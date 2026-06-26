const express = require('express');
const router = express.Router();
const { FragranceNote, ProductFragranceNote } = require('../models');
const { Op } = require('sequelize');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const PermissionService = require('../Services/PermissionService');

const toTitleCase = (str) =>
  str.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

// GET all notes — autocomplete
router.get('/', auth, async (req, res) => {
  try {
    const { q } = req.query;
    const where = q ? { name: { [Op.like]: `%${q.trim()}%` } } : {};
    const notes = await FragranceNote.findAll({ where, order: [['name', 'ASC']] });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fragrance notes' });
  }
});

// GET notes for a product
router.get('/product/:sku', auth, checkPermission('products', 'view'), async (req, res) => {
  try {
    const rows = await ProductFragranceNote.findAll({
      where: { productSku: req.params.sku },
      include: [{ model: FragranceNote, as: 'note' }],
    });
    const result = { top: [], middle: [], base: [] };
    rows.forEach(r => result[r.tier].push({ id: r.note.id, name: r.note.name }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product fragrance notes' });
  }
});

// PUT — replace all notes for a product
// Body: { top: [string], middle: [string], base: [string] }
router.put('/product/:sku', auth, async (req, res) => {
  const canEdit = await PermissionService.hasResourceAction(req.user, 'products', 'edit').catch(() => false);
  const canDataEntry = await PermissionService.hasResourceAction(req.user, 'products', 'dataEntry').catch(() => false);
  if (!canEdit && !canDataEntry) {
    return res.status(403).json({ error: 'Access denied' });
  }
  return putFragranceNotes(req, res);
});

async function putFragranceNotes(req, res) {
  const { sku } = req.params;
  const { top = [], middle = [], base = [] } = req.body;

  try {
    // Normalize all names to title case and dedupe
    const normalize = (arr) => [...new Set(arr.map(toTitleCase).filter(Boolean))];
    const normTop = normalize(top);
    const normMid = normalize(middle);
    const normBase = normalize(base);

    // Upsert note names into master list (case-insensitive lookup, title case stored)
    const allNames = [...new Set([...normTop, ...normMid, ...normBase])];
    const noteIdMap = {};
    for (const name of allNames) {
      const [note] = await FragranceNote.findOrCreate({
        where: { name },
        defaults: { name },
      });
      noteIdMap[name] = note.id;
    }

    // Replace all rows for this SKU
    await ProductFragranceNote.destroy({ where: { productSku: sku } });

    const rows = [];
    [['top', normTop], ['middle', normMid], ['base', normBase]].forEach(([tier, names]) => {
      names.forEach(name => {
        if (noteIdMap[name]) rows.push({ productSku: sku, noteId: noteIdMap[name], tier });
      });
    });

    if (rows.length) await ProductFragranceNote.bulkCreate(rows);

    res.json({ message: 'Fragrance notes saved', count: rows.length });
  } catch (err) {
    console.error('Save fragrance notes error:', err);
    res.status(500).json({ error: 'Failed to save fragrance notes' });
  }
}

module.exports = router;

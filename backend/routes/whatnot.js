const express = require('express');
const router = express.Router();
const { Products, ProductDetails, WhatnotLog, WhatnotShow } = require('../models');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { Op } = require('sequelize');

const MONTH_NAME_TO_INDEX = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

const getShowSortTimestamp = (show) => {
  const rawName = String(show?.name || '').trim();
  const match = rawName.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{1,2})-(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return new Date(show?.createdAt || 0).getTime() || 0;
  }

  const day = Number(match[1]);
  const monthIndex = MONTH_NAME_TO_INDEX[String(match[2] || '').toLowerCase()];
  let hour = Number(match[3]);
  const minute = Number(match[4]);
  const meridiem = String(match[5] || '').toUpperCase();
  const fallbackYear = new Date(show?.createdAt || Date.now()).getFullYear();

  if (!Number.isInteger(day) || monthIndex === undefined || !Number.isInteger(hour) || !Number.isInteger(minute)) {
    return new Date(show?.createdAt || 0).getTime() || 0;
  }

  if (meridiem === 'AM') {
    if (hour === 12) hour = 0;
  } else if (meridiem === 'PM' && hour !== 12) {
    hour += 12;
  }

  return new Date(fallbackYear, monthIndex, day, hour, minute, 0, 0).getTime();
};

// Get available Whatnot shows
router.get('/shows', auth, checkPermission('whatnot', 'view'), async (req, res) => {
  try {
    const shows = await WhatnotShow.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC'], ['name', 'ASC']]
    });

    const sortedShows = [...shows].sort((left, right) => {
      const timeDiff = getShowSortTimestamp(right) - getShowSortTimestamp(left);
      if (timeDiff !== 0) return timeDiff;
      return String(left.name || '').localeCompare(String(right.name || ''));
    });

    res.json(sortedShows);
  } catch (error) {
    console.error('Error fetching whatnot shows:', error);
    res.status(500).json({ error: 'Failed to fetch whatnot shows' });
  }
});

// Create a new Whatnot show (admin/create permission only)
router.post('/shows', auth, checkPermission('whatnot', 'create'), async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const [show] = await WhatnotShow.findOrCreate({
      where: {
        name: name.trim()
      },
      defaults: {
        name: name.trim(),
        isActive: true,
        createdBy: req.user ? String(req.user.id) : null
      }
    });

    res.status(201).json(show);
  } catch (error) {
    console.error('Error creating whatnot show:', error);
    res.status(500).json({ error: 'Failed to create whatnot show' });
  }
});

// Old Whatnot barcode scan (C-3, approved 2026-11-24): the page is no longer used, so the scan no longer changes stock.
// It lowered stock by 1 per scan from an unlocked read and wrote the result as an absolute value, which could lose
// concurrent deductions. Whatnot sales are handled by Whatnot fulfillment.
router.post('/search-barcode', auth, checkPermission('whatnot', 'view'), (req, res) => {
  res.status(410).json({
    success: false,
    message: 'The old Whatnot barcode scan has been turned off and no longer changes stock. Use Whatnot fulfillment.',
  });
});

// Get Whatnot logs
router.get('/logs', auth, checkPermission('whatnot', 'view'), async (req, res) => {
  try {
    const { showId, limit } = req.query;
    const where = {};

    if (showId) {
      where.whatnotShowId = showId;
    }

    const parsedLimit = Number(limit);
    const rowLimit = Number.isNaN(parsedLimit) ? 100 : Math.min(parsedLimit, 500);

    const logs = await WhatnotLog.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: rowLimit
    });

    const skus = [
      ...new Set(
        logs
          .map((log) => log.sku)
          .filter((sku) => typeof sku === 'string' && sku.length > 0)
      ),
    ];

    let productsBySku = {};
    if (skus.length > 0) {
      const products = await Products.findAll({
        where: {
          sku: {
            [Op.in]: skus,
          },
        },
        include: [{
          model: ProductDetails,
          required: false,
          attributes: ['tester']
        }]
      });

      productsBySku = products.reduce((acc, product) => {
        acc[product.sku] = product;
        return acc;
      }, {});
    }

    const enrichedLogs = logs.map((log) => {
      const plain = log.toJSON();
      return {
        ...plain,
        product: plain.sku ? productsBySku[plain.sku] || null : null,
      };
    });

    res.json(enrichedLogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 

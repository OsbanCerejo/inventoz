const express = require("express");
const router = express.Router();
const { BarcodeScan } = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

// Save a barcode scan
router.post("/", auth, checkPermission('barcodeScan', 'create'), async (req, res) => {
  try {
    const { barcode } = req.body;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    // Create scan record with current timestamp (will be stored in local time)
    const scan = await BarcodeScan.create({
      barcode: barcode.trim(),
      scannedAt: new Date() // Sequelize will handle timezone conversion based on DB config
    });

    res.json({ 
      success: true, 
      scan: {
        id: scan.id,
        barcode: scan.barcode,
        scannedAt: scan.scannedAt
      }
    });
  } catch (error) {
    console.error("Error saving barcode scan:", error);
    res.status(500).json({ error: "Failed to save barcode scan" });
  }
});

// Search for scans by barcode number
router.get("/search/:barcode", auth, checkPermission('barcodeScan', 'view'), async (req, res) => {
  try {
    const { barcode } = req.params;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    // Find all scans for this barcode, ordered by most recent first
    const scans = await BarcodeScan.findAll({
      where: {
        barcode: barcode.trim()
      },
      order: [['scannedAt', 'DESC']]
    });

    res.json({ 
      success: true, 
      barcode: barcode.trim(),
      count: scans.length,
      scans: scans.map(scan => ({
        id: scan.id,
        barcode: scan.barcode,
        scannedAt: scan.scannedAt
      }))
    });
  } catch (error) {
    console.error("Error searching barcode scans:", error);
    res.status(500).json({ error: "Failed to search barcode scans" });
  }
});

// Get all scans (optional, for admin viewing)
router.get("/", auth, checkPermission('barcodeScan', 'view'), async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    const scans = await BarcodeScan.findAll({
      order: [['scannedAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({ 
      success: true, 
      count: scans.length,
      scans: scans.map(scan => ({
        id: scan.id,
        barcode: scan.barcode,
        scannedAt: scan.scannedAt
      }))
    });
  } catch (error) {
    console.error("Error fetching barcode scans:", error);
    res.status(500).json({ error: "Failed to fetch barcode scans" });
  }
});

module.exports = router;


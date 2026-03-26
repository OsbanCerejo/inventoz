const express = require('express');
const router = express.Router();
const { Products, ProductDetails, WhatnotLog, WhatnotShow } = require('../models');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { Op } = require('sequelize');
const StockUpdateService = require('../Services/StockUpdateService');

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

// Helper function to determine search type
const determineSearchType = async (barcode) => {
  // First check if this barcode exists as a UPC
  const upcProduct = await Products.findOne({
    where: { upc: barcode }
  });
  
  if (upcProduct) {
    return 'UPC';
  }

  // Then check if it exists as a SKU
  const skuProduct = await Products.findOne({
    where: { sku: barcode }
  });

  return skuProduct ? 'SKU' : null;
};

// Search product by barcode
router.post('/search-barcode', auth, checkPermission('whatnot', 'view'), async (req, res) => {
  try {
    const { barcode, reduceQuantity, isMultipleSelection, showId } = req.body;
    if (!barcode) {
      return res.status(400).json({ success: false, message: 'Barcode is required' });
    }
    if (!showId) {
      return res.status(400).json({ success: false, message: 'Please select a show before scanning' });
    }

    const selectedShow = await WhatnotShow.findOne({
      where: {
        id: showId,
        isActive: true
      }
    });

    if (!selectedShow) {
      return res.status(400).json({ success: false, message: 'Selected show is invalid or inactive' });
    }

    // Search for products with matching UPC or SKU
    const products = await Products.findAll({
      where: {
        [Op.or]: [
          { upc: barcode },
          { sku: barcode }
        ]
      }
    });

    // Create initial log entry
    const logEntry = await WhatnotLog.create({
      barcode,
      searchType: isMultipleSelection ? 'UPC' : await determineSearchType(barcode),
      status: products.length === 0 ? 'not_found' : products.length === 1 ? 'found' : 'multiple_found',
      sku: products.length > 0 ? products[0].sku : null,
      userId: req.user.id.toString(),
      whatnotShowId: selectedShow.id
    });

    if (products.length === 0) {
      return res.json({ 
        success: true,
        found: false, 
        message: 'No products found with this barcode' 
      });
    }

    // If reduceQuantity is true, reduce the quantity for the product with matching SKU
    if (reduceQuantity) {
      const product = products.find(p => p.sku === barcode);
      if (product) {
        const previousQuantity = product.quantity;
        const newQuantity = Math.max(-9999, previousQuantity - 1);
        
        try {
          await StockUpdateService.updateProductQuantity(product.sku, newQuantity);
          
          // Get updated product details
          const updatedProduct = await Products.findByPk(product.sku);
          
          // Update log with quantity changes
          await logEntry.update({
            previousQuantity,
            newQuantity,
            sku: product.sku
          });
          
          return res.json({
            success: true,
            found: true,
            product: updatedProduct
          });
        } catch (error) {
          // Update log with error
          await logEntry.update({
            errors: error.message
          });
          
          console.error('Error updating quantity:', error);
          return res.status(500).json({ success: false, message: 'Error updating quantity' });
        }
      }
    }

    if (products.length === 1) {
      const product = products[0];
      const previousQuantity = product.quantity;
      const newQuantity = Math.max(-9999, previousQuantity - 1);
      
      try {
        await StockUpdateService.updateProductQuantity(product.sku, newQuantity);
        
        // Get updated product details
        const updatedProduct = await Products.findByPk(product.sku);
        
        // Update log with quantity changes
        await logEntry.update({
          previousQuantity,
          newQuantity,
          sku: product.sku
        });
        
        return res.json({
          success: true,
          found: true,
          product: updatedProduct
        });
      } catch (error) {
        // Update log with error
        await logEntry.update({
          errors: error.message
        });
        
        console.error('Error updating quantity:', error);
        return res.status(500).json({ success: false, message: 'Error updating quantity' });
      }
    }

    // If multiple products found, return them all
    return res.json({
      success: true,
      found: true,
      multiple: true,
      products: products
    });
  } catch (error) {
    console.error('Error searching barcode:', error);
    return res.status(500).json({ success: false, message: 'Error searching barcode' });
  }
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

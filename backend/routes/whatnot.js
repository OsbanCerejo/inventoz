const express = require('express');
const router = express.Router();
const { Products, WhatnotLog, WhatnotShow } = require('../models');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { Op } = require('sequelize');
const StockUpdateService = require('../Services/StockUpdateService');

// Get available Whatnot shows
router.get('/shows', auth, checkPermission('whatnot', 'view'), async (req, res) => {
  try {
    const shows = await WhatnotShow.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC'], ['name', 'ASC']]
    });

    res.json(shows);
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
    const logs = await WhatnotLog.findAll({
      include: [{
        model: Products,
        as: 'product'
      }, {
        model: WhatnotShow,
        as: 'show'
      }],
      order: [['createdAt', 'DESC']],
      limit: 100
    });
    
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 

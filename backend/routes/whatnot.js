const express = require('express');
const router = express.Router();
const { Settings, Products, WhatnotLog } = require('../models');
const { Op } = require('sequelize');
const axios = require('axios');
const StockUpdateService = require('../services/StockUpdateService');

// Verify Whatnot menu password
router.post('/verify-password', async (req, res) => {
  try {
    const { password } = req.body;
    const settings = await Settings.findOne();
    
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    
    if (settings.whatnot_menu_pass === password) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'Invalid password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Search product by barcode
router.post('/search-barcode', async (req, res) => {
  try {
    const { barcode, reduceQuantity } = req.body;
    if (!barcode) {
      return res.status(400).json({ success: false, message: 'Barcode is required' });
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

    // Create log entry for the search
    await WhatnotLog.create({
      barcode,
      searchType: barcode.length === 12 ? 'UPC' : 'SKU',
      status: products.length === 0 ? 'not_found' : products.length === 1 ? 'found' : 'multiple_found',
      sku: products.length > 0 ? products[0].sku : null,
      quantityReduced: false
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
        const newQuantity = Math.max(0, product.quantity - 1);
        try {
          await StockUpdateService.updateProductQuantity(product.sku, newQuantity);
          
          // Get updated product details
          const updatedProduct = await Products.findByPk(product.sku);
          
          // Update log to mark quantity as reduced
          await WhatnotLog.update(
            { quantityReduced: true },
            { 
              where: { 
                barcode,
                sku: product.sku
              },
              order: [['createdAt', 'DESC']],
              limit: 1
            }
          );
          
          return res.json({
            success: true,
            found: true,
            product: updatedProduct
          });
        } catch (error) {
          console.error('Error updating quantity:', error);
          return res.status(500).json({ success: false, message: 'Error updating quantity' });
        }
      }
    }

    if (products.length === 1) {
      const product = products[0];
      const newQuantity = Math.max(0, product.quantity - 1);
      
      try {
        await StockUpdateService.updateProductQuantity(product.sku, newQuantity);
        
        // Get updated product details
        const updatedProduct = await Products.findByPk(product.sku);
        
        // Update log to mark quantity as reduced
        await WhatnotLog.update(
          { quantityReduced: true },
          { 
            where: { 
              barcode,
              sku: product.sku
            },
            order: [['createdAt', 'DESC']],
            limit: 1
          }
        );
        
        return res.json({
          success: true,
          found: true,
          product: updatedProduct
        });
      } catch (error) {
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
router.get('/logs', async (req, res) => {
  try {
    const logs = await WhatnotLog.findAll({
      include: [{
        model: Products,
        as: 'product'
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
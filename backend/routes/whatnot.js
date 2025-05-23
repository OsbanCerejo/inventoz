const express = require('express');
const router = express.Router();
const { Settings, Products, WhatnotLog } = require('../models');
const { Op } = require('sequelize');
const axios = require('axios');
const StockUpdateService = require('../services/StockUpdateService');

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

// Verify Whatnot credentials
router.post('/verify-password', async (req, res) => {
  try {
    const { username, password } = req.body;
    const settings = await Settings.findOne({
      where: {
        whatnot_username: username,
        whatnot_password: password
      }
    });
    
    if (!settings) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    res.json({ 
      success: true,
      userId: settings.id // Return the actual ID from the settings table
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Search product by barcode
router.post('/search-barcode', async (req, res) => {
  try {
    const { barcode, reduceQuantity, userId, isMultipleSelection } = req.body;
    if (!barcode) {
      return res.status(400).json({ success: false, message: 'Barcode is required' });
    }

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User ID is required' });
    }

    // Verify the user exists
    const user = await Settings.findByPk(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid user ID' });
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
      userId: userId
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
        const newQuantity = Math.max(0, previousQuantity - 1);
        
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
      const newQuantity = Math.max(0, previousQuantity - 1);
      
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
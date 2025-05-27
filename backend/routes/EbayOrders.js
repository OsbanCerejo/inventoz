const express = require('express');
const router = express.Router();
const ebayService = require('../Services/ebayService');
const { Products, EbayOrders } = require('../models');

// Manual sync orders endpoint
router.get('/sync', async (req, res) => {
    try {
        console.log('Starting manual order sync...');
        
        // Get orders from eBay API
        const orders = await ebayService.getOrders();
        let processedCount = 0;
        let errorCount = 0;
        
        for (const order of orders) {
            try {
                await ebayService.processOrder(order);
                processedCount++;
            } catch (error) {
                console.error(`Error processing order ${order.orderId}:`, error);
                errorCount++;
            }
        }
        
        res.json({
            success: true,
            message: `Order sync completed. Processed ${processedCount} items with ${errorCount} errors.`
        });
    } catch (error) {
        console.error('Error in manual order sync:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sync orders',
            error: error.message
        });
    }
});

module.exports = router; 
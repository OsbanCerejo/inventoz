const cron = require('node-cron');
const ebayService = require('../Services/ebayService');
const { Products, Sales, EbayOrders } = require('../models');
const { Op } = require('sequelize');

// Schedule the job to run every minute
cron.schedule('* * * * *', async () => {
  try {
    // console.log('Starting order processing cron job...');
    
    // Get all orders from eBay API without time filter
    const orders = await ebayService.getOrders();
    
    for (const order of orders) {
      try {
        await ebayService.processOrder(order);
      } catch (error) {
        console.error(`Error processing order ${order.orderId}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Order processing cron job error:', error.message);
  }
});

module.exports = cron; 
const cron = require('node-cron');
const ebayService = require('../Services/ebayService');
const { Products, Sales, EbayOrders } = require('../models');
const { Op } = require('sequelize');

// Schedule the job to run daily at 1 AM
cron.schedule('0 1 * * *', async () => {
  try {
    console.log('Running daily order processing cron job...');
    
    // Get orders from eBay API
    const orders = await ebayService.getOrders();
    
    for (const order of orders) {
      try {
        await ebayService.processOrder(order);
      } catch (error) {
        console.error(`Error processing order ${order.orderId}:`, error);
      }
    }
    
    console.log('Daily order processing completed');
  } catch (error) {
    console.error('Error in daily order processing:', error);
  }
});

module.exports = cron; 
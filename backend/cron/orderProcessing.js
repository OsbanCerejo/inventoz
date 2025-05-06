const cron = require('node-cron');
const ebayService = require('../Services/ebayService');
const { Products, Sales, EbayOrders } = require('../models');
const { Op } = require('sequelize');

// Schedule the job to run every minute
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000); // 60000 ms = 1 minute
    
    console.log(`Running order processing cron job for orders since ${oneMinuteAgo.toISOString()}`);
    
    // Get orders from eBay API with timestamp filter
    const orders = await ebayService.getOrders({
      startTime: oneMinuteAgo.toISOString(),
      endTime: now.toISOString()
    });
    
    for (const order of orders) {
      try {
        await ebayService.processOrder(order);
      } catch (error) {
        console.error(`Error processing order ${order.orderId}:`, error);
      }
    }
    
    console.log(`Order processing completed for time window ${oneMinuteAgo.toISOString()} to ${now.toISOString()}`);
  } catch (error) {
    console.error('Error in order processing:', error);
  }
});

module.exports = cron; 
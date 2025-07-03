const cron = require('node-cron');
const ebayService = require('../Services/ebayService');

// Schedule the job to run every 30 seconds
cron.schedule('*/30 * * * * *', async () => {
  try {
    // console.log('Starting stock update cron job...');
    const result = await ebayService.processPendingUpdates();
    
    if (!result.success) {
      console.error('Stock update failed:', result.message);
    }
  } catch (error) {
    console.error('Stock update cron job error:', error.message);
  }
});

module.exports = cron; 
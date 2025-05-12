const cron = require('node-cron');
const ebayService = require('../Services/ebayService');

// Schedule the job to run every 30 seconds
cron.schedule('*/30 * * * * *', async () => {
  try {
    const result = await ebayService.processPendingUpdates();
    
    if (!result.success) {
      console.error('Error in stock update:', result.message, result.errors);
    }
  } catch (error) {
    console.error('Error in stock update cron job:', error);
  }
});

module.exports = cron; 
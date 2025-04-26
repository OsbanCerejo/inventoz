const cron = require('node-cron');
const ebayService = require('../services/ebayService');

// Schedule the job to run every minute
cron.schedule('* * * * *', async () => {
  try {
    console.log('Running stock update cron job...');
    
    const result = await ebayService.processPendingUpdates();
    
    if (result.success) {
      console.log(result.message);
    } else {
      console.error('Error in stock update:', result.message, result.errors);
    }

    console.log('Stock update cron job completed');
  } catch (error) {
    console.error('Error in stock update cron job:', error);
  }
});

module.exports = cron; 
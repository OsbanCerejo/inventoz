const cron = require("node-cron");
const { runDailyReminderSweep } = require("../Services/InvoiceTrackerPaymentReminderService");

const reminderCronExpression = process.env.INVOICE_TRACKER_REMINDER_CRON || "0 9 * * *";
const reminderTimezone = process.env.INVOICE_TRACKER_REMINDER_TIMEZONE || "America/New_York";

cron.schedule(
  reminderCronExpression,
  async () => {
    try {
      const result = await runDailyReminderSweep();
      console.log(
        `Invoice tracker payment reminder job finished. processed=${result.processedInvoices} sent=${result.sentCount} skipped=${result.skippedCount} failed=${result.failedCount}`
      );
    } catch (error) {
      console.error("Invoice tracker payment reminder cron job error:", error.message);
    }
  },
  {
    timezone: reminderTimezone,
  }
);

module.exports = cron;

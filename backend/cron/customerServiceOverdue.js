const cron = require("node-cron");
const { runOverdueSweep } = require("../Services/CustomerServiceNotificationService");

const cronExpression = process.env.CS_OVERDUE_CRON || "*/30 * * * *";
const timezone = process.env.CS_OVERDUE_TIMEZONE || "America/New_York";

cron.schedule(
  cronExpression,
  async () => {
    try {
      const result = await runOverdueSweep();
      if (result.processed > 0) {
        console.log(`[CS Overdue] Processed ${result.processed} overdue ticket(s).`);
      }
    } catch (err) {
      console.error("[CS Overdue] Cron job error:", err.message);
    }
  },
  { timezone }
);

module.exports = cron;

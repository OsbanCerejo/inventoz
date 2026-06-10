const cron = require('node-cron');
const { sequelize, SkuSalesSummary } = require('../models');

const FULFILLED_SCAN_CONDITION = (alias) => `
  ${alias}.result = 'matched'
  AND ${alias}.productSku IS NOT NULL
  AND ${alias}.productSku <> ''
  AND ${alias}.previousQuantity IS NOT NULL
  AND ${alias}.newQuantity = ${alias}.previousQuantity - 1
`;

async function aggregateSalesSummary() {
  const startedAt = Date.now();
  console.log('[salesSummary] Starting aggregation...');

  try {
    const now = new Date();

    // ── TikTok ─────────────────────────────────────────────────────────────
    const [tiktokRows] = await sequelize.query(`
      SELECT
        tss.productSku   AS sku,
        'tiktok'         AS platform,
        YEAR(tss.createdAt)  AS year,
        MONTH(tss.createdAt) AS month,
        COUNT(*)         AS qty
      FROM \`tiktokShipmentScans\` tss
      WHERE ${FULFILLED_SCAN_CONDITION('tss')}
      GROUP BY tss.productSku, YEAR(tss.createdAt), MONTH(tss.createdAt)
    `);

    // ── Whatnot ────────────────────────────────────────────────────────────
    const [whatnotRows] = await sequelize.query(`
      SELECT
        wss.productSku   AS sku,
        'whatnot'        AS platform,
        YEAR(wss.createdAt)  AS year,
        MONTH(wss.createdAt) AS month,
        COUNT(*)         AS qty
      FROM \`whatnotShipmentScans\` wss
      WHERE ${FULFILLED_SCAN_CONDITION('wss')}
      GROUP BY wss.productSku, YEAR(wss.createdAt), MONTH(wss.createdAt)
    `);

    // ── eBay ───────────────────────────────────────────────────────────────
    const [ebayRows] = await sequelize.query(`
      SELECT
        eo.sku           AS sku,
        'ebay'           AS platform,
        YEAR(eo.creationDate)  AS year,
        MONTH(eo.creationDate) AS month,
        SUM(eo.quantity) AS qty
      FROM \`EbayOrders\` eo
      WHERE eo.orderStatus != 'CANCELLED'
        AND eo.sku IS NOT NULL
        AND eo.sku <> ''
      GROUP BY eo.sku, YEAR(eo.creationDate), MONTH(eo.creationDate)
    `);

    // ── Walmart ────────────────────────────────────────────────────────────
    const [walmartRows] = await sequelize.query(`
      SELECT
        ms.sku            AS sku,
        'walmart'         AS platform,
        YEAR(ms.saleDate)  AS year,
        MONTH(ms.saleDate) AS month,
        SUM(ms.quantity)  AS qty
      FROM \`marketplaceSales\` ms
      WHERE ms.marketplace = 'walmart'
        AND ms.sku IS NOT NULL
        AND ms.sku <> ''
      GROUP BY ms.sku, YEAR(ms.saleDate), MONTH(ms.saleDate)
    `);

    const allRows = [...tiktokRows, ...whatnotRows, ...ebayRows, ...walmartRows].map((r) => ({
      sku: String(r.sku),
      platform: r.platform,
      year: Number(r.year),
      month: Number(r.month),
      qty: Number(r.qty) || 0,
      updatedAt: now,
    }));

    if (allRows.length === 0) {
      console.log('[salesSummary] No rows to upsert. Done.');
      return;
    }

    // Upsert in batches of 1000 to avoid huge single queries
    const BATCH = 1000;
    for (let i = 0; i < allRows.length; i += BATCH) {
      await SkuSalesSummary.bulkCreate(allRows.slice(i, i + BATCH), {
        updateOnDuplicate: ['qty', 'updatedAt'],
      });
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[salesSummary] Done — ${allRows.length} rows upserted in ${elapsed}s`);
  } catch (err) {
    console.error('[salesSummary] Aggregation failed:', err.message);
  }
}

// Run nightly at 2:00 AM
cron.schedule('0 2 * * *', aggregateSalesSummary, {
  timezone: 'America/New_York',
});

// Export so index.js can trigger a manual run on startup if needed
module.exports = { aggregateSalesSummary };

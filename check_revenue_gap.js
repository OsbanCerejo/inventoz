require('dotenv').config({ path: './backend/.env' });
const { sequelize } = require('./backend/models');

(async () => {
  try {
    const from = '2026-05-01T00:00:00.000Z';
    const to   = '2026-06-01T00:00:00.000Z';

    // 1. Revenue as Inventoz currently calculates it (EXISTS fix applied)
    const [revRows] = await sequelize.query(`
      SELECT
        COUNT(*) AS unitsSold,
        COALESCE(SUM(COALESCE(tss.soldPrice,0)),0) AS revenue
      FROM TikTokShipmentScans tss
      WHERE tss.result = 'matched'
        AND tss.productSku IS NOT NULL AND tss.productSku <> ''
        AND tss.previousQuantity IS NOT NULL
        AND tss.newQuantity = tss.previousQuantity - 1
        AND EXISTS (
          SELECT 1 FROM TikTokShipmentItems _tsi
          WHERE _tsi.tiktokShowId = tss.tiktokShowId
            AND _tsi.importId     = tss.importId
            AND _tsi.shipmentId   = tss.shipmentId
            AND _tsi.placedAt >= :from
            AND _tsi.placedAt  < :to
        )
    `, { replacements: { from, to } });
    console.log('=== Inventoz Revenue (EXISTS fix, May 2026) ===');
    console.log('Units:', revRows[0].unitsSold);
    console.log('Revenue: $' + parseFloat(revRows[0].revenue).toFixed(2));

    // 2. Revenue using OLD join approach (for comparison — shows what was being calculated before)
    const [oldRows] = await sequelize.query(`
      SELECT
        COUNT(*) AS unitsSold,
        COALESCE(SUM(COALESCE(tss.soldPrice,0)),0) AS revenue
      FROM TikTokShipmentScans tss
      JOIN TikTokShipmentItems tsi
        ON tsi.tiktokShowId = tss.tiktokShowId
       AND tsi.importId     = tss.importId
       AND tsi.shipmentId   = tss.shipmentId
      WHERE tss.result = 'matched'
        AND tss.productSku IS NOT NULL AND tss.productSku <> ''
        AND tss.previousQuantity IS NOT NULL
        AND tss.newQuantity = tss.previousQuantity - 1
        AND tsi.placedAt >= :from
        AND tsi.placedAt  < :to
    `, { replacements: { from, to } });
    console.log('\n=== OLD Revenue (JOIN bug, for reference) ===');
    console.log('Units:', oldRows[0].unitsSold);
    console.log('Revenue: $' + parseFloat(oldRows[0].revenue).toFixed(2));

    // 3. Break down by order ID — how many unique shipmentIds in the scans vs CSV
    const [shipRows] = await sequelize.query(`
      SELECT COUNT(DISTINCT CONCAT(tss.tiktokShowId,':',tss.importId,':',tss.shipmentId)) AS uniqueShipments
      FROM TikTokShipmentScans tss
      WHERE tss.result = 'matched'
        AND tss.productSku IS NOT NULL AND tss.productSku <> ''
        AND tss.previousQuantity IS NOT NULL
        AND tss.newQuantity = tss.previousQuantity - 1
        AND EXISTS (
          SELECT 1 FROM TikTokShipmentItems _tsi
          WHERE _tsi.tiktokShowId = tss.tiktokShowId
            AND _tsi.importId     = tss.importId
            AND _tsi.shipmentId   = tss.shipmentId
            AND _tsi.placedAt >= :from
            AND _tsi.placedAt  < :to
        )
    `, { replacements: { from, to } });
    console.log('\n=== Unique orders (shipments) in Inventoz May scans ===');
    console.log('Unique shipments:', shipRows[0].uniqueShipments);

    // 4. Distribution of soldPrice values — are any unusually high?
    const [distRows] = await sequelize.query(`
      SELECT
        CASE
          WHEN tss.soldPrice IS NULL THEN 'null'
          WHEN tss.soldPrice = 0 THEN '$0'
          WHEN tss.soldPrice < 10 THEN '<$10'
          WHEN tss.soldPrice < 50 THEN '$10-50'
          WHEN tss.soldPrice < 100 THEN '$50-100'
          WHEN tss.soldPrice < 200 THEN '$100-200'
          WHEN tss.soldPrice < 500 THEN '$200-500'
          ELSE '$500+'
        END AS bucket,
        COUNT(*) AS cnt,
        SUM(tss.soldPrice) AS total
      FROM TikTokShipmentScans tss
      WHERE tss.result = 'matched'
        AND tss.productSku IS NOT NULL AND tss.productSku <> ''
        AND tss.previousQuantity IS NOT NULL
        AND tss.newQuantity = tss.previousQuantity - 1
        AND EXISTS (
          SELECT 1 FROM TikTokShipmentItems _tsi
          WHERE _tsi.tiktokShowId = tss.tiktokShowId
            AND _tsi.importId     = tss.importId
            AND _tsi.shipmentId   = tss.shipmentId
            AND _tsi.placedAt >= :from
            AND _tsi.placedAt  < :to
        )
      GROUP BY bucket ORDER BY MIN(tss.soldPrice)
    `, { replacements: { from, to } });
    console.log('\n=== soldPrice distribution ===');
    distRows.forEach(r => console.log(`  ${r.bucket}: ${r.cnt} items, $${parseFloat(r.total||0).toFixed(2)}`));

    // 5. Check tsi.soldPrice vs tss.soldPrice — do they match?
    const [priceCompare] = await sequelize.query(`
      SELECT
        COALESCE(SUM(tss.soldPrice),0) AS tss_total,
        COALESCE(SUM(tsi_agg.soldPrice),0) AS tsi_total
      FROM TikTokShipmentScans tss
      JOIN (
        SELECT tiktokShowId, importId, shipmentId, MIN(placedAt) AS placedAt, MIN(soldPrice) AS soldPrice
        FROM TikTokShipmentItems
        GROUP BY tiktokShowId, importId, shipmentId
      ) tsi_agg ON tsi_agg.tiktokShowId = tss.tiktokShowId
               AND tsi_agg.importId = tss.importId
               AND tsi_agg.shipmentId = tss.shipmentId
      WHERE tss.result = 'matched'
        AND tss.productSku IS NOT NULL AND tss.productSku <> ''
        AND tss.previousQuantity IS NOT NULL
        AND tss.newQuantity = tss.previousQuantity - 1
        AND tsi_agg.placedAt >= :from
        AND tsi_agg.placedAt < :to
    `, { replacements: { from, to } });
    console.log('\n=== tss.soldPrice vs tsi.soldPrice comparison ===');
    console.log('Sum of tss.soldPrice (scan-level price):', '$' + parseFloat(priceCompare[0].tss_total).toFixed(2));
    console.log('Sum of tsi.soldPrice (order-level price):', '$' + parseFloat(priceCompare[0].tsi_total).toFixed(2));

    await sequelize.close();
  } catch(e) {
    console.error(e.message);
    process.exit(1);
  }
})();

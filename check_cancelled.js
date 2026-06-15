require('dotenv').config({ path: './backend/.env' });
const { sequelize } = require('./backend/models');
const ids = require('C:/Users/11ame/Downloads/cancelled_ids.json');

(async () => {
  try {
    const [tsiRows] = await sequelize.query(
      'SELECT shipmentId, status, itemCategory FROM TikTokShipmentItems WHERE shipmentId IN (:ids) LIMIT 20',
      { replacements: { ids } }
    );
    console.log('Cancelled orders found in TikTokShipmentItems:', tsiRows.length);
    if (tsiRows.length) console.log('Sample:', JSON.stringify(tsiRows.slice(0,5)));

    const [tssRows] = await sequelize.query(
      `SELECT tss.shipmentId, tss.result, tss.productSku, tss.soldPrice,
              tss.previousQuantity, tss.newQuantity
       FROM TikTokShipmentScans tss
       WHERE tss.shipmentId IN (:ids)
         AND tss.result = 'matched'
         AND tss.productSku IS NOT NULL AND tss.productSku <> ''
         AND tss.previousQuantity IS NOT NULL
         AND tss.newQuantity = tss.previousQuantity - 1`,
      { replacements: { ids } }
    );
    console.log('Cancelled orders with fulfilled scans:', tssRows.length);
    if (tssRows.length > 0) {
      const revenue = tssRows.reduce((s, r) => s + parseFloat(r.soldPrice || 0), 0);
      console.log('Revenue counted from cancelled orders: $' + revenue.toFixed(2));
      console.log('Sample:', JSON.stringify(tssRows.slice(0, 5)));
    } else {
      console.log('CONFIRMED: Zero cancelled orders were scanned. No revenue inflation from cancellations.');
    }

    await sequelize.close();
  } catch(e) {
    console.error(e.message);
    process.exit(1);
  }
})();

const { Op } = require('sequelize');
const {
  Products,
  LmManagedSku,
  LmMarketplaceMapping,
  LmSyncJob,
} = require('../models');

// Every 5 minutes: compare Inventoz qty against mapping.currentQty for all
// active auto-sync mappings. If different, enqueue a qty_update job.
// Zero impact on any other part of Inventoz — only reads Products.quantity,
// never writes to it. All writes go to LM tables only.
async function runInventorySync() {
  try {
    // Find all mappings where both the managed SKU and the mapping have sync enabled
    const mappings = await LmMarketplaceMapping.findAll({
      where: {
        marketplace: 'tiktok',
        listingStatus: { [Op.ne]: 'inactive' },
        marketplaceProductId: { [Op.ne]: null },
        marketplaceSkuId: { [Op.ne]: null },
      },
      include: [{
        model: LmManagedSku,
        as: 'managedSku',
        where: { syncEnabled: true },
        attributes: ['sku', 'syncEnabled'],
      }],
    });

    if (mappings.length === 0) return;

    // Collect all SKUs and fetch quantities in one query
    const skus = [...new Set(mappings.map(m => m.managedSku.sku))];
    const products = await Products.findAll({
      where: { sku: skus },
      attributes: ['sku', 'quantity'],
    });
    const qtyMap = Object.fromEntries(products.map(p => [p.sku, p.quantity || 0]));

    let enqueued = 0;

    for (const mapping of mappings) {
      const inventozQty = qtyMap[mapping.managedSku.sku] ?? 0;

      // Skip if qty hasn't changed
      if (inventozQty === mapping.currentQty) continue;

      // Skip if there's already a pending or processing qty_update for this mapping
      const existingJob = await LmSyncJob.findOne({
        where: {
          mappingId: mapping.id,
          jobType: 'qty_update',
          status: { [Op.in]: ['pending', 'processing'] },
        },
      });
      if (existingJob) continue;

      await LmSyncJob.create({
        mappingId: mapping.id,
        jobType: 'qty_update',
        targetQty: inventozQty,
        status: 'pending',
      });

      enqueued++;
    }

    if (enqueued > 0) {
      console.log(`[lmInventorySync] Enqueued ${enqueued} qty_update job(s)`);
    }
  } catch (err) {
    console.error('[lmInventorySync] Error:', err.message);
  }
}

module.exports = { runInventorySync };

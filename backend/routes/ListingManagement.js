const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { auth } = require('../middleware/auth');
const {
  Products,
  LmManagedSku,
  LmMarketplaceMapping,
  LmInventoryEvent,
  LmTiktokOrder,
  LmSyncJob,
  LmTiktokCredential,
  LmPriceHistory,
  LmQtyHistory,
} = require('../models');
const tiktokApi = require('../Services/TiktokShopApiClient');

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getActiveCredential(shopId) {
  const cred = await LmTiktokCredential.findOne({ where: { shopId, isActive: true } });
  if (!cred) throw new Error(`No active credentials for shop ${shopId}`);

  // Auto-refresh if access token expires within 30 minutes
  if (cred.accessTokenExpiry && cred.accessTokenExpiry < new Date(Date.now() + 30 * 60 * 1000)) {
    const refreshed = await tiktokApi.refreshToken(cred.refreshToken);
    const accessExpiry = new Date(Date.now() + (refreshed.access_token_expire_in || 86400) * 1000);
    const refreshExpiry = new Date(Date.now() + (refreshed.refresh_token_expire_in || 2592000) * 1000);
    await cred.update({
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      accessTokenExpiry: accessExpiry,
      refreshTokenExpiry: refreshExpiry,
    });
    cred.accessToken = refreshed.access_token;
  }

  return cred;
}

function pendingSalesQuery(sku) {
  return LmTiktokOrder.sum('quantity', {
    where: { sku, deductedAt: null, cancelledAt: null },
  }).then(v => v || 0);
}

// ─── Managed SKUs ────────────────────────────────────────────────────────────

// GET /listing-management/skus  — list all managed SKUs with dashboard data
router.get('/skus', auth, async (req, res) => {
  try {
    const managed = await LmManagedSku.findAll({
      include: [
        {
          model: LmMarketplaceMapping,
          as: 'mappings',
          where: { marketplace: 'tiktok' },
          required: false,
        },
      ],
    });

    // Fetch product data separately to avoid association join issues
    const skuList = managed.map(ms => ms.sku);
    const productList = skuList.length > 0
      ? await Products.findAll({
          where: { sku: skuList },
          attributes: ['sku', 'itemName', 'brand', 'quantity', 'strength', 'sizeOz', 'sizeMl'],
        })
      : [];
    const productMap = Object.fromEntries(productList.map(p => [p.sku, p]));

    const rows = await Promise.all(managed.map(async (ms) => {
      const product = productMap[ms.sku] || null;
      const mapping = ms.mappings && ms.mappings[0];
      const pendingSales = await pendingSalesQuery(ms.sku);
      const effectiveAvailable = (product?.quantity || 0) - pendingSales;
      const stockAlert = mapping && mapping.currentQty > effectiveAvailable;

      return {
        id: ms.id,
        sku: ms.sku,
        itemName: product?.itemName,
        brand: product?.brand,
        strength: product?.strength,
        sizeOz: product?.sizeOz,
        sizeMl: product?.sizeMl,
        inventozQty: product?.quantity || 0,
        pendingSales,
        effectiveAvailable,
        isGenericAuction: ms.isGenericAuction,
        syncEnabled: ms.syncEnabled,
        mapping: mapping ? {
          id: mapping.id,
          shopId: mapping.shopId,
          marketplaceProductId: mapping.marketplaceProductId,
          marketplaceSkuId: mapping.marketplaceSkuId,
          currentQty: mapping.currentQty,
          lastConfirmedQty: mapping.lastConfirmedQty,
          currentPrice: mapping.currentPrice,
          listingStatus: mapping.listingStatus,
          syncEnabled: mapping.syncEnabled,
          lastSyncAt: mapping.lastSyncAt,
          lastSyncStatus: mapping.lastSyncStatus,
        } : null,
        stockAlert,
      };
    }));

    res.json(rows);
  } catch (err) {
    console.error('LM skus error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /listing-management/skus  — enroll a SKU
router.post('/skus', auth, async (req, res) => {
  try {
    const { sku, isGenericAuction = false, notes } = req.body;
    if (!sku) return res.status(400).json({ error: 'sku is required' });

    const product = await Products.findByPk(sku);
    if (!product) return res.status(404).json({ error: `SKU ${sku} not found` });

    const [ms, created] = await LmManagedSku.findOrCreate({
      where: { sku },
      defaults: { sku, isGenericAuction, notes, addedBy: req.user.id },
    });

    res.status(created ? 201 : 200).json(ms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /listing-management/skus/:id  — update enrollment settings
router.patch('/skus/:id', auth, async (req, res) => {
  try {
    const ms = await LmManagedSku.findByPk(req.params.id);
    if (!ms) return res.status(404).json({ error: 'Not found' });

    const { isGenericAuction, syncEnabled, notes } = req.body;
    const updates = {};
    if (isGenericAuction !== undefined) updates.isGenericAuction = isGenericAuction;
    if (syncEnabled !== undefined) updates.syncEnabled = syncEnabled;
    if (notes !== undefined) updates.notes = notes;

    await ms.update(updates);
    res.json(ms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /listing-management/skus/:id  — remove from management completely
// Deletes the SKU and all related mappings/jobs. Does NOT touch TikTok or Inventoz products.
router.delete('/skus/:id', auth, async (req, res) => {
  try {
    const ms = await LmManagedSku.findByPk(req.params.id);
    if (!ms) return res.status(404).json({ error: 'Not found' });

    // Get all mapping IDs for this SKU so we can clean up jobs
    const mappings = await LmMarketplaceMapping.findAll({ where: { managedSkuId: ms.id }, attributes: ['id'] });
    const mappingIds = mappings.map(m => m.id);

    if (mappingIds.length > 0) {
      await LmSyncJob.destroy({ where: { mappingId: mappingIds } });
      await LmMarketplaceMapping.destroy({ where: { id: mappingIds } });
    }

    await ms.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Marketplace Mappings ────────────────────────────────────────────────────

// POST /listing-management/mappings  — create a mapping (link SKU to TikTok listing)
router.post('/mappings', auth, async (req, res) => {
  try {
    const {
      managedSkuId, shopId, marketplaceProductId, marketplaceSkuId,
      sellerSku, warehouseId, currentQty, currentPrice,
    } = req.body;

    if (!managedSkuId || !shopId) {
      return res.status(400).json({ error: 'managedSkuId and shopId are required' });
    }

    const ms = await LmManagedSku.findByPk(managedSkuId);
    if (!ms) return res.status(404).json({ error: 'Managed SKU not found' });

    const mapping = await LmMarketplaceMapping.create({
      managedSkuId, shopId, marketplaceProductId, marketplaceSkuId,
      sellerSku, warehouseId,
      currentQty: currentQty || 0,
      desiredQty: currentQty || 0,
      currentPrice: currentPrice || null,
      marketplace: 'tiktok',
      syncEnabled: true,
    });

    res.status(201).json(mapping);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /listing-management/mappings/:id  — update mapping settings
router.patch('/mappings/:id', auth, async (req, res) => {
  try {
    const mapping = await LmMarketplaceMapping.findByPk(req.params.id);
    if (!mapping) return res.status(404).json({ error: 'Not found' });

    const allowed = ['syncEnabled', 'listingStatus', 'warehouseId', 'sellerSku', 'marketplaceSkuId', 'marketplaceProductId'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await mapping.update(updates);
    res.json(mapping);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Manual quantity/price push ──────────────────────────────────────────────

// POST /listing-management/mappings/:id/push-qty
router.post('/mappings/:id/push-qty', auth, async (req, res) => {
  try {
    const { qty, reason } = req.body;
    if (qty === undefined || qty === null) return res.status(400).json({ error: 'qty is required' });

    const mapping = await LmMarketplaceMapping.findByPk(req.params.id, {
      include: [{ model: LmManagedSku, as: 'managedSku' }],
    });
    if (!mapping) return res.status(404).json({ error: 'Mapping not found' });

    const cred = await getActiveCredential(mapping.shopId);
    if (!cred.shopCipher) return res.status(400).json({ error: 'Shop cipher not set — reconnect TikTok Shop to fix' });
    await tiktokApi.updateInventory(cred.accessToken, cred.shopCipher, mapping.marketplaceProductId, mapping.marketplaceSkuId, mapping.warehouseId, qty);

    const oldQty = mapping.currentQty;
    const product = await Products.findOne({ where: { sku: mapping.managedSku.sku }, attributes: ['quantity'] });
    const inventozQty = product?.quantity ?? qty;
    await mapping.update({ currentQty: qty, desiredQty: qty, qtyInitialized: true, lastConfirmedQty: inventozQty, lastSyncAt: new Date(), lastSyncStatus: 'ok' });
    await LmQtyHistory.create({ mappingId: mapping.id, oldQty, newQty: qty, reason: reason || 'manual', changedBy: req.user.id });

    res.json({ success: true, currentQty: qty });
  } catch (err) {
    console.error('push-qty error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /listing-management/mappings/:id/push-price
router.post('/mappings/:id/push-price', auth, async (req, res) => {
  try {
    const { price } = req.body;
    if (!price) return res.status(400).json({ error: 'price is required' });

    const mapping = await LmMarketplaceMapping.findByPk(req.params.id);
    if (!mapping) return res.status(404).json({ error: 'Mapping not found' });

    // Price update — enqueue as sync job (will be executed by worker)
    const job = await LmSyncJob.create({
      mappingId: mapping.id,
      jobType: 'price_update',
      targetPrice: price,
      status: 'pending',
    });

    const oldPrice = mapping.currentPrice;
    await LmPriceHistory.create({ mappingId: mapping.id, oldPrice, newPrice: price, changedBy: req.user.id });

    res.json({ success: true, jobId: job.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── TikTok product import ───────────────────────────────────────────────────

// GET /listing-management/tiktok/products?shopId=xxx&pageToken=xxx&keyword=xxx
// Fetches the live TikTok product catalog for a connected shop
router.get('/tiktok/products', auth, async (req, res) => {
  try {
    const { shopId, pageToken, keyword } = req.query;
    if (!shopId) return res.status(400).json({ error: 'shopId is required' });

    const cred = await getActiveCredential(shopId);
    if (!cred.shopCipher) return res.status(400).json({ error: 'Shop cipher not set — reconnect TikTok Shop to fix' });
    const data = await tiktokApi.searchProducts(cred.accessToken, cred.shopCipher, pageToken || null, keyword || null);
    res.json(data);
  } catch (err) {
    console.error('TikTok products error:', err.message);
    if (err.tiktokData) console.error('TikTok error body:', JSON.stringify(err.tiktokData));
    res.status(500).json({ error: err.message, tiktokCode: err.tiktokCode });
  }
});

// GET /listing-management/tiktok/products/:productId?shopId=xxx
// Get one product's full detail including SKUs and warehouse IDs
router.get('/tiktok/products/:productId', auth, async (req, res) => {
  try {
    const { shopId } = req.query;
    if (!shopId) return res.status(400).json({ error: 'shopId is required' });

    const cred = await getActiveCredential(shopId);
    if (!cred.shopCipher) return res.status(400).json({ error: 'Shop cipher not set — reconnect TikTok Shop to fix' });
    const data = await tiktokApi.getProduct(cred.accessToken, cred.shopCipher, req.params.productId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Inventory events log ────────────────────────────────────────────────────

// GET /listing-management/events?sku=xxx&limit=50
router.get('/events', auth, async (req, res) => {
  try {
    const { sku, limit = 50 } = req.query;
    const where = {};
    if (sku) where.sku = sku;

    const events = await LmInventoryEvent.findAll({
      where,
      order: [['processedAt', 'DESC']],
      limit: Math.min(Number(limit), 500),
    });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Sync jobs ───────────────────────────────────────────────────────────────

// GET /listing-management/sync-jobs?status=failed
router.get('/sync-jobs', auth, async (req, res) => {
  try {
    const { status, limit = 100 } = req.query;
    const where = {};
    if (status) where.status = status;

    const jobs = await LmSyncJob.findAll({
      where,
      include: [{ model: LmMarketplaceMapping, as: 'mapping', attributes: ['id', 'shopId', 'marketplaceSkuId', 'managedSkuId'] }],
      order: [['createdAt', 'DESC']],
      limit: Math.min(Number(limit), 500),
    });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /listing-management/sync-jobs/:id/retry
router.post('/sync-jobs/:id/retry', auth, async (req, res) => {
  try {
    const job = await LmSyncJob.findByPk(req.params.id);
    if (!job) return res.status(404).json({ error: 'Not found' });

    await job.update({ status: 'pending', nextRetryAt: new Date(), errorMessage: null });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── TikTok orders ───────────────────────────────────────────────────────────

// GET /listing-management/orders?sku=xxx
router.get('/orders', auth, async (req, res) => {
  try {
    const { sku, limit = 100, deducted } = req.query;
    const where = {};
    if (sku) where.sku = sku;
    if (deducted === 'false') where.deductedAt = null;
    if (deducted === 'true') where.deductedAt = { [Op.ne]: null };

    const orders = await LmTiktokOrder.findAll({
      where,
      order: [['placedAt', 'DESC']],
      limit: Math.min(Number(limit), 500),
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

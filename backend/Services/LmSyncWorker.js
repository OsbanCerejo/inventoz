const {
  LmSyncJob,
  LmMarketplaceMapping,
  LmTiktokCredential,
  LmManagedSku,
} = require('../models');
const tiktokApi = require('./TiktokShopApiClient');
const { Op } = require('sequelize');

const MAX_ATTEMPTS = 5;
const BACKOFF_MINUTES = [1, 5, 15, 60, 240]; // per attempt index

// In-memory lock: prevent two concurrent jobs on the same mapping
const processingMappings = new Set();

async function getCredential(shopId) {
  const cred = await LmTiktokCredential.findOne({ where: { shopId, isActive: true } });
  if (!cred) return null;

  if (cred.accessTokenExpiry && cred.accessTokenExpiry < new Date(Date.now() + 30 * 60 * 1000)) {
    try {
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
    } catch (err) {
      console.error(`[LmSyncWorker] Token refresh failed for shop ${shopId}:`, err.message);
      return null;
    }
  }

  return cred;
}

async function processJob(job) {
  if (processingMappings.has(job.mappingId)) return; // already running for this mapping
  processingMappings.add(job.mappingId);

  try {
    await job.update({ status: 'processing', lastAttemptAt: new Date(), attempts: job.attempts + 1 });

    const mapping = await LmMarketplaceMapping.findByPk(job.mappingId);
    if (!mapping) {
      await job.update({ status: 'cancelled', errorMessage: 'Mapping not found' });
      return;
    }

    // Check if the managed SKU has sync enabled
    const ms = await LmManagedSku.findByPk(mapping.managedSkuId);
    if (!ms || !ms.syncEnabled || !mapping.syncEnabled) {
      await job.update({ status: 'cancelled', errorMessage: 'Sync disabled' });
      return;
    }

    const cred = await getCredential(mapping.shopId);
    if (!cred) {
      await failJob(job, 'No active credentials for shop');
      return;
    }
    if (!cred.shopCipher) {
      await failJob(job, 'Shop cipher not available — reconnect TikTok Shop');
      return;
    }

    if (job.jobType === 'qty_update') {
      // Re-fetch current Inventoz qty at execution time to avoid pushing a stale
      // targetQty that was computed minutes ago (e.g. during a retry after TikTok downtime)
      const { Products } = require('../models');
      const product = ms ? await Products.findOne({ where: { sku: ms.sku }, attributes: ['quantity'] }) : null;
      const freshInventozQty = product?.quantity ?? null;

      // Recompute targetQty using the fresh Inventoz qty + current delta from lastConfirmedQty
      let finalQty = job.targetQty;
      if (freshInventozQty !== null && mapping.lastConfirmedQty !== null) {
        const freshDelta = freshInventozQty - mapping.lastConfirmedQty;
        const freshTarget = Math.max(0, mapping.currentQty + freshDelta);
        // Only use fresh computation if it differs — avoids pushing wrong qty on retries
        if (freshTarget !== job.targetQty) {
          console.log(`[LmSyncWorker] Recomputed targetQty for mapping ${mapping.id}: ${job.targetQty} → ${freshTarget} (inventoz=${freshInventozQty}, lastConfirmed=${mapping.lastConfirmedQty})`);
          finalQty = freshTarget;
        }
      }

      await tiktokApi.updateInventory(
        cred.accessToken,
        cred.shopCipher,
        mapping.marketplaceProductId,
        mapping.marketplaceSkuId,
        mapping.warehouseId,
        finalQty
      );
      await mapping.update({
        currentQty: finalQty,
        lastConfirmedQty: freshInventozQty ?? mapping.lastConfirmedQty,
        lastSyncAt: new Date(),
        lastSyncStatus: 'ok',
      });

    } else if (job.jobType === 'price_update') {
      await tiktokApi.request('PUT', `/product/202309/products/${mapping.marketplaceProductId}/prices`,
        cred.accessToken,
        cred.shopCipher,
        {},
        { skus: [{ id: mapping.marketplaceSkuId, price: { currency: 'USD', amount: String(job.targetPrice) } }] }
      );
      await mapping.update({
        currentPrice: job.targetPrice,
        lastSyncAt: new Date(),
        lastSyncStatus: 'ok',
      });

    } else if (job.jobType === 'reconcile') {
      const inventory = await tiktokApi.getInventory(cred.accessToken, cred.shopCipher, [mapping.marketplaceSkuId]);
      const item = inventory?.inventory_list?.find(i => i.sku_id === mapping.marketplaceSkuId);
      if (item) {
        const liveQty = item.inventory?.find(w => w.warehouse_id === mapping.warehouseId)?.quantity ?? item.total_available;
        await mapping.update({ currentQty: liveQty, lastConfirmedQty: liveQty, lastSyncAt: new Date(), lastSyncStatus: 'ok' });
      }
    }

    await job.update({ status: 'done', completedAt: new Date(), apiResponse: null, errorMessage: null });

  } catch (err) {
    await failJob(job, err.message);
    await LmMarketplaceMapping.update(
      { lastSyncStatus: 'failed' },
      { where: { id: job.mappingId } }
    );
  } finally {
    processingMappings.delete(job.mappingId);
  }
}

async function failJob(job, message) {
  const attempt = job.attempts;
  if (attempt >= MAX_ATTEMPTS) {
    await job.update({ status: 'failed', errorMessage: message });
    return;
  }
  const delayMinutes = BACKOFF_MINUTES[attempt] || 240;
  const nextRetry = new Date(Date.now() + delayMinutes * 60 * 1000);
  await job.update({ status: 'pending', errorMessage: message, nextRetryAt: nextRetry });
}

async function runCycle() {
  try {
    const jobs = await LmSyncJob.findAll({
      where: {
        status: 'pending',
        [Op.or]: [
          { nextRetryAt: null },
          { nextRetryAt: { [Op.lte]: new Date() } },
        ],
      },
      order: [['createdAt', 'ASC']],
      limit: 20,
    });

    if (jobs.length > 0) {
      console.log(`[LmSyncWorker] Processing ${jobs.length} sync job(s)`);
    }

    await Promise.all(jobs.map(job => processJob(job)));
  } catch (err) {
    console.error('[LmSyncWorker] Cycle error:', err.message);
  }
}

let workerInterval = null;

async function start() {
  if (workerInterval) return;

  // Reset jobs left in 'processing' from a prior server crash/restart
  const stuck = await LmSyncJob.update(
    { status: 'pending', nextRetryAt: null },
    { where: { status: 'processing' } }
  );
  if (stuck[0] > 0) {
    console.warn(`[LmSyncWorker] Reset ${stuck[0]} stuck processing job(s) to pending on startup`);
  }

  workerInterval = setInterval(runCycle, 60 * 1000); // every 60 seconds
  console.log('[LmSyncWorker] Started (60s cycle)');
  runCycle(); // run immediately on start
}

function stop() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}

module.exports = { start, stop, runCycle };

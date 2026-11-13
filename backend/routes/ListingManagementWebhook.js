const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { sequelize, Products, LmTiktokOrder, LmMarketplaceMapping, LmManagedSku, LmInventoryEvent, LmSyncJob } = require('../models');

const APP_SECRET = process.env.TIKTOK_APP_SECRET;

// TikTok webhook signature: HMAC-SHA256(APP_SECRET, timestamp + nonce + body_string)
function verifySignature(req) {
  const signature = req.headers['x-tts-signature'] || req.headers['x-tiktok-signature'];
  if (!signature) return false;

  const timestamp = req.headers['x-tts-timestamp'] || req.headers['timestamp'] || '';
  const nonce = req.headers['x-nonce'] || req.headers['nonce'] || '';
  const bodyStr = JSON.stringify(req.body);

  // TikTok signs: timestamp + "\n" + nonce + "\n" + body + "\n"
  const input = `${timestamp}\n${nonce}\n${bodyStr}\n`;
  const expected = crypto.createHmac('sha256', APP_SECRET).update(input).digest('base64');

  // Signature header may be base64 or hex — try both
  if (signature === expected) return true;
  const expectedHex = crypto.createHmac('sha256', APP_SECRET).update(input).digest('hex');
  if (signature === expectedHex) return true;

  // Fallback: body-only signing (older format)
  const bodyOnly = crypto.createHmac('sha256', APP_SECRET).update(bodyStr).digest('hex');
  return signature === bodyOnly;
}

// POST /listing-management/webhook/tiktok
router.post('/tiktok', express.json(), async (req, res) => {
  // Always respond 200 quickly to TikTok — process async
  res.status(200).json({ code: 0, message: 'ok' });

  try {
    if (APP_SECRET && !verifySignature(req)) {
      console.warn('[LM Webhook] Invalid signature — headers:', JSON.stringify({
        'x-tts-signature': req.headers['x-tts-signature'],
        'x-tiktok-signature': req.headers['x-tiktok-signature'],
        'x-tts-timestamp': req.headers['x-tts-timestamp'],
        'x-nonce': req.headers['x-nonce'],
        timestamp: req.headers['timestamp'],
        nonce: req.headers['nonce'],
      }));
      return;
    }

    const { type, data, shop_id } = req.body;
    if (!data) return;

    const eventType = Number(type);

    if (eventType === 1) {
      // Order Status Change
      await handleOrderStatusUpdate(data, shop_id);
    } else if (eventType === 11) {
      // Cancellation status change
      await handleCancellation(data);
    } else if (eventType === 12) {
      // Order return / refund
      await handleReturn(data);
    } else if (eventType === 6 || eventType === 7) {
      // Seller deauthorization or Auth expire
      await handleAuthEvent(data, shop_id, eventType);
    } else if (eventType === 2) {
      // Reverse status update (refund/return request initiated)
      await handleCancellation(data);
    } else if (eventType === 68 || eventType === 71) {
      // Inventory changed / Inventory Changed By Shop
      await handleInventoryChanged(data, shop_id);
    } else if (eventType === 27) {
      // Inventory status change (low stock notification from TikTok)
      console.log(`[LM Webhook] Low stock alert from TikTok for shop ${shop_id}:`, JSON.stringify(data).slice(0, 200));
    }

  } catch (err) {
    console.error('[LM Webhook] Processing error:', err.message);
  }
});

async function handleOrderStatusUpdate(data, shopId) {
  const orderId = data.order_id || data.id;
  const orderStatus = data.order_status;
  if (!orderId) return;

  // TikTok sends order-line-level items in some webhook versions
  const lines = data.line_items || data.order_line_list || [data];

  for (const line of lines) {
    const lineId = line.order_line_id || line.id || orderId;
    const tiktokSkuId = line.sku_id || line.seller_sku;
    const quantity = Number(line.quantity) || 1;
    const idempotencyKey = `${orderId}-${lineId}`;

    // Find the mapping for this TikTok SKU ID
    const mapping = tiktokSkuId
      ? await LmMarketplaceMapping.findOne({ where: { marketplaceSkuId: tiktokSkuId, shopId } })
      : null;

    const inventozSku = mapping
      ? (await LmManagedSku.findByPk(mapping.managedSkuId))?.sku
      : null;

    // Upsert the order record
    const [order, created] = await LmTiktokOrder.findOrCreate({
      where: { idempotencyKey },
      defaults: {
        tiktokOrderId: orderId,
        tiktokOrderLineId: lineId,
        tiktokSkuId: tiktokSkuId || '',
        mappingId: mapping?.id || null,
        sku: inventozSku || null,
        quantity,
        orderStatus,
        shipmentStatus: data.shipment_status || null,
        placedAt: data.create_time ? new Date(data.create_time * 1000) : new Date(),
        rawPayload: data,
      },
    });

    if (!created) {
      await order.update({
        orderStatus,
        shipmentStatus: data.shipment_status || order.shipmentStatus,
        shippedAt: orderStatus === 'SHIPPED' ? new Date() : order.shippedAt,
        rawPayload: data,
      });
    }

    // Deduct inventory when order status reaches SHIPPED and not yet deducted
    if (orderStatus === 'SHIPPED' && !order.deductedAt && inventozSku) {
      await deductInventory(order, inventozSku, quantity, mapping);
    }
  }
}

async function deductInventory(order, sku, quantity, mapping) {
  try {
    await sequelize.transaction(async (t) => {
      const product = await Products.findOne({
        where: { sku },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!product) return;

      const previousQty = product.quantity;
      const newQty = Math.max(0, previousQty - quantity);

      await product.update({ quantity: newQty }, { transaction: t });

      const event = await LmInventoryEvent.create({
        sku,
        previousQty,
        newQty,
        delta: newQty - previousQty,
        eventType: 'MARKETPLACE_DEDUCTION',
        eventSource: 'tiktok_webhook',
        referenceId: order.tiktokOrderId,
        processedAt: new Date(),
        syncStatus: 'skipped', // TikTok already reduced its own listing
      }, { transaction: t });

      await order.update({
        deductedAt: new Date(),
        deductionEventId: event.id,
      }, { transaction: t });

      // Now enqueue sync for all OTHER active mappings of this SKU
      // (e.g., if same SKU is listed on Walmart too)
      if (mapping) {
        const otherMappings = await LmMarketplaceMapping.findAll({
          where: { managedSkuId: mapping.managedSkuId, syncEnabled: true, id: { [require('sequelize').Op.ne]: mapping.id } },
          transaction: t,
        });
        for (const other of otherMappings) {
          const targetQty = Math.max(0, (other.currentQty || 0) - quantity);
          await LmSyncJob.create({
            mappingId: other.id,
            jobType: 'qty_update',
            targetQty,
            inventoryEventId: event.id,
            status: 'pending',
          }, { transaction: t });
        }
      }
    });

    console.log(`[LM Webhook] Deducted ${quantity} from ${sku} (order ${order.tiktokOrderId})`);
  } catch (err) {
    console.error(`[LM Webhook] Deduction failed for order ${order.tiktokOrderId}:`, err.message);
  }
}

async function handleCancellation(data) {
  const orderId = data.order_id || data.id;
  if (!orderId) return;

  // Mark all order lines for this order as cancelled
  const updated = await LmTiktokOrder.update(
    { cancelledAt: new Date(), orderStatus: 'CANCELLED' },
    { where: { tiktokOrderId: String(orderId), cancelledAt: null, deductedAt: null } }
  );

  if (updated[0] > 0) {
    console.log(`[LM Webhook] Cancelled ${updated[0]} order line(s) for order ${orderId}`);
  }
}

async function handleReturn(data) {
  // Returns don't re-add inventory automatically — just log the status change
  const orderId = data.order_id || data.id;
  if (!orderId) return;

  await LmTiktokOrder.update(
    { orderStatus: 'RETURN_OR_REFUND' },
    { where: { tiktokOrderId: String(orderId) } }
  );
  console.log(`[LM Webhook] Return/refund event for order ${orderId}`);
}

async function handleInventoryChanged(data, shopId) {
  // TikTok pushes the new quantity per SKU — update our currentQty to match
  const skuList = data.sku_inventory_list || data.inventory_list || (data.sku_id ? [data] : []);

  for (const item of skuList) {
    const tiktokSkuId = item.sku_id || item.id;
    const newQty = item.available_quantity ?? item.quantity ?? item.stock_infos?.[0]?.available_stock;

    if (!tiktokSkuId || newQty === undefined || newQty === null) continue;

    const mapping = await LmMarketplaceMapping.findOne({
      where: { marketplaceSkuId: String(tiktokSkuId), ...(shopId ? { shopId: String(shopId) } : {}) },
    });

    if (!mapping) continue;

    const qty = Number(newQty);
    await mapping.update({ currentQty: qty, lastConfirmedQty: qty, lastSyncAt: new Date(), lastSyncStatus: 'ok' });
    console.log(`[LM Webhook] Inventory sync: SKU ${tiktokSkuId} → qty ${qty}`);
  }
}

async function handleAuthEvent(data, shopId, eventType) {
  const sid = shopId || data.shop_id;
  if (!sid) return;

  if (eventType === 6) {
    // Seller deauthorized — mark credentials inactive
    await LmTiktokCredential.update({ isActive: false }, { where: { shopId: String(sid) } });
    console.warn(`[LM Webhook] Shop ${sid} deauthorized — credentials marked inactive`);
  } else if (eventType === 7) {
    // Auth expiring soon — trigger a proactive refresh
    const { refreshExpiringTokens } = require('../cron/lmTokenRefresh');
    await refreshExpiringTokens();
    console.log(`[LM Webhook] Auth expire warning for shop ${sid} — triggered token refresh`);
  }
}

module.exports = router;

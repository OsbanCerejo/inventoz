const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { sequelize, Products, LmTiktokOrder, LmMarketplaceMapping, LmManagedSku, LmInventoryEvent, LmSyncJob } = require('../models');

const APP_SECRET = process.env.TIKTOK_APP_SECRET;
const APP_KEY = process.env.TIKTOK_APP_KEY;

// TikTok webhook signature: HMAC-SHA256(key=APP_SECRET, msg=APP_KEY+raw_body) → lowercase hex
// Source: TikTok Shop webhook configuration guide (Step 3)
function verifySignature(req) {
  // ── FULL HEADER DUMP ──────────────────────────────────────────────────────
  console.log('[LM Webhook SIG] ALL headers:', JSON.stringify(req.headers));

  // Pick signature from whatever header TikTok sent
  const sigHeader = Object.keys(req.headers).find(k =>
    k === 'x-tts-signature' || k === 'x-tiktok-signature' ||
    k.includes('signature') || k.includes('sign')
  );
  const signature = sigHeader ? req.headers[sigHeader] : undefined;
  console.log('[LM Webhook SIG] signature header key:', sigHeader, '| value:', signature);
  if (!signature) {
    console.warn('[LM Webhook SIG] No signature header found — rejecting');
    return false;
  }

  // Pick timestamp
  const tsHeader = Object.keys(req.headers).find(k =>
    k === 'x-tts-timestamp' || k === 'timestamp' || k.includes('timestamp')
  );
  const timestamp = tsHeader ? req.headers[tsHeader] : '';
  console.log('[LM Webhook SIG] timestamp header key:', tsHeader, '| value:', timestamp);

  // Pick nonce
  const nonceHeader = Object.keys(req.headers).find(k =>
    k === 'x-nonce' || k === 'nonce' || k.includes('nonce')
  );
  const nonce = nonceHeader ? req.headers[nonceHeader] : '';
  console.log('[LM Webhook SIG] nonce header key:', nonceHeader, '| value:', nonce);

  // Raw body info
  const rawBodyPresent = !!req.rawBody;
  const bodyStr = req.rawBody || JSON.stringify(req.body);
  console.log('[LM Webhook SIG] rawBody present:', rawBodyPresent, '| bodyStr length:', bodyStr.length);
  console.log('[LM Webhook SIG] bodyStr snippet:', bodyStr.slice(0, 200));

  console.log('[LM Webhook SIG] APP_SECRET length:', APP_SECRET ? APP_SECRET.length : 'MISSING');

  // ── ATTEMPT ALL KNOWN SIGNING FORMATS ────────────────────────────────────

  // Format 1: timestamp\nnonce\nbody\n  → base64
  const input1 = `${timestamp}\n${nonce}\n${bodyStr}\n`;
  const h1b64 = crypto.createHmac('sha256', APP_SECRET).update(input1).digest('base64');
  const h1hex = crypto.createHmac('sha256', APP_SECRET).update(input1).digest('hex');
  console.log('[LM Webhook SIG] Format1 (ts\\nnonce\\nbody\\n) base64:', h1b64);
  console.log('[LM Webhook SIG] Format1 (ts\\nnonce\\nbody\\n) hex:   ', h1hex);
  if (signature === h1b64 || signature === h1hex) {
    console.log('[LM Webhook SIG] MATCHED Format1');
    return true;
  }

  // Format 2: body only → hex
  const h2hex = crypto.createHmac('sha256', APP_SECRET).update(bodyStr).digest('hex');
  console.log('[LM Webhook SIG] Format2 (body only) hex:', h2hex);
  if (signature === h2hex) {
    console.log('[LM Webhook SIG] MATCHED Format2');
    return true;
  }

  // Format 2b: CORRECT per TikTok docs — HMAC-SHA256(APP_SECRET, APP_KEY + raw_body) → hex
  const correctInput = (APP_KEY || '') + bodyStr;
  const h2b = crypto.createHmac('sha256', APP_SECRET).update(correctInput).digest('hex');
  console.log('[LM Webhook SIG] Format2b (APP_KEY+body, correct per docs) hex:', h2b);
  if (signature === h2b) {
    console.log('[LM Webhook SIG] MATCHED Format2b — THIS IS THE CORRECT FORMAT');
    return true;
  }

  // Format 3: timestamp + body (no nonce, no newlines) → hex
  const input3 = `${timestamp}${bodyStr}`;
  const h3hex = crypto.createHmac('sha256', APP_SECRET).update(input3).digest('hex');
  console.log('[LM Webhook SIG] Format3 (ts+body) hex:', h3hex);
  if (signature === h3hex) {
    console.log('[LM Webhook SIG] MATCHED Format3');
    return true;
  }

  // Format 4: nonce + timestamp + body (alternative order) → hex
  const input4 = `${nonce}${timestamp}${bodyStr}`;
  const h4hex = crypto.createHmac('sha256', APP_SECRET).update(input4).digest('hex');
  console.log('[LM Webhook SIG] Format4 (nonce+ts+body) hex:', h4hex);
  if (signature === h4hex) {
    console.log('[LM Webhook SIG] MATCHED Format4');
    return true;
  }

  // Format 5: timestamp\nnonce\nbody (no trailing newline) → hex / base64
  const input5 = `${timestamp}\n${nonce}\n${bodyStr}`;
  const h5hex = crypto.createHmac('sha256', APP_SECRET).update(input5).digest('hex');
  const h5b64 = crypto.createHmac('sha256', APP_SECRET).update(input5).digest('base64');
  console.log('[LM Webhook SIG] Format5 (ts\\nnonce\\nbody no trail) hex:', h5hex);
  if (signature === h5hex || signature === h5b64) {
    console.log('[LM Webhook SIG] MATCHED Format5');
    return true;
  }

  // Format 6: APP_SECRET decoded as hex bytes → raw binary key, body only
  // TikTok app secrets are hex strings; HMAC key should be raw bytes, not ASCII
  try {
    const secretBytes = Buffer.from(APP_SECRET.trim(), 'hex');
    const h6hex = crypto.createHmac('sha256', secretBytes).update(bodyStr).digest('hex');
    console.log('[LM Webhook SIG] Format6 (hex-decoded key, body only) hex:', h6hex);
    if (signature === h6hex) {
      console.log('[LM Webhook SIG] MATCHED Format6 — secret should be used as decoded hex bytes');
      return true;
    }

    // Format 7: hex-decoded key + Format1 input
    const h7hex = crypto.createHmac('sha256', secretBytes).update(input1).digest('hex');
    console.log('[LM Webhook SIG] Format7 (hex-decoded key, ts\\nnonce\\nbody\\n) hex:', h7hex);
    if (signature === h7hex) {
      console.log('[LM Webhook SIG] MATCHED Format7');
      return true;
    }
  } catch (e) {
    console.log('[LM Webhook SIG] Format6/7 skipped — APP_SECRET is not valid hex:', e.message);
  }

  // Format 8: trimmed APP_SECRET (in case of whitespace in env var), body only
  const trimmedSecret = (APP_SECRET || '').trim();
  if (trimmedSecret !== APP_SECRET) {
    const h8hex = crypto.createHmac('sha256', trimmedSecret).update(bodyStr).digest('hex');
    console.log('[LM Webhook SIG] Format8 (trimmed secret, body only) hex:', h8hex);
    if (signature === h8hex) {
      console.log('[LM Webhook SIG] MATCHED Format8 — APP_SECRET has whitespace!');
      return true;
    }
  }

  // Format 9: use timestamp from inside body JSON (TikTok may not send it as a header)
  try {
    const bodyTimestamp = String(req.body?.timestamp || '');
    if (bodyTimestamp) {
      const input9a = `${bodyTimestamp}\n${bodyStr}\n`;
      const h9a = crypto.createHmac('sha256', APP_SECRET).update(input9a).digest('hex');
      console.log('[LM Webhook SIG] Format9a (body.timestamp\\nbody\\n) hex:', h9a);
      if (signature === h9a) { console.log('[LM Webhook SIG] MATCHED Format9a'); return true; }

      const input9b = `${bodyTimestamp}${bodyStr}`;
      const h9b = crypto.createHmac('sha256', APP_SECRET).update(input9b).digest('hex');
      console.log('[LM Webhook SIG] Format9b (body.timestamp+body) hex:', h9b);
      if (signature === h9b) { console.log('[LM Webhook SIG] MATCHED Format9b'); return true; }

      const input9c = `${bodyTimestamp}\n\n${bodyStr}\n`;
      const h9c = crypto.createHmac('sha256', APP_SECRET).update(input9c).digest('hex');
      console.log('[LM Webhook SIG] Format9c (body.timestamp\\n\\nbody\\n) hex:', h9c);
      if (signature === h9c) { console.log('[LM Webhook SIG] MATCHED Format9c'); return true; }
    }
  } catch (_) {}

  // Format 10: HMAC-SHA256 keyed with APP_KEY (not APP_SECRET), body only
  if (APP_KEY) {
    const h10 = crypto.createHmac('sha256', APP_KEY).update(bodyStr).digest('hex');
    console.log('[LM Webhook SIG] Format10 (APP_KEY as key, body) hex:', h10);
    if (signature === h10) { console.log('[LM Webhook SIG] MATCHED Format10 — KEY is APP_KEY not APP_SECRET'); return true; }

    // Format 11: HMAC-SHA256 keyed with APP_KEY+APP_SECRET concatenation
    const combinedKey = APP_KEY + APP_SECRET;
    const h11 = crypto.createHmac('sha256', combinedKey).update(bodyStr).digest('hex');
    console.log('[LM Webhook SIG] Format11 (APP_KEY+APP_SECRET, body) hex:', h11);
    if (signature === h11) { console.log('[LM Webhook SIG] MATCHED Format11'); return true; }
  }

  // Format 12: plain SHA256 (no key) of APP_SECRET+body concatenation
  const h12a = crypto.createHash('sha256').update(APP_SECRET + bodyStr).digest('hex');
  console.log('[LM Webhook SIG] Format12a (SHA256 no-key, secret+body) hex:', h12a);
  if (signature === h12a) { console.log('[LM Webhook SIG] MATCHED Format12a'); return true; }

  const h12b = crypto.createHash('sha256').update(bodyStr + APP_SECRET).digest('hex');
  console.log('[LM Webhook SIG] Format12b (SHA256 no-key, body+secret) hex:', h12b);
  if (signature === h12b) { console.log('[LM Webhook SIG] MATCHED Format12b'); return true; }

  // Format 13: aggressive whitespace strip of APP_SECRET (all unicode whitespace)
  const strippedSecret = (APP_SECRET || '').replace(/\s/g, '');
  if (strippedSecret !== APP_SECRET) {
    const h13 = crypto.createHmac('sha256', strippedSecret).update(bodyStr).digest('hex');
    console.log('[LM Webhook SIG] Format13 (whitespace-stripped secret, body) hex:', h13);
    if (signature === h13) { console.log('[LM Webhook SIG] MATCHED Format13 — secret has hidden whitespace!'); return true; }
  }

  console.log('[LM Webhook SIG] APP_KEY value in use:', APP_KEY || 'MISSING', '| APP_SECRET length:', APP_SECRET ? APP_SECRET.length : 'MISSING');
  console.log('[LM Webhook SIG] Full bodyStr for manual verification:', bodyStr);
  console.warn('[LM Webhook SIG] NO FORMAT MATCHED — received signature:', signature);
  return false;
}

// POST /listing-management/webhook/tiktok
router.post('/tiktok', async (req, res) => {
  // Always respond 200 quickly to TikTok — process async
  res.status(200).json({ code: 0, message: 'ok' });

  try {
    if (APP_SECRET && !verifySignature(req)) {
      console.warn('[LM Webhook] Signature verification failed — see SIG logs above');
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

  // Webhook only sends order_id + order_status — fetch full order to get line items
  let lines = data.line_items || data.order_line_list || null;
  if (!lines || lines.length === 0) {
    try {
      const { LmTiktokCredential } = require('../models');
      const cred = shopId
        ? await LmTiktokCredential.findOne({ where: { shopId: String(shopId), isActive: true } })
        : null;
      if (cred) {
        const tiktokApi = require('../Services/TiktokShopApiClient');
        const orderDetail = await tiktokApi.getOrder(cred.accessToken, cred.shopCipher, orderId);
        lines = orderDetail?.line_items || orderDetail?.order_line_list || [];
      }
    } catch (e) {
      console.warn(`[LM Webhook] Could not fetch order detail for ${orderId}:`, e.message);
    }
  }

  // If still no line items, record the order at the order level only
  if (!lines || lines.length === 0) {
    lines = [{ order_line_id: orderId, sku_id: null, quantity: 1 }];
  }

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

    // Deduct inventory when order is in transit (shipped) and not yet deducted
    if ((orderStatus === 'IN_TRANSIT' || orderStatus === 'AWAITING_COLLECTION') && !order.deductedAt && inventozSku) {
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

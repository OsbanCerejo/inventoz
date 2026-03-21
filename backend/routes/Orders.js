const express = require("express");
const router = express.Router();
const axios = require("axios");
const authService = require("../Services/AuthService");
const StockUpdateService = require("../Services/StockUpdateService");
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { Logs, Products, Listings, sequelize, Sequelize } = require("../models");
const Op = Sequelize.Op;
const service = new authService();

const SHIPSTATION_URL = "https://ssapi.shipstation.com/orders";
const APPROVE_LOCK_KEY = "orders_approve_lock";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const normalizeStoreId = (storeId) => {
  const parsed = Number(storeId);
  return Number.isNaN(parsed) ? null : parsed;
};

const listingColumnForStore = (storeId) => {
  if (storeId === 983189) return "ebayBuy4LessToday";
  if (storeId === 1034120) return "ebayOneLifeLuxuries4";
  if (storeId === 1040538) return "walmartOneLifeLuxuries";
  return null;
};

const extractOrdersArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.orders)) return payload.orders;
  return [];
};

const normalizeApprovalItems = (items = []) =>
  items
    .map((item) => {
      const orderId = String(item.orderId || "").trim();
      const storeId = normalizeStoreId(item.store);
      const sku = String(item.finalSku || item.sku || "").trim();
      const quantity = toNumber(item.quantity, 0);
      const lotSize = Math.max(toNumber(item.lotSize, 1), 1);
      const quantitySold = quantity * lotSize;

      if (!orderId || !storeId || !sku || quantitySold <= 0) return null;
      return {
        orderId,
        storeId,
        sku,
        quantitySold,
        orderKey: `${orderId}_${storeId}`,
      };
    })
    .filter(Boolean);

const getApprovalScope = async (normalizedItems) => {
  const allOrderKeys = Array.from(new Set(normalizedItems.map((i) => i.orderKey)));

  const existingProcessed = await Logs.findAll({
    where: {
      entityType: "order_approval_order",
      action: "processed",
      entityId: { [Op.in]: allOrderKeys },
    },
    attributes: ["entityId"],
  });

  const alreadyProcessedSet = new Set(existingProcessed.map((log) => String(log.entityId)));
  const eligibleOrderKeys = allOrderKeys.filter((key) => !alreadyProcessedSet.has(key));
  const processedItems = normalizedItems.filter((item) => eligibleOrderKeys.includes(item.orderKey));

  return {
    allOrderKeys,
    eligibleOrderKeys,
    alreadyProcessedCount: allOrderKeys.length - eligibleOrderKeys.length,
    processedItems,
  };
};

const buildDeductionMaps = (processedItems) => {
  const skuTotals = new Map();
  const skuStoreTotals = new Map();

  processedItems.forEach((item) => {
    skuTotals.set(item.sku, (skuTotals.get(item.sku) || 0) + item.quantitySold);
    const skuStoreKey = `${item.sku}_${item.storeId}`;
    const prev = skuStoreTotals.get(skuStoreKey) || {
      sku: item.sku,
      storeId: item.storeId,
      quantitySold: 0,
    };
    prev.quantitySold += item.quantitySold;
    skuStoreTotals.set(skuStoreKey, prev);
  });

  return { skuTotals, skuStoreTotals };
};

const resolveProductsForSkus = async (skuTotals) => {
  const skuCache = new Map();
  const resolveProduct = async (sku) => {
    if (skuCache.has(sku)) return skuCache.get(sku);
    let product = await Products.findOne({ where: { sku } });
    if (!product) {
      product = await Products.findOne({ where: { alternativeSku: sku } });
    }
    skuCache.set(sku, product || null);
    return product || null;
  };

  const productUpdates = [];
  const missingSkus = [];
  for (const [requestedSku, qtySold] of skuTotals.entries()) {
    const product = await resolveProduct(requestedSku);
    if (!product) {
      missingSkus.push(requestedSku);
      continue;
    }

    const currentQuantity = toNumber(product.quantity, 0);
    productUpdates.push({
      sku: product.sku,
      requestedSku,
      quantitySold: qtySold,
      currentQuantity,
      newQuantity: currentQuantity - qtySold,
    });
  }

  return { productUpdates, missingSkus };
};

const fetchAllAwaitingShipmentOrders = async (token, extraParams = {}) => {
  const pageSize = 500;
  let page = 1;
  let hasMore = true;
  const all = [];

  while (hasMore) {
    const response = await axios.get(SHIPSTATION_URL, {
      headers: { Authorization: `Basic ${token}` },
      params: {
        orderStatus: "awaiting_shipment",
        page,
        pageSize,
        ...extraParams,
      },
    });

    const orders = extractOrdersArray(response.data);
    all.push(...orders);

    const total = toNumber(response.data?.total, 0);
    const pages = toNumber(response.data?.pages, 0);

    if (pages > 0) {
      hasMore = page < pages;
    } else if (total > 0) {
      hasMore = all.length < total;
    } else {
      hasMore = orders.length === pageSize;
    }

    page += 1;
  }

  return all;
};

const acquireApproveLock = async () => {
  const [rows] = await sequelize.query("SELECT GET_LOCK(:lockKey, 10) AS gotLock", {
    replacements: { lockKey: APPROVE_LOCK_KEY },
  });
  return Number(rows?.[0]?.gotLock || 0) === 1;
};

const releaseApproveLock = async () => {
  await sequelize.query("DO RELEASE_LOCK(:lockKey)", {
    replacements: { lockKey: APPROVE_LOCK_KEY },
  });
};

router.get("/allOrders", auth, checkPermission('orders', 'view'), async (req, res) => {
  const TOKEN = process.env.API_KEY_ENCODED;

  // Accept storeid as a query param (can be comma-separated for multiple stores)
  let { storeid } = req.query;
  let storeIds = [];
  if (storeid) {
    if (Array.isArray(storeid)) {
      storeIds = storeid;
    } else if (typeof storeid === 'string') {
      storeIds = storeid.split(',').map(id => id.trim()).filter(Boolean);
    }
  }

  try {
    let allOrders = [];
    if (storeIds.length > 1) {
      // Multiple stores: fetch each separately and merge, removing duplicates by orderId+storeId
      const orderKeySet = new Set();
      for (const storeId of storeIds) {
        const ordersArr = await fetchAllAwaitingShipmentOrders(TOKEN, { storeid: storeId });
        for (const order of ordersArr) {
          // Use orderId + storeId as the unique key
          const storeIdKey = order.advancedOptions && order.advancedOptions.storeId ? order.advancedOptions.storeId : '';
          const uniqueKey = `${order.orderId}_${storeIdKey}`;
          if (!orderKeySet.has(uniqueKey)) {
            allOrders.push(order);
            orderKeySet.add(uniqueKey);
          }
        }
      }
      res.json({ orders: allOrders });
      return;
    }
    const singleStoreId = storeIds.length === 1 ? storeIds[0] : undefined;
    const orders = await fetchAllAwaitingShipmentOrders(TOKEN, singleStoreId ? { storeid: singleStoreId } : {});
    res.json({ orders });
  } catch (error) {
    console.error(
      "Error:",
      error.response ? error.response.data : error.message
    );
    return res.status(502).json({
      error: "Failed to fetch orders from ShipStation",
      details: error.response ? error.response.data : error.message,
    });
  }
});

router.post("/approve-preview", auth, checkPermission('orders', 'view'), async (req, res) => {
  const { items = [], selectedStores = [] } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "No order items provided for preview." });
  }

  try {
    const normalizedItems = normalizeApprovalItems(items);
    if (normalizedItems.length === 0) {
      return res.status(400).json({ error: "No valid order items to preview." });
    }

    const { allOrderKeys, eligibleOrderKeys, alreadyProcessedCount, processedItems } =
      await getApprovalScope(normalizedItems);

    const { skuTotals } = buildDeductionMaps(processedItems);
    const { productUpdates, missingSkus } = await resolveProductsForSkus(skuTotals);

    const previewRows = productUpdates.map((row) => ({
      requestedSku: row.requestedSku,
      deductedSku: row.sku,
      quantityToDeduct: row.quantitySold,
      currentQuantity: row.currentQuantity,
      projectedQuantity: row.newQuantity,
      status: "ready",
    }));

    missingSkus.forEach((sku) => {
      const qty = skuTotals.get(sku) || 0;
      previewRows.push({
        requestedSku: sku,
        deductedSku: null,
        quantityToDeduct: qty,
        currentQuantity: null,
        projectedQuantity: null,
        status: "missing_product",
      });
    });

    return res.json({
      success: true,
      summary: {
        ordersReceived: allOrderKeys.length,
        ordersToProcess: eligibleOrderKeys.length,
        ordersSkippedAlreadyApproved: alreadyProcessedCount,
        skusReadyToUpdate: productUpdates.length,
        skusMissing: missingSkus.length,
        selectedStores,
      },
      previewRows,
    });
  } catch (error) {
    console.error("Error building approval preview:", error);
    return res.status(500).json({
      error: "Failed to build order approval preview.",
      details: error.message,
    });
  }
});

router.post("/approve-batch", auth, checkPermission('orders', 'view'), async (req, res) => {
  const { items = [], selectedStores = [] } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "No order items provided for approval." });
  }

  const gotLock = await acquireApproveLock();
  if (!gotLock) {
    return res.status(409).json({
      error: "Another approval is currently running. Please retry in a few seconds.",
    });
  }

  try {
    const normalizedItems = normalizeApprovalItems(items);

    if (normalizedItems.length === 0) {
      return res.status(400).json({ error: "No valid order items to process." });
    }

    const { allOrderKeys, eligibleOrderKeys, alreadyProcessedCount, processedItems } =
      await getApprovalScope(normalizedItems);

    if (eligibleOrderKeys.length === 0) {
      return res.json({
        success: true,
        batchId: null,
        summary: {
          ordersReceived: allOrderKeys.length,
          ordersProcessed: 0,
          ordersSkippedAlreadyApproved: allOrderKeys.length,
          skusUpdated: 0,
          skusMissing: 0,
          listingUpdatesApplied: 0,
          errors: [],
          selectedStores,
        },
      });
    }

    const { skuTotals, skuStoreTotals } = buildDeductionMaps(processedItems);
    const { productUpdates, missingSkus } = await resolveProductsForSkus(skuTotals);

    let productUpdateResult = { success: true, results: [] };
    if (productUpdates.length > 0) {
      productUpdateResult = await StockUpdateService.updateMultipleProductQuantities(
        productUpdates.map((u) => ({ sku: u.sku, newQuantity: u.newQuantity }))
      );
    }

    const listingResults = [];
    for (const update of Array.from(skuStoreTotals.values())) {
      const storeIdNum = normalizeStoreId(update.storeId);
      const columnToUpdate = listingColumnForStore(storeIdNum);
      if (!columnToUpdate) {
        listingResults.push(`Skipped ${update.sku}: invalid storeId ${update.storeId}`);
        continue;
      }

      let product = await Products.findOne({ where: { sku: update.sku } });
      if (!product) {
        product = await Products.findOne({ where: { alternativeSku: update.sku } });
      }
      if (!product) {
        listingResults.push(`Skipped ${update.sku}: no product mapping`);
        continue;
      }

      const listing = await Listings.findByPk(product.sku);
      if (!listing) {
        listingResults.push(`Skipped ${update.sku}: no listing found for ${product.sku}`);
        continue;
      }

      const newQty = Math.max(toNumber(listing[columnToUpdate], 0) - update.quantitySold, 0);
      listing[columnToUpdate] = newQty;
      await listing.save();
      listingResults.push(`Updated ${product.sku} ${columnToUpdate} => ${newQty}`);
    }

    const batchId = `orders_${new Date().toISOString().slice(0, 10)}_${Date.now()}`;
    const nowIso = new Date().toISOString();

    await Logs.create({
      timestamp: nowIso,
      type: "Order Approval",
      action: "completed",
      entityType: "order_approval_batch",
      entityId: batchId,
      userId: req.user?.id?.toString(),
      metaData: {
        selectedStores,
        ordersReceived: allOrderKeys.length,
        ordersProcessed: eligibleOrderKeys.length,
        ordersSkippedAlreadyApproved: alreadyProcessedCount,
        skusUpdated: productUpdates.length,
        skusMissing: missingSkus,
        listingUpdatesApplied: listingResults.filter((r) => r.startsWith("Updated")).length,
        productUpdateResult,
        listingResults,
      },
    });

    await Logs.bulkCreate(
      eligibleOrderKeys.map((orderKey) => ({
        timestamp: nowIso,
        type: "Order Approval",
        action: "processed",
        entityType: "order_approval_order",
        entityId: orderKey,
        userId: req.user?.id?.toString(),
        metaData: {
          batchId,
        },
      }))
    );

    return res.json({
      success: true,
      batchId,
      summary: {
        ordersReceived: allOrderKeys.length,
        ordersProcessed: eligibleOrderKeys.length,
        ordersSkippedAlreadyApproved: alreadyProcessedCount,
        skusUpdated: productUpdates.length,
        skusMissing: missingSkus.length,
        listingUpdatesApplied: listingResults.filter((r) => r.startsWith("Updated")).length,
        errors: listingResults.filter((r) => r.startsWith("Skipped")),
        selectedStores,
      },
    });
  } catch (error) {
    console.error("Error approving order batch:", error);
    return res.status(500).json({
      error: "Failed to approve order batch.",
      details: error.message,
    });
  } finally {
    await releaseApproveLock().catch(() => {});
  }
});

// Fetch order details by order ID
router.get("/order/:orderNumber", auth, checkPermission('orders', 'view'), async (req, res) => {
  const TOKEN = process.env.API_KEY_ENCODED;

  const { orderNumber } = req.params;

  try {
    const response = await axios.get(SHIPSTATION_URL, {
      headers: {
        Authorization: `Basic ${TOKEN}`,
      },
      params: {
        orderNumber: orderNumber,
      },
    });

    if (response.status === 200) {
      const orders = response.data.orders; // ShipStation API response structure
      if (orders.length > 0) {
        const order = orders[0];
        const transformedOrder = {
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          items: order.items.map((item) => ({
            sku: item.sku,
            name: item.name,
            quantity: item.quantity,
            imageUrl: item.imageUrl,
            options: item.options,
          })),
        };
        res.json(transformedOrder);
      } else {
        res.status(404).json({ error: "Order not found" });
      }
    } else {
      console.error(
        "Error fetching order details:",
        response.status,
        response.statusText
      );
      res.status(response.status).json({ error: response.statusText });
    }
  } catch (error) {
    console.error(
      "Error:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: error.message });
  }
});

// router.get("/testebay", async (req, res) => {
//   const TOKEN = await service.getAccessToken();

//   // const EBAY_API_URL =
//   //   "https://api.ebay.com/sell/inventory/v1/bulk_migrate_listing";


//   // const EBAY_API_URL =
//   //   "https://api.ebay.com/sell/inventory/v1/inventory_item/PHI-CO-US-00001";


//   // const payload = {
//   //   requests: [
//   //     {
//   //       listingId: "195728146053",
//   //     },
//   //   ],
//   // };
//   try {
//     const response = await axios.get(EBAY_API_URL, {
//       headers: {
//         Authorization: `Bearer ${TOKEN}`,
//       },
//     });

//     // const response = await axios.post(EBAY_API_URL, payload, {
//     //   headers: {
//     //     Authorization: `Bearer ${TOKEN}`,
//     //     "Content-Type": "application/json",
//     //   },
//     // });

//     if (response.status === 200 && response.data) {
//       console.log("eBay API Response:", response.data);
//       return res.json(response.data);
//     } else {
//       console.error("Unexpected response from eBay API:", response.statusText);
//       return res.status(response.status).json({
//         message: "Unexpected response from eBay API",
//         details: response.statusText,
//       });
//     }
//   } catch (error) {
//     console.error(
//       "Error fetching eBay API:",
//       error.response ? error.response.data : error.message
//     );

//     return res.status(500).json({
//       message: "Failed to fetch eBay API",
//       error: error.response ? error.response.data : error.message,
//     });
//   }
// });

module.exports = router;

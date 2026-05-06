const express = require("express");
const router = express.Router();
const axios = require("axios");
const authService = require("../Services/AuthService");
const StockUpdateService = require("../Services/StockUpdateService");
const LowStockAlertService = require("../Services/LowStockAlertService");
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { Logs, Products, Listings, MarketplaceSale, sequelize, Sequelize } = require("../models");
const Op = Sequelize.Op;
const service = new authService();

const SHIPSTATION_URL = "https://ssapi.shipstation.com/orders";
const APPROVE_LOCK_KEY = "orders_approve_lock";
const baseKnownStoreMeta = {
  983189: { name: "eBay Buy4LessToday", marketplace: "ebay" },
  1034120: { name: "eBay OneLifeLuxuries4", marketplace: "ebay" },
  1040538: { name: "Walmart OneLifeLuxuries", marketplace: "walmart" },
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const normalizeStoreId = (storeId) => {
  const parsed = Number(storeId);
  return Number.isNaN(parsed) ? null : parsed;
};

const configuredTikTokStoreId = normalizeStoreId(process.env.SHIPSTATION_TIKTOK_STORE_ID);
const KNOWN_STORE_META = {
  ...baseKnownStoreMeta,
  ...(configuredTikTokStoreId
    ? {
        [configuredTikTokStoreId]: {
          name: String(process.env.SHIPSTATION_TIKTOK_STORE_NAME || "TikTok Shop").trim(),
          marketplace: "tiktok",
        },
      }
    : {}),
};

const listingColumnForStore = (storeId) => {
  if (storeId === 983189) return "ebayBuy4LessToday";
  if (storeId === 1034120) return "ebayOneLifeLuxuries4";
  if (storeId === 1040538) return "walmartOneLifeLuxuries";
  return null;
};

const getOrderStoreId = (order) => normalizeStoreId(order?.advancedOptions?.storeId || order?.storeId);

const inferMarketplaceFromOrder = (order) => {
  const known = KNOWN_STORE_META[getOrderStoreId(order)];
  if (known?.marketplace) return known.marketplace;

  const probe = [
    order?.storeName,
    order?.advancedOptions?.source,
    order?.advancedOptions?.storeName,
    order?.orderSourceCode,
    order?.source,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");

  if (probe.includes("tiktok")) return "tiktok";
  if (probe.includes("walmart")) return "walmart";
  if (probe.includes("ebay")) return "ebay";
  if (probe.includes("amazon")) return "amazon";
  if (probe.includes("temu")) return "temu";
  return "other";
};

const inferStoreNameFromOrder = (order) => {
  const storeId = getOrderStoreId(order);
  const known = KNOWN_STORE_META[storeId];
  if (known?.name) return known.name;

  const marketplace = inferMarketplaceFromOrder(order);
  if (marketplace === "tiktok") return "TikTok Shop";

  const candidates = [
    order?.storeName,
    order?.advancedOptions?.storeName,
    order?.advancedOptions?.source,
    order?.orderSourceCode,
    order?.source,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (candidates.length > 0) return candidates[0];
  if (storeId) return `Store ${storeId}`;
  return "Unknown Store";
};

const inferMarketplaceFromStore = ({ storeId, storeName = "" }) => {
  const known = KNOWN_STORE_META[normalizeStoreId(storeId)];
  if (known?.marketplace) return known.marketplace;

  const probe = String(storeName || "").trim().toLowerCase();
  if (probe.includes("tiktok")) return "tiktok";
  if (probe.includes("walmart")) return "walmart";
  if (probe.includes("ebay")) return "ebay";
  if (probe.includes("amazon")) return "amazon";
  if (probe.includes("temu")) return "temu";
  return "other";
};

const parseSaleDate = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const buildAvailableStores = (orders = []) => {
  const stores = new Map();
  orders.forEach((order) => {
    const storeId = getOrderStoreId(order);
    if (!storeId) return;
    if (stores.has(storeId)) return;
    stores.set(storeId, {
      id: String(storeId),
      name: inferStoreNameFromOrder(order),
      marketplace: inferMarketplaceFromOrder(order),
    });
  });

  return Array.from(stores.values()).sort((left, right) =>
    String(left.name || "").localeCompare(String(right.name || ""))
  );
};

const extractOrdersArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.orders)) return payload.orders;
  return [];
};

const isNonProductOrderItem = (item = {}) => {
  const name = String(item?.name || "").trim().toLowerCase();
  const sku = String(item?.sku || "").trim().toLowerCase();
  const probe = `${name} ${sku}`;

  return (
    probe.includes("platform discount") ||
    probe.includes("seller discount") ||
    probe.includes("shipping discount")
  );
};

const normalizeApprovalItems = (items = []) =>
  items
    .map((item) => {
      if (isNonProductOrderItem(item)) return null;
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
        storeName: String(item.storeName || "").trim() || `Store ${storeId}`,
        saleDate: parseSaleDate(item.orderDate),
        marketplace: inferMarketplaceFromStore({
          storeId,
          storeName: String(item.storeName || "").trim(),
        }),
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

const resolveProductsForSkus = async (skuTotals, options = {}) => {
  const transaction = options.transaction;
  const skuCache = new Map();
  const resolveProduct = async (sku) => {
    if (skuCache.has(sku)) return skuCache.get(sku);
    let product = await Products.findOne({ where: { sku }, transaction });
    if (!product) {
      product = await Products.findOne({ where: { alternativeSku: sku }, transaction });
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

const buildNotFoundItems = (missingSkus, skuTotals) =>
  missingSkus.map((sku) => ({
    requestedSku: sku,
    quantityToDeduct: skuTotals.get(sku) || 0,
  }));

const buildMarketplaceSalesRows = ({ processedItems, productUpdates, batchId, approvedBy, approvedAt }) => {
  const canonicalSkuByRequestedSku = new Map(
    productUpdates.map((row) => [String(row.requestedSku), String(row.sku)])
  );
  const groupedRows = new Map();

  processedItems.forEach((item) => {
    const canonicalSku = canonicalSkuByRequestedSku.get(String(item.sku));
    if (!canonicalSku) return;

    const saleDate = parseSaleDate(item.saleDate);
    const storeName = String(item.storeName || "").trim() || `Store ${item.storeId}`;
    const marketplace = String(item.marketplace || "").trim() || inferMarketplaceFromStore(item);
    const rowKey = `${item.orderId}__${item.storeId}__${canonicalSku}__${saleDate}`;

    if (!groupedRows.has(rowKey)) {
      groupedRows.set(rowKey, {
        orderId: item.orderId,
        storeId: item.storeId,
        storeName,
        marketplace,
        saleDate,
        sku: canonicalSku,
        quantity: 0,
        batchId,
        approvedAt,
        approvedBy,
      });
    }

    groupedRows.get(rowKey).quantity += Number(item.quantitySold || 0);
  });

  return Array.from(groupedRows.values()).filter((row) => Number(row.quantity || 0) > 0);
};

const findDuplicateMarketplaceOrders = async (normalizedItems, options = {}) => {
  const transaction = options.transaction;
  const orderScope = Array.from(
    new Map(
      normalizedItems.map((item) => [
        `${item.orderId}_${item.storeId}`,
        {
          orderId: item.orderId,
          storeId: item.storeId,
          storeName: item.storeName,
          marketplace: item.marketplace,
          saleDate: parseSaleDate(item.saleDate),
        },
      ])
    ).values()
  );

  if (orderScope.length === 0) {
    return [];
  }

  const existingRows = await MarketplaceSale.findAll({
    where: {
      [Op.or]: orderScope.map((row) => ({
        orderId: row.orderId,
        storeId: row.storeId,
      })),
    },
    attributes: ["orderId", "storeId", "storeName", "marketplace", "saleDate"],
    group: ["orderId", "storeId", "storeName", "marketplace", "saleDate"],
    transaction,
  });

  return existingRows.map((row) => ({
    orderId: String(row.orderId),
    storeId: normalizeStoreId(row.storeId),
    storeName: String(row.storeName || "").trim() || `Store ${row.storeId}`,
    marketplace: String(row.marketplace || "").trim() || "other",
    saleDate: parseSaleDate(row.saleDate),
    orderKey: `${row.orderId}_${row.storeId}`,
  }));
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
      res.json({ orders: allOrders, availableStores: buildAvailableStores(allOrders) });
      return;
    }
    const singleStoreId = storeIds.length === 1 ? storeIds[0] : undefined;
    const orders = await fetchAllAwaitingShipmentOrders(TOKEN, singleStoreId ? { storeid: singleStoreId } : {});
    res.json({ orders, availableStores: buildAvailableStores(orders) });
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

router.post("/approve-preview", auth, checkPermission('orders', 'approve'), async (req, res) => {
  const { items = [], selectedStores = [] } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "No order items provided for preview." });
  }

  try {
    const normalizedItems = normalizeApprovalItems(items);
    if (normalizedItems.length === 0) {
      return res.status(400).json({ error: "No valid order items to preview." });
    }

    const duplicateOrders = await findDuplicateMarketplaceOrders(normalizedItems);

    const { allOrderKeys, eligibleOrderKeys, alreadyProcessedCount, processedItems } =
      await getApprovalScope(normalizedItems);

    const { skuTotals } = buildDeductionMaps(processedItems);
    const { productUpdates, missingSkus } = await resolveProductsForSkus(skuTotals);
    const notFoundItems = buildNotFoundItems(missingSkus, skuTotals);

    const previewRows = productUpdates.map((row) => ({
      requestedSku: row.requestedSku,
      deductedSku: row.sku,
      quantityToDeduct: row.quantitySold,
      currentQuantity: row.currentQuantity,
      projectedQuantity: row.newQuantity,
      status: "ready",
    }));

    return res.json({
      success: true,
      summary: {
        ordersReceived: allOrderKeys.length,
        ordersToProcess: eligibleOrderKeys.length,
        ordersSkippedAlreadyApproved: alreadyProcessedCount,
        duplicateOrders,
        skusReadyToUpdate: productUpdates.length,
        skusMissing: missingSkus.length,
        notFoundItems,
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

router.post("/approve-batch", auth, checkPermission('orders', 'approve'), async (req, res) => {
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

    const duplicateOrders = await findDuplicateMarketplaceOrders(normalizedItems);
    if (duplicateOrders.length > 0) {
      return res.status(409).json({
        error: "One or more orders were already recorded in marketplace sales.",
        details: "Remove the duplicate orders from the approval batch and retry.",
        duplicateOrders,
      });
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
    const batchId = `orders_${new Date().toISOString().slice(0, 10)}_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const approvedAt = new Date();
    const listingResults = [];
    const lowStockAlerts = [];
    const transactionResult = await sequelize.transaction(async (transaction) => {
      const duplicateOrdersInTransaction = await findDuplicateMarketplaceOrders(normalizedItems, {
        transaction,
      });
      if (duplicateOrdersInTransaction.length > 0) {
        const duplicateError = new Error("One or more orders were already recorded in marketplace sales.");
        duplicateError.statusCode = 409;
        duplicateError.details = "Remove the duplicate orders from the approval batch and retry.";
        duplicateError.duplicateOrders = duplicateOrdersInTransaction;
        throw duplicateError;
      }

      const { productUpdates, missingSkus } = await resolveProductsForSkus(skuTotals, { transaction });
    const notFoundItems = buildNotFoundItems(missingSkus, skuTotals);

      let productUpdateResult = { success: true, results: [] };
      if (productUpdates.length > 0) {
        productUpdateResult = await StockUpdateService.updateMultipleProductQuantities(
          productUpdates.map((u) => ({ sku: u.sku, newQuantity: u.newQuantity })),
          {
            transaction,
            lowStockAlerts,
          }
        );
      }

      for (const update of Array.from(skuStoreTotals.values())) {
        const storeIdNum = normalizeStoreId(update.storeId);
        const columnToUpdate = listingColumnForStore(storeIdNum);
        if (!columnToUpdate) {
          continue;
        }

        let product = await Products.findOne({ where: { sku: update.sku }, transaction });
        if (!product) {
          product = await Products.findOne({ where: { alternativeSku: update.sku }, transaction });
        }
        if (!product) {
          listingResults.push(`Skipped ${update.sku}: no product mapping`);
          continue;
        }

        const listing = await Listings.findByPk(product.sku, { transaction });
        if (!listing) {
          listingResults.push(`Skipped ${update.sku}: no listing found for ${product.sku}`);
          continue;
        }

        const newQty = Math.max(toNumber(listing[columnToUpdate], 0) - update.quantitySold, 0);
        listing[columnToUpdate] = newQty;
        await listing.save({ transaction });
        listingResults.push(`Updated ${product.sku} ${columnToUpdate} => ${newQty}`);
      }

      const marketplaceSalesRows = buildMarketplaceSalesRows({
        processedItems,
        productUpdates,
        batchId,
        approvedBy: req.user?.id || null,
        approvedAt,
      });

      if (marketplaceSalesRows.length > 0) {
        await MarketplaceSale.bulkCreate(marketplaceSalesRows, { transaction });
      }

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
          notFoundItems,
          marketplaceSalesRecorded: marketplaceSalesRows.length,
          listingUpdatesApplied: listingResults.filter((r) => r.startsWith("Updated")).length,
          productUpdateResult,
          listingResults,
        },
      }, { transaction });

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
        })),
        { transaction }
      );

      return {
        productUpdates,
        missingSkus,
        notFoundItems,
        marketplaceSalesRows,
      };
    });

    for (const product of lowStockAlerts) {
      LowStockAlertService.sendEmailAlert(product).catch((err) => {
        console.error("Failed to send low stock alert email:", err);
      });
    }

    return res.json({
      success: true,
      batchId,
      summary: {
        ordersReceived: allOrderKeys.length,
        ordersProcessed: eligibleOrderKeys.length,
        ordersSkippedAlreadyApproved: alreadyProcessedCount,
        skusUpdated: transactionResult.productUpdates.length,
        skusMissing: transactionResult.missingSkus.length,
        notFoundItems: transactionResult.notFoundItems,
        marketplaceSalesRecorded: transactionResult.marketplaceSalesRows.length,
        listingUpdatesApplied: listingResults.filter((r) => r.startsWith("Updated")).length,
        errors: listingResults.filter((r) => r.startsWith("Skipped")),
        selectedStores,
      },
    });
  } catch (error) {
    console.error("Error approving order batch:", error);
    return res.status(error.statusCode || 500).json({
      error: "Failed to approve order batch.",
      details: error.details || error.message,
      duplicateOrders: error.duplicateOrders || [],
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

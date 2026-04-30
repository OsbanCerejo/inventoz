const { Op } = require("sequelize");
const {
  WalmartConnection,
  WalmartItem,
  WalmartInventorySnapshot,
  WalmartPricingSnapshot,
  WalmartOrder,
  WalmartOrderLine,
  WalmartProductMapping,
  WalmartSyncRun,
  WalmartSyncError,
  Products,
  User,
  sequelize,
} = require("../models");
const WalmartAuthService = require("./WalmartAuthService");
const WalmartApiClient = require("./WalmartApiClient");

const RESOURCE_TO_CONNECTION_FIELD = {
  orders: "lastOrdersSyncAt",
  items: "lastItemsSyncAt",
  inventory: "lastInventorySyncAt",
  pricing: "lastPricingSyncAt",
};

const VALID_RESOURCES = new Set(["orders", "items", "inventory", "pricing"]);

const safeJson = (value) => {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({ error: "Unable to serialize payload." });
  }
};

const coerceDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toIntegerOrNull = (value) => {
  const numeric = toNumberOrNull(value);
  if (numeric === null) return null;
  return Math.round(numeric);
};

const firstNonEmpty = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
};

const getFulfilledByLabel = (fulfillmentOption) => {
  const raw = String(fulfillmentOption || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("wfs")) return "WFS";
  if (raw.includes("seller") || raw.includes("s2h")) return "Seller";
  if (raw.includes("3pl")) return "3PL";
  return String(fulfillmentOption || "").trim() || null;
};

const parseWalmartSkuReference = (rawSku) => {
  const walmartSku = String(rawSku || "").trim();
  if (!walmartSku) {
    return {
      walmartSku: null,
      canonicalSku: null,
      unitsPerListing: 1,
      isAliasSku: false,
    };
  }

  const match = walmartSku.match(/^(.*)_lot_of_([^_]+)$/i);
  if (!match) {
    return {
      walmartSku,
      canonicalSku: walmartSku,
      unitsPerListing: 1,
      isAliasSku: false,
    };
  }

  const canonicalSku = String(match[1] || "").trim() || walmartSku;
  const suffix = String(match[2] || "").trim();
  const parsedUnits = Number.parseInt(suffix, 10);

  return {
    walmartSku,
    canonicalSku,
    unitsPerListing: Number.isFinite(parsedUnits) && parsedUnits > 0 ? parsedUnits : 1,
    isAliasSku: true,
  };
};

const findLocalProductForWalmartSku = async (walmartSku, transaction) => {
  const parsedSku = parseWalmartSkuReference(walmartSku);
  const candidateSkus = [...new Set([parsedSku.walmartSku, parsedSku.canonicalSku].filter(Boolean))];

  for (const sku of candidateSkus) {
    const localProduct = await Products.findOne({ where: { sku }, transaction });
    if (localProduct) {
      return {
        localProduct,
        parsedSku,
      };
    }
  }

  return {
    localProduct: null,
    parsedSku,
  };
};

const getConnection = async () => {
  const clientIdHint = WalmartAuthService.getClientIdHint();
  const { market, baseUrl } = WalmartAuthService.getCredentials();
  const [connection] = await WalmartConnection.findOrCreate({
    where: { id: 1 },
    defaults: {
      storeName: "Walmart USA Store",
      market,
      apiBaseUrl: baseUrl,
      clientIdHint,
      status: WalmartAuthService.hasCredentials() ? "disconnected" : "error",
    },
  });

  if (
    connection.market !== market ||
    connection.apiBaseUrl !== baseUrl ||
    connection.clientIdHint !== clientIdHint
  ) {
    await connection.update({ market, apiBaseUrl: baseUrl, clientIdHint });
  }

  return connection;
};

const recordConnectionError = async (message, userId = null) => {
  const connection = await getConnection();
  await connection.update({
    status: "error",
    lastTokenErrorAt: new Date(),
    lastTokenErrorMessage: message,
    lastUpdatedBy: userId,
  });
  return connection;
};

const testConnection = async (userId = null) => {
  const connection = await getConnection();
  if (!WalmartAuthService.hasCredentials()) {
    await recordConnectionError("Missing Walmart API credentials.", userId);
    throw new Error("Missing Walmart API credentials. Set WALMART_CLIENT_ID and WALMART_CLIENT_SECRET.");
  }

  try {
    await WalmartAuthService.getAccessToken({ forceRefresh: true });
    await connection.update({
      status: "active",
      lastTokenSuccessAt: new Date(),
      lastTokenErrorAt: null,
      lastTokenErrorMessage: null,
      lastUpdatedBy: userId,
    });
    return connection;
  } catch (error) {
    await recordConnectionError(error.message || "Failed to fetch Walmart token.", userId);
    throw error;
  }
};

const createRun = async (resourceType, triggerType, userId) => {
  if (!VALID_RESOURCES.has(resourceType)) {
    throw new Error(`Unsupported Walmart sync resource: ${resourceType}`);
  }

  return WalmartSyncRun.create({
    resourceType,
    triggerType,
    status: "running",
    startedAt: new Date(),
    requestedBy: userId || null,
  });
};

const addRunError = async (runId, resourceType, error, meta = {}) => {
  await WalmartSyncError.create({
    syncRunId: runId,
    resourceType,
    referenceType: meta.referenceType || null,
    referenceValue: meta.referenceValue || null,
    errorCode: meta.errorCode || error?.code || String(error?.response?.status || ""),
    errorMessage: error?.message || String(error),
    payloadSnippet: meta.payload ? safeJson(meta.payload) : null,
  });
};

const finishRun = async (run, updates) => {
  await run.update({
    completedAt: new Date(),
    ...updates,
  });
  return run;
};

const updateConnectionAfterRun = async (resourceType, run, userId) => {
  const connection = await getConnection();
  const field = RESOURCE_TO_CONNECTION_FIELD[resourceType];
  const values = {
    status: run.status === "failed" ? "error" : "active",
    lastUpdatedBy: userId || null,
  };
  if (field && run.status !== "failed") {
    values[field] = new Date();
  }
  await connection.update(values);
  return connection;
};

const extractOrders = (payload) => {
  if (Array.isArray(payload?.elements?.order)) return payload.elements.order;
  if (Array.isArray(payload?.list?.elements?.order)) return payload.list.elements.order;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.elements)) return payload.elements;
  return [];
};

const extractOrdersNextCursor = (payload) =>
  firstNonEmpty(payload?.list?.meta?.nextCursor, payload?.meta?.nextCursor, payload?.nextCursor);

const extractOrderLines = (order) => {
  if (Array.isArray(order?.orderLines?.orderLine)) return order.orderLines.orderLine;
  if (Array.isArray(order?.orderLines)) return order.orderLines;
  if (Array.isArray(order?.lines)) return order.lines;
  return [];
};

const getLatestLineStatus = (line) => {
  const statuses = line?.orderLineStatuses?.orderLineStatus;
  if (Array.isArray(statuses) && statuses.length > 0) {
    const sorted = [...statuses].sort((a, b) => {
      const aTime = Number(firstNonEmpty(a?.statusDate, a?.statusTime) || 0);
      const bTime = Number(firstNonEmpty(b?.statusDate, b?.statusTime) || 0);
      return bTime - aTime;
    });
    return firstNonEmpty(sorted[0]?.status, statuses[0]?.status);
  }
  return firstNonEmpty(line?.status);
};

const getOrderStatusLabel = (order) => {
  const directStatus = firstNonEmpty(order?.orderStatus, order?.status);
  if (directStatus) {
    return directStatus;
  }

  const lineStatuses = [
    ...new Set(
      extractOrderLines(order)
        .map((line) => getLatestLineStatus(line))
        .filter((value) => typeof value === "string" && value.trim())
    ),
  ];

  if (lineStatuses.length === 0) {
    return null;
  }
  if (lineStatuses.length === 1) {
    return lineStatuses[0];
  }
  return lineStatuses.join(", ");
};

const buildOrdersPath = (nextCursor = null) => {
  if (nextCursor) {
    return nextCursor.startsWith("?") ? `/v3/orders${nextCursor}` : `/v3/orders?nextCursor=${encodeURIComponent(nextCursor)}`;
  }

  const createdEndDate = new Date();
  const createdStartDate = new Date(createdEndDate.getTime() - 180 * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    limit: "100",
    productInfo: "true",
    replacementInfo: "false",
    createdStartDate: createdStartDate.toISOString(),
    createdEndDate: createdEndDate.toISOString(),
  });
  return `/v3/orders?${params.toString()}`;
};

const upsertOrder = async (order, transaction) => {
  const purchaseOrderId = firstNonEmpty(
    order?.purchaseOrderId,
    order?.purchaseOrderNumber,
    order?.customerOrderId
  );
  if (!purchaseOrderId) {
    throw new Error("Walmart order payload did not include purchaseOrderId.");
  }

  const shippingInfo = order?.shippingInfo || {};
  const postalAddress = shippingInfo?.postalAddress || shippingInfo?.address || {};
  const orderData = {
    purchaseOrderId,
    customerOrderId: firstNonEmpty(order?.customerOrderId, order?.customerOrderNumber),
    orderDate: coerceDate(firstNonEmpty(order?.orderDate, order?.purchaseOrderDate, order?.createdDate)),
    shippingMethod: firstNonEmpty(order?.shippingMethod, shippingInfo?.methodCode),
    orderStatus: getOrderStatusLabel(order),
    fulfillmentOption: firstNonEmpty(
      order?.fulfillment?.method,
      order?.fulfillmentOption,
      order?.shippingProgramType
    ),
    customerName: firstNonEmpty(shippingInfo?.postalAddress?.name, order?.customerName),
    customerEmailMasked: firstNonEmpty(order?.customerEmailId, order?.customerEmailMasked),
    shippingCity: firstNonEmpty(postalAddress?.city, postalAddress?.cityName),
    shippingState: firstNonEmpty(postalAddress?.state, postalAddress?.stateCode),
    shippingPostalCode: firstNonEmpty(postalAddress?.postalCode, postalAddress?.zipCode),
    shippingCountry: firstNonEmpty(postalAddress?.country, postalAddress?.countryCode),
    totalAmount: toNumberOrNull(firstNonEmpty(order?.orderTotal?.amount, order?.totalAmount?.amount)),
    currency: firstNonEmpty(order?.orderTotal?.currency, order?.totalAmount?.currency),
    acknowledgedAt: coerceDate(order?.acknowledgedDate),
    shippedAt: coerceDate(order?.shippingInfo?.estimatedShipDate),
    deliveredAt: coerceDate(order?.shippingInfo?.estimatedDeliveryDate),
    cancelledAt: coerceDate(order?.cancelDate),
    rawPayload: safeJson(order),
    lastSyncedAt: new Date(),
  };

  const [record, created] = await WalmartOrder.findOrCreate({
    where: { purchaseOrderId },
    defaults: orderData,
    transaction,
  });

  if (!created) {
    await record.update(orderData, { transaction });
  }

  await WalmartOrderLine.destroy({ where: { walmartOrderId: record.id }, transaction });
  const lines = extractOrderLines(order);
  if (lines.length > 0) {
    await WalmartOrderLine.bulkCreate(
      lines.map((line) => ({
        walmartOrderId: record.id,
        purchaseOrderId,
        lineNumber: String(firstNonEmpty(line?.lineNumber, line?.orderLineNumber, line?.lineId) || ""),
        walmartSku: firstNonEmpty(line?.item?.sku, line?.sku, line?.sellerSku),
        productName: firstNonEmpty(line?.item?.productName, line?.productName, line?.item?.itemName),
        quantity: toIntegerOrNull(
          firstNonEmpty(line?.orderLineQuantity?.amount, line?.quantity?.amount, line?.quantity)
        ),
        unitPrice: toNumberOrNull(
          firstNonEmpty(line?.price?.amount, line?.unitPrice?.amount, line?.charges?.charge?.[0]?.chargeAmount?.amount)
        ),
        shippingPrice: toNumberOrNull(firstNonEmpty(line?.shippingPrice?.amount)),
        taxAmount: toNumberOrNull(firstNonEmpty(line?.tax?.taxAmount?.amount, line?.taxAmount?.amount)),
        lineStatus: firstNonEmpty(line?.orderLineStatuses?.orderLineStatus?.[0]?.status, line?.status),
        trackingNumber: firstNonEmpty(
          line?.orderLineStatuses?.orderLineStatus?.[0]?.trackingInfo?.trackingNumber
        ),
        carrier: firstNonEmpty(
          line?.orderLineStatuses?.orderLineStatus?.[0]?.trackingInfo?.carrierName?.carrier
        ),
        rawPayload: safeJson(line),
        lastSyncedAt: new Date(),
      })),
      { transaction }
    );
  }

  return { created };
};

const extractItems = (payload) => {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.ItemResponse)) return payload.ItemResponse;
  if (Array.isArray(payload?.payload)) return payload.payload;
  if (Array.isArray(payload?.elements)) return payload.elements;
  return [];
};

const extractItemsNextCursor = (payload) =>
  firstNonEmpty(payload?.nextCursor, payload?.meta?.nextCursor, payload?.list?.meta?.nextCursor);

const buildItemsPath = (nextCursor = "*") => {
  const params = new URLSearchParams({
    limit: "100",
    nextCursor: nextCursor || "*",
  });
  return `/v3/items?${params.toString()}`;
};

const upsertItem = async (item, transaction) => {
  const walmartSku = firstNonEmpty(item?.sku, item?.sellerSku, item?.mart);
  if (!walmartSku) {
    throw new Error("Walmart item payload did not include a SKU.");
  }

  const itemData = {
    walmartSku,
    walmartItemId: firstNonEmpty(item?.itemId, item?.wpid, item?.walmartItemId),
    productName: firstNonEmpty(item?.productName, item?.title, item?.name),
    brand: firstNonEmpty(item?.brand, item?.brandName),
    publishedStatus: firstNonEmpty(item?.publishedStatus, item?.published),
    lifecycleStatus: firstNonEmpty(item?.lifecycleStatus, item?.status),
    productType: firstNonEmpty(item?.productType, item?.category),
    gtin: firstNonEmpty(item?.gtin, item?.upc, item?.barcode),
    currentPrice: toNumberOrNull(firstNonEmpty(item?.price?.amount, item?.currentPrice?.amount, item?.price)),
    currency: firstNonEmpty(item?.price?.currency, item?.currency),
    rawPayload: safeJson(item),
    lastSyncedAt: new Date(),
  };

  const [record, created] = await WalmartItem.findOrCreate({
    where: { walmartSku },
    defaults: itemData,
    transaction,
  });

  if (!created) {
    await record.update(itemData, { transaction });
  }

  const { localProduct, parsedSku } = await findLocalProductForWalmartSku(walmartSku, transaction);
  if (localProduct) {
    const [mapping] = await WalmartProductMapping.findOrCreate({
      where: { localSku: localProduct.sku, walmartSku },
      defaults: {
        walmartItemId: itemData.walmartItemId,
        walmartProductId: itemData.walmartItemId,
        listingStatus: firstNonEmpty(itemData.publishedStatus, itemData.lifecycleStatus),
        lastSyncedAt: new Date(),
        lastSyncStatus: "synced",
      },
      transaction,
    });

    if (!mapping.isNewRecord) {
      await mapping.update(
        {
          walmartItemId: itemData.walmartItemId,
          walmartProductId: itemData.walmartItemId,
          listingStatus: firstNonEmpty(itemData.publishedStatus, itemData.lifecycleStatus),
          lastSyncedAt: new Date(),
          lastSyncStatus: "synced",
          lastSyncError: null,
        },
        { transaction }
      );
    }
  }

  return { created };
};

const extractInventoryRows = (payload) => {
  if (Array.isArray(payload?.elements?.inventories)) return payload.elements.inventories;
  if (Array.isArray(payload?.elements?.inventory)) return payload.elements.inventory;
  if (Array.isArray(payload?.inventory)) return payload.inventory;
  if (Array.isArray(payload?.inventories)) return payload.inventories;
  if (Array.isArray(payload?.elements)) return payload.elements;
  return [];
};

const extractInventoryNextCursor = (payload) =>
  firstNonEmpty(payload?.meta?.nextCursor, payload?.list?.meta?.nextCursor, payload?.nextCursor);

const buildInventoryPath = (nextCursor = null) => {
  if (nextCursor) {
    return nextCursor.startsWith("?")
      ? `/v3/inventories${nextCursor}`
      : `/v3/inventories?nextCursor=${encodeURIComponent(nextCursor)}`;
  }

  const params = new URLSearchParams({
    limit: "50",
  });
  return `/v3/inventories?${params.toString()}`;
};

const upsertInventorySnapshot = async (entry, transaction) => {
  const walmartSku = firstNonEmpty(entry?.sku, entry?.sellerSku, entry?.mart);
  if (!walmartSku) {
    throw new Error("Walmart inventory payload did not include a SKU.");
  }

  const nodes = Array.isArray(entry?.nodes) ? entry.nodes : [];
  const availableFromNodes = nodes.reduce((sum, node) => {
    const amount = toNumberOrNull(
      firstNonEmpty(
        node?.availToSellQty?.amount,
        node?.availableToSellQty?.amount,
        node?.quantity?.amount,
        node?.quantity,
        node?.availableQuantity
      )
    );
    return sum + (amount || 0);
  }, 0);
  const derivedAvailableQuantity =
    nodes.length > 0
      ? availableFromNodes
      : toIntegerOrNull(
          firstNonEmpty(
            entry?.availToSellQty?.amount,
            entry?.availableToSellQty?.amount,
            entry?.quantity?.amount,
            entry?.quantity,
            entry?.availableQuantity
          )
        );

  await WalmartInventorySnapshot.create(
    {
      walmartSku,
      fulfillmentType: firstNonEmpty(entry?.fulfillmentType, entry?.fulfillment?.type),
      shipNode:
        firstNonEmpty(entry?.shipNode, entry?.node, entry?.fulfillment?.shipNode) ||
        (nodes.length > 1 ? "MULTI_NODE" : firstNonEmpty(nodes[0]?.shipNode)),
      availableQuantity: derivedAvailableQuantity,
      rawPayload: safeJson(entry),
      syncedAt: new Date(),
    },
    { transaction }
  );

  return { created: true };
};

const upsertPricingSnapshot = async (entry, transaction) => {
  const walmartSku = firstNonEmpty(entry?.sku, entry?.sellerSku, entry?.mart);
  if (!walmartSku) {
    throw new Error("Walmart pricing payload did not include a SKU.");
  }

  await WalmartPricingSnapshot.create(
    {
      walmartSku,
      currentPrice: toNumberOrNull(
        firstNonEmpty(entry?.currentPrice?.amount, entry?.price?.amount, entry?.currentPrice, entry?.price)
      ),
      currency: firstNonEmpty(entry?.currentPrice?.currency, entry?.price?.currency, entry?.currency),
      comparisonPrice: toNumberOrNull(firstNonEmpty(entry?.comparisonPrice?.amount, entry?.comparisonPrice)),
      promoPrice: toNumberOrNull(firstNonEmpty(entry?.promoPrice?.amount, entry?.promoPrice)),
      promoStartAt: coerceDate(firstNonEmpty(entry?.promoStartDate, entry?.promoStartAt)),
      promoEndAt: coerceDate(firstNonEmpty(entry?.promoEndDate, entry?.promoEndAt)),
      rawPayload: safeJson(entry),
      syncedAt: new Date(),
    },
    { transaction }
  );

  return { created: true };
};

const syncOrders = async ({ userId, triggerType = "manual" } = {}) => {
  const run = await createRun("orders", triggerType, userId);
  try {
    await testConnection(userId);
    const orders = [];
    const seenCursors = new Set();
    let nextCursor = null;
    let pageCount = 0;

    do {
      const response = await WalmartApiClient.request({
        method: "GET",
        path: buildOrdersPath(nextCursor),
      });
      const pageOrders = extractOrders(response.data);
      const returnedCursor = extractOrdersNextCursor(response.data);
      orders.push(...pageOrders);
      pageCount += 1;

      nextCursor = returnedCursor;
      if (!nextCursor || seenCursors.has(nextCursor) || pageCount >= 100) {
        nextCursor = null;
      } else {
        seenCursors.add(nextCursor);
      }
    } while (nextCursor);

    let createdCount = 0;
    let updatedCount = 0;

    await sequelize.transaction(async (transaction) => {
      for (const order of orders) {
        const { created } = await upsertOrder(order, transaction);
        if (created) createdCount += 1;
        else updatedCount += 1;
      }
    });

    await finishRun(run, {
      status: "success",
      recordsFetched: orders.length,
      recordsInserted: createdCount,
      recordsUpdated: updatedCount,
      errorCount: 0,
      summaryMessage: `Synced ${orders.length} Walmart orders across ${pageCount} page(s).`,
    });
    await updateConnectionAfterRun("orders", run, userId);
    return run.reload({
      include: [{ model: WalmartSyncError, as: "errors", required: false }],
    });
  } catch (error) {
    await addRunError(run.id, "orders", error, { payload: error?.response?.data });
    await finishRun(run, {
      status: "failed",
      recordsFetched: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      errorCount: 1,
      summaryMessage: error.message || "Walmart orders sync failed.",
    });
    await updateConnectionAfterRun("orders", run, userId);
    throw error;
  }
};

const syncItems = async ({ userId, triggerType = "manual" } = {}) => {
  const run = await createRun("items", triggerType, userId);
  try {
    await testConnection(userId);
    const items = [];
    const seenCursors = new Set();
    let nextCursor = "*";
    let pageCount = 0;

    do {
      const response = await WalmartApiClient.request({
        method: "GET",
        path: buildItemsPath(nextCursor),
      });
      const pageItems = extractItems(response.data);
      const returnedCursor = extractItemsNextCursor(response.data);
      items.push(...pageItems);
      pageCount += 1;

      nextCursor = returnedCursor;
      if (!nextCursor || seenCursors.has(nextCursor) || pageCount >= 100) {
        nextCursor = null;
      } else {
        seenCursors.add(nextCursor);
      }
    } while (nextCursor);

    let createdCount = 0;
    let updatedCount = 0;

    await sequelize.transaction(async (transaction) => {
      for (const item of items) {
        const { created } = await upsertItem(item, transaction);
        if (created) createdCount += 1;
        else updatedCount += 1;
      }
    });

    await finishRun(run, {
      status: "success",
      recordsFetched: items.length,
      recordsInserted: createdCount,
      recordsUpdated: updatedCount,
      errorCount: 0,
      summaryMessage: `Synced ${items.length} Walmart items across ${pageCount} page(s).`,
    });
    await updateConnectionAfterRun("items", run, userId);
    return run.reload({
      include: [{ model: WalmartSyncError, as: "errors", required: false }],
    });
  } catch (error) {
    await addRunError(run.id, "items", error, { payload: error?.response?.data });
    await finishRun(run, {
      status: "failed",
      recordsFetched: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      errorCount: 1,
      summaryMessage: error.message || "Walmart items sync failed.",
    });
    await updateConnectionAfterRun("items", run, userId);
    throw error;
  }
};

const syncInventory = async ({ userId, triggerType = "manual" } = {}) => {
  const run = await createRun("inventory", triggerType, userId);
  try {
    await testConnection(userId);
    const entries = [];
    const seenCursors = new Set();
    let nextCursor = null;
    let pageCount = 0;

    do {
      const response = await WalmartApiClient.request({
        method: "GET",
        path: buildInventoryPath(nextCursor),
      });
      const pageEntries = extractInventoryRows(response.data);
      const returnedCursor = extractInventoryNextCursor(response.data);
      entries.push(...pageEntries);
      pageCount += 1;

      nextCursor = returnedCursor;
      if (!nextCursor || seenCursors.has(nextCursor) || pageCount >= 100) {
        nextCursor = null;
      } else {
        seenCursors.add(nextCursor);
      }
    } while (nextCursor);

    await sequelize.transaction(async (transaction) => {
      for (const entry of entries) {
        await upsertInventorySnapshot(entry, transaction);
      }
    });

    await finishRun(run, {
      status: "success",
      recordsFetched: entries.length,
      recordsInserted: entries.length,
      recordsUpdated: 0,
      errorCount: 0,
      summaryMessage: `Synced ${entries.length} Walmart inventory rows across ${pageCount} page(s).`,
    });
    await updateConnectionAfterRun("inventory", run, userId);
    return run.reload({
      include: [{ model: WalmartSyncError, as: "errors", required: false }],
    });
  } catch (error) {
    await addRunError(run.id, "inventory", error, { payload: error?.response?.data });
    await finishRun(run, {
      status: "failed",
      recordsFetched: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      errorCount: 1,
      summaryMessage: error.message || "Walmart inventory sync failed.",
    });
    await updateConnectionAfterRun("inventory", run, userId);
    throw error;
  }
};

const syncPricing = async ({ userId, triggerType = "manual" } = {}) => {
  const run = await createRun("pricing", triggerType, userId);
  try {
    await testConnection(userId);
    const items = await WalmartItem.findAll({ order: [["updatedAt", "DESC"]], limit: 2000 });

    await sequelize.transaction(async (transaction) => {
      for (const item of items) {
        await upsertPricingSnapshot(
          {
            sku: item.walmartSku,
            currentPrice: item.currentPrice,
            currency: item.currency,
          },
          transaction
        );
      }
    });

    await finishRun(run, {
      status: "success",
      recordsFetched: items.length,
      recordsInserted: items.length,
      recordsUpdated: 0,
      errorCount: 0,
      summaryMessage: `Synced ${items.length} Walmart pricing snapshots from item data.`,
    });
    await updateConnectionAfterRun("pricing", run, userId);
    return run.reload({
      include: [{ model: WalmartSyncError, as: "errors", required: false }],
    });
  } catch (error) {
    await addRunError(run.id, "pricing", error, { payload: error?.response?.data });
    await finishRun(run, {
      status: "failed",
      recordsFetched: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      errorCount: 1,
      summaryMessage: error.message || "Walmart pricing sync failed.",
    });
    await updateConnectionAfterRun("pricing", run, userId);
    throw error;
  }
};

const syncCatalog = async ({ userId, triggerType = "manual" } = {}) => {
  const runs = [];
  runs.push(await syncItems({ userId, triggerType }));
  runs.push(await syncInventory({ userId, triggerType }));
  runs.push(await syncPricing({ userId, triggerType }));

  return {
    resourceType: "catalog",
    status: runs.some((run) => run.status === "failed") ? "failed" : "success",
    runs,
    summaryMessage: "Walmart catalog sync completed.",
  };
};

const syncAll = async ({ userId, triggerType = "manual" } = {}) => {
  const runs = [];
  runs.push(await syncOrders({ userId, triggerType }));
  runs.push(await syncCatalog({ userId, triggerType }));

  return {
    resourceType: "all",
    status: runs.some((run) => run.status === "failed") ? "failed" : "success",
    runs,
    summaryMessage: "All Walmart syncs completed.",
  };
};

const updateInventoryForSku = async ({
  walmartSku,
  quantity,
  inventoryAvailableDate,
  shipNode,
  userId,
} = {}) => {
  const parsedQuantity = toIntegerOrNull(quantity);
  if (!walmartSku) {
    throw new Error("Walmart SKU is required for inventory updates.");
  }
  if (parsedQuantity === null || parsedQuantity < 0) {
    throw new Error("Inventory quantity must be zero or greater.");
  }

  await testConnection(userId);

  const latestSnapshot = await WalmartInventorySnapshot.findOne({
    where: { walmartSku },
    order: [["syncedAt", "DESC"], ["id", "DESC"]],
  });

  const resolvedShipNode =
    firstNonEmpty(shipNode, latestSnapshot?.shipNode) === "MULTI_NODE"
      ? null
      : firstNonEmpty(shipNode, latestSnapshot?.shipNode);

  const payload = {
    sku: walmartSku,
    quantity: {
      unit: "EACH",
      amount: parsedQuantity,
    },
    inventoryAvailableDate:
      inventoryAvailableDate || new Date().toISOString().slice(0, 10),
  };

  const requestConfig = resolvedShipNode
    ? {
        method: "PUT",
        path: `/v3/inventories/${encodeURIComponent(walmartSku)}`,
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          inventories: {
            nodes: [
              {
                shipNode: resolvedShipNode,
                inputQty: {
                  unit: "EACH",
                  amount: parsedQuantity,
                },
              },
            ],
          },
        },
        timeout: WalmartAuthService.REQUEST_TIMEOUT_MS,
      }
    : {
        method: "PUT",
        path: "/v3/inventory",
        headers: {
          "Content-Type": "application/json",
        },
        data: payload,
        timeout: WalmartAuthService.REQUEST_TIMEOUT_MS,
      };

  const response = await WalmartApiClient.request(requestConfig);

  await WalmartInventorySnapshot.create({
    walmartSku,
    fulfillmentType: latestSnapshot?.fulfillmentType || null,
    shipNode: resolvedShipNode || latestSnapshot?.shipNode || null,
    availableQuantity: parsedQuantity,
    rawPayload: safeJson({
      request: requestConfig.data,
      response: response.data,
    }),
    syncedAt: new Date(),
  });

  return {
    walmartSku,
    availableQuantity: parsedQuantity,
    shipNode: resolvedShipNode || null,
    response: response.data,
  };
};

const updatePriceForSku = async ({ walmartSku, price, currency = "USD", userId } = {}) => {
  const parsedPrice = toNumberOrNull(price);
  const normalizedCurrency = String(currency || "USD").trim().toUpperCase() || "USD";
  if (!walmartSku) {
    throw new Error("Walmart SKU is required for price updates.");
  }
  if (parsedPrice === null || parsedPrice < 0) {
    throw new Error("Price must be zero or greater.");
  }

  await testConnection(userId);

  const payload = {
    sku: walmartSku,
    pricing: [
      {
        currentPrice: {
          currency: normalizedCurrency,
          amount: parsedPrice,
        },
      },
    ],
  };

  const response = await WalmartApiClient.request({
    method: "PUT",
    path: "/v3/price",
    headers: {
      "Content-Type": "application/json",
    },
    data: payload,
  });

  await WalmartPricingSnapshot.create({
    walmartSku,
    currentPrice: parsedPrice,
    currency: normalizedCurrency,
    rawPayload: safeJson({
      request: payload,
      response: response.data,
    }),
    syncedAt: new Date(),
  });

  await WalmartItem.update(
    {
      currentPrice: parsedPrice,
      currency: normalizedCurrency,
      updatedAt: new Date(),
    },
    { where: { walmartSku } }
  );

  return {
    walmartSku,
    currentPrice: parsedPrice,
    currency: normalizedCurrency,
    response: response.data,
  };
};

const getRecentRuns = () =>
  WalmartSyncRun.findAll({
    include: [
      { model: WalmartSyncError, as: "errors", required: false },
      { model: User, as: "requester", attributes: ["id", "name", "username"], required: false },
    ],
    order: [["startedAt", "DESC"]],
    limit: 20,
  });

const getRecentErrors = () =>
  WalmartSyncError.findAll({
    where: {
      errorCode: {
        [Op.ne]: "DEBUG",
      },
    },
    include: [
      {
        model: WalmartSyncRun,
        as: "syncRun",
        attributes: ["id", "resourceType", "status", "startedAt", "completedAt"],
        required: true,
      },
    ],
    order: [["createdAt", "DESC"]],
    limit: 50,
  });

const getOrders = async (filters = {}) => {
  const where = {};
  const page = Math.max(Number(filters.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize || 100), 1), 200);
  if (filters.status) {
    where.orderStatus = filters.status;
  }
  if (filters.fulfilledBy) {
    const [matchingFulfillmentRows] = await sequelize.query(
      `
      SELECT DISTINCT fulfillmentOption AS fulfillmentValue
      FROM walmartOrders
      WHERE fulfillmentOption IS NOT NULL AND TRIM(fulfillmentOption) <> ''
      `
    );
    const matchingValues = (matchingFulfillmentRows || [])
      .map((row) => row.fulfillmentValue)
      .filter((value) => getFulfilledByLabel(value) === filters.fulfilledBy);

    if (matchingValues.length === 0) {
      where.fulfillmentOption = "__no_match__";
    } else {
      where.fulfillmentOption = { [Op.in]: matchingValues };
    }
  }
  if (filters.purchaseOrderId) {
    where.purchaseOrderId = { [Op.like]: `%${filters.purchaseOrderId}%` };
  }
  if (filters.fromDate || filters.toDate) {
    where.orderDate = {};
    if (filters.fromDate) where.orderDate[Op.gte] = new Date(filters.fromDate);
    if (filters.toDate) where.orderDate[Op.lte] = new Date(filters.toDate);
  }

  const { count, rows } = await WalmartOrder.findAndCountAll({
    where,
    include: [{ model: WalmartOrderLine, as: "lines", required: false }],
    distinct: true,
    order: [["orderDate", "DESC"], ["updatedAt", "DESC"]],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const [statusRows] = await sequelize.query(
    `
    SELECT DISTINCT orderStatus AS statusValue
    FROM walmartOrders
    WHERE orderStatus IS NOT NULL AND TRIM(orderStatus) <> ''
    ORDER BY statusValue ASC
    `
  );

  const [fulfillmentRows] = await sequelize.query(
    `
    SELECT DISTINCT fulfillmentOption AS fulfillmentValue
    FROM walmartOrders
    WHERE fulfillmentOption IS NOT NULL AND TRIM(fulfillmentOption) <> ''
    ORDER BY fulfillmentValue ASC
    `
  );

  const statusOptions = (statusRows || []).map((row) => row.statusValue).filter(Boolean);
  const fulfilledByOptions = [
    ...new Set(
      (fulfillmentRows || [])
        .map((row) => getFulfilledByLabel(row.fulfillmentValue))
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b));

  return {
    rows,
    count,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(count / pageSize), 1),
    statusOptions,
    fulfilledByOptions,
  };
};

const getOrderByPurchaseOrderId = (purchaseOrderId) =>
  WalmartOrder.findOne({
    where: { purchaseOrderId },
    include: [{ model: WalmartOrderLine, as: "lines", required: false }],
  });

const getSkuSnapshot = async (localSku) => {
  const mappings = await WalmartProductMapping.findAll({
    where: { localSku },
    include: [{ model: WalmartItem, as: "item", required: false }],
    order: [["updatedAt", "DESC"]],
  });

  const walmartSkus = mappings.map((mapping) => mapping.walmartSku).filter(Boolean);
  const [inventorySnapshots, pricingSnapshots] = await Promise.all([
    walmartSkus.length
      ? WalmartInventorySnapshot.findAll({
          where: { walmartSku: { [Op.in]: walmartSkus } },
          order: [["syncedAt", "DESC"]],
        })
      : [],
    walmartSkus.length
      ? WalmartPricingSnapshot.findAll({
          where: { walmartSku: { [Op.in]: walmartSkus } },
          order: [["syncedAt", "DESC"]],
        })
      : [],
  ]);

  const latestInventoryBySku = new Map();
  for (const row of inventorySnapshots) {
    if (!latestInventoryBySku.has(row.walmartSku)) {
      latestInventoryBySku.set(row.walmartSku, row);
    }
  }

  const latestPricingBySku = new Map();
  for (const row of pricingSnapshots) {
    if (!latestPricingBySku.has(row.walmartSku)) {
      latestPricingBySku.set(row.walmartSku, row);
    }
  }

  return mappings.map((mapping) => ({
    id: mapping.id,
    localSku: mapping.localSku,
    walmartSku: mapping.walmartSku,
    walmartItemId: mapping.walmartItemId,
    listingStatus: mapping.listingStatus,
    lastSyncedAt: mapping.lastSyncedAt,
    lastSyncStatus: mapping.lastSyncStatus,
    lastSyncError: mapping.lastSyncError,
    item: mapping.item,
    inventorySnapshot: latestInventoryBySku.get(mapping.walmartSku) || null,
    pricingSnapshot: latestPricingBySku.get(mapping.walmartSku) || null,
  }));
};

const getCatalog = async (filters = {}) => {
  const where = {};
  const page = Math.max(Number(filters.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize || 100), 1), 200);

  if (filters.search) {
    const likeSearch = `%${String(filters.search).trim()}%`;
    where[Op.or] = [
      { walmartSku: { [Op.like]: likeSearch } },
      { productName: { [Op.like]: likeSearch } },
      { brand: { [Op.like]: likeSearch } },
      { walmartItemId: { [Op.like]: likeSearch } },
    ];
  }

  if (filters.listingStatus) {
    where.publishedStatus = filters.listingStatus;
  }

  const include = [
    {
      model: WalmartProductMapping,
      as: "mappings",
      required: filters.mappingStatus === "mapped",
      where: filters.mappingStatus === "mapped" ? { isMapped: true } : undefined,
    },
  ];

  if (filters.mappingStatus === "unmapped") {
    include[0].required = false;
    where[Op.and] = [...(where[Op.and] || []), sequelize.where(sequelize.col("mappings.id"), Op.is, null)];
  }

  const { count, rows } = await WalmartItem.findAndCountAll({
    where,
    include,
    distinct: true,
    order: [["updatedAt", "DESC"], ["walmartSku", "ASC"]],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const walmartSkus = rows.map((item) => item.walmartSku).filter(Boolean);
  const [inventorySnapshots, pricingSnapshots] = await Promise.all([
    walmartSkus.length
      ? WalmartInventorySnapshot.findAll({
          where: { walmartSku: { [Op.in]: walmartSkus } },
          order: [["syncedAt", "DESC"]],
        })
      : [],
    walmartSkus.length
      ? WalmartPricingSnapshot.findAll({
          where: { walmartSku: { [Op.in]: walmartSkus } },
          order: [["syncedAt", "DESC"]],
        })
      : [],
  ]);

  const latestInventoryBySku = new Map();
  for (const row of inventorySnapshots) {
    if (!latestInventoryBySku.has(row.walmartSku)) {
      latestInventoryBySku.set(row.walmartSku, row);
    }
  }

  const latestPricingBySku = new Map();
  for (const row of pricingSnapshots) {
    if (!latestPricingBySku.has(row.walmartSku)) {
      latestPricingBySku.set(row.walmartSku, row);
    }
  }

  const listingStatusRows = await WalmartItem.findAll({
    attributes: [[sequelize.fn("DISTINCT", sequelize.col("publishedStatus")), "publishedStatus"]],
    where: {
      publishedStatus: {
        [Op.ne]: null,
      },
    },
    raw: true,
  });

  const catalogRows = rows.map((item) => {
    const mappings = Array.isArray(item.mappings) ? item.mappings : [];
    const primaryMapping = mappings[0] || null;
    return {
      id: item.id,
      walmartSku: item.walmartSku,
      walmartItemId: item.walmartItemId,
      productName: item.productName,
      brand: item.brand,
      listingStatus: item.publishedStatus || item.lifecycleStatus || "—",
      currentPrice: latestPricingBySku.get(item.walmartSku)?.currentPrice ?? item.currentPrice,
      currency: latestPricingBySku.get(item.walmartSku)?.currency ?? item.currency,
      availableQuantity: latestInventoryBySku.get(item.walmartSku)?.availableQuantity ?? null,
      shipNode: latestInventoryBySku.get(item.walmartSku)?.shipNode ?? null,
      lastSyncedAt: item.lastSyncedAt,
      localSku: primaryMapping?.localSku || null,
      mappingStatus: primaryMapping ? "mapped" : "unmapped",
      lastSyncStatus: primaryMapping?.lastSyncStatus || null,
      lastSyncError: primaryMapping?.lastSyncError || null,
    };
  });

  return {
    rows: catalogRows,
    count,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(count / pageSize), 1),
    listingStatusOptions: (listingStatusRows || [])
      .map((row) => row.publishedStatus)
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b))),
  };
};

module.exports = {
  getConnection,
  testConnection,
  syncOrders,
  syncItems,
  syncInventory,
  syncPricing,
  syncCatalog,
  syncAll,
  updateInventoryForSku,
  updatePriceForSku,
  getRecentRuns,
  getRecentErrors,
  getOrders,
  getOrderByPurchaseOrderId,
  getSkuSnapshot,
  getCatalog,
};

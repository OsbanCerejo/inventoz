const express = require("express");
const { Op } = require("sequelize");
const {
  InvoiceTrackerInvoice,
  InvoiceTrackerInvoiceItem,
  InvoiceTrackerInboundBatch,
  InvoiceTrackerInboundRow,
  Inbound,
  Logs,
  Products,
  User,
  sequelize,
} = require("../models");
const PricingService = require("../Services/PricingService");
const { auth } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permissions");

const router = express.Router();

const VALID_SHIPMENT_STATUSES = ["order_placed", "shipped", "received"];
const VALID_ITEM_CHECK_STATUSES = ["not_checked", "working_on_it", "verified", "missing_items"];
const VALID_INBOUND_STATUSES = ["pending", "partial", "done"];
const VALID_PAYMENT_STATUSES = ["paid", "unpaid", "credit"];
const VALID_MISMATCH_REASONS = [
  "short_shipped",
  "damaged",
  "backordered",
  "not_in_carton",
  "counting_error",
  "overage",
];
const MAX_VENDOR_NAME_LENGTH = 255;
const MAX_INVOICE_NUMBER_LENGTH = 255;
const MAX_NOTES_LENGTH = 5000;
const MAX_SKU_LENGTH = 255;
const MAX_ITEM_NAME_LENGTH = 255;
const MAX_QUANTITY = 100000;
const MAX_MONEY_AMOUNT = 1000000;

const listInvoiceIncludes = [
  {
    model: InvoiceTrackerInvoiceItem,
    as: "items",
    required: false,
    separate: true,
    order: [["createdAt", "ASC"]],
  },
  {
    model: User,
    as: "creator",
    attributes: ["id", "name", "username"],
    required: false,
  },
  {
    model: User,
    as: "updater",
    attributes: ["id", "name", "username"],
    required: false,
  },
];

const detailInvoiceIncludes = [
  ...listInvoiceIncludes,
  {
    model: InvoiceTrackerInboundRow,
    as: "inboundRows",
    required: false,
    separate: true,
    order: [
      ["resolutionStatus", "ASC"],
      ["sku", "ASC"],
      ["unitPrice", "ASC"],
      ["createdAt", "ASC"],
    ],
    include: [
      {
        model: User,
        as: "resolver",
        attributes: ["id", "name", "username"],
        required: false,
      },
      {
        model: User,
        as: "inbounder",
        attributes: ["id", "name", "username"],
        required: false,
      },
    ],
  },
  {
    model: InvoiceTrackerInboundBatch,
    as: "inboundBatches",
    required: false,
    separate: true,
    order: [["submittedAt", "DESC"]],
    include: [
      {
        model: User,
        as: "submitter",
        attributes: ["id", "name", "username"],
        required: false,
      },
    ],
  },
  {
    model: User,
    as: "inboundCompleter",
    attributes: ["id", "name", "username"],
    required: false,
  },
];

const sanitizeString = (value) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const parseExpectedUpdatedAt = (value) => {
  const normalized = sanitizeString(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const assertOptimisticLock = (invoice, expectedUpdatedAt) => {
  if (!expectedUpdatedAt) return null;
  const dbTime = new Date(invoice.updatedAt).getTime();
  const expectedTime = new Date(expectedUpdatedAt).getTime();
  if (dbTime !== expectedTime) {
    return {
      status: 409,
      body: {
        error: "This invoice was changed by another user. Refresh and try again.",
        code: "STALE_INVOICE",
      },
    };
  }
  return null;
};

const toMoneyNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_MONEY_AMOUNT) {
    return null;
  }
  return Number(parsed.toFixed(2));
};

const toPositiveInteger = (value, { allowZero = false } = {}) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  if (allowZero) {
    if (parsed < 0 || parsed > MAX_QUANTITY) return null;
    return parsed;
  }
  if (parsed <= 0 || parsed > MAX_QUANTITY) return null;
  return parsed;
};

const getDisplayUser = (user) => {
  if (!user) return null;
  return user.name || user.username || `User ${user.id}`;
};

const getInboundGroupingKey = (sku, unitPrice) => `${sku}__${Number(unitPrice || 0).toFixed(2)}`;

const serializeInboundRow = (row) => {
  const plain = row.get ? row.get({ plain: true }) : row;
  const expectedQty = Number(plain.expectedQty || 0);
  const actualQty = plain.actualQty === null || plain.actualQty === undefined ? null : Number(plain.actualQty);
  const deltaQty = plain.deltaQty === null || plain.deltaQty === undefined ? null : Number(plain.deltaQty);
  const unitPrice = Number(plain.unitPrice || 0);
  const inboundedQty =
    plain.inboundedQty === null || plain.inboundedQty === undefined ? null : Number(plain.inboundedQty);

  return {
    ...plain,
    unitPrice,
    expectedQty,
    actualQty,
    deltaQty,
    inboundedQty,
    lineValue: Number((unitPrice * expectedQty).toFixed(2)),
    actualValue:
      actualQty === null ? null : Number((unitPrice * Number(actualQty || 0)).toFixed(2)),
    resolverDisplay: getDisplayUser(plain.resolver),
    inbounderDisplay: getDisplayUser(plain.inbounder),
  };
};

const summarizeInboundRows = (rows) => {
  const serialized = rows.map(serializeInboundRow);
  return {
    totalRows: serialized.length,
    pendingRows: serialized.filter((row) => row.resolutionStatus === "pending").length,
    resolvedRows: serialized.filter((row) => row.resolutionStatus === "resolved").length,
    inboundedRows: serialized.filter((row) => row.resolutionStatus === "inbounded").length,
    mismatchRows: serialized.filter((row) => row.resolutionType === "mismatch").length,
    totalExpectedQty: serialized.reduce((sum, row) => sum + row.expectedQty, 0),
    totalResolvedQty: serialized.reduce(
      (sum, row) => sum + (row.actualQty === null || row.actualQty === undefined ? 0 : row.actualQty),
      0
    ),
    totalInboundedQty: serialized.reduce((sum, row) => sum + Number(row.inboundedQty || 0), 0),
  };
};

const serializeInvoice = (invoice) => {
  const plain = invoice.get ? invoice.get({ plain: true }) : invoice;
  const items = Array.isArray(plain.items) ? plain.items : [];
  const inboundRows = Array.isArray(plain.inboundRows) ? plain.inboundRows : [];
  const inboundBatches = Array.isArray(plain.inboundBatches) ? plain.inboundBatches : [];
  const miscellaneousAmount = Number(plain.miscellaneousAmount || 0);
  const shippingAmount = Number(plain.shippingAmount || 0);

  const serializedItems = items.map((item) => {
    const unitPrice = Number(item.unitPrice || 0);
    const quantity = Number(item.quantity || 0);
    return {
      ...item,
      unitPrice,
      quantity,
      lineTotal: Number((unitPrice * quantity).toFixed(2)),
    };
  });

  const itemsTotal = serializedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalAmount = itemsTotal + miscellaneousAmount + shippingAmount;
  const serializedInboundRows = inboundRows.map(serializeInboundRow);

  return {
    ...plain,
    miscellaneousAmount,
    shippingAmount,
    items: serializedItems,
    itemsTotal: Number(itemsTotal.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2)),
    itemCount: serializedItems.length,
    inboundRows: serializedInboundRows,
    inboundSummary: summarizeInboundRows(serializedInboundRows),
    inboundCompleterDisplay: getDisplayUser(plain.inboundCompleter),
    inboundBatches: inboundBatches.map((batch) => {
      const batchPlain = batch.get ? batch.get({ plain: true }) : batch;
      return {
        ...batchPlain,
        submitterDisplay: getDisplayUser(batchPlain.submitter),
      };
    }),
  };
};

const resolveProductBySku = async (rawSku) => {
  const sku = sanitizeString(rawSku);
  if (!sku) return null;

  return Products.findOne({
    where: {
      [Op.or]: [{ sku }, { alternativeSku: sku }],
    },
    attributes: ["sku", "alternativeSku", "itemName", "brand"],
  });
};

const buildItems = async (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const builtItems = [];
  for (const item of items) {
    const skuInput = sanitizeString(item?.sku);
    const quantity = Number(item?.quantity);
    const unitPrice = toMoneyNumber(item?.unitPrice);

    if (!skuInput) continue;
    if (skuInput.length > MAX_SKU_LENGTH) {
      const error = new Error(`SKU is too long: ${skuInput}`);
      error.status = 400;
      throw error;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      const error = new Error(`Quantity must be greater than 0 for SKU ${skuInput}`);
      error.status = 400;
      throw error;
    }
    if (quantity > MAX_QUANTITY) {
      const error = new Error(`Quantity is too large for SKU ${skuInput}`);
      error.status = 400;
      throw error;
    }
    if (unitPrice === null) {
      const error = new Error(`Unit price is invalid for SKU ${skuInput}`);
      error.status = 400;
      throw error;
    }

    const product = await resolveProductBySku(skuInput);
    if (!product) {
      const error = new Error(`SKU not found: ${skuInput}`);
      error.status = 400;
      throw error;
    }
    if ((product.itemName || "").length > MAX_ITEM_NAME_LENGTH) {
      const error = new Error(`Resolved item name is too long for SKU ${skuInput}`);
      error.status = 400;
      throw error;
    }

    builtItems.push({
      sku: product.sku,
      itemName: product.itemName,
      quantity,
      unitPrice,
    });
  }

  return builtItems;
};

const validateHeaderFields = ({
  vendorName,
  invoiceNumber,
  notes,
  orderDate,
  shipmentStatus,
  itemCheckStatus,
  inboundStatus,
  paymentStatus,
  paymentDueBy,
  paymentDate,
  receivedDate,
  miscellaneousAmount,
  shippingAmount,
}) => {
  if (!vendorName || !invoiceNumber || !orderDate) {
    return "Vendor Name, Invoice Number, and Order Date are required";
  }
  if (vendorName.length > MAX_VENDOR_NAME_LENGTH) return "Vendor Name is too long";
  if (invoiceNumber.length > MAX_INVOICE_NUMBER_LENGTH) return "Invoice Number is too long";
  if (notes && notes.length > MAX_NOTES_LENGTH) return "Notes are too long";
  if (!VALID_SHIPMENT_STATUSES.includes(shipmentStatus)) return "Invalid shipment status";
  if (!VALID_ITEM_CHECK_STATUSES.includes(itemCheckStatus)) return "Invalid item check status";
  if (!VALID_INBOUND_STATUSES.includes(inboundStatus)) return "Invalid inbound status";
  if (!VALID_PAYMENT_STATUSES.includes(paymentStatus)) return "Invalid payment status";
  if (shipmentStatus === "received" && !receivedDate) {
    return "Received Date is required when shipment status is Received";
  }
  if (paymentStatus === "paid" && !paymentDate) {
    return "Payment Date is required when payment status is Paid";
  }
  if (paymentStatus === "credit" && !paymentDueBy) {
    return "Payment Due By date is required for credit invoices";
  }
  if (miscellaneousAmount === null || shippingAmount === null) {
    return "Miscellaneous and Shipping must be valid amounts";
  }
  return null;
};

const findDuplicateInvoice = async ({ vendorName, invoiceNumber, excludeId = null, transaction = null }) => {
  const where = {
    vendorName,
    invoiceNumber,
    isArchived: false,
  };
  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }

  return InvoiceTrackerInvoice.findOne({
    where,
    transaction,
    attributes: ["id"],
  });
};

const groupInvoiceItems = (items) => {
  const grouped = new Map();

  for (const item of items) {
    const unitPrice = Number(item.unitPrice || 0);
    const quantity = Number(item.quantity || 0);
    const key = getInboundGroupingKey(item.sku, unitPrice);

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        sku: item.sku,
        itemName: item.itemName,
        unitPrice,
        expectedQty: quantity,
      });
    } else {
      grouped.get(key).expectedQty += quantity;
    }
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (a.sku !== b.sku) return a.sku.localeCompare(b.sku);
    return a.unitPrice - b.unitPrice;
  });
};

const recomputeInvoiceInboundStatus = async (invoiceId, transaction, actorUserId = null) => {
  const rows = await InvoiceTrackerInboundRow.findAll({
    where: { invoiceId },
    transaction,
  });

  let inboundStatus = "pending";
  let inboundCompletedAt = null;
  let inboundCompletedBy = null;

  if (rows.length > 0) {
    const inboundedCount = rows.filter((row) => row.resolutionStatus === "inbounded").length;
    if (inboundedCount === rows.length) {
      inboundStatus = "done";
      inboundCompletedAt = new Date();
      inboundCompletedBy = actorUserId || null;
    } else if (inboundedCount > 0) {
      inboundStatus = "partial";
    }
  }

  await InvoiceTrackerInvoice.update(
    {
      inboundStatus,
      inboundCompletedAt,
      inboundCompletedBy,
    },
    {
      where: { id: invoiceId },
      transaction,
    }
  );

  return inboundStatus;
};

const syncInvoiceInboundRows = async (invoice, transaction) => {
  const rows = await InvoiceTrackerInboundRow.findAll({
    where: { invoiceId: invoice.id },
    transaction,
    order: [["createdAt", "ASC"]],
  });

  const hasAnyInbounded = rows.some((row) => row.resolutionStatus === "inbounded");
  if (hasAnyInbounded) {
    return rows;
  }

  const items = await InvoiceTrackerInvoiceItem.findAll({
    where: { invoiceId: invoice.id },
    transaction,
    order: [["createdAt", "ASC"]],
  });
  const groups = groupInvoiceItems(items);
  const existingByKey = new Map(rows.map((row) => [getInboundGroupingKey(row.sku, row.unitPrice), row]));
  const seenKeys = new Set();

  for (const group of groups) {
    const existing = existingByKey.get(group.key);
    seenKeys.add(group.key);

    if (!existing) {
      await InvoiceTrackerInboundRow.create(
        {
          invoiceId: invoice.id,
          sku: group.sku,
          itemName: group.itemName,
          unitPrice: group.unitPrice,
          expectedQty: group.expectedQty,
          actualQty: null,
          deltaQty: null,
          resolutionStatus: "pending",
          resolutionType: null,
          mismatchReason: null,
          inboundedQty: null,
          inboundCompositeSku: null,
          resolvedBy: null,
          resolvedAt: null,
          inboundedBy: null,
          inboundedAt: null,
        },
        { transaction }
      );
      continue;
    }

    const shouldReset =
      Number(existing.expectedQty || 0) !== Number(group.expectedQty || 0) ||
      sanitizeString(existing.itemName) !== sanitizeString(group.itemName);

    const updates = {
      itemName: group.itemName,
      expectedQty: group.expectedQty,
      unitPrice: group.unitPrice,
    };

    if (shouldReset) {
      updates.actualQty = null;
      updates.deltaQty = null;
      updates.resolutionStatus = "pending";
      updates.resolutionType = null;
      updates.mismatchReason = null;
      updates.resolvedBy = null;
      updates.resolvedAt = null;
      updates.inboundedQty = null;
      updates.inboundCompositeSku = null;
      updates.inboundedBy = null;
      updates.inboundedAt = null;
      updates.batchId = null;
    }

    await existing.update(updates, { transaction });
  }

  for (const row of rows) {
    const key = getInboundGroupingKey(row.sku, row.unitPrice);
    if (!seenKeys.has(key)) {
      await row.destroy({ transaction });
    }
  }

  return InvoiceTrackerInboundRow.findAll({
    where: { invoiceId: invoice.id },
    transaction,
    order: [["createdAt", "ASC"]],
  });
};

const ensureInboundEligibility = async (invoice, transaction) => {
  if (!invoice || invoice.isArchived) {
    const error = new Error("Invoice not found");
    error.status = 404;
    throw error;
  }
  if (invoice.shipmentStatus !== "received" || !invoice.receivedDate) {
    const error = new Error("Invoice is not eligible for inbound until shipment is marked Received and Received Date is set");
    error.status = 400;
    throw error;
  }
  if (invoice.paymentStatus !== "paid") {
    const error = new Error("Invoice is not eligible for inbound until payment status is marked Paid");
    error.status = 400;
    throw error;
  }
  if (invoice.itemCheckStatus !== "verified") {
    const error = new Error("Invoice is not eligible for inbound until Items Check status is marked Verified");
    error.status = 400;
    throw error;
  }

  const itemCount = await InvoiceTrackerInvoiceItem.count({
    where: { invoiceId: invoice.id },
    transaction,
  });
  if (itemCount === 0) {
    const error = new Error("Invoice must have at least one valid item before starting inbound");
    error.status = 400;
    throw error;
  }
};

const buildInboundReviewResponse = async (invoiceId, transaction = null) => {
  const invoice = await InvoiceTrackerInvoice.findOne({
    where: { id: invoiceId, isArchived: false },
    include: detailInvoiceIncludes,
    transaction,
  });
  if (!invoice) {
    const error = new Error("Invoice not found");
    error.status = 404;
    throw error;
  }

  const serialized = serializeInvoice(invoice);
  return {
    invoice: serialized,
    rows: serialized.inboundRows,
    summary: serialized.inboundSummary,
  };
};

const createInvoiceInboundRecord = async ({
  invoice,
  row,
  actor,
  transaction,
}) => {
  const actualQty = Number(row.actualQty || 0);
  const compositeSku = `INVTRACK-${invoice.id}-${row.id}`;

  if (actualQty <= 0) {
    return {
      compositeSku: null,
      created: false,
      inboundedQty: 0,
    };
  }

  const product = await Products.findOne({
    where: { sku: row.sku },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!product) {
    const error = new Error(`Product not found for SKU ${row.sku}`);
    error.status = 400;
    throw error;
  }

  const [foundInbound, created] = await Inbound.findOrCreate({
    where: { compositeSku },
    defaults: {
      sku: row.sku,
      quantity: String(actualQty),
      date: invoice.receivedDate,
      batch: null,
      vendorInvoiceNumber: invoice.invoiceNumber,
      vendorName: invoice.vendorName,
      compositeSku,
    },
    transaction,
  });

  if (!created) {
    const error = new Error(`This invoice row was already inbounded (${row.sku})`);
    error.status = 409;
    throw error;
  }

  const currentQuantity = Number(product.quantity || 0);
  await product.update({ quantity: currentQuantity + actualQty }, { transaction });

  return {
    compositeSku,
    created: true,
    inboundRecord: foundInbound,
    inboundedQty: actualQty,
    pricingPayload: {
      sku: row.sku,
      vendorInvoiceNumber: invoice.invoiceNumber,
      vendorName: invoice.vendorName,
      price: row.unitPrice,
      quantity: actualQty,
      inboundCompositeSku: compositeSku,
      notes: `Created from Invoice Tracker invoice ${invoice.invoiceNumber}`,
    },
    logPayload: {
      timestamp: new Date(),
      type: "invoice_tracker_inbound",
      action: "create",
      entityType: "inbound",
      entityId: compositeSku,
      changes: null,
      previousState: null,
      newState: {
        sku: row.sku,
        quantity: actualQty,
        date: invoice.receivedDate,
        vendorName: invoice.vendorName,
        vendorInvoiceNumber: invoice.invoiceNumber,
      },
      userId: actor?.id ? String(actor.id) : null,
      metaData: {
        source: "invoice_tracker",
        invoiceId: invoice.id,
        invoiceInboundRowId: row.id,
      },
    },
  };
};

router.get("/lookup-product", auth, checkPermission("invoiceTracker", "view"), async (req, res) => {
  try {
    const sku = sanitizeString(req.query?.sku);
    if (!sku) {
      return res.status(400).json({ error: "SKU is required" });
    }

    const product = await resolveProductBySku(sku);
    if (!product) {
      return res.status(404).json({ error: "SKU not found" });
    }

    return res.json({
      sku: product.sku,
      alternativeSku: product.alternativeSku,
      itemName: product.itemName,
      brand: product.brand,
    });
  } catch (error) {
    console.error("Error looking up invoice tracker SKU:", error);
    return res.status(500).json({ error: "Failed to look up SKU" });
  }
});

router.get("/", auth, checkPermission("invoiceTracker", "view"), async (req, res) => {
  try {
    const search = sanitizeString(req.query?.search);
    const shipmentStatus = sanitizeString(req.query?.shipmentStatus);
    const itemCheckStatus = sanitizeString(req.query?.itemCheckStatus);
    const inboundStatus = sanitizeString(req.query?.inboundStatus);
    const paymentStatus = sanitizeString(req.query?.paymentStatus);
    const dateFrom = sanitizeString(req.query?.dateFrom);
    const dateTo = sanitizeString(req.query?.dateTo);
    const archived = sanitizeString(req.query?.archived);

    const where = {};
    if (archived === "only") {
      where.isArchived = true;
    } else if (archived === "all") {
      // no-op
    } else {
      where.isArchived = false;
    }

    if (search) {
      const matchingItemRows = await InvoiceTrackerInvoiceItem.findAll({
        attributes: ["invoiceId"],
        where: {
          [Op.or]: [
            { sku: { [Op.like]: `%${search}%` } },
            { itemName: { [Op.like]: `%${search}%` } },
          ],
        },
        raw: true,
      });
      const matchingInvoiceIds = [...new Set(matchingItemRows.map((row) => row.invoiceId))];

      where[Op.or] = [
        { vendorName: { [Op.like]: `%${search}%` } },
        { invoiceNumber: { [Op.like]: `%${search}%` } },
        ...(matchingInvoiceIds.length ? [{ id: { [Op.in]: matchingInvoiceIds } }] : []),
      ];
    }
    if (VALID_SHIPMENT_STATUSES.includes(shipmentStatus)) where.shipmentStatus = shipmentStatus;
    if (VALID_ITEM_CHECK_STATUSES.includes(itemCheckStatus)) where.itemCheckStatus = itemCheckStatus;
    if (VALID_INBOUND_STATUSES.includes(inboundStatus)) where.inboundStatus = inboundStatus;
    if (VALID_PAYMENT_STATUSES.includes(paymentStatus)) where.paymentStatus = paymentStatus;
    if (dateFrom || dateTo) {
      where.orderDate = {};
      if (dateFrom) where.orderDate[Op.gte] = dateFrom;
      if (dateTo) where.orderDate[Op.lte] = dateTo;
    }

    const invoices = await InvoiceTrackerInvoice.findAll({
      where,
      include: listInvoiceIncludes,
      order: [["orderDate", "DESC"], ["createdAt", "DESC"]],
    });

    return res.json(invoices.map(serializeInvoice));
  } catch (error) {
    console.error("Error fetching invoice tracker invoices:", error);
    return res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

router.get("/:id", auth, checkPermission("invoiceTracker", "view"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid invoice id" });
    }

    const invoice = await InvoiceTrackerInvoice.findOne({
      where: { id, isArchived: false },
      include: detailInvoiceIncludes,
    });
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    return res.json(serializeInvoice(invoice));
  } catch (error) {
    console.error("Error fetching invoice tracker invoice detail:", error);
    return res.status(500).json({ error: "Failed to fetch invoice details" });
  }
});

router.get("/:id/inbound-review", auth, checkPermission("invoiceTracker", "view"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid invoice id" });
    }

    const invoice = await InvoiceTrackerInvoice.findOne({
      where: { id, isArchived: false },
      transaction,
    });
    if (!invoice) {
      await transaction.rollback();
      return res.status(404).json({ error: "Invoice not found" });
    }

    await ensureInboundEligibility(invoice, transaction);
    await syncInvoiceInboundRows(invoice, transaction);
    await recomputeInvoiceInboundStatus(invoice.id, transaction, invoice.inboundCompletedBy || null);

    const payload = await buildInboundReviewResponse(invoice.id, transaction);
    await transaction.commit();
    return res.json(payload);
  } catch (error) {
    await transaction.rollback();
    console.error("Error preparing invoice inbound review:", error);
    return res.status(error.status || 500).json({ error: error.message || "Failed to load inbound review" });
  }
});

router.post("/", auth, checkPermission("invoiceTracker", "create"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const vendorName = sanitizeString(req.body?.vendorName);
    const invoiceNumber = sanitizeString(req.body?.invoiceNumber);
    const orderDate = sanitizeString(req.body?.orderDate);
    const shipmentStatus = sanitizeString(req.body?.shipmentStatus) || "order_placed";
    const itemCheckStatus = sanitizeString(req.body?.itemCheckStatus) || "not_checked";
    const paymentStatus = sanitizeString(req.body?.paymentStatus) || "unpaid";
    const paymentDueBy = sanitizeString(req.body?.paymentDueBy) || null;
    const paymentDate = sanitizeString(req.body?.paymentDate) || null;
    const receivedDate = sanitizeString(req.body?.receivedDate) || null;
    const miscellaneousAmount = toMoneyNumber(req.body?.miscellaneousAmount);
    const shippingAmount = toMoneyNumber(req.body?.shippingAmount);
    const notes = sanitizeString(req.body?.notes) || null;
    const items = await buildItems(req.body?.items);

    const validationError = validateHeaderFields({
      vendorName,
      invoiceNumber,
      notes,
      orderDate,
      shipmentStatus,
      itemCheckStatus,
      inboundStatus: "pending",
      paymentStatus,
      paymentDueBy,
      paymentDate,
      receivedDate,
      miscellaneousAmount,
      shippingAmount,
    });
    if (validationError) {
      await transaction.rollback();
      return res.status(400).json({ error: validationError });
    }

    const existingDuplicate = await findDuplicateInvoice({ vendorName, invoiceNumber, transaction });
    if (existingDuplicate) {
      await transaction.rollback();
      return res.status(409).json({ error: "An invoice with this vendor and invoice number already exists" });
    }

    const invoice = await InvoiceTrackerInvoice.create(
      {
        vendorName,
        invoiceNumber,
        orderDate,
        shipmentStatus,
        itemCheckStatus,
        inboundStatus: "pending",
        paymentStatus,
        paymentDueBy: paymentStatus === "credit" ? paymentDueBy : null,
        paymentDate: paymentStatus === "paid" ? paymentDate : null,
        receivedDate: shipmentStatus === "received" ? receivedDate : null,
        miscellaneousAmount,
        shippingAmount,
        notes,
        createdBy: req.user?.id || null,
        lastUpdatedBy: req.user?.id || null,
      },
      { transaction }
    );

    if (items.length) {
      await InvoiceTrackerInvoiceItem.bulkCreate(
        items.map((item) => ({
          ...item,
          invoiceId: invoice.id,
        })),
        { transaction }
      );
    }

    await transaction.commit();

    const created = await InvoiceTrackerInvoice.findOne({
      where: { id: invoice.id, isArchived: false },
      include: detailInvoiceIncludes,
    });
    return res.status(201).json(serializeInvoice(created));
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating invoice tracker invoice:", error);
    return res.status(error.status || 500).json({ error: error.message || "Failed to create invoice" });
  }
});

router.put("/:id", auth, checkPermission("invoiceTracker", "edit"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid invoice id" });
    }

    const invoice = await InvoiceTrackerInvoice.findOne({
      where: { id, isArchived: false },
      transaction,
    });
    if (!invoice) {
      await transaction.rollback();
      return res.status(404).json({ error: "Invoice not found" });
    }

    if (invoice.inboundStatus !== "pending") {
      await transaction.rollback();
      return res.status(400).json({
        error: "This invoice already has inbound activity and can no longer be edited. Create a new invoice instead.",
      });
    }

    const expectedUpdatedAt = parseExpectedUpdatedAt(req.body?.expectedUpdatedAt);
    if (sanitizeString(req.body?.expectedUpdatedAt) && !expectedUpdatedAt) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid expectedUpdatedAt" });
    }
    const lockError = assertOptimisticLock(invoice, expectedUpdatedAt);
    if (lockError) {
      await transaction.rollback();
      return res.status(lockError.status).json(lockError.body);
    }

    const vendorName = sanitizeString(req.body?.vendorName);
    const invoiceNumber = sanitizeString(req.body?.invoiceNumber);
    const orderDate = sanitizeString(req.body?.orderDate);
    const shipmentStatus = sanitizeString(req.body?.shipmentStatus) || "order_placed";
    const itemCheckStatus = sanitizeString(req.body?.itemCheckStatus) || "not_checked";
    const paymentStatus = sanitizeString(req.body?.paymentStatus) || "unpaid";
    const paymentDueBy = sanitizeString(req.body?.paymentDueBy) || null;
    const paymentDate = sanitizeString(req.body?.paymentDate) || null;
    const receivedDate = sanitizeString(req.body?.receivedDate) || null;
    const miscellaneousAmount = toMoneyNumber(req.body?.miscellaneousAmount);
    const shippingAmount = toMoneyNumber(req.body?.shippingAmount);
    const notes = sanitizeString(req.body?.notes) || null;
    const items = await buildItems(req.body?.items);

    const validationError = validateHeaderFields({
      vendorName,
      invoiceNumber,
      notes,
      orderDate,
      shipmentStatus,
      itemCheckStatus,
      inboundStatus: invoice.inboundStatus || "pending",
      paymentStatus,
      paymentDueBy,
      paymentDate,
      receivedDate,
      miscellaneousAmount,
      shippingAmount,
    });
    if (validationError) {
      await transaction.rollback();
      return res.status(400).json({ error: validationError });
    }

    const existingDuplicate = await findDuplicateInvoice({
      vendorName,
      invoiceNumber,
      excludeId: invoice.id,
      transaction,
    });
    if (existingDuplicate) {
      await transaction.rollback();
      return res.status(409).json({ error: "An invoice with this vendor and invoice number already exists" });
    }

    await invoice.update(
      {
        vendorName,
        invoiceNumber,
        orderDate,
        shipmentStatus,
        itemCheckStatus,
        paymentStatus,
        paymentDueBy: paymentStatus === "credit" ? paymentDueBy : null,
        paymentDate: paymentStatus === "paid" ? paymentDate : null,
        receivedDate: shipmentStatus === "received" ? receivedDate : null,
        miscellaneousAmount,
        shippingAmount,
        notes,
        lastUpdatedBy: req.user?.id || null,
      },
      { transaction }
    );

    await InvoiceTrackerInvoiceItem.destroy({
      where: { invoiceId: invoice.id },
      transaction,
    });
    if (items.length) {
      await InvoiceTrackerInvoiceItem.bulkCreate(
        items.map((item) => ({
          ...item,
          invoiceId: invoice.id,
        })),
        { transaction }
      );
    }

    if (invoice.inboundStatus === "pending") {
      await syncInvoiceInboundRows(invoice, transaction);
      await recomputeInvoiceInboundStatus(invoice.id, transaction, req.user?.id || null);
    }

    await transaction.commit();

    const updated = await InvoiceTrackerInvoice.findOne({
      where: { id: invoice.id, isArchived: false },
      include: detailInvoiceIncludes,
    });
    return res.json(serializeInvoice(updated));
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating invoice tracker invoice:", error);
    return res.status(error.status || 500).json({ error: error.message || "Failed to update invoice" });
  }
});

router.post("/:id/inbound-rows/resolve", auth, checkPermission("invoiceTracker", "edit"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    const rowId = Number(req.body?.rowId);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(rowId) || rowId <= 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid invoice or row id" });
    }

    const invoice = await InvoiceTrackerInvoice.findOne({
      where: { id, isArchived: false },
      transaction,
    });
    if (!invoice) {
      await transaction.rollback();
      return res.status(404).json({ error: "Invoice not found" });
    }

    await ensureInboundEligibility(invoice, transaction);

    const row = await InvoiceTrackerInboundRow.findOne({
      where: { id: rowId, invoiceId: invoice.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!row) {
      await transaction.rollback();
      return res.status(404).json({ error: "Inbound row not found" });
    }
    if (row.resolutionStatus === "inbounded") {
      await transaction.rollback();
      return res.status(409).json({ error: "This row has already been inbounded" });
    }

    const actualQty = toPositiveInteger(req.body?.actualQty, { allowZero: true });
    if (actualQty === null) {
      await transaction.rollback();
      return res.status(400).json({ error: "Actual quantity must be 0 or greater" });
    }
    const mismatchReason = sanitizeString(req.body?.mismatchReason);
    const isMatch = Number(actualQty) === Number(row.expectedQty || 0);

    if (!isMatch && !VALID_MISMATCH_REASONS.includes(mismatchReason)) {
      await transaction.rollback();
      return res.status(400).json({ error: "Mismatch reason is required when actual quantity differs from expected" });
    }

    await row.update(
      {
        actualQty,
        deltaQty: actualQty - Number(row.expectedQty || 0),
        resolutionStatus: "resolved",
        resolutionType: isMatch ? "match" : "mismatch",
        mismatchReason: isMatch ? null : mismatchReason,
        resolvedBy: req.user?.id || null,
        resolvedAt: new Date(),
      },
      { transaction }
    );

    await recomputeInvoiceInboundStatus(invoice.id, transaction, req.user?.id || null);
    const payload = await buildInboundReviewResponse(invoice.id, transaction);
    await transaction.commit();
    return res.json(payload);
  } catch (error) {
    await transaction.rollback();
    console.error("Error resolving invoice inbound row:", error);
    return res.status(error.status || 500).json({ error: error.message || "Failed to resolve row" });
  }
});

router.post("/:id/inbound-rows/resolve-all", auth, checkPermission("invoiceTracker", "edit"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid invoice id" });
    }

    const invoice = await InvoiceTrackerInvoice.findOne({
      where: { id, isArchived: false },
      transaction,
    });
    if (!invoice) {
      await transaction.rollback();
      return res.status(404).json({ error: "Invoice not found" });
    }

    await ensureInboundEligibility(invoice, transaction);

    const rows = await InvoiceTrackerInboundRow.findAll({
      where: {
        invoiceId: invoice.id,
        resolutionStatus: {
          [Op.ne]: "inbounded",
        },
      },
      transaction,
    });

    for (const row of rows) {
      // eslint-disable-next-line no-await-in-loop
      await row.update(
        {
          actualQty: Number(row.expectedQty || 0),
          deltaQty: 0,
          resolutionStatus: "resolved",
          resolutionType: "match",
          mismatchReason: null,
          resolvedBy: req.user?.id || null,
          resolvedAt: new Date(),
        },
        { transaction }
      );
    }

    await recomputeInvoiceInboundStatus(invoice.id, transaction, req.user?.id || null);
    const payload = await buildInboundReviewResponse(invoice.id, transaction);
    await transaction.commit();
    return res.json(payload);
  } catch (error) {
    await transaction.rollback();
    console.error("Error resolving all invoice inbound rows:", error);
    return res.status(error.status || 500).json({ error: error.message || "Failed to resolve rows" });
  }
});

router.post("/:id/inbound-submit", auth, checkPermission("invoiceTracker", "edit"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    const rowIds = Array.isArray(req.body?.rowIds)
      ? req.body.rowIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
      : [];

    if (!Number.isInteger(id) || id <= 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid invoice id" });
    }
    if (!rowIds.length) {
      await transaction.rollback();
      return res.status(400).json({ error: "Select at least one resolved row to inbound" });
    }

    const invoice = await InvoiceTrackerInvoice.findOne({
      where: { id, isArchived: false },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!invoice) {
      await transaction.rollback();
      return res.status(404).json({ error: "Invoice not found" });
    }

    await ensureInboundEligibility(invoice, transaction);

    const rows = await InvoiceTrackerInboundRow.findAll({
      where: {
        invoiceId: invoice.id,
        id: { [Op.in]: rowIds },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (rows.length !== rowIds.length) {
      await transaction.rollback();
      return res.status(404).json({ error: "One or more selected rows could not be found" });
    }

    for (const row of rows) {
      if (row.resolutionStatus !== "resolved") {
        await transaction.rollback();
        return res.status(400).json({ error: `Row ${row.sku} must be resolved before inbounding` });
      }
    }

    const batch = await InvoiceTrackerInboundBatch.create(
      {
        invoiceId: invoice.id,
        rowCount: rows.length,
        submittedBy: req.user?.id || null,
        submittedAt: new Date(),
      },
      { transaction }
    );

    const postCommitPricingPayloads = [];
    const postCommitLogPayloads = [];

    for (const row of rows) {
      // eslint-disable-next-line no-await-in-loop
      const result = await createInvoiceInboundRecord({
        invoice,
        row,
        actor: req.user,
        transaction,
      });

      // eslint-disable-next-line no-await-in-loop
      await row.update(
        {
          batchId: batch.id,
          resolutionStatus: "inbounded",
          inboundedQty: Number(row.actualQty || 0),
          inboundCompositeSku: result.compositeSku,
          inboundedBy: req.user?.id || null,
          inboundedAt: new Date(),
        },
        { transaction }
      );

      if (result.pricingPayload) {
        postCommitPricingPayloads.push(result.pricingPayload);
      }
      if (result.logPayload) {
        postCommitLogPayloads.push(result.logPayload);
      }
    }

    await recomputeInvoiceInboundStatus(invoice.id, transaction, req.user?.id || null);
    const payload = await buildInboundReviewResponse(invoice.id, transaction);
    await transaction.commit();

    for (const pricingPayload of postCommitPricingPayloads) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await PricingService.createPriceFromInbound(pricingPayload, req.user);
      } catch (pricingError) {
        console.error("Invoice inbound pricing creation failed:", pricingError);
      }
    }

    for (const logPayload of postCommitLogPayloads) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await Logs.create(logPayload);
      } catch (logError) {
        console.error("Invoice inbound log creation failed:", logError);
      }
    }

    return res.json({
      ...payload,
      message: rows.length === 1 ? "Row inbounded successfully" : "Selected rows inbounded successfully",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error inbounding invoice rows:", error);
    return res.status(error.status || 500).json({ error: error.message || "Failed to inbound selected rows" });
  }
});

router.delete("/:id", auth, checkPermission("invoiceTracker", "delete"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid invoice id" });
    }

    const invoice = await InvoiceTrackerInvoice.findOne({
      where: { id, isArchived: false },
      transaction,
    });
    if (!invoice) {
      await transaction.rollback();
      return res.status(404).json({ error: "Invoice not found" });
    }

    const expectedUpdatedAt = parseExpectedUpdatedAt(req.body?.expectedUpdatedAt);
    if (sanitizeString(req.body?.expectedUpdatedAt) && !expectedUpdatedAt) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid expectedUpdatedAt" });
    }
    const lockError = assertOptimisticLock(invoice, expectedUpdatedAt);
    if (lockError) {
      await transaction.rollback();
      return res.status(lockError.status).json(lockError.body);
    }

    await invoice.update(
      {
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: req.user?.id || null,
        lastUpdatedBy: req.user?.id || null,
      },
      { transaction }
    );

    await transaction.commit();
    return res.json({ message: "Invoice archived successfully" });
  } catch (error) {
    await transaction.rollback();
    console.error("Error deleting invoice:", error);
    return res.status(500).json({ error: "Failed to archive invoice" });
  }
});

router.patch("/:id/restore", auth, checkPermission("invoiceTracker", "edit"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid invoice id" });
    }

    const invoice = await InvoiceTrackerInvoice.findOne({
      where: { id, isArchived: true },
      transaction,
    });
    if (!invoice) {
      await transaction.rollback();
      return res.status(404).json({ error: "Archived invoice not found" });
    }

    const expectedUpdatedAt = parseExpectedUpdatedAt(req.body?.expectedUpdatedAt);
    if (sanitizeString(req.body?.expectedUpdatedAt) && !expectedUpdatedAt) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid expectedUpdatedAt" });
    }
    const lockError = assertOptimisticLock(invoice, expectedUpdatedAt);
    if (lockError) {
      await transaction.rollback();
      return res.status(lockError.status).json(lockError.body);
    }

    const existingDuplicate = await findDuplicateInvoice({
      vendorName: invoice.vendorName,
      invoiceNumber: invoice.invoiceNumber,
      excludeId: invoice.id,
      transaction,
    });
    if (existingDuplicate) {
      await transaction.rollback();
      return res.status(409).json({
        error: "Cannot restore because an active invoice with this vendor and invoice number already exists",
      });
    }

    await invoice.update(
      {
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
        lastUpdatedBy: req.user?.id || null,
      },
      { transaction }
    );

    await transaction.commit();
    return res.json({ message: "Invoice restored successfully" });
  } catch (error) {
    await transaction.rollback();
    console.error("Error restoring invoice:", error);
    return res.status(500).json({ error: "Failed to restore invoice" });
  }
});

module.exports = router;

const express = require("express");
const { Op } = require("sequelize");
const {
  InvoiceTrackerInvoice,
  InvoiceTrackerInvoiceItem,
  Products,
  User,
  sequelize,
} = require("../models");
const { auth } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permissions");

const router = express.Router();

const VALID_SHIPMENT_STATUSES = ["order_placed", "shipped", "received"];
const VALID_ITEM_CHECK_STATUSES = ["not_checked", "working_on_it", "verified", "missing_items"];
const VALID_INBOUND_STATUSES = ["pending", "done"];
const VALID_PAYMENT_STATUSES = ["paid", "unpaid", "credit"];
const MAX_VENDOR_NAME_LENGTH = 255;
const MAX_INVOICE_NUMBER_LENGTH = 255;
const MAX_NOTES_LENGTH = 5000;
const MAX_SKU_LENGTH = 255;
const MAX_ITEM_NAME_LENGTH = 255;
const MAX_QUANTITY = 100000;
const MAX_MONEY_AMOUNT = 1000000;

const invoiceIncludes = [
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

const serializeInvoice = (invoice) => {
  const plain = invoice.get ? invoice.get({ plain: true }) : invoice;
  const items = Array.isArray(plain.items) ? plain.items : [];
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

  return {
    ...plain,
    miscellaneousAmount,
    shippingAmount,
    items: serializedItems,
    itemsTotal: Number(itemsTotal.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2)),
    itemCount: serializedItems.length,
  };
};

const resolveProductBySku = async (rawSku) => {
  const sku = sanitizeString(rawSku);
  if (!sku) {
    return null;
  }

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

    if (!skuInput) {
      continue;
    }
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
  if (vendorName.length > MAX_VENDOR_NAME_LENGTH) {
    return "Vendor Name is too long";
  }
  if (invoiceNumber.length > MAX_INVOICE_NUMBER_LENGTH) {
    return "Invoice Number is too long";
  }
  if (notes && notes.length > MAX_NOTES_LENGTH) {
    return "Notes are too long";
  }
  if (!VALID_SHIPMENT_STATUSES.includes(shipmentStatus)) {
    return "Invalid shipment status";
  }
  if (!VALID_ITEM_CHECK_STATUSES.includes(itemCheckStatus)) {
    return "Invalid item check status";
  }
  if (!VALID_INBOUND_STATUSES.includes(inboundStatus)) {
    return "Invalid inbound status";
  }
  if (!VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
    return "Invalid payment status";
  }
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

    res.json({
      sku: product.sku,
      alternativeSku: product.alternativeSku,
      itemName: product.itemName,
      brand: product.brand,
    });
  } catch (error) {
    console.error("Error looking up invoice tracker SKU:", error);
    res.status(500).json({ error: "Failed to look up SKU" });
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
    if (VALID_SHIPMENT_STATUSES.includes(shipmentStatus)) {
      where.shipmentStatus = shipmentStatus;
    }
    if (VALID_ITEM_CHECK_STATUSES.includes(itemCheckStatus)) {
      where.itemCheckStatus = itemCheckStatus;
    }
    if (VALID_INBOUND_STATUSES.includes(inboundStatus)) {
      where.inboundStatus = inboundStatus;
    }
    if (VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
      where.paymentStatus = paymentStatus;
    }
    if (dateFrom || dateTo) {
      where.orderDate = {};
      if (dateFrom) {
        where.orderDate[Op.gte] = dateFrom;
      }
      if (dateTo) {
        where.orderDate[Op.lte] = dateTo;
      }
    }

    const invoices = await InvoiceTrackerInvoice.findAll({
      where,
      include: invoiceIncludes,
      order: [["orderDate", "DESC"], ["createdAt", "DESC"]],
    });

    res.json(invoices.map(serializeInvoice));
  } catch (error) {
    console.error("Error fetching invoice tracker invoices:", error);
    res.status(500).json({ error: "Failed to fetch invoices" });
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
      include: invoiceIncludes,
    });
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    res.json(serializeInvoice(invoice));
  } catch (error) {
    console.error("Error fetching invoice tracker invoice detail:", error);
    res.status(500).json({ error: "Failed to fetch invoice details" });
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
    const inboundStatus = sanitizeString(req.body?.inboundStatus) || "pending";
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
      inboundStatus,
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
    if (items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "At least one invoice item is required" });
    }

    const existingDuplicate = await findDuplicateInvoice({
      vendorName,
      invoiceNumber,
      transaction,
    });
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
        inboundStatus,
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

    await InvoiceTrackerInvoiceItem.bulkCreate(
      items.map((item) => ({
        ...item,
        invoiceId: invoice.id,
      })),
      { transaction }
    );

    await transaction.commit();

    const created = await InvoiceTrackerInvoice.findOne({
      where: { id: invoice.id, isArchived: false },
      include: invoiceIncludes,
    });
    res.status(201).json(serializeInvoice(created));
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating invoice tracker invoice:", error);
    res.status(error.status || 500).json({ error: error.message || "Failed to create invoice" });
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
    const inboundStatus = sanitizeString(req.body?.inboundStatus) || "pending";
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
      inboundStatus,
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
    if (items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "At least one invoice item is required" });
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
        inboundStatus,
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

    await InvoiceTrackerInvoiceItem.bulkCreate(
      items.map((item) => ({
        ...item,
        invoiceId: invoice.id,
      })),
      { transaction }
    );

    await transaction.commit();

    const updated = await InvoiceTrackerInvoice.findOne({
      where: { id: invoice.id, isArchived: false },
      include: invoiceIncludes,
    });
    res.json(serializeInvoice(updated));
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating invoice tracker invoice:", error);
    res.status(error.status || 500).json({ error: error.message || "Failed to update invoice" });
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
    res.json({ message: "Invoice archived successfully" });
  } catch (error) {
    await transaction.rollback();
    console.error("Error deleting invoice:", error);
    res.status(500).json({ error: "Failed to archive invoice" });
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
    res.json({ message: "Invoice restored successfully" });
  } catch (error) {
    await transaction.rollback();
    console.error("Error restoring invoice:", error);
    res.status(500).json({ error: "Failed to restore invoice" });
  }
});

module.exports = router;

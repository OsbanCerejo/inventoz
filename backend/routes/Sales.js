const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { Op } = require("sequelize");
const {
  SalesOrder,
  SalesOrderItem,
  Products,
  Logs,
  User,
  sequelize,
} = require("../models");
const { auth } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permissions");

const router = express.Router();
const SALES_INVOICE_UPLOAD_DIR = path.join(__dirname, "../uploads/sales-invoices");
const SALES_INVOICE_MAX_FILE_SIZE = 10 * 1024 * 1024;
const VALID_SALES_INVOICE_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);

const salesInvoiceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(SALES_INVOICE_UPLOAD_DIR)) {
      fs.mkdirSync(SALES_INVOICE_UPLOAD_DIR, { recursive: true });
    }
    cb(null, SALES_INVOICE_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `sale-${req.params.id}-${uniqueSuffix}${ext}`);
  },
});

const salesInvoiceUpload = multer({
  storage: salesInvoiceStorage,
  limits: { fileSize: SALES_INVOICE_MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!VALID_SALES_INVOICE_EXTENSIONS.has(ext)) {
      cb(new Error("Only PDF, PNG, JPG, JPEG, and WEBP files are allowed"));
      return;
    }
    cb(null, true);
  },
});

const VALID_SALE_CATEGORIES = ["customer_sale", "marketplace", "wfs", "wholesale", "other"];
const VALID_PAYMENT_STATUSES = ["unpaid", "partial", "paid"];
const VALID_SHIPMENT_STATUSES = ["pending", "shipped", "delivered"];
const VALID_PACKING_STATUSES = ["not_packed", "packing", "packed"];
const VALID_SALE_STATUSES = ["draft", "finalized", "voided"];
const VALID_MARKETPLACES = ["Amazon", "Walmart", "TEMU", "eBay", "TikTok", "Whatnot", "Other"];
const VALID_WHOLESALE_VALUES = ["HBA", "Other"];
const MAX_SKU_LENGTH = 255;
const MAX_ITEM_NAME_LENGTH = 255;
const MAX_NOTES_LENGTH = 5000;
const MAX_NAME_LENGTH = 255;
const MAX_VOID_REASON_LENGTH = 2000;
const MAX_QUANTITY = 100000;
const MAX_MONEY = 1000000;

const listIncludes = [
  {
    model: SalesOrderItem,
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
  {
    model: User,
    as: "finalizer",
    attributes: ["id", "name", "username"],
    required: false,
  },
  {
    model: User,
    as: "voider",
    attributes: ["id", "name", "username"],
    required: false,
  },
  {
    model: User,
    as: "invoiceAttachmentUploader",
    attributes: ["id", "name", "username"],
    required: false,
  },
];

const sanitizeString = (value) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const parseOptionalMoney = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_MONEY) return null;
  return Number(parsed.toFixed(2));
};

const parseRequiredPositiveInteger = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_QUANTITY) return null;
  return parsed;
};

const parseExpectedUpdatedAt = (value) => {
  const normalized = sanitizeString(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const assertOptimisticLock = (record, expectedUpdatedAt) => {
  if (!expectedUpdatedAt) return null;
  const dbTime = new Date(record.updatedAt).getTime();
  const expectedTime = new Date(expectedUpdatedAt).getTime();
  if (dbTime !== expectedTime) {
    return {
      status: 409,
      body: {
        error: "This sales record was changed by another user. Refresh and try again.",
        code: "STALE_SALE",
      },
    };
  }
  return null;
};

const getDisplayUser = (user) => {
  if (!user) return null;
  return user.name || user.username || `User ${user.id}`;
};

const removeFileIfExists = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Failed to remove file:", filePath, error);
  }
};

const buildProductDisplayName = (product) => {
  if (!product) return "";
  const parts = [];
  const brand = sanitizeString(product.brand);
  const itemName = sanitizeString(product.itemName);
  const sizeOz = Number(product.sizeOz || 0);
  if (brand) parts.push(brand);
  if (itemName) parts.push(itemName);
  if (Number.isFinite(sizeOz) && sizeOz > 0) {
    parts.push(`${sizeOz} oz`);
  }
  return parts.join(" ").trim();
};

const buildSaleCategoryLabel = (sale) => {
  switch (sale.saleCategory) {
    case "customer_sale":
      return sale.customerName ? `Customer Sale - ${sale.customerName}` : "Customer Sale";
    case "marketplace":
      if (sale.marketplaceName === "Other") {
        return sale.marketplaceOther ? `Marketplace - ${sale.marketplaceOther}` : "Marketplace - Other";
      }
      return sale.marketplaceName ? `Marketplace - ${sale.marketplaceName}` : "Marketplace";
    case "wfs":
      return "WFS";
    case "wholesale":
      if (sale.wholesaleName === "Other") {
        return sale.wholesaleOther ? `Wholesale - ${sale.wholesaleOther}` : "Wholesale - Other";
      }
      return sale.wholesaleName ? `Wholesale - ${sale.wholesaleName}` : "Wholesale";
    case "other":
      return sale.otherCategoryLabel ? `Other - ${sale.otherCategoryLabel}` : "Other";
    default:
      return sale.saleCategory || "Sale";
  }
};

const serializeSale = (sale) => {
  const plain = sale.get ? sale.get({ plain: true }) : sale;
  const items = Array.isArray(plain.items) ? plain.items : [];
  const serializedItems = items.map((item) => {
    const quantity = Number(item.quantity || 0);
    const unitSoldPrice =
      item.unitSoldPrice === null || item.unitSoldPrice === undefined
        ? null
        : Number(item.unitSoldPrice);
    return {
      ...item,
      quantity,
      unitSoldPrice,
      lineTotal:
        unitSoldPrice === null ? null : Number((quantity * unitSoldPrice).toFixed(2)),
    };
  });

  const totalUnits = serializedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const pricedSubtotal = serializedItems.reduce(
    (sum, item) => sum + (item.lineTotal === null ? 0 : Number(item.lineTotal || 0)),
    0
  );

  return {
    ...plain,
    items: serializedItems,
    totalUnits,
    itemCount: serializedItems.length,
    pricedSubtotal: Number(pricedSubtotal.toFixed(2)),
    categoryLabel: buildSaleCategoryLabel(plain),
    creatorDisplay: getDisplayUser(plain.creator),
    updaterDisplay: getDisplayUser(plain.updater),
    finalizerDisplay: getDisplayUser(plain.finalizer),
    voiderDisplay: getDisplayUser(plain.voider),
    invoiceAttachmentAvailable: Boolean(plain.invoiceAttachmentPath),
    invoiceAttachmentOriginalName: plain.invoiceAttachmentOriginalName || null,
    invoiceAttachmentMimeType: plain.invoiceAttachmentMimeType || null,
    invoiceAttachmentUploadedAt: plain.invoiceAttachmentUploadedAt || null,
    invoiceAttachmentUploaderDisplay: getDisplayUser(plain.invoiceAttachmentUploader),
  };
};

const resolveProductBySku = async (rawSku, options = {}) => {
  const sku = sanitizeString(rawSku);
  if (!sku) return null;
  return Products.findOne({
    where: {
      [Op.or]: [{ sku }, { alternativeSku: sku }],
    },
    attributes: ["sku", "alternativeSku", "brand", "itemName", "sizeOz", "quantity", "upc"],
    transaction: options.transaction,
    lock: options.lock,
  });
};

const buildItems = async (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const builtItems = [];
  for (const item of items) {
    const skuInput = sanitizeString(item?.sku);
    const quantity = parseRequiredPositiveInteger(item?.quantity);
    const unitSoldPrice = parseOptionalMoney(item?.unitSoldPrice);
    const hasAnyValue =
      Boolean(skuInput) ||
      Boolean(sanitizeString(item?.itemName)) ||
      Boolean(String(item?.quantity ?? "").trim()) ||
      Boolean(String(item?.unitSoldPrice ?? "").trim());

    if (!hasAnyValue) {
      continue;
    }

    if (!skuInput) {
      const error = new Error("Every sales item must include a SKU");
      error.status = 400;
      throw error;
    }
    if (skuInput.length > MAX_SKU_LENGTH) {
      const error = new Error(`SKU is too long: ${skuInput}`);
      error.status = 400;
      throw error;
    }
    if (quantity === null) {
      const error = new Error(`Quantity must be greater than 0 for SKU ${skuInput}`);
      error.status = 400;
      throw error;
    }
    if (
      item?.unitSoldPrice !== "" &&
      item?.unitSoldPrice !== null &&
      item?.unitSoldPrice !== undefined &&
      unitSoldPrice === null
    ) {
      const error = new Error(`Sold price is invalid for SKU ${skuInput}`);
      error.status = 400;
      throw error;
    }

    const product = await resolveProductBySku(skuInput);
    if (!product) {
      const error = new Error(`SKU not found: ${skuInput}`);
      error.status = 400;
      throw error;
    }

    const displayName = buildProductDisplayName(product).slice(0, MAX_ITEM_NAME_LENGTH);
    builtItems.push({
      sku: product.sku,
      itemName: displayName || sanitizeString(item?.itemName).slice(0, MAX_ITEM_NAME_LENGTH) || product.sku,
      quantity,
      unitSoldPrice,
    });
  }

  return builtItems;
};

const normalizeSalePayload = (body) => {
  const payload = {
    saleDate: sanitizeString(body?.saleDate),
    saleCategory: sanitizeString(body?.saleCategory),
    customerName: sanitizeString(body?.customerName).slice(0, MAX_NAME_LENGTH),
    marketplaceName: sanitizeString(body?.marketplaceName).slice(0, MAX_NAME_LENGTH),
    marketplaceOther: sanitizeString(body?.marketplaceOther).slice(0, MAX_NAME_LENGTH),
    wholesaleName: sanitizeString(body?.wholesaleName).slice(0, MAX_NAME_LENGTH),
    wholesaleOther: sanitizeString(body?.wholesaleOther).slice(0, MAX_NAME_LENGTH),
    otherCategoryLabel: sanitizeString(body?.otherCategoryLabel).slice(0, MAX_NAME_LENGTH),
    paymentStatus: sanitizeString(body?.paymentStatus),
    shipmentStatus: sanitizeString(body?.shipmentStatus),
    packingStatus: sanitizeString(body?.packingStatus),
    notes: sanitizeString(body?.notes).slice(0, MAX_NOTES_LENGTH),
  };

  if (!payload.saleDate) {
    const error = new Error("Sale date is required");
    error.status = 400;
    throw error;
  }
  if (!VALID_SALE_CATEGORIES.includes(payload.saleCategory)) {
    const error = new Error("Sale category is invalid");
    error.status = 400;
    throw error;
  }
  if (!VALID_PAYMENT_STATUSES.includes(payload.paymentStatus)) {
    const error = new Error("Payment status is invalid");
    error.status = 400;
    throw error;
  }
  if (!VALID_SHIPMENT_STATUSES.includes(payload.shipmentStatus)) {
    const error = new Error("Shipment status is invalid");
    error.status = 400;
    throw error;
  }
  if (!VALID_PACKING_STATUSES.includes(payload.packingStatus)) {
    const error = new Error("Packing status is invalid");
    error.status = 400;
    throw error;
  }

  if (payload.saleCategory === "customer_sale" && !payload.customerName) {
    const error = new Error("Customer name is required for customer sales");
    error.status = 400;
    throw error;
  }

  if (payload.saleCategory === "marketplace") {
    if (!VALID_MARKETPLACES.includes(payload.marketplaceName)) {
      const error = new Error("Marketplace selection is invalid");
      error.status = 400;
      throw error;
    }
    if (payload.marketplaceName === "Other" && !payload.marketplaceOther) {
      const error = new Error("Marketplace name is required when Marketplace is Other");
      error.status = 400;
      throw error;
    }
  } else {
    payload.marketplaceName = "";
    payload.marketplaceOther = "";
  }

  if (payload.saleCategory === "wholesale") {
    if (!VALID_WHOLESALE_VALUES.includes(payload.wholesaleName)) {
      const error = new Error("Wholesale selection is invalid");
      error.status = 400;
      throw error;
    }
    if (payload.wholesaleName === "Other" && !payload.wholesaleOther) {
      const error = new Error("Wholesale name is required when Wholesale is Other");
      error.status = 400;
      throw error;
    }
  } else {
    payload.wholesaleName = "";
    payload.wholesaleOther = "";
  }

  if (payload.saleCategory === "other") {
    if (!payload.otherCategoryLabel) {
      const error = new Error("Please specify the sale category");
      error.status = 400;
      throw error;
    }
  } else {
    payload.otherCategoryLabel = "";
  }

  if (payload.saleCategory !== "customer_sale") {
    payload.customerName = "";
  }

  return payload;
};

const generateReceiptNumber = async () => {
  const today = new Date();
  const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(
    today.getDate()
  ).padStart(2, "0")}`;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const receiptNumber = `SAL-${yyyymmdd}-${suffix}`;
    const existing = await SalesOrder.findOne({
      where: { receiptNumber },
      attributes: ["id"],
    });
    if (!existing) {
      return receiptNumber;
    }
  }

  throw new Error("Unable to generate a unique sales receipt number");
};

const createLog = async ({
  transaction,
  actor,
  action,
  entityId,
  previousState,
  newState,
  metaData,
}) => {
  await Logs.create(
    {
      timestamp: new Date(),
      type: "sales_tracker",
      action,
      entityType: "sales_order",
      entityId: String(entityId),
      changes: null,
      previousState,
      newState,
      userId: actor?.id ? String(actor.id) : null,
      metaData: metaData || null,
    },
    { transaction }
  );
};

router.get("/", auth, checkPermission("sales", "view"), async (req, res) => {
  try {
    const search = sanitizeString(req.query.search);
    const status = sanitizeString(req.query.status);
    const category = sanitizeString(req.query.category);
    const paymentStatus = sanitizeString(req.query.paymentStatus);
    const shipmentStatus = sanitizeString(req.query.shipmentStatus);
    const dateFrom = sanitizeString(req.query.dateFrom);
    const dateTo = sanitizeString(req.query.dateTo);

    const where = {};
    if (status && VALID_SALE_STATUSES.includes(status)) {
      where.status = status;
    }
    if (category && VALID_SALE_CATEGORIES.includes(category)) {
      where.saleCategory = category;
    }
    if (paymentStatus && VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
      where.paymentStatus = paymentStatus;
    }
    if (shipmentStatus && VALID_SHIPMENT_STATUSES.includes(shipmentStatus)) {
      where.shipmentStatus = shipmentStatus;
    }
    if (dateFrom && dateTo) {
      where.saleDate = { [Op.between]: [dateFrom, dateTo] };
    } else if (dateFrom) {
      where.saleDate = { [Op.gte]: dateFrom };
    } else if (dateTo) {
      where.saleDate = { [Op.lte]: dateTo };
    }
    if (search) {
      where[Op.or] = [
        { receiptNumber: { [Op.like]: `%${search}%` } },
        { customerName: { [Op.like]: `%${search}%` } },
        { marketplaceName: { [Op.like]: `%${search}%` } },
        { marketplaceOther: { [Op.like]: `%${search}%` } },
        { wholesaleName: { [Op.like]: `%${search}%` } },
        { wholesaleOther: { [Op.like]: `%${search}%` } },
        { otherCategoryLabel: { [Op.like]: `%${search}%` } },
      ];
    }

    const sales = await SalesOrder.findAll({
      where,
      include: listIncludes,
      order: [
        ["saleDate", "DESC"],
        ["id", "DESC"],
      ],
    });

    return res.json(sales.map(serializeSale));
  } catch (error) {
    console.error("Error listing sales orders:", error);
    return res.status(500).json({ error: "Failed to load sales tracker records" });
  }
});

router.get("/product-search", auth, checkPermission("sales", "view"), async (req, res) => {
  try {
    const query = sanitizeString(req.query.query);
    if (!query || query.length < 2) {
      return res.json([]);
    }

    const products = await Products.findAll({
      where: {
        [Op.or]: [
          { sku: { [Op.like]: `%${query}%` } },
          { alternativeSku: { [Op.like]: `%${query}%` } },
          { brand: { [Op.like]: `%${query}%` } },
          { itemName: { [Op.like]: `%${query}%` } },
          sequelize.where(sequelize.cast(sequelize.col("upc"), "CHAR"), {
            [Op.like]: `%${query}%`,
          }),
        ],
      },
      attributes: ["sku", "alternativeSku", "brand", "itemName", "sizeOz", "quantity", "upc"],
      order: [
        ["brand", "ASC"],
        ["itemName", "ASC"],
        ["sku", "ASC"],
      ],
      limit: 20,
    });

    return res.json(
      products.map((product) => ({
        sku: product.sku,
        alternativeSku: product.alternativeSku || null,
        itemName: buildProductDisplayName(product),
        quantity: Number(product.quantity || 0),
        upc: product.upc || null,
      }))
    );
  } catch (error) {
    console.error("Error searching products for sales:", error);
    return res.status(500).json({ error: "Failed to search products" });
  }
});

router.get("/lookup-product", auth, checkPermission("sales", "view"), async (req, res) => {
  try {
    const sku = sanitizeString(req.query.sku);
    if (!sku) {
      return res.status(400).json({ error: "SKU is required" });
    }

    const product = await resolveProductBySku(sku);
    if (!product) {
      return res.status(404).json({ error: "SKU not found" });
    }

    return res.json({
      sku: product.sku,
      alternativeSku: product.alternativeSku || null,
      itemName: buildProductDisplayName(product),
      quantity: Number(product.quantity || 0),
      upc: product.upc || null,
    });
  } catch (error) {
    console.error("Error looking up sales SKU:", error);
    return res.status(500).json({ error: "Failed to look up SKU" });
  }
});

router.get("/:id/invoice-attachment", auth, checkPermission("sales", "view"), async (req, res) => {
  try {
    const saleId = Number(req.params.id);
    if (!Number.isInteger(saleId) || saleId <= 0) {
      return res.status(400).json({ error: "Invalid sale id" });
    }

    const sale = await SalesOrder.findByPk(saleId, {
      attributes: [
        "id",
        "invoiceAttachmentPath",
        "invoiceAttachmentOriginalName",
        "invoiceAttachmentMimeType",
      ],
    });
    if (!sale) {
      return res.status(404).json({ error: "Sales record not found" });
    }
    if (!sale.invoiceAttachmentPath) {
      return res.status(404).json({ error: "No invoice attachment found" });
    }
    if (!fs.existsSync(sale.invoiceAttachmentPath)) {
      return res.status(404).json({ error: "Attached file could not be found on disk" });
    }

    const fileName = sale.invoiceAttachmentOriginalName || path.basename(sale.invoiceAttachmentPath);
    res.setHeader("Content-Type", sale.invoiceAttachmentMimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`);
    return res.sendFile(path.resolve(sale.invoiceAttachmentPath));
  } catch (error) {
    console.error("Error fetching sales invoice attachment:", error);
    return res.status(500).json({ error: "Failed to fetch invoice attachment" });
  }
});

router.post(
  "/:id/invoice-attachment",
  auth,
  checkPermission("sales", "edit"),
  (req, res) => {
    salesInvoiceUpload.single("file")(req, res, async (uploadError) => {
      const uploadedPath = req.file?.path || null;
      if (uploadError) {
        console.error("Error uploading sales invoice attachment:", uploadError);
        return res.status(400).json({ error: uploadError.message || "Failed to upload invoice attachment" });
      }

      const transaction = await sequelize.transaction();
      try {
        const saleId = Number(req.params.id);
        if (!Number.isInteger(saleId) || saleId <= 0) {
          if (uploadedPath) removeFileIfExists(uploadedPath);
          await transaction.rollback();
          return res.status(400).json({ error: "Invalid sale id" });
        }
        if (!req.file) {
          await transaction.rollback();
          return res.status(400).json({ error: "No file uploaded" });
        }

        const sale = await SalesOrder.findByPk(saleId, {
          include: listIncludes,
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!sale) {
          if (uploadedPath) removeFileIfExists(uploadedPath);
          await transaction.rollback();
          return res.status(404).json({ error: "Sales record not found" });
        }
        if (sale.status === "voided") {
          if (uploadedPath) removeFileIfExists(uploadedPath);
          await transaction.rollback();
          return res.status(400).json({ error: "Voided sales records cannot be updated" });
        }

        const previousPath = sale.invoiceAttachmentPath;
        sale.invoiceAttachmentPath = req.file.path;
        sale.invoiceAttachmentOriginalName = req.file.originalname;
        sale.invoiceAttachmentMimeType = req.file.mimetype || null;
        sale.invoiceAttachmentUploadedAt = new Date();
        sale.invoiceAttachmentUploadedBy = req.user?.id || null;
        sale.lastUpdatedBy = req.user?.id || sale.lastUpdatedBy;
        await sale.save({ transaction });
        await transaction.commit();

        if (previousPath && previousPath !== req.file.path) {
          removeFileIfExists(previousPath);
        }

        const updatedSale = await SalesOrder.findByPk(sale.id, { include: listIncludes });
        return res.json(serializeSale(updatedSale));
      } catch (error) {
        if (uploadedPath) removeFileIfExists(uploadedPath);
        await transaction.rollback();
        console.error("Error saving sales invoice attachment:", error);
        return res.status(error.status || 500).json({ error: error.message || "Failed to save invoice attachment" });
      }
    });
  }
);

router.delete("/:id/invoice-attachment", auth, checkPermission("sales", "edit"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const saleId = Number(req.params.id);
    if (!Number.isInteger(saleId) || saleId <= 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid sale id" });
    }

    const sale = await SalesOrder.findByPk(saleId, {
      include: listIncludes,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({ error: "Sales record not found" });
    }
    if (sale.status === "voided") {
      await transaction.rollback();
      return res.status(400).json({ error: "Voided sales records cannot be updated" });
    }

    const previousPath = sale.invoiceAttachmentPath;
    sale.invoiceAttachmentPath = null;
    sale.invoiceAttachmentOriginalName = null;
    sale.invoiceAttachmentMimeType = null;
    sale.invoiceAttachmentUploadedAt = null;
    sale.invoiceAttachmentUploadedBy = null;
    sale.lastUpdatedBy = req.user?.id || sale.lastUpdatedBy;
    await sale.save({ transaction });
    await transaction.commit();

    removeFileIfExists(previousPath);

    const updatedSale = await SalesOrder.findByPk(sale.id, { include: listIncludes });
    return res.json(serializeSale(updatedSale));
  } catch (error) {
    await transaction.rollback();
    console.error("Error deleting sales invoice attachment:", error);
    return res.status(500).json({ error: "Failed to delete invoice attachment" });
  }
});

router.get("/:id", auth, checkPermission("sales", "view"), async (req, res) => {
  try {
    const sale = await SalesOrder.findByPk(req.params.id, {
      include: listIncludes,
    });
    if (!sale) {
      return res.status(404).json({ error: "Sales record not found" });
    }
    return res.json(serializeSale(sale));
  } catch (error) {
    console.error("Error loading sales order:", error);
    return res.status(500).json({ error: "Failed to load sales record" });
  }
});

router.post("/", auth, checkPermission("sales", "create"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const payload = normalizeSalePayload(req.body || {});
    const builtItems = await buildItems(req.body?.items || []);
    const receiptNumber = await generateReceiptNumber();

    const sale = await SalesOrder.create(
      {
        ...payload,
        receiptNumber,
        createdBy: req.user.id,
        lastUpdatedBy: req.user.id,
      },
      { transaction }
    );

    if (builtItems.length > 0) {
      await SalesOrderItem.bulkCreate(
        builtItems.map((item) => ({
          ...item,
          saleId: sale.id,
        })),
        { transaction }
      );
    }

    const createdSale = await SalesOrder.findByPk(sale.id, {
      include: listIncludes,
      transaction,
    });

    await createLog({
      transaction,
      actor: req.user,
      action: "create",
      entityId: sale.id,
      previousState: null,
      newState: createdSale.get({ plain: true }),
      metaData: { source: "sales_tracker" },
    });

    await transaction.commit();
    return res.status(201).json(serializeSale(createdSale));
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating sales order:", error);
    return res.status(error.status || 500).json({
      error: error.message || "Failed to create sales record",
    });
  }
});

router.put("/:id", auth, checkPermission("sales", "edit"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const sale = await SalesOrder.findByPk(req.params.id, {
      include: listIncludes,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({ error: "Sales record not found" });
    }

    const stale = assertOptimisticLock(sale, parseExpectedUpdatedAt(req.body?.expectedUpdatedAt));
    if (stale) {
      await transaction.rollback();
      return res.status(stale.status).json(stale.body);
    }

    if (sale.status === "voided") {
      await transaction.rollback();
      return res.status(400).json({ error: "Voided sales records cannot be edited" });
    }

    const payload = normalizeSalePayload(req.body || {});
    const previousState = sale.get({ plain: true });

    if (sale.status === "finalized") {
      await sale.update(
        {
          ...payload,
          lastUpdatedBy: req.user.id,
        },
        { transaction }
      );
    } else {
      const builtItems = await buildItems(req.body?.items || []);
      await sale.update(
        {
          ...payload,
          lastUpdatedBy: req.user.id,
        },
        { transaction }
      );

      await SalesOrderItem.destroy({
        where: { saleId: sale.id },
        transaction,
      });

      if (builtItems.length > 0) {
        await SalesOrderItem.bulkCreate(
          builtItems.map((item) => ({
            ...item,
            saleId: sale.id,
          })),
          { transaction }
        );
      }
    }

    const updatedSale = await SalesOrder.findByPk(sale.id, {
      include: listIncludes,
      transaction,
    });

    await createLog({
      transaction,
      actor: req.user,
      action: "update",
      entityId: sale.id,
      previousState,
      newState: updatedSale.get({ plain: true }),
      metaData: { source: "sales_tracker" },
    });

    await transaction.commit();
    return res.json(serializeSale(updatedSale));
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating sales order:", error);
    return res.status(error.status || 500).json({
      error: error.message || "Failed to update sales record",
    });
  }
});

router.post("/:id/finalize", auth, checkPermission("sales", "edit"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const sale = await SalesOrder.findByPk(req.params.id, {
      include: listIncludes,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({ error: "Sales record not found" });
    }

    const stale = assertOptimisticLock(sale, parseExpectedUpdatedAt(req.body?.expectedUpdatedAt));
    if (stale) {
      await transaction.rollback();
      return res.status(stale.status).json(stale.body);
    }

    if (sale.status !== "draft") {
      await transaction.rollback();
      return res.status(400).json({ error: "Only draft sales can be finalized" });
    }

    const items = Array.isArray(sale.items) ? sale.items : [];
    if (items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Add at least one item before finalizing the sale" });
    }

    const products = await Products.findAll({
      where: {
        sku: {
          [Op.in]: [...new Set(items.map((item) => item.sku))],
        },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const productMap = new Map(products.map((product) => [product.sku, product]));
    for (const item of items) {
      const product = productMap.get(item.sku);
      if (!product) {
        const error = new Error(`Product not found for SKU ${item.sku}`);
        error.status = 400;
        throw error;
      }
      const currentQuantity = Number(product.quantity || 0);
      await product.update({ quantity: currentQuantity - Number(item.quantity || 0) }, { transaction });
    }

    const previousState = sale.get({ plain: true });
    await sale.update(
      {
        status: "finalized",
        finalizedAt: new Date(),
        finalizedBy: req.user.id,
        lastUpdatedBy: req.user.id,
      },
      { transaction }
    );

    const updatedSale = await SalesOrder.findByPk(sale.id, {
      include: listIncludes,
      transaction,
    });

    await createLog({
      transaction,
      actor: req.user,
      action: "finalize",
      entityId: sale.id,
      previousState,
      newState: updatedSale.get({ plain: true }),
      metaData: {
        source: "sales_tracker",
        stockMovement: "deduct",
      },
    });

    await transaction.commit();
    return res.json(serializeSale(updatedSale));
  } catch (error) {
    await transaction.rollback();
    console.error("Error finalizing sales order:", error);
    return res.status(error.status || 500).json({
      error: error.message || "Failed to finalize sales record",
    });
  }
});

router.post("/:id/void", auth, checkPermission("sales", "edit"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const sale = await SalesOrder.findByPk(req.params.id, {
      include: listIncludes,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({ error: "Sales record not found" });
    }

    const stale = assertOptimisticLock(sale, parseExpectedUpdatedAt(req.body?.expectedUpdatedAt));
    if (stale) {
      await transaction.rollback();
      return res.status(stale.status).json(stale.body);
    }

    if (sale.status !== "finalized") {
      await transaction.rollback();
      return res.status(400).json({ error: "Only finalized sales can be voided" });
    }

    const voidReason = sanitizeString(req.body?.voidReason).slice(0, MAX_VOID_REASON_LENGTH);
    const items = Array.isArray(sale.items) ? sale.items : [];
    const products = await Products.findAll({
      where: {
        sku: {
          [Op.in]: [...new Set(items.map((item) => item.sku))],
        },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const productMap = new Map(products.map((product) => [product.sku, product]));
    for (const item of items) {
      const product = productMap.get(item.sku);
      if (!product) {
        const error = new Error(`Product not found for SKU ${item.sku}`);
        error.status = 400;
        throw error;
      }
      const currentQuantity = Number(product.quantity || 0);
      await product.update({ quantity: currentQuantity + Number(item.quantity || 0) }, { transaction });
    }

    const previousState = sale.get({ plain: true });
    await sale.update(
      {
        status: "voided",
        voidedAt: new Date(),
        voidedBy: req.user.id,
        voidReason: voidReason || null,
        lastUpdatedBy: req.user.id,
      },
      { transaction }
    );

    const updatedSale = await SalesOrder.findByPk(sale.id, {
      include: listIncludes,
      transaction,
    });

    await createLog({
      transaction,
      actor: req.user,
      action: "void",
      entityId: sale.id,
      previousState,
      newState: updatedSale.get({ plain: true }),
      metaData: {
        source: "sales_tracker",
        stockMovement: "restore",
        voidReason: voidReason || null,
      },
    });

    await transaction.commit();
    return res.json(serializeSale(updatedSale));
  } catch (error) {
    await transaction.rollback();
    console.error("Error voiding sales order:", error);
    return res.status(error.status || 500).json({
      error: error.message || "Failed to void sales record",
    });
  }
});

router.delete("/:id", auth, checkPermission("sales", "delete"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const sale = await SalesOrder.findByPk(req.params.id, {
      include: listIncludes,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({ error: "Sales record not found" });
    }

    if (sale.status !== "draft") {
      await transaction.rollback();
      return res.status(400).json({ error: "Only draft sales can be deleted" });
    }

    await createLog({
      transaction,
      actor: req.user,
      action: "delete",
      entityId: sale.id,
      previousState: sale.get({ plain: true }),
      newState: null,
      metaData: { source: "sales_tracker" },
    });

    await sale.destroy({ transaction });
    await transaction.commit();
    return res.json({ success: true });
  } catch (error) {
    await transaction.rollback();
    console.error("Error deleting sales order:", error);
    return res.status(500).json({ error: "Failed to delete sales record" });
  }
});

module.exports = router;

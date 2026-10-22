const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const xlsx = require("xlsx");
const JSZip = require("jszip");
const { Op } = require("sequelize");
const {
  sequelize,
  PriceListUpload,
  PriceListOffer,
  PriceListCartItem,
  PriceListCartState,
} = require("../models");
const { auth } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permissions");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "../uploads/pricelists");
const STALE_CART_MESSAGE =
  "You have a cart from old pricelists which might have new prices for items, Please save your cart or delete items and add again";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".xlsx", ".xls", ".csv"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedTypes.includes(ext)) {
      cb(new Error("Only Excel and CSV files are allowed"));
      return;
    }
    cb(null, true);
  },
});

const sanitizeString = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normalizeHeader = (value) =>
  sanitizeString(value)
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "")
    .toUpperCase();

const normalizeName = (value) =>
  sanitizeString(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const parsePriceValue = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed.toFixed(2));
};

const parseAvailableValue = (value) => {
  const raw = sanitizeString(value);
  if (!raw) return null;
  const digits = raw.replace(/[^0-9.-]/g, "");
  if (!digits) return null;
  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
};

// Normalize a raw UPC value: strip formatting, zero-pad 11-digit numbers (Excel drops leading zero)
const parseUpcValue = (value) => {
  if (value === null || value === undefined || value === "") return "";
  // Remove spaces, dashes, dots, quotes
  const cleaned = String(value).replace(/[\s\-.'"`]/g, "").trim();
  if (!cleaned) return "";
  // If purely numeric and 11 digits, pad to 12 (Excel stripped the leading zero)
  if (/^\d{11}$/.test(cleaned)) return "0" + cleaned;
  // Accept 12–14 digit numeric strings (UPC-A, EAN-13, GTIN-14) and alphanumeric codes
  if (/^\d{12,14}$/.test(cleaned) || /^[A-Z0-9\-]{6,20}$/i.test(cleaned)) return cleaned;
  return "";
};

// Detect which column looks like it contains UPC/barcode values
// Returns the column index or -1
const detectUpcColumn = (headers, dataRows) => {
  const sample = dataRows.slice(0, 50);
  const scores = headers.map((_, col) => {
    let hits = 0;
    for (const row of sample) {
      const v = parseUpcValue(row[col]);
      if (v && /^\d{11,14}$/.test(v)) hits++;
    }
    return hits;
  });
  const threshold = sample.length * 0.4;
  // Find best-scoring column that isn't already identified as price/name/qty
  const best = scores
    .map((score, col) => ({ col, score, header: headers[col] }))
    .filter(({ score, header }) =>
      score >= threshold &&
      !PRICE_ALIASES.has(header) &&
      !NAME_ALIASES.has(header) &&
      !QTY_ALIASES.has(header)
    )
    .sort((a, b) => b.score - a.score)[0];
  return best ? best.col : -1;
};

const buildIdentityKey = ({ vendorName, upc, productName }) => {
  const normalizedVendor = normalizeName(vendorName);
  if (sanitizeString(upc)) {
    return `${normalizedVendor}::upc::${sanitizeString(upc)}`;
  }
  return `${normalizedVendor}::name::${normalizeName(productName)}`;
};

const buildSearchText = ({ upc, brand, productName, vendorName }) =>
  [upc, brand, productName, vendorName]
    .map((value) => normalizeName(value))
    .filter(Boolean)
    .join(" ");

const mapRowByHeaders = (row) => {
  const mapped = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    mapped[normalizeHeader(key)] = value;
  });
  return mapped;
};

// Known column aliases per field
const PRICE_ALIASES = new Set([
  "PRICE", "COST", "UNITPRICE", "UNIT_PRICE", "UNIT_COST", "UNITCOST",
  "WHOLESALE", "WHOLESALE_PRICE", "WHOLESALEPRICE",
  "SPECIAL", "SALE", "SALEPRICE", "SALE_PRICE",
  "LIST", "LIST_PRICE", "LISTPRICE",
  "MSRP", "EACH", "COST_PRICE", "COSTPRICE", "DEALER_PRICE", "DEALERPRICE",
  "BUYING_PRICE", "BUYINGPRICE", "NET", "NET_PRICE", "NETPRICE",
]);
const NAME_ALIASES = new Set(["NAME", "DESCRIPTION", "ITEM", "ITEM_NAME", "ITEMNAME", "PRODUCT", "PRODUCT_NAME", "PRODUCTNAME", "TITLE"]);
const UPC_ALIASES  = new Set([
  "UPC", "UPCCODE", "UPC_CODE", "UPCEAN", "UPCA", "UPCBAR",
  "BARCODE", "BAR_CODE", "BARCODENUMBER",
  "EAN", "EAN13", "EAN_13", "EANCODE",
  "GTIN", "GTIN13", "GTIN_13", "GTIN14", "GTIN_14",
  "ISBN", "PRODUCTCODE", "PRODUCT_CODE",
  "ITEMCODE", "ITEM_CODE", "ITEMNO", "ITEM_NO", "ITEMNUMBER", "ITEM_NUMBER",
  "CODE", "CATALOGCODE", "CATALOG_CODE",
  "SERIAL", "SERIALNO", "SERIAL_NO",
]);
const QTY_ALIASES  = new Set(["AVAILABLE", "AVAIL", "QTY", "STOCK", "QUANTITY", "ON_HAND", "ONHAND", "IN_STOCK", "INSTOCK"]);
const BRAND_ALIASES = new Set(["BRAND", "MANUFACTURER", "MFG", "MAKE", "VENDOR", "SUPPLIER"]);

const HEADER_KEYWORDS = new Set([...PRICE_ALIASES, ...NAME_ALIASES, ...UPC_ALIASES, ...QTY_ALIASES, ...BRAND_ALIASES, "SIZE", "WEIGHT", "SKU", "MODEL"]);

const scoreRowAsHeader = (cells) => {
  let score = 0;
  for (const cell of cells) {
    const n = normalizeHeader(String(cell ?? ""));
    if (n && HEADER_KEYWORDS.has(n)) score++;
  }
  return score;
};

// Detect which column is numeric across data rows (fallback price detection)
const detectNumericColumn = (headers, dataRows) => {
  const counts = new Array(headers.length).fill(0);
  const totals = new Array(headers.length).fill(0);
  for (const row of dataRows.slice(0, 50)) {
    row.forEach((cell, col) => {
      const v = parsePriceValue(cell);
      if (v !== null && v > 0) { counts[col]++; totals[col]++; }
    });
  }
  const sample = Math.min(dataRows.length, 50);
  const threshold = sample * 0.5;
  // Return column indices where >50% of rows have a positive numeric value, sorted by count desc
  return headers
    .map((h, col) => ({ col, header: h, count: counts[col] }))
    .filter(({ count }) => count >= threshold)
    .sort((a, b) => b.count - a.count);
};

const resolveField = (mapped, aliases) => {
  for (const alias of aliases) {
    if (mapped[alias] !== undefined && mapped[alias] !== "") return mapped[alias];
  }
  return undefined;
};

// Extract detected sheet info without committing to offers — used for mapping preview
const extractSheetMeta = (worksheet) => {
  const rawRows = xlsx.utils.sheet_to_json(worksheet, { defval: "", header: 1 });
  let bestHeaderIdx = 0;
  let bestScore = 0;
  rawRows.forEach((row, idx) => {
    const score = scoreRowAsHeader(row);
    if (score > bestScore) { bestScore = score; bestHeaderIdx = idx; }
  });
  const headerRow = rawRows[bestHeaderIdx] || [];
  const headers = headerRow.map((cell) => normalizeHeader(String(cell ?? "")));
  const originalHeaders = headerRow.map((cell) => sanitizeString(String(cell ?? "")));
  const dataRows = rawRows.slice(bestHeaderIdx + 1).filter(row => row.some(c => String(c ?? "").trim()));
  return { headers, originalHeaders, dataRows, bestHeaderIdx };
};

const buildOffersFromRows = ({ headers, dataRows, vendorName, columnMapping = {} }) => {
  // columnMapping overrides: { price: "SPECIAL", name: "PRODUCT_NAME", upc: "BARCODE", qty: "AVAIL", brand: "MANUFACTURER" }
  const priceKey   = columnMapping.price   ? normalizeHeader(columnMapping.price)   : null;
  const nameKey    = columnMapping.name    ? normalizeHeader(columnMapping.name)     : null;
  const upcKey     = columnMapping.upc     ? normalizeHeader(columnMapping.upc)      : null;
  const qtyKey     = columnMapping.qty     ? normalizeHeader(columnMapping.qty)      : null;
  const brandKey   = columnMapping.brand   ? normalizeHeader(columnMapping.brand)    : null;

  // If no price mapping provided, try to detect numeric fallback column
  let fallbackPriceHeader = null;
  if (!priceKey) {
    const numericCols = detectNumericColumn(headers, dataRows);
    const candidate = numericCols.find(({ header }) => !NAME_ALIASES.has(header) && !UPC_ALIASES.has(header) && !QTY_ALIASES.has(header));
    if (candidate) fallbackPriceHeader = candidate.header;
  }

  // If no UPC mapping provided, try to detect a UPC-like column by value pattern
  let fallbackUpcCol = -1;
  if (!upcKey && resolveField(Object.fromEntries(headers.map((h, i) => [h, i])), UPC_ALIASES) === undefined) {
    fallbackUpcCol = detectUpcColumn(headers, dataRows);
  }

  const offers = [];
  dataRows.forEach((row) => {
    const mapped = {};
    headers.forEach((header, col) => { if (header) mapped[header] = row[col] ?? ""; });

    const productName = sanitizeString(
      nameKey ? mapped[nameKey] : resolveField(mapped, NAME_ALIASES)
    );
    const rawUpc = upcKey
      ? mapped[upcKey]
      : (resolveField(mapped, UPC_ALIASES) ?? (fallbackUpcCol !== -1 ? row[fallbackUpcCol] : undefined));
    const upc = parseUpcValue(rawUpc);
    const brand = sanitizeString(
      brandKey ? mapped[brandKey] : resolveField(mapped, BRAND_ALIASES)
    );
    const rawPrice = priceKey
      ? mapped[priceKey]
      : (resolveField(mapped, PRICE_ALIASES) ?? (fallbackPriceHeader ? mapped[fallbackPriceHeader] : undefined));
    const price = parsePriceValue(rawPrice);
    const rawQty = qtyKey ? mapped[qtyKey] : resolveField(mapped, QTY_ALIASES);
    const availableQty = parseAvailableValue(rawQty);

    if (!productName && !upc) return;
    if (price === null) return;

    offers.push({
      vendorName: sanitizeString(vendorName),
      upc: upc || null,
      brand: brand || null,
      productName: productName || upc,
      price,
      availableQty,
      identityKey: buildIdentityKey({ vendorName, upc, productName: productName || upc }),
      searchText: buildSearchText({ upc, brand, productName: productName || upc, vendorName }),
    });
  });
  return offers;
};

const parseWorkbookOffers = ({ filePath, vendorName, columnMapping = {} }) => {
  const workbook = xlsx.readFile(filePath, { cellDates: false, raw: false });
  const offers = [];
  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const { headers, dataRows } = extractSheetMeta(worksheet);
    offers.push(...buildOffersFromRows({ headers, dataRows, vendorName, columnMapping }));
  });
  return offers;
};

// Returns needsMapping:true + preview data when price column can't be auto-detected
const buildPreview = ({ headers, originalHeaders, dataRows }) => {
  const numericCols = detectNumericColumn(headers, dataRows);
  const sampleRows = dataRows.slice(0, 5).map(row =>
    originalHeaders.reduce((obj, h, col) => { obj[h] = row[col] ?? ""; return obj; }, {})
  );

  const priceHeaderIdx = headers.findIndex(h => PRICE_ALIASES.has(h));
  const fallbackPriceIdx = numericCols.find(({ header }) => !NAME_ALIASES.has(header) && !UPC_ALIASES.has(header) && !QTY_ALIASES.has(header))?.col ?? -1;
  const upcAliasIdx = headers.findIndex(h => UPC_ALIASES.has(h));
  const upcFallbackIdx = upcAliasIdx === -1 ? detectUpcColumn(headers, dataRows) : -1;

  return {
    headers: originalHeaders.filter(Boolean),
    sampleRows,
    suggestions: {
      price: priceHeaderIdx !== -1 ? originalHeaders[priceHeaderIdx] : (fallbackPriceIdx !== -1 ? originalHeaders[fallbackPriceIdx] : null),
      name:  originalHeaders[headers.findIndex(h => NAME_ALIASES.has(h))]  || null,
      upc:   upcAliasIdx !== -1 ? originalHeaders[upcAliasIdx] : (upcFallbackIdx !== -1 ? originalHeaders[upcFallbackIdx] : null),
      qty:   originalHeaders[headers.findIndex(h => QTY_ALIASES.has(h))]   || null,
      brand: originalHeaders[headers.findIndex(h => BRAND_ALIASES.has(h))] || null,
    },
  };
};

const parseWorkbookWithPreview = ({ filePath, vendorName }) => {
  const workbook = xlsx.readFile(filePath, { cellDates: false, raw: false });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const { headers, originalHeaders, dataRows } = extractSheetMeta(worksheet);

  const preview = buildPreview({ headers, originalHeaders, dataRows });

  // Try parsing as-is
  const offers = buildOffersFromRows({ headers, dataRows, vendorName });
  if (offers.length > 0) return { offers, needsMapping: false, preview };

  // No offers — must map manually
  return { offers: [], needsMapping: true, preview };
};

const getOrCreateCartState = async (transaction) => {
  const [state] = await PriceListCartState.findOrCreate({
    where: { id: 1 },
    defaults: {
      id: 1,
      activeCatalogVersion: 0,
      cartCatalogVersion: null,
    },
    transaction,
  });
  return state;
};

const getCartSummary = async () => {
  const [state, uploads, cartItems] = await Promise.all([
    getOrCreateCartState(),
    PriceListUpload.findAll({
      where: { isActive: true, status: "completed" },
      attributes: ["id", "vendorName", "originalName", "productCount", "createdAt", "catalogVersion"],
      order: [
        ["vendorName", "ASC"],
        ["createdAt", "DESC"],
      ],
    }),
    PriceListCartItem.findAll({
      order: [
        ["vendorName", "ASC"],
        ["productName", "ASC"],
      ],
    }),
  ]);

  const cartHasItems = cartItems.length > 0;
  const cartFrozen =
    cartHasItems &&
    state.cartCatalogVersion !== null &&
    Number(state.cartCatalogVersion) !== Number(state.activeCatalogVersion);

  return {
    uploads,
    cartItems,
    cartHasItems,
    cartFrozen,
    cartMessage: cartFrozen ? STALE_CART_MESSAGE : null,
    activeCatalogVersion: Number(state.activeCatalogVersion || 0),
    cartCatalogVersion: state.cartCatalogVersion === null ? null : Number(state.cartCatalogVersion),
  };
};

const capQuantity = (desiredQuantity, availableQty) => {
  if (availableQty === null || availableQty === undefined) {
    return { quantity: desiredQuantity, warning: null };
  }
  if (desiredQuantity <= availableQty) {
    return { quantity: desiredQuantity, warning: null };
  }
  return {
    quantity: availableQty,
    warning: `Quantity capped to available stock (${availableQty}).`,
  };
};

router.get("/dashboard", auth, checkPermission("pricelist", "view"), async (req, res) => {
  try {
    const summary = await getCartSummary();
    res.json(summary);
  } catch (error) {
    console.error("Error fetching price list dashboard:", error);
    res.status(500).json({ error: "Failed to fetch price list data" });
  }
});

router.get("/search", auth, checkPermission("pricelist", "view"), async (req, res) => {
  try {
    const query = sanitizeString(req.query.query);
    if (!query) {
      return res.json([]);
    }

    const tokens = normalizeName(query)
      .split(" ")
      .map((token) => token.trim())
      .filter(Boolean);

    if (tokens.length < 1) {
      return res.json([]);
    }

    const where = {
      [Op.and]: tokens.map((token) => ({
        searchText: {
          [Op.like]: `%${token}%`,
        },
      })),
    };

    const offers = await PriceListOffer.findAll({
      where,
      include: [
        {
          model: PriceListUpload,
          as: "upload",
          required: true,
          where: { isActive: true, status: "completed" },
          attributes: ["id", "vendorName", "originalName", "catalogVersion"],
        },
      ],
      order: [
        [{ model: PriceListUpload, as: "upload" }, "vendorName", "ASC"],
        ["productName", "ASC"],
      ],
      limit: 100,
    });

    res.json(
      offers.map((offer) => ({
        id: offer.id,
        vendorName: offer.vendorName,
        upc: offer.upc,
        brand: offer.brand,
        productName: offer.productName,
        price: Number(offer.price),
        availableQty: offer.availableQty,
        identityKey: offer.identityKey,
      }))
    );
  } catch (error) {
    console.error("Error searching price list offers:", error);
    res.status(500).json({ error: "Failed to search price lists" });
  }
});

router.post(
  "/upload",
  auth,
  checkPermission("pricelist", "create"),
  upload.single("file"),
  async (req, res) => {
    let uploadedFilePath = null;
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const vendorName = sanitizeString(req.body.vendorName);
      if (!vendorName) {
        return res.status(400).json({ error: "Vendor name is required" });
      }

      uploadedFilePath = req.file.path;
      const isDryRun = req.body.dryRun === "true";

      // Parse columnMapping override from request body (sent as JSON string or object)
      let columnMapping = {};
      if (req.body.columnMapping) {
        try {
          columnMapping = typeof req.body.columnMapping === "string"
            ? JSON.parse(req.body.columnMapping)
            : req.body.columnMapping;
        } catch (_) { /* ignore malformed mapping */ }
      }

      // Dry run: parse and return detected mapping + preview without saving
      if (isDryRun) {
        const parsed = parseWorkbookWithPreview({ filePath: uploadedFilePath, vendorName });
        if (uploadedFilePath && fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath);
        uploadedFilePath = null;
        return res.status(200).json({ dryRun: true, needsMapping: parsed.needsMapping, preview: parsed.preview });
      }

      // If explicit mapping provided, use it directly; otherwise try smart detection with preview fallback
      let offers;
      if (Object.keys(columnMapping).length > 0) {
        offers = parseWorkbookOffers({ filePath: uploadedFilePath, vendorName, columnMapping });
        if (offers.length < 1) {
          return res.status(400).json({ error: "No valid offers were found with the provided column mapping." });
        }
      } else {
        const parsed = parseWorkbookWithPreview({ filePath: uploadedFilePath, vendorName });
        if (parsed.needsMapping) {
          return res.status(200).json({ needsMapping: true, preview: parsed.preview });
        }
        offers = parsed.offers;
        if (offers.length < 1) {
          return res.status(400).json({ error: "No valid offers were found in the uploaded file." });
        }
      }

      const existingUploads = await PriceListUpload.findAll({
        where: { vendorName, isActive: true },
        attributes: ["id", "filePath"],
      });

      const result = await sequelize.transaction(async (transaction) => {
        const cartState = await getOrCreateCartState(transaction);
        const nextCatalogVersion = Number(cartState.activeCatalogVersion || 0) + 1;

        const uploadRecord = await PriceListUpload.create(
          {
            vendorName,
            fileName: req.file.filename,
            originalName: req.file.originalname,
            filePath: uploadedFilePath,
            status: "completed",
            productCount: offers.length,
            uploadedBy: req.user?.id || null,
            isActive: true,
            catalogVersion: nextCatalogVersion,
          },
          { transaction }
        );

        await PriceListOffer.bulkCreate(
          offers.map((offer) => ({
            ...offer,
            priceListUploadId: uploadRecord.id,
          })),
          { transaction }
        );

        if (existingUploads.length > 0) {
          const existingIds = existingUploads.map((item) => item.id);
          await PriceListOffer.destroy({
            where: { priceListUploadId: { [Op.in]: existingIds } },
            transaction,
          });
          await PriceListUpload.destroy({
            where: { id: { [Op.in]: existingIds } },
            transaction,
          });
        }

        cartState.activeCatalogVersion = nextCatalogVersion;
        await cartState.save({ transaction });

        return {
          uploadRecord,
          previousFiles: existingUploads.map((item) => item.filePath).filter(Boolean),
        };
      });

      for (const staleFilePath of result.previousFiles) {
        if (staleFilePath && fs.existsSync(staleFilePath)) {
          fs.unlinkSync(staleFilePath);
        }
      }

      const summary = await getCartSummary();
      res.json({
        message: `Uploaded ${offers.length} offers for ${vendorName}.`,
        upload: {
          id: result.uploadRecord.id,
          vendorName: result.uploadRecord.vendorName,
          originalName: result.uploadRecord.originalName,
          productCount: result.uploadRecord.productCount,
          createdAt: result.uploadRecord.createdAt,
        },
        ...summary,
      });
    } catch (error) {
      console.error("Error uploading price list:", error);
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        fs.unlinkSync(uploadedFilePath);
      }
      res.status(500).json({ error: error.message || "Failed to upload price list" });
    }
  }
);

router.delete("/uploads/:id", auth, checkPermission("pricelist", "delete"), async (req, res) => {
  try {
    const uploadId = Number(req.params.id);
    const upload = await PriceListUpload.findByPk(uploadId);

    if (!upload || !upload.isActive) {
      return res.status(404).json({ error: "Active vendor pricelist not found." });
    }

    const vendorCartCount = await PriceListCartItem.count({
      where: { vendorName: upload.vendorName },
    });

    if (vendorCartCount > 0) {
      return res.status(409).json({
        error: `Cannot remove ${upload.vendorName} while that vendor still has items in the shared cart. Please clear or save those cart lines first.`,
      });
    }

    const filePath = upload.filePath;

    await sequelize.transaction(async (transaction) => {
      await PriceListOffer.destroy({
        where: { priceListUploadId: upload.id },
        transaction,
      });

      await upload.destroy({ transaction });

      const cartState = await getOrCreateCartState(transaction);
      cartState.activeCatalogVersion = Number(cartState.activeCatalogVersion || 0) + 1;

      const cartCount = await PriceListCartItem.count({ transaction });
      if (cartCount === 0) {
        cartState.cartCatalogVersion = null;
      }

      await cartState.save({ transaction });
    });

    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const summary = await getCartSummary();
    res.json({
      message: `${upload.vendorName} pricelist removed.`,
      ...summary,
    });
  } catch (error) {
    console.error("Error deleting vendor pricelist:", error);
    res.status(500).json({ error: "Failed to delete vendor pricelist" });
  }
});

router.post("/cart/items", auth, checkPermission("pricelist", "edit"), async (req, res) => {
  try {
    const offerId = Number(req.body.offerId);
    const requestedQuantity = Math.max(1, Number(req.body.quantity) || 1);

    const offer = await PriceListOffer.findByPk(offerId, {
      include: [
        {
          model: PriceListUpload,
          as: "upload",
          required: true,
          where: { isActive: true, status: "completed" },
        },
      ],
    });

    if (!offer) {
      return res.status(404).json({ error: "Offer not found in the active price lists." });
    }

    const result = await sequelize.transaction(async (transaction) => {
      const cartState = await getOrCreateCartState(transaction);
      const cartCount = await PriceListCartItem.count({ transaction });

      if (
        cartCount > 0 &&
        cartState.cartCatalogVersion !== null &&
        Number(cartState.cartCatalogVersion) !== Number(cartState.activeCatalogVersion)
      ) {
        return { staleCart: true };
      }

      if (cartCount === 0) {
        cartState.cartCatalogVersion = Number(cartState.activeCatalogVersion || 0);
        await cartState.save({ transaction });
      }

      const existingItem = await PriceListCartItem.findOne({
        where: {
          vendorName: offer.vendorName,
          identityKey: offer.identityKey,
        },
        transaction,
      });

      const currentQuantity = existingItem ? Number(existingItem.quantity || 0) : 0;
      const desiredQuantity = currentQuantity + requestedQuantity;
      const { quantity, warning } = capQuantity(desiredQuantity, offer.availableQty);

      if (existingItem) {
        existingItem.upc = offer.upc;
        existingItem.brand = offer.brand;
        existingItem.productName = offer.productName;
        existingItem.price = offer.price;
        existingItem.availableQty = offer.availableQty;
        existingItem.quantity = quantity;
        existingItem.sourceUploadId = offer.priceListUploadId;
        existingItem.lastUpdatedBy = req.user?.id || null;
        await existingItem.save({ transaction });
      } else {
        await PriceListCartItem.create(
          {
            vendorName: offer.vendorName,
            identityKey: offer.identityKey,
            upc: offer.upc,
            brand: offer.brand,
            productName: offer.productName,
            price: offer.price,
            availableQty: offer.availableQty,
            quantity,
            sourceUploadId: offer.priceListUploadId,
            createdBy: req.user?.id || null,
            lastUpdatedBy: req.user?.id || null,
          },
          { transaction }
        );
      }

      return { warning };
    });

    if (result.staleCart) {
      return res.status(409).json({ error: STALE_CART_MESSAGE, staleCart: true });
    }

    const summary = await getCartSummary();
    res.json({
      message: "Item added to cart.",
      warning: result.warning || null,
      ...summary,
    });
  } catch (error) {
    console.error("Error adding item to cart:", error);
    res.status(500).json({ error: "Failed to add item to cart" });
  }
});

router.patch("/cart/items/:id", auth, checkPermission("pricelist", "edit"), async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    const requestedQuantity = Math.max(1, Number(req.body.quantity) || 1);
    const item = await PriceListCartItem.findByPk(itemId);

    if (!item) {
      return res.status(404).json({ error: "Cart item not found." });
    }

    const { quantity, warning } = capQuantity(requestedQuantity, item.availableQty);
    item.quantity = quantity;
    item.lastUpdatedBy = req.user?.id || null;
    await item.save();

    const summary = await getCartSummary();
    res.json({
      message: "Cart item updated.",
      warning: warning || null,
      ...summary,
    });
  } catch (error) {
    console.error("Error updating cart item:", error);
    res.status(500).json({ error: "Failed to update cart item" });
  }
});

router.delete("/cart/items/:id", auth, checkPermission("pricelist", "edit"), async (req, res) => {
  try {
    const itemId = Number(req.params.id);

    await sequelize.transaction(async (transaction) => {
      const item = await PriceListCartItem.findByPk(itemId, { transaction });
      if (!item) {
        const error = new Error("Cart item not found.");
        error.status = 404;
        throw error;
      }
      await item.destroy({ transaction });

      const remaining = await PriceListCartItem.count({ transaction });
      if (remaining === 0) {
        const cartState = await getOrCreateCartState(transaction);
        cartState.cartCatalogVersion = null;
        await cartState.save({ transaction });
      }
    });

    const summary = await getCartSummary();
    res.json({
      message: "Cart item deleted.",
      ...summary,
    });
  } catch (error) {
    console.error("Error deleting cart item:", error);
    res.status(error.status || 500).json({ error: error.message || "Failed to delete cart item" });
  }
});

router.delete("/cart/clear", auth, checkPermission("pricelist", "edit"), async (req, res) => {
  try {
    await sequelize.transaction(async (transaction) => {
      await PriceListCartItem.destroy({ where: {}, truncate: true, transaction });
      const cartState = await getOrCreateCartState(transaction);
      cartState.cartCatalogVersion = null;
      await cartState.save({ transaction });
    });

    const summary = await getCartSummary();
    res.json({
      message: "Cart cleared.",
      ...summary,
    });
  } catch (error) {
    console.error("Error clearing price list cart:", error);
    res.status(500).json({ error: "Failed to clear cart" });
  }
});

router.get("/cart/export", auth, checkPermission("pricelist", "view"), async (req, res) => {
  try {
    const cartItems = await PriceListCartItem.findAll({
      order: [
        ["vendorName", "ASC"],
        ["productName", "ASC"],
      ],
    });

    if (cartItems.length < 1) {
      return res.status(400).json({ error: "Cart is empty." });
    }

    const grouped = cartItems.reduce((acc, item) => {
      if (!acc[item.vendorName]) {
        acc[item.vendorName] = [];
      }
      acc[item.vendorName].push(item);
      return acc;
    }, {});

    const zip = new JSZip();

    Object.entries(grouped).forEach(([vendorName, items]) => {
      const rows = items.map((item) => ({
        UPC: item.upc || "",
        BRAND: item.brand || "",
        NAME: item.productName,
        PRICE: Number(item.price || 0),
        AVAILABLE: item.availableQty === null || item.availableQty === undefined ? "" : item.availableQty,
        ORDER_QTY: Number(item.quantity || 0),
      }));
      const workbook = xlsx.utils.book_new();
      const worksheet = xlsx.utils.json_to_sheet(rows);
      xlsx.utils.book_append_sheet(workbook, worksheet, "Order");
      const fileBuffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
      const safeVendorName = vendorName.replace(/[\\/:*?"<>|]/g, "-");
      zip.file(`${safeVendorName}.xlsx`, fileBuffer);
    });

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=\"pricelist-cart-${today}.zip\"`);
    res.send(zipBuffer);
  } catch (error) {
    console.error("Error exporting cart:", error);
    res.status(500).json({ error: "Failed to export cart" });
  }
});

module.exports = router;

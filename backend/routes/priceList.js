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

const parseWorkbookOffers = ({ filePath, vendorName }) => {
  const workbook = xlsx.readFile(filePath, { cellDates: false, raw: false });
  const offers = [];

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

    rows.forEach((row) => {
      const mapped = mapRowByHeaders(row);
      const productName = sanitizeString(mapped.NAME || mapped.DESCRIPTION || mapped.ITEM || mapped.ITEM_NAME);
      const upc = sanitizeString(mapped.UPC || mapped.BARCODE || mapped.SERIAL || mapped.UPCEAN);
      const brand = sanitizeString(mapped.BRAND);
      const price = parsePriceValue(mapped.PRICE);
      const availableQty = parseAvailableValue(
        mapped.AVAILABLE || mapped.AVAIL || mapped.QTY || mapped.STOCK || mapped.QUANTITY
      );

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
  });

  return offers;
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
      const offers = parseWorkbookOffers({ filePath: uploadedFilePath, vendorName });
      if (offers.length < 1) {
        return res.status(400).json({ error: "No valid offers were found in the uploaded file." });
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

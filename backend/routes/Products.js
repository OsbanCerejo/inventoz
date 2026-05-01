const express = require("express");
const router = express.Router();
const { Products, ProductDetails, ProductHistory, StockUpdateHistory, Logs, HbaOrder, HbaOrderItem, sequelize } = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const StockUpdateService = require("../Services/StockUpdateService");
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

const LIST_SORT_KEYS = new Set([
  "sku",
  "brand",
  "itemName",
  "quantity",
  "sizeOz",
  "strength",
  "shade",
  "location",
  "upc",
]);

const buildContainsFilter = (columnName, rawValue, options = {}) => {
  const value = String(rawValue || "").trim();
  if (!value) return null;
  if (options.castToChar) {
    return Sequelize.where(
      Sequelize.cast(Sequelize.col(columnName), "CHAR"),
      { [Op.like]: `%${value}%` }
    );
  }
  return {
    [columnName]: {
      [Op.like]: `%${value}%`,
    },
  };
};

const normalizeNullableInteger = (value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.floor(parsed));
};

const normalizeNullableDecimal = (value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed.toFixed(2);
};

const HBA_ORDER_RATE_LIMIT_WINDOW_MS =
  Math.max(1, Number(process.env.HBA_ORDER_RATE_LIMIT_WINDOW_MINUTES || 15)) * 60 * 1000;
const HBA_ORDER_RATE_LIMIT_MAX_REQUESTS = Math.max(
  1,
  Number(process.env.HBA_ORDER_RATE_LIMIT_MAX_REQUESTS || 5)
);
const hbaOrderSubmissionLog = new Map();

const getClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || "unknown";
};

const checkHbaOrderRateLimit = (ipAddress) => {
  const now = Date.now();
  const windowStart = now - HBA_ORDER_RATE_LIMIT_WINDOW_MS;
  const previousEntries = hbaOrderSubmissionLog.get(ipAddress) || [];
  const recentEntries = previousEntries.filter((timestamp) => timestamp >= windowStart);

  if (recentEntries.length >= HBA_ORDER_RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterMs = recentEntries[0] + HBA_ORDER_RATE_LIMIT_WINDOW_MS - now;
    hbaOrderSubmissionLog.set(ipAddress, recentEntries);
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  recentEntries.push(now);
  hbaOrderSubmissionLog.set(ipAddress, recentEntries);
  return { limited: false, retryAfterSeconds: 0 };
};

const getHbaSalesPeople = () => {
  return String(process.env.HBA_SALES_PEOPLE || "General Sales")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
};

const generateHbaOrderNumber = () => {
  const now = new Date();
  const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const randomSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `HBA-${yyyymmdd}-${randomSuffix}`;
};

const buildHbaOrderEmailHtml = ({ customer, items, totals }) => {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">${item.sku}</td>
          <td style="padding:8px;border:1px solid #ddd;">${item.upc || ""}</td>
          <td style="padding:8px;border:1px solid #ddd;">${item.brand || ""}</td>
          <td style="padding:8px;border:1px solid #ddd;">${item.itemName}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;">${item.quantity}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;">$${Number(item.price || 0).toFixed(2)}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;">$${Number(item.subtotal || 0).toFixed(2)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#222;line-height:1.5;">
      <h2>New HBA Order Request</h2>
      <p>A new order request was submitted from the HBA ordering site.</p>

      <h3>Contact Information</h3>
      <table style="border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Name</td><td>${customer.name}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Company</td><td>${customer.companyName}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Address 1</td><td>${customer.addressLine1}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Address 2</td><td>${customer.addressLine2 || ""}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">City</td><td>${customer.city}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">State</td><td>${customer.state || ""}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Zip</td><td>${customer.zipCode || ""}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Country</td><td>${customer.country}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Phone</td><td>${customer.phone}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email</td><td>${customer.email}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Sales Person</td><td>${customer.salesPerson}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Notes</td><td>${customer.notes || ""}</td></tr>
      </table>

      <h3>Order Items</h3>
      <table style="border-collapse:collapse;width:100%;border:1px solid #ddd;">
        <thead>
          <tr style="background:#f7f7f7;">
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">SKU</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">UPC</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Brand</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Item</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:right;">Qty</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:right;">Price</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <p style="margin-top:16px;"><strong>Total SKUs:</strong> ${totals.totalSkus}</p>
      <p><strong>Total Units:</strong> ${totals.totalUnits}</p>
      <p><strong>Total Price:</strong> $${Number(totals.totalPrice || 0).toFixed(2)}</p>
    </div>
  `;
};

const buildHbaOrderEmailText = ({ customer, items, totals }) => {
  return [
    "New HBA Order Request",
    "",
    "Contact Information",
    `Name: ${customer.name}`,
    `Company: ${customer.companyName}`,
    `Address 1: ${customer.addressLine1}`,
    `Address 2: ${customer.addressLine2 || ""}`,
    `City: ${customer.city}`,
    `State: ${customer.state || ""}`,
    `Zip: ${customer.zipCode || ""}`,
    `Country: ${customer.country}`,
    `Phone: ${customer.phone}`,
    `Email: ${customer.email}`,
    `Sales Person: ${customer.salesPerson}`,
    `Notes: ${customer.notes || ""}`,
    "",
    "Order Items",
    ...items.map(
      (item) =>
        `${item.sku} | ${item.upc || ""} | ${item.brand || ""} | ${item.itemName} | Qty ${item.quantity} | $${Number(item.price || 0).toFixed(2)} | $${Number(item.subtotal || 0).toFixed(2)}`
    ),
    "",
    `Total SKUs: ${totals.totalSkus}`,
    `Total Units: ${totals.totalUnits}`,
    `Total Price: $${Number(totals.totalPrice || 0).toFixed(2)}`,
  ].join("\n");
};

router.get("/", auth, checkPermission('products', 'view'), async (req, res) => {
  const db = require("../models");
  const listOfProducts = await db.Products.findAll({
    include: [{
      model: db.ProductDetails,
      required: false,
      attributes: ['tester']
    }]
  });
  res.json(listOfProducts);
});

router.get("/hba/public-catalog", async (req, res) => {
  try {
    const rows = await Products.findAll({
      attributes: [
        "sku",
        "brand",
        "itemName",
        "image",
        "upc",
        "quantity",
        "hbaQuantity",
        "hbaPrice",
      ],
      where: {
        hbaEnabled: true,
      },
      order: [["brand", "ASC"], ["itemName", "ASC"], ["sku", "ASC"]],
    });

    return res.json(
      rows.map((row) => ({
        sku: row.sku,
        brand: row.brand,
        itemName: row.itemName,
        image: row.image || "",
        upc: row.upc,
        inventoryQuantity: row.quantity,
        hbaQuantity: row.hbaQuantity,
        hbaPrice: row.hbaPrice,
        inStock: Number(row.hbaQuantity || 0) > 0,
      }))
    );
  } catch (error) {
    console.error("Error loading public HBA catalog:", error);
    return res.status(500).json({ error: "Failed to load public HBA catalog" });
  }
});

router.get("/hba/site-config", async (req, res) => {
  return res.json({
    salesPeople: getHbaSalesPeople(),
  });
});

router.post("/hba/submit-order", async (req, res) => {
  try {
    const EmailService = require("../Services/EmailService");
    const clientIp = getClientIp(req);
    const rateLimitState = checkHbaOrderRateLimit(clientIp);

    if (rateLimitState.limited) {
      res.set("Retry-After", String(rateLimitState.retryAfterSeconds));
      return res.status(429).json({
        error: "Too many order submissions. Please wait a few minutes and try again.",
      });
    }

    const recipientListRaw =
      process.env.HBA_ORDER_NOTIFICATION_EMAIL ||
      process.env.HBA_ORDER_NOTIFICATION_EMAILS ||
      process.env.ALERT_EMAIL ||
      process.env.SMTP_USER;

    const recipients = String(recipientListRaw || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      return res.status(500).json({ error: "HBA order notification email is not configured." });
    }

    const customer = req.body?.customer || {};
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (items.length === 0) {
      return res.status(400).json({ error: "Cart is empty." });
    }

    const requiredFields = [
      "name",
      "companyName",
      "addressLine1",
      "city",
      "country",
      "phone",
      "email",
      "salesPerson",
    ];

    for (const field of requiredFields) {
      if (!String(customer[field] || "").trim()) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    const normalizedItems = items
      .map((item) => {
        const quantity = Math.max(0, Math.floor(Number(item.quantity || 0)));
        const price = Number(item.price || 0);
        return {
          sku: String(item.sku || "").trim(),
          upc: item.upc || "",
          brand: item.brand || "",
          itemName: item.itemName || "",
          quantity,
          price,
          subtotal: quantity * price,
        };
      })
      .filter((item) => item.sku && item.quantity > 0);

    if (normalizedItems.length === 0) {
      return res.status(400).json({ error: "Cart is empty." });
    }

    const totals = normalizedItems.reduce(
      (summary, item) => {
        summary.totalSkus += 1;
        summary.totalUnits += item.quantity;
        summary.totalPrice += item.subtotal;
        return summary;
      },
      { totalSkus: 0, totalUnits: 0, totalPrice: 0 }
    );

    const orderNumber = generateHbaOrderNumber();
    const userAgent = String(req.headers["user-agent"] || "");

    const orderRecord = await sequelize.transaction(async (transaction) => {
      const createdOrder = await HbaOrder.create(
        {
          orderNumber,
          customerName: customer.name,
          companyName: customer.companyName,
          addressLine1: customer.addressLine1,
          addressLine2: customer.addressLine2 || "",
          city: customer.city,
          state: customer.state || "",
          zipCode: customer.zipCode || "",
          country: customer.country,
          phone: customer.phone,
          email: customer.email,
          salesPerson: customer.salesPerson,
          notes: customer.notes || "",
          totalSkus: totals.totalSkus,
          totalUnits: totals.totalUnits,
          totalPrice: totals.totalPrice.toFixed(2),
          submittedIp: clientIp,
          userAgent,
          notificationStatus: "pending",
          notificationRecipients: recipients.join(", "),
        },
        { transaction }
      );

      await HbaOrderItem.bulkCreate(
        normalizedItems.map((item) => ({
          orderId: createdOrder.id,
          sku: item.sku,
          upc: item.upc,
          brand: item.brand,
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.price.toFixed(2),
          subtotal: item.subtotal.toFixed(2),
        })),
        { transaction }
      );

      return createdOrder;
    });

    const html = buildHbaOrderEmailHtml({ customer, items: normalizedItems, totals });
    const text = buildHbaOrderEmailText({ customer, items: normalizedItems, totals });
    const success = await EmailService.sendEmail({
      to: recipients,
      subject: `HBA Order Request ${orderNumber} - ${customer.companyName} - ${customer.name}`,
      html,
      text,
    });

    if (!success) {
      await orderRecord.update({
        notificationStatus: "failed",
        notificationError: "Failed to send order email.",
      });
      return res.status(500).json({ error: "Failed to send order email." });
    }

    await orderRecord.update({
      notificationStatus: "sent",
      notificationSentAt: new Date(),
      notificationError: null,
    });

    return res.json({ success: true, orderNumber });
  } catch (error) {
    console.error("Error submitting HBA order:", error);
    return res.status(500).json({ error: "Failed to submit HBA order." });
  }
});

router.get("/list", auth, checkPermission('products', 'view'), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const requestedSortKey = String(req.query.sortKey || "sku").trim();
    const sortKey = LIST_SORT_KEYS.has(requestedSortKey) ? requestedSortKey : "sku";
    const sortDirection = String(req.query.sortDirection || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";

    const filters = {
      upc: req.query.upc,
      sku: req.query.sku,
      brand: req.query.brand,
      itemName: req.query.itemName,
      sizeOz: req.query.sizeOz,
      strength: req.query.strength,
      shade: req.query.shade,
      location: req.query.location,
    };

    const whereClauses = [
      buildContainsFilter("sku", filters.sku),
      buildContainsFilter("brand", filters.brand),
      buildContainsFilter("itemName", filters.itemName),
      buildContainsFilter("strength", filters.strength),
      buildContainsFilter("shade", filters.shade),
      buildContainsFilter("location", filters.location),
      buildContainsFilter("upc", filters.upc, { castToChar: true }),
      buildContainsFilter("sizeOz", filters.sizeOz, { castToChar: true }),
    ].filter(Boolean);

    const where = whereClauses.length ? { [Op.and]: whereClauses } : {};
    const offset = (page - 1) * pageSize;

    const { count, rows } = await Products.findAndCountAll({
      attributes: [
        "sku",
        "brand",
        "itemName",
        "sizeOz",
        "sizeMl",
        "strength",
        "shade",
        "location",
        "quantity",
        "image",
        "verified",
        "upc",
      ],
      where,
      include: [
        {
          model: ProductDetails,
          required: false,
          attributes: ["tester", "discontinued"],
        },
      ],
      order: [[sortKey, sortDirection]],
      limit: pageSize,
      offset,
      distinct: true,
      subQuery: false,
    });

    return res.json({
      rows,
      total: count,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Error loading paginated products list:", error);
    return res.status(500).json({ error: "Failed to load products list" });
  }
});

router.get("/hba/catalog", auth, checkPermission('products', 'view'), async (req, res) => {
  try {
    const rows = await Products.findAll({
      attributes: [
        "sku",
        "brand",
        "itemName",
        "image",
        "quantity",
        "hbaQuantity",
        "hbaPrice",
      ],
      where: {
        hbaEnabled: true,
      },
      order: [["brand", "ASC"], ["itemName", "ASC"], ["sku", "ASC"]],
    });

    return res.json(rows);
  } catch (error) {
    console.error("Error loading HBA catalog:", error);
    return res.status(500).json({ error: "Failed to load HBA catalog" });
  }
});

router.get("/byId/:id", auth, checkPermission('products', 'view'), async (req, res) => {
  const id = req.params.id;
  const product = await Products.findByPk(id);
  res.json(product);
});

router.get("/search", auth, checkPermission('products', 'view'), async (req, res) => {
  const { searchString, searchType } = req.query;
  // console.log(searchType);
  const searchResults = await Products.findAll({
    where: {
      [searchType]: {
        [Op.like]: "%" + searchString + "%",
      },
    },
  });
  res.json(searchResults);
});

router.post("/", auth, checkPermission('products', 'create'), async (req, res) => {
  const product = req.body;
  try {
    // Ensure trackQuantity and minimumQuantity are set properly
    const productData = {
      ...product,
      trackQuantity: product.trackQuantity || false,
      minimumQuantity: product.minimumQuantity || null,
      lowStockAlertSent: false,
      hbaEnabled: Boolean(product.hbaEnabled),
      hbaQuantity: normalizeNullableInteger(product.hbaQuantity),
      hbaPrice: normalizeNullableDecimal(product.hbaPrice),
    };
    
    const [found, created] = await Products.findOrCreate({
      where: { sku: product.sku },
      defaults: productData,
    });

    if (created) {
      // Log the product creation
      try {
        await Logs.create({
          type: "Product",
          action: "create",
          entityType: "product",
          entityId: product.sku,
          userId: req.user.id.toString(),
          changes: [{
            sku: product.sku,
            changes: []
          }],
          newState: product,
          metaData: {
            message: "New product created"
          }
        });
      } catch (logError) {
        console.error("Failed to create product log:", logError);
      }
      res.json("Created New");
    } else {
      res.json("Already Exists");
    }
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.put("/", auth, checkPermission('products', 'edit'), async (req, res) => {
  const product = req.body;
  // console.log("Edited Product Value in Server : ", product);

  const normalizeMinimumQuantity = (value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };
  
  try {
    // Get the current product state
    const currentProduct = await Products.findOne({ where: { sku: product.sku } });
    
    if (!currentProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Store the previous state
    const previousState = currentProduct.toJSON();

    // Update the product
    await Products.update(
      {
        brand: product.brand,
        itemName: product.itemName,
        location: product.location,
        sizeOz: product.sizeOz,
        sizeMl: product.sizeMl,
        strength: product.strength,
        shade: product.shade,
        formulation: product.formulation,
        category: product.category,
        type: product.type,
        upc: product.upc,
        warehouseLocations: product.warehouseLocations,
        batch: product.batch,
        condition: product.condition,
        verified: product.verified,
        listed: product.listed,
        final: product.final,
        image: product.image,
        alternativeSku: product.alternativeSku,
        trackQuantity: product.trackQuantity !== undefined ? product.trackQuantity : currentProduct.trackQuantity,
        minimumQuantity:
          product.minimumQuantity !== undefined
            ? normalizeMinimumQuantity(product.minimumQuantity)
            : currentProduct.minimumQuantity,
        hbaEnabled:
          product.hbaEnabled !== undefined
            ? Boolean(product.hbaEnabled)
            : currentProduct.hbaEnabled,
        hbaQuantity:
          product.hbaQuantity !== undefined
            ? normalizeNullableInteger(product.hbaQuantity)
            : currentProduct.hbaQuantity,
        hbaPrice:
          product.hbaPrice !== undefined
            ? normalizeNullableDecimal(product.hbaPrice)
            : currentProduct.hbaPrice,
      },
      { where: { sku: product.sku } }
    );

    // Get the updated quantity (use new quantity if provided, otherwise keep current)
    const updatedQuantity = product.quantity !== undefined ? product.quantity : currentProduct.quantity;

    // If a quantity is being updated, use the StockUpdateService
    if (currentProduct.quantity !== product.quantity || product.verified !== currentProduct.verified) {
      await StockUpdateService.updateProductQuantity(
          product.sku,
          updatedQuantity
      );
    }

    // If trackQuantity or minimumQuantity changed, handle tracking status
    // This handles: tracking turned on/off, minimum quantity changed
    if (currentProduct.trackQuantity !== product.trackQuantity || 
        currentProduct.minimumQuantity !== product.minimumQuantity) {
      const LowStockAlertService = require("../Services/LowStockAlertService");
      
      // If tracking was just turned ON (from OFF), reset the alert flag first
      // This ensures we can send an alert if stock is currently low
      if (!currentProduct.trackQuantity && product.trackQuantity) {
        await Products.update(
          { lowStockAlertSent: false },
          { where: { sku: product.sku } }
        );
        
        // Check if stock is currently low and send alert if needed
        const lowStockCheck = await LowStockAlertService.checkAndHandleLowStock(product.sku, updatedQuantity);
        
        // Send email if needed
        if (lowStockCheck.shouldAlert) {
          const EmailService = require("../Services/EmailService");
          const recipientEmail = process.env.LOW_STOCK_ALERT_EMAIL || process.env.ALERT_EMAIL;
          if (recipientEmail) {
            EmailService.sendLowStockAlert(lowStockCheck.product, recipientEmail).catch(err => {
              console.error('Failed to send low stock alert email:', err);
            });
          }
        }
      } 
      // If tracking was turned OFF, the checkAndHandleLowStock will reset the flag
      // But we should also check if tracking is still ON and quantity/minimum changed
      else if (product.trackQuantity) {
        // Tracking is still ON, check low stock status with current quantity
        const lowStockCheck = await LowStockAlertService.checkAndHandleLowStock(product.sku, updatedQuantity);
        
        // Send email if needed
        if (lowStockCheck.shouldAlert) {
          const EmailService = require("../Services/EmailService");
          const recipientEmail = process.env.LOW_STOCK_ALERT_EMAIL || process.env.ALERT_EMAIL;
          if (recipientEmail) {
            EmailService.sendLowStockAlert(lowStockCheck.product, recipientEmail).catch(err => {
              console.error('Failed to send low stock alert email:', err);
            });
          }
        }
      }
      // If tracking was turned OFF, checkAndHandleLowStock will handle resetting the flag
      // No need to do anything else here
    }

    // Get the updated product data
    const updatedProduct = await Products.findOne({ where: { sku: product.sku } });
    
    // Calculate changes
    const changes = [];
    Object.keys(product).forEach(key => {
      if (JSON.stringify(previousState[key]) !== JSON.stringify(product[key])) {
        changes.push({
          field: key,
          oldValue: previousState[key],
          newValue: product[key]
        });
      }
    });

    // Log the product update
    try {
      await Logs.create({
        type: "Product",
        action: "update",
        entityType: "product",
        entityId: product.sku,
        userId: req.user.id.toString(),
        changes: [{
          sku: product.sku,
          changes: changes
        }],
        previousState: previousState,
        newState: updatedProduct.toJSON(),
        metaData: {
          message: "Product updated",
          quantityChanged: currentProduct.quantity !== product.quantity,
          verificationChanged: currentProduct.verified !== product.verified
        }
      });
    } catch (logError) {
      console.error("Failed to create product update log:", logError);
    }

    res.json(updatedProduct);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/delete/:id", auth, checkPermission('products', 'delete'), async (req, res) => {
  try {
    const id = req.params.id;

    const currentProduct = await Products.findOne({ where: { sku: id } });
    if (!currentProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    const status = await Products.destroy({
      where: {
        sku: id,
      },
    });

    try {
      await Logs.create({
        type: "Product",
        action: "delete",
        entityType: "product",
        entityId: currentProduct.sku,
        userId: req.user.id.toString(),
        changes: [],
        previousState: currentProduct.toJSON(),
        newState: [],
        metaData: {
          message: "Product has been deleted",
        }
      });
    } catch (logError) {
      console.error("Failed to create product delete log:", logError);
    }

    res.json(status);
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

router.get("/findAndCount/:skuPrefix", auth, checkPermission('products', 'view'), async (req, res) => {
  // console.log("Here inside find and count all in backend");
  const skuPrefix = req.params.skuPrefix;
  const { count, rows } = await Products.findAndCountAll({
    where: {
      sku: {
        [Op.like]: skuPrefix + "-" + "%",
      },
    },
    // offset: 10,
    // limit: 2,
  });
  //   console.log(count);
  res.json(count + 1);
});

router.post("/updateQuantities", auth, checkPermission('products', 'edit'), async (req, res) => {
  const skusToUpdate = req.body;

  try {
    const skipped = [];
    const updates = await Promise.all(skusToUpdate.map(async (skuUpdate) => {
      let product = await Products.findOne({ where: { sku: skuUpdate.sku } });

      if (!product) {
        product = await Products.findOne({ where: { alternativeSku: skuUpdate.sku } });
        if (product) {
          return {
            sku: product.sku,
            newQuantity: product.quantity - skuUpdate.quantitySold,
            originalRequestedSku: skuUpdate.sku
          };
        }
      }
      
      if (!product) {
        skipped.push(skuUpdate.sku);
        return null; // skip this one
      }
      
      return {
        sku: skuUpdate.sku,
        newQuantity: product.quantity - skuUpdate.quantitySold
      };
    }));

    // Filter out nulls (skipped)
    const validUpdates = updates.filter(Boolean);
    const result = await StockUpdateService.updateMultipleProductQuantities(validUpdates);

    res.json({
      success: true,
      message: "Quantities updated successfully",
      result,
      skipped,
    });
  } catch (error) {
    console.error("Error updating quantities:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get low stock products (admin only)
router.get("/low-stock", auth, checkPermission('lowStock', 'view'), async (req, res) => {
  try {
    const LowStockAlertService = require("../Services/LowStockAlertService");
    const lowStockProducts = await LowStockAlertService.getLowStockProducts();
    res.json(lowStockProducts);
  } catch (error) {
    console.error("Error getting low stock products:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Test email configuration (admin only)
router.post("/test-email", auth, checkPermission('lowStock', 'view'), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const EmailService = require("../Services/EmailService");
    const success = await EmailService.sendTestEmail(email);
    
    if (success) {
      res.json({ success: true, message: 'Test email sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send test email. Check server logs for details.' });
    }
  } catch (error) {
    console.error("Error sending test email:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const { Products, ProductDetails, ProductHistory, StockUpdateHistory, Logs, HbaOrder, HbaOrderItem, SkuSalesSummary, Settings, sequelize, FragranceNote, ProductFragranceNote } = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const StockUpdateService = require("../Services/StockUpdateService");
const PermissionService = require("../Services/PermissionService");
const PricingService = require("../Services/PricingService");
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

const NUMERIC_SORT_KEYS = new Set(["quantity", "sizeOz", "upc"]);

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

const normalizePositiveInteger = (value, fallback = 1) => {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.floor(parsed));
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

const normalizeHbaCondition = (value) => {
  const normalized = String(value || "").trim();
  const allowed = new Set(["Unboxed", "Sealed", "Damaged", "Old Batch"]);
  return allowed.has(normalized) ? normalized : null;
};

const HBA_ORDER_RATE_LIMIT_WINDOW_MS =
  Math.max(1, Number(process.env.HBA_ORDER_RATE_LIMIT_WINDOW_MINUTES || 15)) * 60 * 1000;
const HBA_ORDER_RATE_LIMIT_MAX_REQUESTS = Math.max(
  1,
  Number(process.env.HBA_ORDER_RATE_LIMIT_MAX_REQUESTS || 5)
);
const HBA_MINIMUM_ORDER_TOTAL = 500;
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

const isHbaCustomerConfirmationEnabled = () => {
  return String(process.env.HBA_CUSTOMER_CONFIRMATION_EMAIL_ENABLED || "")
    .trim()
    .toLowerCase() === "true";
};

const generateHbaOrderNumber = () => {
  const now = new Date();
  const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const randomSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `HBA-${yyyymmdd}-${randomSuffix}`;
};

const escapeHtml = (value) => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const buildHbaOrderEmailHtml = ({ customer, items, totals }) => {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.sku)}</td>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.upc || "")}</td>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.brand || "")}</td>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.itemName)}</td>
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
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Name</td><td>${escapeHtml(customer.name)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Company</td><td>${escapeHtml(customer.companyName)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Address 1</td><td>${escapeHtml(customer.addressLine1)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Address 2</td><td>${escapeHtml(customer.addressLine2 || "")}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">City</td><td>${escapeHtml(customer.city)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">State</td><td>${escapeHtml(customer.state || "")}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Zip</td><td>${escapeHtml(customer.zipCode || "")}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Country</td><td>${escapeHtml(customer.country)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Phone</td><td>${escapeHtml(customer.phone)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email</td><td>${escapeHtml(customer.email)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Sales Person</td><td>${escapeHtml(customer.salesPerson)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Notes</td><td>${escapeHtml(customer.notes || "")}</td></tr>
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

const buildHbaCustomerConfirmationHtml = ({ customer, items, totals, orderNumber }) => {
  const supportEmail = "support@hbadeals.com";
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.sku)}</td>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.upc || "")}</td>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.brand || "")}</td>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.itemName)}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;">${item.quantity}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;">$${Number(item.price || 0).toFixed(2)}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;">$${Number(item.subtotal || 0).toFixed(2)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#222;line-height:1.5;">
      <h2>We received your HBA order request</h2>
      <p>Thank you for your order request. Our team will review it and follow up with invoice and payment details.</p>
      <p><strong>Reference:</strong> ${escapeHtml(orderNumber)}</p>

      <h3>Order Summary</h3>
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
      <p><strong>Total Amount:</strong> $${Number(totals.totalPrice || 0).toFixed(2)}</p>

      <h3>Contact</h3>
      <p><strong>Name:</strong> ${escapeHtml(customer.name)}</p>
      <p><strong>Company:</strong> ${escapeHtml(customer.companyName)}</p>
      <p>If you have questions, reply to this email or contact <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
    </div>
  `;
};

const buildHbaCustomerConfirmationText = ({ customer, items, totals, orderNumber }) => {
  return [
    "We received your HBA order request",
    "",
    "Thank you for your order request. Our team will review it and follow up with invoice and payment details.",
    `Reference: ${orderNumber}`,
    "",
    "Order Summary",
    ...items.map(
      (item) =>
        `${item.sku} | ${item.upc || ""} | ${item.brand || ""} | ${item.itemName} | Qty ${item.quantity} | $${Number(item.price || 0).toFixed(2)} | $${Number(item.subtotal || 0).toFixed(2)}`
    ),
    "",
    `Total SKUs: ${totals.totalSkus}`,
    `Total Units: ${totals.totalUnits}`,
    `Total Amount: $${Number(totals.totalPrice || 0).toFixed(2)}`,
    "",
    `Name: ${customer.name}`,
    `Company: ${customer.companyName}`,
    "",
    "Questions? Reply to this email or contact support@hbadeals.com.",
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
        "category",
        "sizeOz",
        "sizeMl",
        "strength",
        "shade",
        "condition",
        "hbaCondition",
        "hbaNewArrival",
        "image",
        "upc",
        "quantity",
        "hbaQuantity",
        "hbaPrice",
        "hbaMoq",
        "hbaStepCount",
      ],
      include: [
        {
          model: ProductDetails,
          required: false,
          attributes: ["tester", "discontinued", "sizeType"],
        },
      ],
      where: {
        hbaEnabled: true,
      },
      order: [["brand", "ASC"], ["itemName", "ASC"], ["sku", "ASC"]],
    });

    return res.json(
      rows.map((row) => {
        const details =
          row.ProductDetails ||
          row.ProductDetail ||
          (typeof row.get === "function" ? row.get("ProductDetails") || row.get("ProductDetail") : null) ||
          null;
        const sizeType = String(
          details?.sizeType ??
            details?.dataValues?.sizeType ??
            ""
        ).trim();

        const hbaMoq = normalizePositiveInteger(row.hbaMoq);
        const hbaStepCount = normalizePositiveInteger(row.hbaStepCount);

        return {
          sku: row.sku,
          brand: row.brand,
          itemName: row.itemName,
          category: row.category || "",
          sizeOz: row.sizeOz,
          sizeMl: row.sizeMl,
          strength: row.strength,
          shade: row.shade,
          condition: row.condition,
          hbaCondition: row.hbaCondition,
          hbaNewArrival: Boolean(row.hbaNewArrival),
          sizeType,
          tester: Boolean(details?.tester),
          discontinued: Boolean(details?.discontinued),
          image: row.image || "",
          upc: row.upc,
          inventoryQuantity: row.quantity,
          hbaQuantity: row.hbaQuantity,
          hbaPrice: row.hbaPrice,
          hbaMoq,
          hbaStepCount,
          inStock: Number(row.hbaQuantity || 0) >= hbaMoq,
        };
      })
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

    const allowedSalesPeople = new Set(getHbaSalesPeople());
    if (!allowedSalesPeople.has(String(customer.salesPerson || "").trim())) {
      return res.status(400).json({ error: "Selected sales person is invalid." });
    }

    const requestedItems = items
      .map((item) => ({
        sku: String(item?.sku || "").trim(),
        quantity: Math.max(0, Math.floor(Number(item?.quantity || 0))),
      }))
      .filter((item) => item.sku && item.quantity > 0);

    if (requestedItems.length === 0) {
      return res.status(400).json({ error: "Cart is empty." });
    }

    const requestedSkuMap = requestedItems.reduce((map, item) => {
      map.set(item.sku, (map.get(item.sku) || 0) + item.quantity);
      return map;
    }, new Map());

    const submittedSkus = [...requestedSkuMap.keys()];
    const products = await Products.findAll({
      attributes: ["sku", "upc", "brand", "itemName", "hbaEnabled", "hbaQuantity", "hbaPrice", "hbaMoq", "hbaStepCount"],
      where: {
        sku: {
          [Op.in]: submittedSkus,
        },
      },
    });

    if (products.length !== submittedSkus.length) {
      const foundSkuSet = new Set(products.map((product) => product.sku));
      const missingSkus = submittedSkus.filter((sku) => !foundSkuSet.has(sku));
      return res.status(400).json({
        error: `Some submitted SKUs are invalid: ${missingSkus.join(", ")}`,
      });
    }

    const normalizedItems = [];
    for (const product of products) {
      if (!product.hbaEnabled) {
        return res.status(400).json({ error: `SKU ${product.sku} is not available for HBA ordering.` });
      }

      const allowedQuantity = Math.max(0, Math.floor(Number(product.hbaQuantity || 0)));
      const requestedQuantity = requestedSkuMap.get(product.sku) || 0;
      const hbaMoq = normalizePositiveInteger(product.hbaMoq);
      const hbaStepCount = normalizePositiveInteger(product.hbaStepCount);

      if (requestedQuantity < 1) {
        continue;
      }

      if (allowedQuantity < 1) {
        return res.status(400).json({ error: `SKU ${product.sku} is currently sold out.` });
      }

      if (requestedQuantity < hbaMoq) {
        return res.status(400).json({
          error: `Minimum order quantity for SKU ${product.sku} is ${hbaMoq}.`,
        });
      }

      if ((requestedQuantity - hbaMoq) % hbaStepCount !== 0) {
        return res.status(400).json({
          error: `SKU ${product.sku} must be ordered in increments of ${hbaStepCount} from the MOQ.`,
        });
      }

      if (requestedQuantity > allowedQuantity) {
        return res.status(400).json({
          error: `Requested quantity for SKU ${product.sku} exceeds available HBA quantity.`,
        });
      }

      const price = Number(product.hbaPrice || 0);
      normalizedItems.push({
        sku: product.sku,
        upc: product.upc || "",
        brand: product.brand || "",
        itemName: product.itemName || "",
        quantity: requestedQuantity,
        price,
        subtotal: requestedQuantity * price,
      });
    }

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

    if (totals.totalPrice < HBA_MINIMUM_ORDER_TOTAL) {
      return res.status(400).json({
        error: `Minimum order amount is $${HBA_MINIMUM_ORDER_TOTAL}.`,
      });
    }

    const orderNumber = generateHbaOrderNumber();
    const userAgent = String(req.headers["user-agent"] || "");
    const customerConfirmationEnabled = isHbaCustomerConfirmationEnabled();

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
          customerNotificationStatus: customerConfirmationEnabled ? "pending" : "skipped",
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
    const success = await EmailService.sendHbaEmail({
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

    if (customerConfirmationEnabled) {
      const customerHtml = buildHbaCustomerConfirmationHtml({
        customer,
        items: normalizedItems,
        totals,
        orderNumber,
      });
      const customerText = buildHbaCustomerConfirmationText({
        customer,
        items: normalizedItems,
        totals,
        orderNumber,
      });

      const customerEmailSent = await EmailService.sendHbaEmail({
        to: customer.email,
        subject: `HBA Order Request Received - ${orderNumber}`,
        html: customerHtml,
        text: customerText,
        replyTo: "support@hbadeals.com",
      });

      if (customerEmailSent) {
        await orderRecord.update({
          customerNotificationStatus: "sent",
          customerNotificationSentAt: new Date(),
          customerNotificationError: null,
        });
      } else {
        await orderRecord.update({
          customerNotificationStatus: "failed",
          customerNotificationError: "Failed to send customer confirmation email.",
        });
      }
    }

    return res.json({ success: true, orderNumber });
  } catch (error) {
    console.error("Error submitting HBA order:", error);
    if (error?.original) {
      console.error("Original database error:", {
        name: error.original.name,
        message: error.original.message,
        code: error.original.code,
        errno: error.original.errno,
        sqlMessage: error.original.sqlMessage,
      });
    }

    const details =
      process.env.NODE_ENV === "development"
        ? error?.message || "Failed to submit HBA order."
        : undefined;

    return res.status(500).json({
      error: "Failed to submit HBA order.",
      ...(details ? { details } : {}),
    });
  }
});

// GET distinct brands and categories (used by admin to configure data entry scope)
router.get('/filter-options', auth, async (req, res) => {
  try {
    const [brands, categories] = await Promise.all([
      Products.findAll({ attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand')), 'brand']], where: { brand: { [Op.not]: null } }, order: [['brand', 'ASC']], raw: true }),
      Products.findAll({ attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('category')), 'category']], where: { category: { [Op.not]: null } }, order: [['category', 'ASC']], raw: true }),
    ]);
    res.json({
      brands: brands.map(r => r.brand).filter(Boolean),
      categories: categories.map(r => r.category).filter(Boolean),
    });
  } catch (err) {
    console.error('Error fetching filter options:', err);
    res.status(500).json({ error: 'Failed to fetch filter options' });
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
      categories: req.query.categories, // comma-separated list; absent = no filter (show all)
      types: req.query.types,           // comma-separated: Sealed|Unsealed|Unboxed|Tester
      brands: req.query.brands,         // comma-separated exact brand names; absent = no filter
    };

    // Parse category filter:
    //   absent        → no filter (show all)
    //   "__none__"    → impossible filter (show nothing — user deselected all)
    //   "A,B,C"       → show only those categories
    const categoryFilter = filters.categories === "__none__"
      ? ["__none__"]
      : filters.categories
        ? filters.categories.split(",").map((c) => c.trim()).filter(Boolean)
        : null;

    // Parse type/condition filter:
    //   absent        → no filter (show all)
    //   "__none__"    → show nothing
    //   "Sealed,Tester,..."  → condition values + optional Tester flag
    let typeWhereClause = null;
    if (filters.types === "__none__") {
      typeWhereClause = Sequelize.literal("1 = 0"); // matches nothing
    } else if (filters.types) {
      const typeValues = filters.types.split(",").map((t) => t.trim()).filter(Boolean);
      const conditionValues = typeValues.filter((t) => t !== "Tester");
      const includeTester = typeValues.includes("Tester");
      const orParts = [];
      if (conditionValues.length > 0) {
        orParts.push({ condition: { [Op.in]: conditionValues } });
      }
      if (includeTester) {
        // Tester lives on ProductDetails — use a subquery to avoid JOIN complexity
        orParts.push(
          Sequelize.literal("`Products`.`sku` IN (SELECT `sku` FROM `ProductDetails` WHERE `tester` = 1)")
        );
      }
      if (orParts.length > 0) {
        typeWhereClause = orParts.length === 1 ? orParts[0] : { [Op.or]: orParts };
      }
    }

    const whereClauses = [
      buildContainsFilter("sku", filters.sku),
      buildContainsFilter("brand", filters.brand),
      buildContainsFilter("itemName", filters.itemName),
      buildContainsFilter("strength", filters.strength),
      buildContainsFilter("shade", filters.shade),
      buildContainsFilter("location", filters.location),
      buildContainsFilter("upc", filters.upc, { castToChar: true }),
      buildContainsFilter("sizeOz", filters.sizeOz, { castToChar: true }),
      categoryFilter && categoryFilter.length > 0
        ? { category: { [Op.in]: categoryFilter } }
        : null,
      filters.brands
        ? { brand: { [Op.in]: filters.brands.split(',').map(b => b.trim()).filter(Boolean) } }
        : null,
      typeWhereClause,
      // Server-enforced data entry scope — always applied regardless of frontend params
      req.user.data_entry_brands?.length > 0
        ? { brand: { [Op.in]: req.user.data_entry_brands } }
        : null,
      req.user.data_entry_categories?.length > 0
        ? { category: { [Op.in]: req.user.data_entry_categories } }
        : null,
    ].filter(Boolean);

    const where = whereClauses.length ? { [Op.and]: whereClauses } : {};
    const offset = (page - 1) * pageSize;
    const order =
      NUMERIC_SORT_KEYS.has(sortKey)
        ? [[Sequelize.cast(Sequelize.col(`Products.${sortKey}`), "SIGNED"), sortDirection]]
        : [[sortKey, sortDirection]];

    const { count, rows } = await Products.findAndCountAll({
      attributes: [
        "sku",
        "brand",
        "itemName",
        "category",
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
      order,
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

router.get("/price-scanner/:barcode", auth, checkPermission('priceScanner', 'view'), async (req, res) => {
  try {
    const barcode = String(req.params.barcode || "").trim();
    if (!barcode) {
      return res.status(400).json({ error: "Barcode is required" });
    }

    const exactMatches = [
      { sku: barcode },
      { alternativeSku: barcode },
      Sequelize.where(Sequelize.cast(Sequelize.col("Products.upc"), "CHAR"), barcode),
    ];
    const numericBarcode = Number(barcode);
    if (Number.isFinite(numericBarcode)) {
      exactMatches.push({ upc: numericBarcode });
    }

    const products = await Products.findAll({
      attributes: [
        "sku",
        "alternativeSku",
        "brand",
        "itemName",
        "quantity",
        "location",
        "sizeOz",
        "sizeMl",
        "strength",
        "shade",
        "category",
        "condition",
        "upc",
        "image",
        "retailPrice",
      ],
      include: [
        {
          model: ProductDetails,
          required: false,
          attributes: ["tester", "discontinued", "sizeType", "dupeOf"],
        },
      ],
      where: {
        [Op.or]: exactMatches,
      },
      order: [["brand", "ASC"], ["itemName", "ASC"], ["sku", "ASC"]],
    });

    const seen = new Set();
    const results = products
      .filter((product) => {
        if (seen.has(product.sku)) return false;
        seen.add(product.sku);
        return true;
      })
      .map(async (product) => {
        const averagePrice = await PricingService.getAveragePriceForSku(product.sku);
        const pricing = PricingService.calculateExpectedSellingPrice(averagePrice);
        const details =
          product.ProductDetails ||
          product.ProductDetail ||
          (typeof product.get === "function" ? product.get("ProductDetails") || product.get("ProductDetail") : null) ||
          null;

        return {
          sku: product.sku,
          alternativeSku: product.alternativeSku,
          upc: product.upc,
          brand: product.brand,
          itemName: product.itemName,
          quantity: product.quantity,
          location: product.location,
          sizeOz: product.sizeOz,
          sizeMl: product.sizeMl,
          strength: product.strength,
          shade: product.shade,
          category: product.category,
          condition: product.condition,
          image: product.image,
          expectedPrice: pricing.expectedPrice,
          retailPrice: product.retailPrice != null ? Number(product.retailPrice) : null,
          tester: Boolean(details?.tester),
          discontinued: Boolean(details?.discontinued),
          sizeType: details?.sizeType || "",
          dupeOf: details?.dupeOf || null,
        };
      });

    const resolvedResults = await Promise.all(results);

    return res.json({
      barcode,
      count: resolvedResults.length,
      matches: resolvedResults,
    });
  } catch (error) {
    console.error("Error scanning product price:", error);
    return res.status(500).json({ error: "Failed to scan product price" });
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
      hbaMoq: normalizePositiveInteger(product.hbaMoq),
      hbaStepCount: normalizePositiveInteger(product.hbaStepCount),
      hbaCondition: normalizeHbaCondition(product.hbaCondition),
      hbaNewArrival: Boolean(product.hbaNewArrival),
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

    const requestedHbaEnabled =
      product.hbaEnabled !== undefined
        ? Boolean(product.hbaEnabled)
        : currentProduct.hbaEnabled;
    const requestedHbaQuantity =
      product.hbaQuantity !== undefined
        ? normalizeNullableInteger(product.hbaQuantity)
        : currentProduct.hbaQuantity;
    const requestedHbaPrice =
      product.hbaPrice !== undefined
        ? normalizeNullableDecimal(product.hbaPrice)
        : currentProduct.hbaPrice;
    const requestedHbaMoq =
      product.hbaMoq !== undefined
        ? normalizePositiveInteger(product.hbaMoq)
        : normalizePositiveInteger(currentProduct.hbaMoq);
    const requestedHbaStepCount =
      product.hbaStepCount !== undefined
        ? normalizePositiveInteger(product.hbaStepCount)
        : normalizePositiveInteger(currentProduct.hbaStepCount);
    const requestedHbaCondition =
      product.hbaCondition !== undefined
        ? normalizeHbaCondition(product.hbaCondition)
        : currentProduct.hbaCondition;
    const requestedHbaNewArrival =
      product.hbaNewArrival !== undefined
        ? Boolean(product.hbaNewArrival)
        : currentProduct.hbaNewArrival;

    const requestedHbaChange =
      requestedHbaEnabled !== currentProduct.hbaEnabled ||
      requestedHbaQuantity !== currentProduct.hbaQuantity ||
      requestedHbaPrice !== currentProduct.hbaPrice ||
      requestedHbaMoq !== normalizePositiveInteger(currentProduct.hbaMoq) ||
      requestedHbaStepCount !== normalizePositiveInteger(currentProduct.hbaStepCount) ||
      requestedHbaCondition !== currentProduct.hbaCondition ||
      requestedHbaNewArrival !== currentProduct.hbaNewArrival;

    if (requestedHbaChange) {
      const canEditHbaListing = await PermissionService.hasResourceAction(
        req.user,
        "hbaListing",
        "edit"
      );

      if (!canEditHbaListing) {
        return res.status(403).json({
          error: "Access denied. You do not have permission to edit HBA listing settings.",
        });
      }
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
        retailPrice: product.retailPrice !== undefined && product.retailPrice !== '' ? Number(product.retailPrice) : null,
        trackQuantity: product.trackQuantity !== undefined ? product.trackQuantity : currentProduct.trackQuantity,
        minimumQuantity:
          product.minimumQuantity !== undefined
            ? normalizeMinimumQuantity(product.minimumQuantity)
            : currentProduct.minimumQuantity,
        hbaEnabled: requestedHbaEnabled,
        hbaQuantity: requestedHbaQuantity,
        hbaPrice: requestedHbaPrice,
        hbaMoq: requestedHbaMoq,
        hbaStepCount: requestedHbaStepCount,
        hbaCondition: requestedHbaCondition,
        hbaNewArrival: requestedHbaNewArrival,
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

// ── Sales Summary — last 6 months per platform for a SKU ──────────────────
router.get('/salesSummary/:sku', auth, checkPermission('products', 'view'), async (req, res) => {
  try {
    const { sku } = req.params;
    const now = new Date();

    // Build the 6 most recent year/month pairs
    const periods = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periods.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }

    const rows = await SkuSalesSummary.findAll({
      where: { sku },
      attributes: ['platform', 'year', 'month', 'qty'],
    });

    // Shape into { months: ['Jan','Feb',...], tiktok: [0,5,...], whatnot: [...], ebay: [...] }
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const lookup = {};
    rows.forEach((r) => {
      const key = `${r.platform}_${r.year}_${r.month}`;
      lookup[key] = Number(r.qty) || 0;
    });

    // ── Avg sold price per platform (direct query — fast single-pass per platform)
    // TikTok: exclude bundle scans (one lot price spread across N scan rows).
    // Bundle detection: tsi_count < scan_count means one order line produced N scans.
    const [[tiktokAvgRow]] = await sequelize.query(
      `SELECT AVG(CASE WHEN sc.tsi_count >= sc.scan_count THEN tss.soldPrice END) AS avg
       FROM \`tiktokShipmentScans\` tss
       JOIN (
         SELECT s.tiktokShowId, s.importId, s.shipmentId,
           s.scan_count, COALESCE(i.tsi_count, 1) AS tsi_count
         FROM (
           SELECT tiktokShowId, importId, shipmentId, COUNT(*) AS scan_count
           FROM \`tiktokShipmentScans\`
           WHERE result = 'matched'
             AND productSku IS NOT NULL AND productSku <> ''
             AND previousQuantity IS NOT NULL
             AND newQuantity = previousQuantity - 1
           GROUP BY tiktokShowId, importId, shipmentId
         ) s
         LEFT JOIN (
           SELECT tiktokShowId, importId, shipmentId, COUNT(*) AS tsi_count
           FROM \`tiktokShipmentItems\`
           GROUP BY tiktokShowId, importId, shipmentId
         ) i ON i.tiktokShowId = s.tiktokShowId
            AND i.importId     = s.importId
            AND i.shipmentId   = s.shipmentId
       ) sc ON sc.tiktokShowId = tss.tiktokShowId
           AND sc.importId     = tss.importId
           AND sc.shipmentId   = tss.shipmentId
       WHERE tss.result = 'matched'
         AND tss.productSku = :sku
         AND tss.soldPrice IS NOT NULL
         AND tss.soldPrice > 0
         AND tss.previousQuantity IS NOT NULL
         AND tss.newQuantity = tss.previousQuantity - 1`,
      { replacements: { sku } }
    );

    const [[whatnotAvgRow]] = await sequelize.query(
      `SELECT AVG(wss.soldPrice) AS avg
       FROM \`whatnotShipmentScans\` wss
       WHERE wss.result = 'matched'
         AND wss.productSku = :sku
         AND wss.soldPrice IS NOT NULL
         AND wss.soldPrice > 0
         AND wss.previousQuantity IS NOT NULL
         AND wss.newQuantity = wss.previousQuantity - 1`,
      { replacements: { sku } }
    );

    const [[ebayAvgRow]] = await sequelize.query(
      `SELECT AVG(eo.price) AS avg
       FROM \`EbayOrders\` eo
       WHERE eo.sku = :sku
         AND eo.orderStatus != 'CANCELLED'
         AND eo.price IS NOT NULL
         AND eo.price > 0`,
      { replacements: { sku } }
    );

    const toAvg = (row) => row?.avg != null ? Number(Number(row.avg).toFixed(2)) : null;

    const result = {
      months:   periods.map((p) => monthNames[p.month - 1]),
      tiktok:   periods.map((p) => lookup[`tiktok_${p.year}_${p.month}`]   || 0),
      whatnot:  periods.map((p) => lookup[`whatnot_${p.year}_${p.month}`]  || 0),
      ebay:     periods.map((p) => lookup[`ebay_${p.year}_${p.month}`]     || 0),
      walmart:  periods.map((p) => lookup[`walmart_${p.year}_${p.month}`]  || 0),
      avgPrice: {
        tiktok:  toAvg(tiktokAvgRow),
        whatnot: toAvg(whatnotAvgRow),
        ebay:    toAvg(ebayAvgRow),
      },
    };

    res.json(result);
  } catch (err) {
    console.error('Error fetching sales summary:', err);
    res.status(500).json({ error: 'Failed to fetch sales summary' });
  }
});

// ── Data Entry Config (admin only) ───────────────────────────────────────────

const DATA_ENTRY_ELIGIBLE_FIELDS = [
  'image', 'brand', 'itemName', 'alternativeSku', 'upc',
  'location', 'sizeOz', 'sizeMl', 'strength', 'shade',
  'category', 'type', 'formulation', 'batch', 'verified', 'listed',
  'fragranceNotes', 'retailPrice', 'dupeOf',
];

router.get('/data-entry/config', auth, async (req, res) => {
  try {
    const settings = await Settings.findOne({ where: { id: 1 } });
    const enabledFields = settings?.data_entry_fields || [];
    const payload = { enabledFields };
    // Only admins see the full eligible field list (used by Settings page)
    if (req.user.role === 'admin') {
      payload.eligibleFields = DATA_ENTRY_ELIGIBLE_FIELDS;
    }
    // Include this user's data entry scope (brand/category restrictions)
    payload.allowedBrands = req.user.data_entry_brands || [];
    payload.allowedCategories = req.user.data_entry_categories || [];
    res.json(payload);
  } catch (err) {
    console.error('Error fetching data entry config:', err);
    res.status(500).json({ error: 'Failed to fetch data entry config' });
  }
});

// Escape MySQL LIKE special characters so user input is treated as a literal string
const escapeLike = (s) => s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

// ── Search by fragrance notes (AND logic — product must have ALL notes) ────────
router.get('/search/by-notes', auth, checkPermission('priceScanner', 'view'), async (req, res) => {
  try {
    const raw = String(req.query.notes || '');
    if (raw.length > 500) return res.status(400).json({ error: 'Query too long' });
    const noteNames = raw.split(',').map(n => n.trim()).filter(Boolean);
    if (!noteNames.length) return res.json([]);

    // Find noteIds for each requested name (case-insensitive, escaped LIKE)
    const foundNotes = await FragranceNote.findAll({
      where: { name: { [Op.in]: noteNames } },
      attributes: ['id', 'name'],
    });
    const likeNotes = await FragranceNote.findAll({
      where: {
        [Op.or]: noteNames.map(n => ({ name: { [Op.like]: `%${escapeLike(n)}%` } })),
      },
      attributes: ['id', 'name'],
    });

    const allCandidates = [...foundNotes, ...likeNotes];
    if (!allCandidates.length) return res.json([]);

    // Build per-note-name buckets of matching noteIds (in JS, no extra DB calls)
    const bucketIds = noteNames.map(noteName => {
      const ids = allCandidates
        .filter(n => n.name.toLowerCase().includes(noteName.toLowerCase()))
        .map(n => n.id);
      return ids;
    });
    if (bucketIds.some(ids => ids.length === 0)) return res.json([]);

    // Single batch query: fetch all (noteId, productSku) pairs for all candidate noteIds
    const allNoteIds = [...new Set(bucketIds.flat())];
    const pfnCandidates = await ProductFragranceNote.findAll({
      where: { noteId: { [Op.in]: allNoteIds } },
      attributes: ['productSku', 'noteId'],
    });

    // Build SKU → Set<noteId> map, then intersect per bucket
    const skuNoteIds = {};
    for (const row of pfnCandidates) {
      if (!skuNoteIds[row.productSku]) skuNoteIds[row.productSku] = new Set();
      skuNoteIds[row.productSku].add(row.noteId);
    }

    // A SKU qualifies if it has at least one noteId from every bucket
    const qualifyingSkus = Object.entries(skuNoteIds)
      .filter(([, noteSet]) => bucketIds.every(ids => ids.some(id => noteSet.has(id))))
      .map(([sku]) => sku);

    if (!qualifyingSkus.length) return res.json([]);
    const skuList = qualifyingSkus;

    const [products, pfnRows] = await Promise.all([
      Products.findAll({
        where: { sku: { [Op.in]: skuList } },
        attributes: ['sku', 'brand', 'itemName', 'quantity', 'location', 'sizeOz', 'sizeMl', 'strength', 'shade', 'image', 'retailPrice'],
        include: [{ model: ProductDetails, required: false, attributes: ['tester', 'discontinued', 'dupeOf'] }],
        order: [['quantity', 'DESC']],
      }),
      ProductFragranceNote.findAll({
        where: { productSku: { [Op.in]: skuList } },
        include: [{ model: FragranceNote, as: 'note', attributes: ['id', 'name'] }],
      }),
    ]);

    // Build per-SKU note map grouped by tier
    const noteMap = {};
    for (const row of pfnRows) {
      if (!noteMap[row.productSku]) noteMap[row.productSku] = { top: [], middle: [], base: [] };
      if (row.note) noteMap[row.productSku][row.tier].push({ id: row.note.id, name: row.note.name });
    }

    res.json(products.map(p => {
      const details = p.ProductDetails || p.ProductDetail || null;
      return {
        sku: p.sku, brand: p.brand, itemName: p.itemName,
        quantity: p.quantity, location: p.location,
        sizeOz: p.sizeOz, sizeMl: p.sizeMl, strength: p.strength, shade: p.shade,
        image: p.image,
        retailPrice: p.retailPrice != null ? Number(p.retailPrice) : null,
        tester: Boolean(details?.tester),
        discontinued: Boolean(details?.discontinued),
        dupeOf: details?.dupeOf || null,
        fragranceNotes: noteMap[p.sku] || { top: [], middle: [], base: [] },
      };
    }));
  } catch (err) {
    console.error('Search by notes error:', err);
    res.status(500).json({ error: 'Failed to search by notes' });
  }
});

// ── Search by dupe/clone of ────────────────────────────────────────────────────
router.get('/search/by-dupe', auth, checkPermission('priceScanner', 'view'), async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);
    if (q.length > 200) return res.status(400).json({ error: 'Query too long' });

    const details = await ProductDetails.findAll({
      where: { dupeOf: { [Op.like]: `%${escapeLike(q)}%` } },
      attributes: ['sku', 'dupeOf', 'tester', 'discontinued'],
    });
    if (!details.length) return res.json([]);

    const skus = details.map(d => d.sku);
    const products = await Products.findAll({
      where: { sku: { [Op.in]: skus } },
      attributes: ['sku', 'brand', 'itemName', 'quantity', 'location', 'sizeOz', 'sizeMl', 'strength', 'shade', 'image', 'retailPrice'],
      order: [['quantity', 'DESC']],
    });

    const detailMap = Object.fromEntries(details.map(d => [d.sku, d]));
    res.json(products.map(p => {
      const d = detailMap[p.sku];
      return {
        sku: p.sku, brand: p.brand, itemName: p.itemName,
        quantity: p.quantity, location: p.location,
        sizeOz: p.sizeOz, sizeMl: p.sizeMl, strength: p.strength, shade: p.shade,
        image: p.image,
        retailPrice: p.retailPrice != null ? Number(p.retailPrice) : null,
        tester: Boolean(d?.tester),
        discontinued: Boolean(d?.discontinued),
        dupeOf: d?.dupeOf || null,
      };
    }));
  } catch (err) {
    console.error('Search by dupe error:', err);
    res.status(500).json({ error: 'Failed to search by dupe' });
  }
});

router.put('/data-entry/config', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const { enabledFields } = req.body;
    if (!Array.isArray(enabledFields)) {
      return res.status(400).json({ error: 'enabledFields must be an array' });
    }
    const sanitized = enabledFields.filter(f => DATA_ENTRY_ELIGIBLE_FIELDS.includes(f));
    await Settings.update({ data_entry_fields: sanitized }, { where: { id: 1 } });
    res.json({ enabledFields: sanitized });
  } catch (err) {
    console.error('Error updating data entry config:', err);
    res.status(500).json({ error: 'Failed to update data entry config' });
  }
});

// ── Data Entry — save allowed fields for a SKU ────────────────────────────────

router.put('/data-entry', auth, checkPermission('products', 'dataEntry'), async (req, res) => {
  try {
    const { sku, ...incoming } = req.body;
    if (!sku) return res.status(400).json({ error: 'sku is required' });

    // Enforce data entry scope server-side
    const scopeBrands = req.user.data_entry_brands;
    const scopeCategories = req.user.data_entry_categories;
    if (scopeBrands?.length > 0 || scopeCategories?.length > 0) {
      const product = await Products.findOne({ where: { sku }, attributes: ['brand', 'category'] });
      if (!product) return res.status(404).json({ error: 'Product not found' });
      if (scopeBrands?.length > 0 && !scopeBrands.includes(product.brand)) {
        return res.status(403).json({ error: 'Product is outside your allowed brands' });
      }
      if (scopeCategories?.length > 0 && !scopeCategories.includes(product.category)) {
        return res.status(403).json({ error: 'Product is outside your allowed categories' });
      }
    }

    const settings = await Settings.findOne({ where: { id: 1 } });
    const enabledFields = settings?.data_entry_fields || [];
    if (enabledFields.length === 0) {
      return res.status(400).json({ error: 'No fields are configured for data entry' });
    }

    const SPECIAL_FIELDS = new Set(['fragranceNotes', 'dupeOf']);
    const DETAILS_FIELDS = new Set(['dupeOf']);
    const updatePayload = {};
    const detailsPayload = {};

    for (const field of enabledFields) {
      if (SPECIAL_FIELDS.has(field)) {
        if (DETAILS_FIELDS.has(field) && incoming[field] !== undefined) {
          detailsPayload[field] = incoming[field];
        }
        continue;
      }
      if (incoming[field] !== undefined) {
        updatePayload[field] = incoming[field];
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      await Products.update(updatePayload, { where: { sku } });
    }

    if (Object.keys(detailsPayload).length > 0) {
      const [count] = await ProductDetails.update(detailsPayload, { where: { sku } });
      if (count === 0) {
        await ProductDetails.create({ sku, ...detailsPayload });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error in data entry save:', err);
    res.status(500).json({ error: 'Failed to save data entry' });
  }
});

module.exports = router;

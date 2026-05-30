const express = require("express");
const { Op } = require("sequelize");
const { HbaOrder, HbaOrderItem } = require("../models");
const EmailService = require("../Services/EmailService");
const { auth } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permissions");

const router = express.Router();

const VALID_STATUSES = new Set(["new", "in_review", "invoiced", "paid", "fulfilled", "cancelled"]);
const SUPPORT_EMAIL = "support@hbadeals.com";

const escapeHtml = (value) => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const getInternalRecipients = () => {
  const recipientListRaw =
    process.env.HBA_ORDER_NOTIFICATION_EMAIL ||
    process.env.HBA_ORDER_NOTIFICATION_EMAILS ||
    process.env.ALERT_EMAIL ||
    process.env.SMTP_USER;

  return String(recipientListRaw || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
};

const toEmailPayload = (order) => {
  const plain = typeof order.toJSON === "function" ? order.toJSON() : order;
  const items = plain.items || [];
  return {
    customer: {
      name: plain.customerName,
      companyName: plain.companyName,
      addressLine1: plain.addressLine1,
      addressLine2: plain.addressLine2,
      city: plain.city,
      state: plain.state,
      zipCode: plain.zipCode,
      country: plain.country,
      phone: plain.phone,
      email: plain.email,
      salesPerson: plain.salesPerson,
      notes: plain.notes,
    },
    items: items.map((item) => ({
      sku: item.sku,
      upc: item.upc,
      brand: item.brand,
      itemName: item.itemName,
      quantity: Number(item.quantity || 0),
      price: Number(item.unitPrice || 0),
      subtotal: Number(item.subtotal || 0),
    })),
    totals: {
      totalSkus: Number(plain.totalSkus || 0),
      totalUnits: Number(plain.totalUnits || 0),
      totalPrice: Number(plain.totalPrice || 0),
    },
    orderNumber: plain.orderNumber,
  };
};

const buildInternalEmailHtml = ({ customer, items, totals, orderNumber }) => {
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
      <h2>HBA Order Request ${escapeHtml(orderNumber)}</h2>
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

const buildCustomerEmailHtml = ({ customer, items, totals, orderNumber }) => {
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
      <p>If you have questions, reply to this email or contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
    </div>
  `;
};

const buildEmailText = ({ customer, items, totals, orderNumber, customerCopy }) => {
  return [
    customerCopy ? "We received your HBA order request" : `HBA Order Request ${orderNumber}`,
    "",
    customerCopy
      ? "Thank you for your order request. Our team will review it and follow up with invoice and payment details."
      : "A new order request was submitted from the HBA ordering site.",
    `Reference: ${orderNumber}`,
    "",
    `Name: ${customer.name}`,
    `Company: ${customer.companyName}`,
    `Email: ${customer.email}`,
    `Phone: ${customer.phone}`,
    "",
    "Order Items",
    ...items.map(
      (item) =>
        `${item.sku} | ${item.upc || ""} | ${item.brand || ""} | ${item.itemName} | Qty ${item.quantity} | $${Number(item.price || 0).toFixed(2)} | $${Number(item.subtotal || 0).toFixed(2)}`
    ),
    "",
    `Total SKUs: ${totals.totalSkus}`,
    `Total Units: ${totals.totalUnits}`,
    `Total Amount: $${Number(totals.totalPrice || 0).toFixed(2)}`,
    ...(customerCopy ? ["", `Questions? Reply to this email or contact ${SUPPORT_EMAIL}.`] : []),
  ].join("\n");
};

const getOrderWithItems = async (id) => {
  return HbaOrder.findByPk(id, {
    include: [{ model: HbaOrderItem, as: "items", required: false }],
    order: [[{ model: HbaOrderItem, as: "items" }, "id", "ASC"]],
  });
};

router.get("/", auth, checkPermission("hbaOrders", "view"), async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();
    const salesPerson = String(req.query.salesPerson || "").trim();
    const emailStatus = String(req.query.emailStatus || "").trim();
    const dateFrom = String(req.query.dateFrom || "").trim();
    const dateTo = String(req.query.dateTo || "").trim();
    const whereAnd = [];

    if (status && status !== "all") whereAnd.push({ status });
    if (salesPerson && salesPerson !== "all") whereAnd.push({ salesPerson });
    if (emailStatus && emailStatus !== "all") {
      whereAnd.push({
        [Op.or]: [
          { notificationStatus: emailStatus },
          { customerNotificationStatus: emailStatus },
        ],
      });
    }
    if (dateFrom || dateTo) {
      const createdAt = {};
      if (dateFrom) createdAt[Op.gte] = new Date(`${dateFrom}T00:00:00`);
      if (dateTo) createdAt[Op.lte] = new Date(`${dateTo}T23:59:59`);
      whereAnd.push({ createdAt });
    }
    if (search) {
      const like = `%${search}%`;
      whereAnd.push({
        [Op.or]: [
        { orderNumber: { [Op.like]: like } },
        { customerName: { [Op.like]: like } },
        { companyName: { [Op.like]: like } },
        { email: { [Op.like]: like } },
          { "$items.sku$": { [Op.like]: like } },
          { "$items.upc$": { [Op.like]: like } },
          { "$items.brand$": { [Op.like]: like } },
          { "$items.itemName$": { [Op.like]: like } },
        ],
      });
    }
    const where = whereAnd.length ? { [Op.and]: whereAnd } : {};

    const orders = await HbaOrder.findAll({
      where,
      include: [
        {
          model: HbaOrderItem,
          as: "items",
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: 500,
      distinct: true,
      subQuery: false,
    });

    const allRows = await HbaOrder.findAll({ attributes: ["status", "notificationStatus", "customerNotificationStatus"] });
    const summary = allRows.reduce(
      (acc, row) => {
        acc.totalOrders += 1;
        acc[row.status] = (acc[row.status] || 0) + 1;
        if (row.notificationStatus === "failed" || row.customerNotificationStatus === "failed") {
          acc.failedEmails += 1;
        }
        return acc;
      },
      { totalOrders: 0, new: 0, in_review: 0, invoiced: 0, paid: 0, fulfilled: 0, cancelled: 0, failedEmails: 0 }
    );

    const salesPeople = await HbaOrder.findAll({
      attributes: ["salesPerson"],
      group: ["salesPerson"],
      order: [["salesPerson", "ASC"]],
    });

    res.json({
      rows: orders,
      summary,
      salesPeople: salesPeople.map((row) => row.salesPerson).filter(Boolean),
    });
  } catch (error) {
    console.error("Error loading HBA orders:", error);
    res.status(500).json({ error: "Failed to load HBA orders" });
  }
});

router.get("/:id", auth, checkPermission("hbaOrders", "view"), async (req, res) => {
  const order = await getOrderWithItems(req.params.id);
  if (!order) return res.status(404).json({ error: "HBA order not found" });
  return res.json(order);
});

router.patch("/:id", auth, checkPermission("hbaOrders", "edit"), async (req, res) => {
  const order = await HbaOrder.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: "HBA order not found" });

  const nextStatus = String(req.body?.status || order.status).trim();
  if (!VALID_STATUSES.has(nextStatus)) {
    return res.status(400).json({ error: "Invalid HBA order status" });
  }

  await order.update({
    status: nextStatus,
    internalNotes: req.body?.internalNotes === undefined ? order.internalNotes : req.body.internalNotes,
    reviewedBy: req.user?.id || order.reviewedBy,
    reviewedAt: new Date(),
  });

  const updated = await getOrderWithItems(order.id);
  return res.json(updated);
});

router.post("/:id/resend-internal-email", auth, checkPermission("hbaOrders", "edit"), async (req, res) => {
  const order = await getOrderWithItems(req.params.id);
  if (!order) return res.status(404).json({ error: "HBA order not found" });

  const recipients = getInternalRecipients();
  if (recipients.length === 0) {
    return res.status(500).json({ error: "HBA order notification email is not configured." });
  }

  const payload = toEmailPayload(order);
  const success = await EmailService.sendHbaEmail({
    to: recipients,
    subject: `HBA Order Request ${payload.orderNumber} - ${payload.customer.companyName} - ${payload.customer.name}`,
    html: buildInternalEmailHtml(payload),
    text: buildEmailText({ ...payload, customerCopy: false }),
  });

  await order.update({
    notificationStatus: success ? "sent" : "failed",
    notificationSentAt: success ? new Date() : order.notificationSentAt,
    notificationRecipients: recipients.join(", "),
    notificationError: success ? null : "Failed to resend internal order email.",
  });

  return res.json({ success });
});

router.post("/:id/resend-customer-email", auth, checkPermission("hbaOrders", "edit"), async (req, res) => {
  const order = await getOrderWithItems(req.params.id);
  if (!order) return res.status(404).json({ error: "HBA order not found" });

  const payload = toEmailPayload(order);
  const success = await EmailService.sendHbaEmail({
    to: payload.customer.email,
    subject: `HBA Order Request Received - ${payload.orderNumber}`,
    html: buildCustomerEmailHtml(payload),
    text: buildEmailText({ ...payload, customerCopy: true }),
    replyTo: SUPPORT_EMAIL,
  });

  await order.update({
    customerNotificationStatus: success ? "sent" : "failed",
    customerNotificationSentAt: success ? new Date() : order.customerNotificationSentAt,
    customerNotificationError: success ? null : "Failed to resend customer confirmation email.",
  });

  return res.json({ success });
});

module.exports = router;

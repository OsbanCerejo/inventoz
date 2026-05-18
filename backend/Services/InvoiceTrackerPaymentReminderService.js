const { Op } = require("sequelize");
const {
  InvoiceTrackerInvoice,
  InvoiceTrackerInvoiceItem,
  InvoiceTrackerPaymentReminderLog,
  sequelize,
} = require("../models");
const EmailService = require("./EmailService");

const REMINDER_EMAILS_ENV = "INVOICE_TRACKER_REMINDER_EMAILS";
const REMINDER_CHECKPOINTS = new Set([30, 7, 3, 2, 1, 0]);

const sanitizeString = (value) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const getTodayDateString = () => new Date().toISOString().slice(0, 10);

const parseReminderRecipientEmails = () =>
  String(process.env[REMINDER_EMAILS_ENV] || "")
    .split(",")
    .map((value) => sanitizeString(value).toLowerCase())
    .filter(Boolean);

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizeString(value));

const getInvoiceReminderRecipients = async () =>
  Array.from(new Set(parseReminderRecipientEmails())).filter((email) => isValidEmail(email));

const getPaymentReminderDayOffset = (paymentDueBy) => {
  const dueDate = sanitizeString(paymentDueBy);
  if (!dueDate) return null;

  const [year, month, day] = dueDate.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;

  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const dueUtc = Date.UTC(year, month - 1, day);
  return Math.round((dueUtc - todayUtc) / (24 * 60 * 60 * 1000));
};

const getPaymentReminderLabel = (dayOffset) => {
  if (dayOffset === null) return "Payment reminder";
  if (dayOffset > 1) return `Due in ${dayOffset} days`;
  if (dayOffset === 1) return "Due tomorrow";
  if (dayOffset === 0) return "Due today";
  if (dayOffset === -1) return "Overdue by 1 day";
  return `Overdue by ${Math.abs(dayOffset)} days`;
};

const getReminderTypeForOffset = (dayOffset) => {
  if (dayOffset === null) return "manual";
  if (REMINDER_CHECKPOINTS.has(dayOffset)) {
    if (dayOffset === 0) return "due_today";
    return `due_${dayOffset}`;
  }
  if (dayOffset < 0) {
    return `overdue_day_${Math.abs(dayOffset)}`;
  }
  return null;
};

const shouldSendAutomaticReminder = (dayOffset) => {
  if (dayOffset === null) return false;
  return REMINDER_CHECKPOINTS.has(dayOffset) || dayOffset < 0;
};

const serializeInvoiceForReminder = (invoice) => {
  const plain = invoice.get ? invoice.get({ plain: true }) : invoice;
  const items = Array.isArray(plain.items) ? plain.items : [];
  const miscellaneousAmount = Number(plain.miscellaneousAmount || 0);
  const shippingAmount = Number(plain.shippingAmount || 0);

  const serializedItems = items.map((item) => {
    const unitPrice = Number(item.unitPrice || 0);
    const quantity = Number(item.quantity || 0);
    return {
      sku: sanitizeString(item.sku),
      itemName: sanitizeString(item.itemName),
      unitPrice,
      quantity,
      lineTotal: Number((unitPrice * quantity).toFixed(2)),
    };
  });

  const itemsTotal = serializedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  return {
    id: plain.id,
    vendorName: sanitizeString(plain.vendorName),
    invoiceNumber: sanitizeString(plain.invoiceNumber),
    orderDate: sanitizeString(plain.orderDate),
    paymentStatus: sanitizeString(plain.paymentStatus),
    paymentDueBy: sanitizeString(plain.paymentDueBy),
    partialPaymentAmount:
      plain.partialPaymentAmount === null || plain.partialPaymentAmount === undefined
        ? null
        : Number(plain.partialPaymentAmount),
    miscellaneousAmount,
    shippingAmount,
    items: serializedItems,
    totalAmount: Number((itemsTotal + miscellaneousAmount + shippingAmount).toFixed(2)),
  };
};

const buildReminderEmailContent = (invoice, reminderLabel, dayOffset, triggerSource) => {
  const totalAmount = Number(invoice.totalAmount || 0).toFixed(2);
  const partialPaymentAmount =
    invoice.partialPaymentAmount === null || invoice.partialPaymentAmount === undefined
      ? null
      : Number(invoice.partialPaymentAmount || 0).toFixed(2);
  const paymentDueBy = sanitizeString(invoice.paymentDueBy) || "N/A";
  const orderDate = sanitizeString(invoice.orderDate) || "N/A";
  const subject = `${reminderLabel}: Invoice ${invoice.invoiceNumber} (${invoice.vendorName})`;
  const intro =
    triggerSource === "automatic"
      ? "This is an automatic payment reminder from Invoice Tracker."
      : "This is a manual payment reminder from Invoice Tracker.";

  const itemRowsHtml = (invoice.items || [])
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.sku}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.itemName}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.quantity}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:760px;margin:0 auto;color:#1f2937;">
      <div style="background:#0f766e;color:#fff;padding:18px 24px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;">Invoice Payment Reminder</h2>
        <p style="margin:8px 0 0 0;opacity:.92;">${reminderLabel}</p>
      </div>
      <div style="border:1px solid #d1d5db;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
        <p>${intro}</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:6px 0;font-weight:bold;">Vendor</td><td style="padding:6px 0;">${invoice.vendorName}</td></tr>
          <tr><td style="padding:6px 0;font-weight:bold;">Invoice Number</td><td style="padding:6px 0;">${invoice.invoiceNumber}</td></tr>
          <tr><td style="padding:6px 0;font-weight:bold;">Order Date</td><td style="padding:6px 0;">${orderDate}</td></tr>
          <tr><td style="padding:6px 0;font-weight:bold;">Payment Due By</td><td style="padding:6px 0;">${paymentDueBy}</td></tr>
          <tr><td style="padding:6px 0;font-weight:bold;">Payment Status</td><td style="padding:6px 0;">${invoice.paymentStatus}</td></tr>
          ${
            partialPaymentAmount !== null
              ? `<tr><td style="padding:6px 0;font-weight:bold;">Partial Payment Received</td><td style="padding:6px 0;">$${partialPaymentAmount}</td></tr>`
              : ""
          }
          <tr><td style="padding:6px 0;font-weight:bold;">Reminder Status</td><td style="padding:6px 0;">${reminderLabel}</td></tr>
          <tr><td style="padding:6px 0;font-weight:bold;">Total Amount</td><td style="padding:6px 0;">$${totalAmount}</td></tr>
        </table>
        ${
          itemRowsHtml
            ? `<h3 style="margin:24px 0 12px;">Invoice Items</h3>
               <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
                 <thead>
                   <tr style="background:#f8fafc;">
                     <th style="padding:8px;text-align:left;border-bottom:1px solid #e5e7eb;">SKU</th>
                     <th style="padding:8px;text-align:left;border-bottom:1px solid #e5e7eb;">Item Name</th>
                     <th style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb;">Qty</th>
                   </tr>
                 </thead>
                 <tbody>${itemRowsHtml}</tbody>
               </table>`
            : ""
        }
      </div>
    </div>
  `;

  const text = [
    "Invoice Payment Reminder",
    reminderLabel,
    intro,
    "",
    `Vendor: ${invoice.vendorName}`,
    `Invoice Number: ${invoice.invoiceNumber}`,
    `Order Date: ${orderDate}`,
    `Payment Due By: ${paymentDueBy}`,
    `Payment Status: ${invoice.paymentStatus}`,
    ...(partialPaymentAmount !== null ? [`Partial Payment Received: $${partialPaymentAmount}`] : []),
    `Days Offset: ${dayOffset === null ? "N/A" : dayOffset}`,
    `Total Amount: $${totalAmount}`,
    "",
    "Items:",
    ...(invoice.items || []).map(
      (item) => `- ${item.sku} | ${item.itemName} | Qty ${item.quantity}`
    ),
  ].join("\n");

  return { subject, html, text };
};

const createReminderLog = async ({
  invoiceId,
  recipientEmail,
  reminderType,
  triggerDate,
  daysOffset,
  triggerSource,
  status,
  sentAt = null,
  errorMessage = null,
  initiatedBy = null,
}) =>
  InvoiceTrackerPaymentReminderLog.create({
    invoiceId,
    recipientEmail,
    reminderType,
    triggerDate,
    daysOffset,
    triggerSource,
    status,
    sentAt,
    errorMessage,
    initiatedBy,
  });

const alreadySentAutomaticReminder = async ({ invoiceId, recipientEmail, reminderType, triggerDate }) => {
  const existing = await InvoiceTrackerPaymentReminderLog.findOne({
    where: {
      invoiceId,
      recipientEmail,
      reminderType,
      triggerDate,
      triggerSource: "automatic",
      status: "sent",
    },
  });
  return Boolean(existing);
};

const loadReminderInvoice = async (invoiceId) =>
  InvoiceTrackerInvoice.findOne({
    where: { id: invoiceId, isArchived: false },
    include: [
      {
        model: InvoiceTrackerInvoiceItem,
        as: "items",
        required: false,
        separate: true,
        order: [["createdAt", "ASC"]],
      },
    ],
  });

const sendReminderForInvoice = async (invoiceOrId, { triggerSource = "manual", initiatedBy = null } = {}) => {
  const invoiceRecord =
    typeof invoiceOrId === "number" ? await loadReminderInvoice(invoiceOrId) : invoiceOrId;
  if (!invoiceRecord) {
    const error = new Error("Invoice not found");
    error.status = 404;
    throw error;
  }

  const invoice = serializeInvoiceForReminder(invoiceRecord);
  if (!["credit", "partial"].includes(invoice.paymentStatus)) {
    const error = new Error("Reminder emails can only be sent for credit or partial-payment invoices.");
    error.status = 400;
    throw error;
  }
  if (!invoice.paymentDueBy) {
    const error = new Error("Payment due date is required before sending a reminder.");
    error.status = 400;
    throw error;
  }

  const recipients = await getInvoiceReminderRecipients();
  if (recipients.length < 1) {
    const error = new Error(`No reminder recipients configured. Set ${REMINDER_EMAILS_ENV} in the backend environment.`);
    error.status = 400;
    throw error;
  }

  const dayOffset = getPaymentReminderDayOffset(invoice.paymentDueBy);
  const reminderType = getReminderTypeForOffset(dayOffset) || "manual";
  const reminderLabel = getPaymentReminderLabel(dayOffset);
  const triggerDate = getTodayDateString();
  const emailContent = buildReminderEmailContent(invoice, reminderLabel, dayOffset, triggerSource);

  const results = [];
  for (const recipientEmail of recipients) {
    if (triggerSource === "automatic") {
      const alreadySent = await alreadySentAutomaticReminder({
        invoiceId: invoice.id,
        recipientEmail,
        reminderType,
        triggerDate,
      });
      if (alreadySent) {
        results.push({ recipientEmail, status: "skipped" });
        continue;
      }
    }

    const sent = await EmailService.sendEmail({
      to: recipientEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    await createReminderLog({
      invoiceId: invoice.id,
      recipientEmail,
      reminderType,
      triggerDate,
      daysOffset: dayOffset,
      triggerSource,
      status: sent ? "sent" : "failed",
      sentAt: sent ? new Date() : null,
      errorMessage: sent ? null : "Email transport reported failure",
      initiatedBy,
    });

    results.push({ recipientEmail, status: sent ? "sent" : "failed" });
  }

  const sentCount = results.filter((entry) => entry.status === "sent").length;
  const failedCount = results.filter((entry) => entry.status === "failed").length;
  const skippedCount = results.filter((entry) => entry.status === "skipped").length;

  if (triggerSource === "manual" && sentCount < 1) {
    const error = new Error("Failed to send reminder email. Check SMTP settings and try again.");
    error.status = 500;
    throw error;
  }

  return {
    invoiceId: invoice.id,
    recipients,
    results,
    sentCount,
    failedCount,
    skippedCount,
    reminderType,
    reminderLabel,
    dayOffset,
  };
};

const runDailyReminderSweep = async () => {
  const recipients = await getInvoiceReminderRecipients();
  if (recipients.length < 1) {
    console.warn(`Invoice tracker payment reminders skipped: ${REMINDER_EMAILS_ENV} is not configured.`);
    return { processedInvoices: 0, sentCount: 0, skippedCount: 0, failedCount: 0 };
  }

  const invoices = await InvoiceTrackerInvoice.findAll({
    where: {
      isArchived: false,
      paymentStatus: { [Op.in]: ["credit", "partial"] },
      paymentDueBy: { [Op.ne]: null },
    },
    include: [
      {
        model: InvoiceTrackerInvoiceItem,
        as: "items",
        required: false,
        separate: true,
        order: [["createdAt", "ASC"]],
      },
    ],
    order: [["paymentDueBy", "ASC"], ["id", "ASC"]],
  });

  let processedInvoices = 0;
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const invoice of invoices) {
    const dayOffset = getPaymentReminderDayOffset(invoice.paymentDueBy);
    if (!shouldSendAutomaticReminder(dayOffset)) {
      continue;
    }

    processedInvoices += 1;
    const result = await sendReminderForInvoice(invoice, { triggerSource: "automatic", initiatedBy: null });
    sentCount += result.sentCount;
    skippedCount += result.skippedCount;
    failedCount += result.failedCount;
  }

  return { processedInvoices, sentCount, skippedCount, failedCount };
};

module.exports = {
  getInvoiceReminderRecipients,
  getPaymentReminderDayOffset,
  getPaymentReminderLabel,
  getReminderTypeForOffset,
  shouldSendAutomaticReminder,
  sendReminderForInvoice,
  runDailyReminderSweep,
};

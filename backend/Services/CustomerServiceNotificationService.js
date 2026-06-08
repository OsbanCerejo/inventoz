const { Op } = require("sequelize");
const {
  CustomerServiceNotification,
  CustomerServiceTicket,
  User,
  UserPermission,
  Permission,
} = require("../models");
const EmailService = require("./EmailService");

const SLA_HOURS = { normal: 48, high: 24, urgent: 6 };

function computeDueAt(priority, from = new Date()) {
  const hours = SLA_HOURS[priority] ?? 48;
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

const CS_USER_ATTRS = ["id", "email", "customerServiceNotificationEmail", "customerServiceEmailNotificationsEnabled", "customerServiceInAppNotificationsEnabled", "isActive"];

async function getUsersWithPermission(permissionKey) {
  const permission = await Permission.findOne({ where: { key: permissionKey } });
  if (!permission) return [];
  const assignments = await UserPermission.findAll({
    where: { permissionId: permission.id, allowed: true },
    include: [{ model: User, as: "user", attributes: CS_USER_ATTRS }],
  });
  return assignments.map((a) => a.user).filter((u) => u && u.isActive);
}

// Returns all users who should receive management-level CS notifications:
// users with customerService.assign permission + all active admins (admins implicitly hold all permissions).
async function getCsManagers() {
  const [assignUsers, adminUsers] = await Promise.all([
    getUsersWithPermission("customerService.assign"),
    User.findAll({
      where: { role: "admin", isActive: true },
      attributes: CS_USER_ATTRS,
    }),
  ]);
  const map = new Map();
  adminUsers.forEach((u) => map.set(u.id, u));
  assignUsers.forEach((u) => map.set(u.id, u));
  return [...map.values()];
}

async function sendInAppNotification({ ticketId, recipientUserId, type, message }) {
  await CustomerServiceNotification.create({ ticketId, recipientUserId, type, message });
}

function inAppEnabled(user) {
  // user may be undefined (e.g. assignee not loaded) — default to allow
  if (!user) return true;
  return user.customerServiceInAppNotificationsEnabled !== false;
}

async function sendEmailIfEnabled(user, subject, html, text) {
  if (!user.customerServiceEmailNotificationsEnabled) return;
  const to = user.customerServiceNotificationEmail || user.email;
  if (!to) return;
  await EmailService.sendEmail({ to, subject, html, text });
}

function ticketLink(ticketNumber) {
  const base = process.env.APP_FRONTEND_URL || "https://inventoz-frontend.lprpnx.easypanel.host";
  return `${base}/customer-service?search=${encodeURIComponent(ticketNumber)}`;
}

async function notifyAssigned(ticket, assigneeUser, actorName) {
  const msg = `Ticket ${ticket.ticketNumber} (${ticket.platform} / ${ticket.username}) has been assigned to you by ${actorName}.`;
  const html = `<p>${msg}</p><p><a href="${ticketLink(ticket.ticketNumber)}">View ticket</a></p>`;
  if (inAppEnabled(assigneeUser)) {
    await sendInAppNotification({ ticketId: ticket.id, recipientUserId: assigneeUser.id, type: "assigned", message: msg });
  }
  await sendEmailIfEnabled(assigneeUser, `CS Ticket Assigned: ${ticket.ticketNumber}`, html, msg);
}

async function notifyNoteAdded(ticket, actorName, actorId) {
  const managers = await getCsManagers();

  const userMap = new Map();
  if (ticket.assignee) userMap.set(ticket.assignee.id, ticket.assignee);
  managers.forEach((u) => userMap.set(u.id, u));

  const recipients = new Set();
  if (ticket.assignedTo) recipients.add(ticket.assignedTo);
  managers.forEach((u) => recipients.add(u.id));

  // Don't notify the person who just added the note about their own action
  if (actorId) recipients.delete(actorId);

  const msg = `A new note was added to ticket ${ticket.ticketNumber} (${ticket.platform} / ${ticket.username}) by ${actorName}.`;
  const html = `<p>${msg}</p><p><a href="${ticketLink(ticket.ticketNumber)}">View ticket</a></p>`;

  for (const userId of recipients) {
    const user = userMap.get(userId);
    if (inAppEnabled(user)) {
      await sendInAppNotification({ ticketId: ticket.id, recipientUserId: userId, type: "note_added", message: msg });
    }
    if (user) await sendEmailIfEnabled(user, `New Note on CS Ticket: ${ticket.ticketNumber}`, html, msg);
  }
}

async function notifyResolved(ticket, actorName) {
  const managers = await getCsManagers();

  const userMap = new Map();
  if (ticket.assignee) userMap.set(ticket.assignee.id, ticket.assignee);
  managers.forEach((u) => userMap.set(u.id, u));

  const recipients = new Set();
  if (ticket.assignedTo) recipients.add(ticket.assignedTo);
  managers.forEach((u) => recipients.add(u.id));

  const msg = `Ticket ${ticket.ticketNumber} (${ticket.platform} / ${ticket.username}) has been resolved by ${actorName}.`;
  const html = `<p>${msg}</p><p><a href="${ticketLink(ticket.ticketNumber)}">View ticket</a></p>`;

  for (const userId of recipients) {
    const user = userMap.get(userId);
    if (inAppEnabled(user)) {
      await sendInAppNotification({ ticketId: ticket.id, recipientUserId: userId, type: "resolved", message: msg });
    }
    if (user) await sendEmailIfEnabled(user, `CS Ticket Resolved: ${ticket.ticketNumber}`, html, msg);
  }
}

async function notifyArchived(ticket, actorName) {
  const managers = await getCsManagers();

  const userMap = new Map();
  if (ticket.assignee) userMap.set(ticket.assignee.id, ticket.assignee);
  managers.forEach((u) => userMap.set(u.id, u));

  const recipients = new Set();
  if (ticket.assignedTo) recipients.add(ticket.assignedTo);
  managers.forEach((u) => recipients.add(u.id));

  const msg = `Ticket ${ticket.ticketNumber} (${ticket.platform} / ${ticket.username}) has been archived/cancelled by ${actorName}.`;
  const html = `<p>${msg}</p><p><a href="${ticketLink(ticket.ticketNumber)}">View ticket</a></p>`;

  for (const userId of recipients) {
    const user = userMap.get(userId);
    if (inAppEnabled(user)) {
      await sendInAppNotification({ ticketId: ticket.id, recipientUserId: userId, type: "archived", message: msg });
    }
    if (user) await sendEmailIfEnabled(user, `CS Ticket Archived: ${ticket.ticketNumber}`, html, msg);
  }
}

async function runOverdueSweep() {
  const now = new Date();

  const overdueTickets = await CustomerServiceTicket.findAll({
    where: {
      isArchived: false,
      overdueSentAt: null,
      dueAt: { [Op.lt]: now },
      status: { [Op.notIn]: ["resolved"] },
    },
    include: [
      { model: User, as: "assignee", attributes: CS_USER_ATTRS },
    ],
  });

  if (overdueTickets.length === 0) return { processed: 0 };

  const managers = await getCsManagers();

  let processed = 0;
  for (const ticket of overdueTickets) {
    try {
      const recipients = new Map();
      if (ticket.assignee) recipients.set(ticket.assignee.id, ticket.assignee);
      managers.forEach((u) => { if (!recipients.has(u.id)) recipients.set(u.id, u); });

      const msg = `Ticket ${ticket.ticketNumber} (${ticket.platform} / ${ticket.username}) is overdue. It was due at ${ticket.dueAt.toISOString()}.`;
      const html = `<p style="color:#dc2626;"><strong>OVERDUE:</strong> ${msg}</p><p><a href="${ticketLink(ticket.ticketNumber)}">View ticket</a></p>`;

      for (const [userId, user] of recipients) {
        if (inAppEnabled(user)) {
          await sendInAppNotification({ ticketId: ticket.id, recipientUserId: userId, type: "overdue", message: msg });
        }
        if (user) await sendEmailIfEnabled(user, `OVERDUE CS Ticket: ${ticket.ticketNumber}`, html, msg);
      }

      await ticket.update({ overdueSentAt: now });
      processed++;
    } catch (err) {
      console.error(`[CS Overdue] Failed to process ticket ${ticket.id}:`, err.message);
    }
  }

  return { processed };
}

module.exports = { computeDueAt, notifyAssigned, notifyNoteAdded, notifyResolved, notifyArchived, runOverdueSweep };

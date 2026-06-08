const express = require("express");
const { Op, literal } = require("sequelize");
const {
  CustomerServiceTicket,
  CustomerServiceTicketNote,
  CustomerServiceTicketActivity,
  CustomerServiceNotification,
  User,
  sequelize,
} = require("../models");
const { auth } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permissions");
const {
  computeDueAt,
  notifyAssigned,
  notifyNoteAdded,
  notifyResolved,
  notifyArchived,
} = require("../Services/CustomerServiceNotificationService");
const PermissionService = require("../Services/PermissionService");

const router = express.Router();

const VALID_STATUSES = ["open", "assigned", "in_progress", "waiting_on_customer", "waiting_on_internal_team", "resolved"];
const VALID_PRIORITIES = ["normal", "high", "urgent"];
const VALID_PLATFORMS = ["whatnot", "tiktok"];
const VALID_CATEGORIES = [
  "missing_item", "wrong_item", "damaged_item", "package_not_received",
  "return_refund_request", "complaint", "address_issue", "general_question", "other",
];

const SLA_HOURS = { normal: 48, high: 24, urgent: 6 };

const s = (v) => (typeof v === "string" ? v.trim() : "");

const actorName = (user) => user?.name || user?.username || "Unknown";

const ticketIncludes = [
  { model: User, as: "creator", attributes: ["id", "name", "username"], required: false },
  { model: User, as: "assignee", attributes: ["id", "name", "username"], required: false },
  { model: User, as: "updater", attributes: ["id", "name", "username"], required: false },
];

const canEditTicket = async (req, ticket) => {
  const user = req.user;
  if (!user) return false;
  if (user.role === "admin") return true;
  const hasAssign = await PermissionService.hasResourceAction(user, "customerService", "assign");
  if (hasAssign) return true;
  return ticket.assignedTo === user.id;
};

// ─── Dashboard counts ────────────────────────────────────────────────────────

router.get("/dashboard", auth, checkPermission("customerService", "view"), async (req, res) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const [
      open, assigned, inProgress, waitingCustomer, waitingInternal, urgent,
      dueToday, overdue, resolvedThisWeek, archivedTotal,
    ] = await Promise.all([
      CustomerServiceTicket.count({ where: { status: "open", isArchived: false } }),
      CustomerServiceTicket.count({ where: { status: "assigned", isArchived: false } }),
      CustomerServiceTicket.count({ where: { status: "in_progress", isArchived: false } }),
      CustomerServiceTicket.count({ where: { status: "waiting_on_customer", isArchived: false } }),
      CustomerServiceTicket.count({ where: { status: "waiting_on_internal_team", isArchived: false } }),
      CustomerServiceTicket.count({ where: { priority: "urgent", isArchived: false, status: { [Op.notIn]: ["resolved"] } } }),
      CustomerServiceTicket.count({ where: { dueAt: { [Op.gte]: todayStart, [Op.lt]: todayEnd }, isArchived: false, status: { [Op.notIn]: ["resolved"] } } }),
      CustomerServiceTicket.count({ where: { dueAt: { [Op.lt]: now }, isArchived: false, status: { [Op.notIn]: ["resolved"] } } }),
      CustomerServiceTicket.count({ where: { resolvedAt: { [Op.gte]: weekAgo }, isArchived: false } }),
      CustomerServiceTicket.count({ where: { isArchived: true } }),
    ]);

    res.json({ open, assigned, inProgress, waitingCustomer, waitingInternal, urgent, dueToday, overdue, resolvedThisWeek, archivedTotal });
  } catch (err) {
    console.error("CS dashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// ─── List tickets ─────────────────────────────────────────────────────────────

router.get("/", auth, checkPermission("customerService", "view"), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const where = {};

    const archived = req.query.archived === "true";
    where.isArchived = archived;

    if (req.query.tab) {
      const tab = s(req.query.tab);
      if (tab === "mine") {
        where.assignedTo = req.user.id;
        where.isArchived = false;
      } else if (tab === "overdue") {
        where.dueAt = { [Op.lt]: new Date() };
        where.status = { [Op.notIn]: ["resolved"] };
        where.isArchived = false;
      } else if (tab === "waiting") {
        where.status = { [Op.in]: ["waiting_on_customer", "waiting_on_internal_team"] };
        where.isArchived = false;
      } else if (tab === "resolved") {
        where.status = "resolved";
        where.isArchived = false;
      } else if (tab === "archived") {
        where.isArchived = true;
      }
    }

    if (req.query.status && req.query.status !== "all" && VALID_STATUSES.includes(req.query.status)) {
      where.status = req.query.status;
    }
    if (req.query.priority && VALID_PRIORITIES.includes(req.query.priority)) {
      where.priority = req.query.priority;
    }
    if (req.query.platform && VALID_PLATFORMS.includes(req.query.platform)) {
      where.platform = req.query.platform;
    }
    if (req.query.category && VALID_CATEGORIES.includes(req.query.category)) {
      where.issueCategory = req.query.category;
    }
    if (req.query.assignedTo) {
      where.assignedTo = Number(req.query.assignedTo) || null;
    }
    if (req.query.createdBy) {
      where.createdBy = Number(req.query.createdBy) || null;
    }
    if (req.query.overdueOnly === "true") {
      where.dueAt = { [Op.lt]: new Date() };
      where.status = { [Op.notIn]: ["resolved"] };
    }
    if (req.query.dateFrom || req.query.dateTo) {
      const dateFilter = {};
      if (req.query.dateFrom) dateFilter[Op.gte] = new Date(req.query.dateFrom);
      if (req.query.dateTo) dateFilter[Op.lte] = new Date(req.query.dateTo);
      where.createdAt = dateFilter;
    }
    if (req.query.search) {
      const q = s(req.query.search);
      where[Op.or] = [
        { ticketNumber: { [Op.like]: `%${q}%` } },
        { username: { [Op.like]: `%${q}%` } },
        { orderNumber: { [Op.like]: `%${q}%` } },
      ];
    }

    const { count, rows } = await CustomerServiceTicket.findAndCountAll({
      where,
      include: ticketIncludes,
      order: [["createdAt", "DESC"]],
      offset,
      limit,
      distinct: true,
    });

    res.json({ data: rows, page, limit, total: count, totalPages: Math.ceil(count / limit) });
  } catch (err) {
    console.error("CS list error:", err);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// ─── Users list (for assignee dropdowns — available to anyone with CS view) ───

router.get("/users", auth, checkPermission("customerService", "view"), async (req, res) => {
  try {
    const users = await User.findAll({
      where: { isActive: true },
      attributes: ["id", "name", "username"],
      order: [["name", "ASC"]],
    });
    res.json(users);
  } catch (err) {
    console.error("CS users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ─── Notifications ────────────────────────────────────────────────────────────
// NOTE: These must be defined BEFORE /:id routes or Express will match "notifications" as an id.

router.get("/notifications/mine", auth, checkPermission("customerService", "view"), async (req, res) => {
  try {
    const limit = Math.min(50, Number(req.query.limit) || 20);
    const unreadOnly = req.query.unreadOnly === "true";

    const where = { recipientUserId: req.user.id };
    if (unreadOnly) where.isRead = false;

    const notifications = await CustomerServiceNotification.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      include: [
        {
          model: CustomerServiceTicket,
          as: "ticket",
          attributes: ["id", "ticketNumber", "platform", "username", "status"],
          required: false,
        },
      ],
    });

    const unreadCount = await CustomerServiceNotification.count({ where: { recipientUserId: req.user.id, isRead: false } });
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error("CS notifications error:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.patch("/notifications/read-all", auth, checkPermission("customerService", "view"), async (req, res) => {
  try {
    await CustomerServiceNotification.update(
      { isRead: true, readAt: new Date() },
      { where: { recipientUserId: req.user.id, isRead: false } }
    );
    res.json({ message: "All marked as read" });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

router.patch("/notifications/:notifId/read", auth, checkPermission("customerService", "view"), async (req, res) => {
  try {
    const notif = await CustomerServiceNotification.findOne({
      where: { id: Number(req.params.notifId), recipientUserId: req.user.id },
    });
    if (!notif) return res.status(404).json({ error: "Not found" });
    await notif.update({ isRead: true, readAt: new Date() });
    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

// ─── Get single ticket ────────────────────────────────────────────────────────

router.get("/:id", auth, checkPermission("customerService", "view"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid ticket id" });

    const ticket = await CustomerServiceTicket.findByPk(id, {
      include: [
        ...ticketIncludes,
        {
          model: CustomerServiceTicketNote,
          as: "notes",
          separate: true,
          order: [["createdAt", "ASC"]],
          include: [{ model: User, as: "author", attributes: ["id", "name", "username"], required: false }],
        },
        {
          model: CustomerServiceTicketActivity,
          as: "activities",
          separate: true,
          order: [["createdAt", "DESC"]],
          include: [{ model: User, as: "actor", attributes: ["id", "name", "username"], required: false }],
        },
      ],
    });

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    // Activity log is only visible to admins and users with customerService.assign permission (managers).
    // Regular assignees can see notes but not the full audit trail.
    const canSeeActivities = req.user?.role === "admin" || await PermissionService.hasResourceAction(req.user, "customerService", "assign");
    if (!canSeeActivities) {
      ticket.setDataValue("activities", []);
    }

    res.json(ticket);
  } catch (err) {
    console.error("CS get ticket error:", err);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

// ─── Create ticket ────────────────────────────────────────────────────────────

router.post("/", auth, checkPermission("customerService", "create"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const platform = s(req.body?.platform);
    const username = s(req.body?.username);
    const orderNumber = s(req.body?.orderNumber);
    const issueCategory = s(req.body?.issueCategory);
    const priority = s(req.body?.priority) || "normal";

    if (!platform || !VALID_PLATFORMS.includes(platform)) { await transaction.rollback(); return res.status(400).json({ error: "Invalid platform" }); }
    if (!username) { await transaction.rollback(); return res.status(400).json({ error: "username is required" }); }
    if (!orderNumber) { await transaction.rollback(); return res.status(400).json({ error: "orderNumber is required" }); }
    if (!issueCategory || !VALID_CATEGORIES.includes(issueCategory)) { await transaction.rollback(); return res.status(400).json({ error: "Invalid issueCategory" }); }
    if (!VALID_PRIORITIES.includes(priority)) { await transaction.rollback(); return res.status(400).json({ error: "Invalid priority" }); }

    const createdBy = req.user?.id || null;
    const dueAt = computeDueAt(priority);

    const ticket = await CustomerServiceTicket.create(
      { platform, username, orderNumber, issueCategory, priority, status: "assigned", assignedTo: createdBy, dueAt, createdBy, lastUpdatedBy: createdBy, ticketNumber: "CS-TEMP" },
      { transaction }
    );

    await ticket.update({ ticketNumber: `CS-${String(ticket.id).padStart(5, "0")}` }, { transaction });

    await CustomerServiceTicketActivity.create(
      { ticketId: ticket.id, actionType: "created", toValue: "assigned", details: `Ticket created and auto-assigned`, performedBy: createdBy },
      { transaction }
    );

    await transaction.commit();

    const created = await CustomerServiceTicket.findByPk(ticket.id, {
      include: [
        ...ticketIncludes,
        {
          model: User,
          as: "assignee",
          attributes: ["id", "name", "username", "email", "customerServiceNotificationEmail", "customerServiceEmailNotificationsEnabled", "customerServiceInAppNotificationsEnabled", "isActive"],
          required: false,
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "name", "username"],
          required: false,
        },
      ],
    });

    // Notify assignee (creator) — fire and forget
    if (created.assignee && created.assignee.id !== createdBy) {
      notifyAssigned(created, created.assignee, actorName(req.user)).catch(() => {});
    }

    res.status(201).json(created);
  } catch (err) {
    await transaction.rollback();
    console.error("CS create error:", err);
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

// ─── Update ticket ────────────────────────────────────────────────────────────

router.put("/:id", auth, checkPermission("customerService", "edit"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) { await transaction.rollback(); return res.status(400).json({ error: "Invalid ticket id" }); }

    const ticket = await CustomerServiceTicket.findOne({
      where: { id, isArchived: false },
      include: [
        { model: User, as: "assignee", attributes: ["id", "name", "username", "email", "customerServiceNotificationEmail", "customerServiceEmailNotificationsEnabled", "customerServiceInAppNotificationsEnabled", "isActive"], required: false },
        { model: User, as: "creator", attributes: ["id", "name", "username", "email", "customerServiceNotificationEmail", "customerServiceEmailNotificationsEnabled", "customerServiceInAppNotificationsEnabled", "isActive"], required: false },
      ],
      transaction,
    });
    if (!ticket) { await transaction.rollback(); return res.status(404).json({ error: "Ticket not found" }); }

    if (!await canEditTicket(req, ticket)) { await transaction.rollback(); return res.status(403).json({ error: "You can only edit tickets assigned to you" }); }

    const platform = s(req.body?.platform) || ticket.platform;
    const username = s(req.body?.username) || ticket.username;
    const orderNumber = s(req.body?.orderNumber) || ticket.orderNumber;
    const issueCategory = s(req.body?.issueCategory) || ticket.issueCategory;
    const priority = s(req.body?.priority) || ticket.priority;
    const newAssignedTo = req.body?.assignedTo !== undefined ? (Number(req.body.assignedTo) || null) : ticket.assignedTo;

    if (!VALID_PLATFORMS.includes(platform)) { await transaction.rollback(); return res.status(400).json({ error: "Invalid platform" }); }
    if (!VALID_CATEGORIES.includes(issueCategory)) { await transaction.rollback(); return res.status(400).json({ error: "Invalid issueCategory" }); }
    if (!VALID_PRIORITIES.includes(priority)) { await transaction.rollback(); return res.status(400).json({ error: "Invalid priority" }); }

    // Validate new assignee (requires customerService.assign)
    if (newAssignedTo !== ticket.assignedTo) {
      const hasAssignPerm = req.user?.role === "admin" || await PermissionService.hasResourceAction(req.user, "customerService", "assign");
      if (!hasAssignPerm) { await transaction.rollback(); return res.status(403).json({ error: "You do not have permission to reassign tickets" }); }
      if (newAssignedTo) {
        const assignee = await User.findByPk(newAssignedTo, { attributes: ["id", "isActive"], transaction });
        if (!assignee?.isActive) { await transaction.rollback(); return res.status(400).json({ error: "Assigned user must exist and be active" }); }
      }
    }

    const prevPriority = ticket.priority;
    const prevAssignedTo = ticket.assignedTo;
    const prevDueAt = ticket.dueAt; // capture before update mutates the instance

    // Recalculate dueAt if priority changes; also clear overdueSentAt so the cron fires again on the new deadline
    const dueAt = priority !== prevPriority ? computeDueAt(priority) : ticket.dueAt;
    const overdueSentAt = priority !== prevPriority ? null : ticket.overdueSentAt;

    const updates = { platform, username, orderNumber, issueCategory, priority, assignedTo: newAssignedTo, dueAt, overdueSentAt, lastUpdatedBy: req.user?.id || null };
    await ticket.update(updates, { transaction });

    if (prevPriority !== priority) {
      await CustomerServiceTicketActivity.create(
        { ticketId: ticket.id, actionType: "priority_changed", fromValue: prevPriority, toValue: priority, performedBy: req.user?.id || null },
        { transaction }
      );
    }
    if (priority !== prevPriority) {
      await CustomerServiceTicketActivity.create(
        { ticketId: ticket.id, actionType: "due_date_changed", fromValue: prevDueAt?.toISOString() || "none", toValue: dueAt?.toISOString() || "none", performedBy: req.user?.id || null },
        { transaction }
      );
    }
    if (newAssignedTo !== prevAssignedTo) {
      await CustomerServiceTicketActivity.create(
        { ticketId: ticket.id, actionType: prevAssignedTo ? "reassigned" : "assigned", fromValue: String(prevAssignedTo || ""), toValue: String(newAssignedTo || ""), performedBy: req.user?.id || null },
        { transaction }
      );
    }

    await transaction.commit();

    const updated = await CustomerServiceTicket.findByPk(id, {
      include: [
        ...ticketIncludes,
        {
          model: User,
          as: "assignee",
          attributes: ["id", "name", "username", "email", "customerServiceNotificationEmail", "customerServiceEmailNotificationsEnabled", "customerServiceInAppNotificationsEnabled", "isActive"],
          required: false,
        },
      ],
    });

    if (newAssignedTo !== prevAssignedTo && updated.assignee) {
      notifyAssigned(updated, updated.assignee, actorName(req.user)).catch(() => {});
    }

    res.json(updated);
  } catch (err) {
    await transaction.rollback();
    console.error("CS update error:", err);
    res.status(500).json({ error: "Failed to update ticket" });
  }
});

// ─── Change status ────────────────────────────────────────────────────────────

router.patch("/:id/status", auth, checkPermission("customerService", "edit"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    const newStatus = s(req.body?.status);
    if (!Number.isInteger(id) || id <= 0) { await transaction.rollback(); return res.status(400).json({ error: "Invalid ticket id" }); }
    if (!VALID_STATUSES.includes(newStatus)) { await transaction.rollback(); return res.status(400).json({ error: "Invalid status" }); }

    const ticket = await CustomerServiceTicket.findOne({
      where: { id, isArchived: false },
      include: [
        { model: User, as: "assignee", attributes: ["id", "name", "username", "email", "customerServiceNotificationEmail", "customerServiceEmailNotificationsEnabled", "customerServiceInAppNotificationsEnabled", "isActive"], required: false },
        { model: User, as: "creator", attributes: ["id", "name", "username", "email", "customerServiceNotificationEmail", "customerServiceEmailNotificationsEnabled", "customerServiceInAppNotificationsEnabled", "isActive"], required: false },
      ],
      transaction,
    });
    if (!ticket) { await transaction.rollback(); return res.status(404).json({ error: "Ticket not found" }); }

    if (newStatus === "resolved") {
      const hasResolvePerm = req.user?.role === "admin" || await PermissionService.hasResourceAction(req.user, "customerService", "resolve");
      if (!hasResolvePerm) { await transaction.rollback(); return res.status(403).json({ error: "You do not have permission to resolve tickets" }); }
    } else if (ticket.status === "resolved") {
      // Reopening a resolved ticket requires resolve or assign permission
      const canReopen = req.user?.role === "admin"
        || await PermissionService.hasResourceAction(req.user, "customerService", "resolve")
        || await PermissionService.hasResourceAction(req.user, "customerService", "assign");
      if (!canReopen) { await transaction.rollback(); return res.status(403).json({ error: "Only managers can reopen a resolved ticket" }); }
    } else if (!(await canEditTicket(req, ticket))) {
      await transaction.rollback();
      return res.status(403).json({ error: "You can only change status of tickets assigned to you" });
    }

    const prevStatus = ticket.status;
    // Set resolvedAt when resolving; clear it when reopening so the ticket no longer counts as resolved
    const resolvedAt = newStatus === "resolved" ? new Date() : prevStatus === "resolved" ? null : ticket.resolvedAt;

    // Timer management:
    // - Moving TO waiting_on_customer: clear dueAt (pause the clock, we're waiting on them)
    // - Moving FROM waiting_on_customer to anything else: restart timer from now based on current priority
    let dueAt = ticket.dueAt;
    let timerChanged = false;
    if (newStatus === "waiting_on_customer") {
      dueAt = null;
      timerChanged = true;
    } else if (prevStatus === "waiting_on_customer") {
      dueAt = computeDueAt(ticket.priority);
      timerChanged = true;
    }

    // If the timer is restarting, clear overdueSentAt so the cron can fire again on the new deadline
    const overdueSentAt = timerChanged && newStatus !== "waiting_on_customer" ? null : ticket.overdueSentAt;

    await ticket.update({ status: newStatus, resolvedAt, dueAt, overdueSentAt, lastUpdatedBy: req.user?.id || null }, { transaction });
    await CustomerServiceTicketActivity.create(
      { ticketId: ticket.id, actionType: newStatus === "resolved" ? "resolved" : "status_changed", fromValue: prevStatus, toValue: newStatus, performedBy: req.user?.id || null },
      { transaction }
    );
    if (timerChanged) {
      await CustomerServiceTicketActivity.create(
        {
          ticketId: ticket.id, actionType: "due_date_changed",
          fromValue: ticket.dueAt?.toISOString() || "none",
          toValue: dueAt?.toISOString() || "none",
          details: newStatus === "waiting_on_customer" ? "Timer paused (waiting on customer)" : "Timer restarted",
          performedBy: req.user?.id || null,
        },
        { transaction }
      );
    }

    await transaction.commit();

    if (newStatus === "resolved") {
      const fresh = await CustomerServiceTicket.findByPk(id, {
        include: [
          { model: User, as: "assignee", attributes: ["id", "name", "username", "email", "customerServiceNotificationEmail", "customerServiceEmailNotificationsEnabled", "customerServiceInAppNotificationsEnabled", "isActive"], required: false },
          { model: User, as: "creator", attributes: ["id", "name", "username", "email", "customerServiceNotificationEmail", "customerServiceEmailNotificationsEnabled", "customerServiceInAppNotificationsEnabled", "isActive"], required: false },
        ],
      });
      notifyResolved(fresh, actorName(req.user)).catch(() => {});
    }

    res.json({ message: "Status updated" });
  } catch (err) {
    await transaction.rollback();
    console.error("CS status error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// ─── Add note ─────────────────────────────────────────────────────────────────

router.post("/:id/notes", auth, checkPermission("customerService", "edit"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    const note = s(req.body?.note);
    if (!Number.isInteger(id) || id <= 0) { await transaction.rollback(); return res.status(400).json({ error: "Invalid ticket id" }); }
    if (!note) { await transaction.rollback(); return res.status(400).json({ error: "Note is required" }); }

    const ticket = await CustomerServiceTicket.findOne({
      where: { id, isArchived: false },
      include: [
        { model: User, as: "assignee", attributes: ["id", "name", "username", "email", "customerServiceNotificationEmail", "customerServiceEmailNotificationsEnabled", "customerServiceInAppNotificationsEnabled", "isActive"], required: false },
        { model: User, as: "creator", attributes: ["id", "name", "username", "email", "customerServiceNotificationEmail", "customerServiceEmailNotificationsEnabled", "customerServiceInAppNotificationsEnabled", "isActive"], required: false },
      ],
      transaction,
    });
    if (!ticket) { await transaction.rollback(); return res.status(404).json({ error: "Ticket not found" }); }

    if (!(await canEditTicket(req, ticket))) {
      await transaction.rollback();
      return res.status(403).json({ error: "You can only add notes to tickets assigned to you" });
    }

    const createdNote = await CustomerServiceTicketNote.create(
      { ticketId: id, note, createdBy: req.user?.id || null },
      { transaction }
    );

    await CustomerServiceTicketActivity.create(
      { ticketId: id, actionType: "note_added", details: note.substring(0, 100), performedBy: req.user?.id || null },
      { transaction }
    );

    await ticket.update({ lastUpdatedBy: req.user?.id || null }, { transaction });

    await transaction.commit();

    notifyNoteAdded(ticket, actorName(req.user), req.user?.id).catch(() => {});

    const fullNote = await CustomerServiceTicketNote.findByPk(createdNote.id, {
      include: [{ model: User, as: "author", attributes: ["id", "name", "username"], required: false }],
    });
    res.status(201).json(fullNote);
  } catch (err) {
    await transaction.rollback();
    console.error("CS add note error:", err);
    res.status(500).json({ error: "Failed to add note" });
  }
});

// ─── Archive / cancel ─────────────────────────────────────────────────────────

router.patch("/:id/archive", auth, checkPermission("customerService", "archive"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) { await transaction.rollback(); return res.status(400).json({ error: "Invalid ticket id" }); }

    const ticket = await CustomerServiceTicket.findOne({
      where: { id, isArchived: false },
      include: [
        { model: User, as: "assignee", attributes: ["id", "name", "username", "email", "customerServiceNotificationEmail", "customerServiceEmailNotificationsEnabled", "customerServiceInAppNotificationsEnabled", "isActive"], required: false },
        { model: User, as: "creator", attributes: ["id", "name", "username", "email", "customerServiceNotificationEmail", "customerServiceEmailNotificationsEnabled", "customerServiceInAppNotificationsEnabled", "isActive"], required: false },
      ],
      transaction,
    });
    if (!ticket) { await transaction.rollback(); return res.status(404).json({ error: "Ticket not found" }); }

    const archiveReason = s(req.body?.archiveReason) || null;

    await ticket.update({
      isArchived: true, archivedAt: new Date(), archivedBy: req.user?.id || null,
      archiveReason, lastUpdatedBy: req.user?.id || null,
    }, { transaction });

    await CustomerServiceTicketActivity.create(
      { ticketId: id, actionType: "archived", details: archiveReason || "Ticket archived", performedBy: req.user?.id || null },
      { transaction }
    );

    await transaction.commit();

    const fresh = await CustomerServiceTicket.findByPk(id, {
      include: [
        { model: User, as: "assignee", attributes: ["id", "name", "username", "email", "customerServiceNotificationEmail", "customerServiceEmailNotificationsEnabled", "customerServiceInAppNotificationsEnabled", "isActive"], required: false },
        { model: User, as: "creator", attributes: ["id", "name", "username", "email", "customerServiceNotificationEmail", "customerServiceEmailNotificationsEnabled", "customerServiceInAppNotificationsEnabled", "isActive"], required: false },
      ],
    });
    notifyArchived(fresh, actorName(req.user)).catch(() => {});

    res.json({ message: "Ticket archived" });
  } catch (err) {
    await transaction.rollback();
    console.error("CS archive error:", err);
    res.status(500).json({ error: "Failed to archive ticket" });
  }
});

module.exports = router;

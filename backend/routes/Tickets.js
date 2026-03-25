const express = require("express");
const { Op, UniqueConstraintError, literal } = require("sequelize");
const {
  ReshipmentTicket,
  ReshipmentTicketItem,
  ReshipmentTicketActivity,
  User,
  sequelize,
} = require("../models");
const { auth } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permissions");

const router = express.Router();

const VALID_STATUSES = ["new", "acknowledged", "ready_to_ship", "waiting_on_item", "done"];
const VALID_PRIORITIES = ["normal", "high", "urgent"];
const STATUS_SORT_SQL = `CASE
  WHEN status = 'new' THEN 1
  WHEN status = 'acknowledged' THEN 2
  WHEN status = 'ready_to_ship' THEN 3
  WHEN status = 'waiting_on_item' THEN 4
  WHEN status = 'done' THEN 5
  ELSE 6
END`;

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

const assertOptimisticLock = (ticket, expectedUpdatedAt) => {
  if (!expectedUpdatedAt) return null;
  const dbTime = new Date(ticket.updatedAt).getTime();
  const expectedTime = new Date(expectedUpdatedAt).getTime();
  if (dbTime !== expectedTime) {
    return {
      status: 409,
      body: {
        error: "This ticket was changed by another user. Refresh and try again.",
        code: "STALE_TICKET",
      },
    };
  }
  return null;
};

const generateTicketNumber = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const sec = String(now.getSeconds()).padStart(2, "0");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `RST-${y}${m}${d}-${h}${min}${sec}-${suffix}`;
};

const buildItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      sku: sanitizeString(item?.sku) || null,
      itemName: sanitizeString(item?.itemName) || null,
      quantity: Number(item?.quantity) > 0 ? Number(item.quantity) : 1,
      notes: sanitizeString(item?.notes) || null,
    }))
    .filter((item) => item.sku || item.itemName);
};

const resolveAssigneeId = async (assignedToValue) => {
  const assignedTo = assignedToValue ? Number(assignedToValue) : null;
  if (!Number.isInteger(assignedTo) || assignedTo <= 0) {
    return null;
  }

  const assignee = await User.findByPk(assignedTo, {
    attributes: ["id", "isActive"],
  });
  if (!assignee || !assignee.isActive) {
    const error = new Error("Assigned user must exist and be active");
    error.code = "INVALID_ASSIGNEE";
    throw error;
  }

  return assignedTo;
};

const createTicketWithRetry = async (payload, transaction, maxAttempts = 5) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await ReshipmentTicket.create(
        {
          ...payload,
          ticketNumber: generateTicketNumber(),
        },
        { transaction }
      );
    } catch (error) {
      const isDuplicateTicketNumber =
        error instanceof UniqueConstraintError &&
        Array.isArray(error.errors) &&
        error.errors.some((entry) => entry.path === "ticketNumber");

      if (!isDuplicateTicketNumber || attempt === maxAttempts - 1) {
        throw error;
      }
    }
  }
  return null;
};

const ticketIncludes = [
  {
    model: ReshipmentTicketItem,
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
    as: "assignee",
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

router.get("/", auth, checkPermission("tickets", "view"), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const status = sanitizeString(req.query.status);
    const search = sanitizeString(req.query.search);

    const where = { isArchived: false };
    if (status && status !== "all" && VALID_STATUSES.includes(status)) {
      where.status = status;
    }
    if (search) {
      where[Op.or] = [
        { ticketNumber: { [Op.like]: `%${search}%` } },
        { username: { [Op.like]: `%${search}%` } },
        { orderId: { [Op.like]: `%${search}%` } },
        { trackingNumber: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await ReshipmentTicket.findAndCountAll({
      where,
      include: ticketIncludes,
      order: [
        [literal(STATUS_SORT_SQL), "ASC"],
        ["createdAt", "DESC"],
      ],
      offset,
      limit,
      distinct: true,
    });

    res.json({
      data: rows,
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

router.get("/:id", auth, checkPermission("tickets", "view"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid ticket id" });
    }

    const ticket = await ReshipmentTicket.findOne({
      where: { id, isArchived: false },
      include: [
        ...ticketIncludes,
        {
          model: ReshipmentTicketActivity,
          as: "activities",
          include: [
            {
              model: User,
              as: "actor",
              attributes: ["id", "name", "username"],
              required: false,
            },
          ],
          separate: true,
          order: [["createdAt", "DESC"]],
        },
      ],
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json(ticket);
  } catch (error) {
    console.error("Error fetching ticket detail:", error);
    res.status(500).json({ error: "Failed to fetch ticket detail" });
  }
});

router.post("/", auth, checkPermission("tickets", "create"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const username = sanitizeString(req.body?.username);
    const orderId = sanitizeString(req.body?.orderId);
    const trackingNumber = sanitizeString(req.body?.trackingNumber) || null;
    const shippingAddress = sanitizeString(req.body?.shippingAddress);
    const reason = sanitizeString(req.body?.reason) || null;
    const notes = sanitizeString(req.body?.notes) || null;
    const status = sanitizeString(req.body?.status) || "new";
    const priority = sanitizeString(req.body?.priority) || "normal";
    const needsReturnLabel = !!req.body?.needsReturnLabel;
    const assignedToValue = req.body?.assignedTo;
    const assignedTo = await resolveAssigneeId(assignedToValue);
    const items = buildItems(req.body?.items);

    if (!username || !orderId || !shippingAddress) {
      await transaction.rollback();
      return res.status(400).json({
        error: "username, orderId, and shippingAddress are required",
      });
    }
    if (!VALID_STATUSES.includes(status)) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid status" });
    }
    if (!VALID_PRIORITIES.includes(priority)) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid priority" });
    }

    const ticket = await createTicketWithRetry(
      {
        username,
        orderId,
        trackingNumber,
        shippingAddress,
        reason,
        notes,
        status,
        priority,
        needsReturnLabel,
        createdBy: req.user?.id || null,
        assignedTo,
        lastUpdatedBy: req.user?.id || null,
        closedAt: status === "done" ? new Date() : null,
      },
      transaction
    );

    if (items.length > 0) {
      await ReshipmentTicketItem.bulkCreate(
        items.map((item) => ({
          ...item,
          ticketId: ticket.id,
        })),
        { transaction }
      );
    }

    await ReshipmentTicketActivity.create(
      {
        ticketId: ticket.id,
        actionType: "created",
        toStatus: status,
        details: `Ticket created with ${items.length} item(s)`,
        createdBy: req.user?.id || null,
      },
      { transaction }
    );

    await transaction.commit();

    const created = await ReshipmentTicket.findByPk(ticket.id, {
      include: ticketIncludes,
    });
    res.status(201).json(created);
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating ticket:", error);
    if (error?.code === "INVALID_ASSIGNEE") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

router.put("/:id", auth, checkPermission("tickets", "edit"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid ticket id" });
    }

    const ticket = await ReshipmentTicket.findOne({
      where: { id, isArchived: false },
      transaction,
    });
    if (!ticket) {
      await transaction.rollback();
      return res.status(404).json({ error: "Ticket not found" });
    }

    const expectedUpdatedAt = parseExpectedUpdatedAt(req.body?.expectedUpdatedAt);
    if (sanitizeString(req.body?.expectedUpdatedAt) && !expectedUpdatedAt) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid expectedUpdatedAt" });
    }
    const lockError = assertOptimisticLock(ticket, expectedUpdatedAt);
    if (lockError) {
      await transaction.rollback();
      return res.status(lockError.status).json(lockError.body);
    }

    const username = sanitizeString(req.body?.username);
    const orderId = sanitizeString(req.body?.orderId);
    const trackingNumber = sanitizeString(req.body?.trackingNumber) || null;
    const shippingAddress = sanitizeString(req.body?.shippingAddress);
    const reason = sanitizeString(req.body?.reason) || null;
    const notes = sanitizeString(req.body?.notes) || null;
    const status = sanitizeString(req.body?.status) || ticket.status;
    const priority = sanitizeString(req.body?.priority) || ticket.priority;
    const needsReturnLabel = !!req.body?.needsReturnLabel;
    const assignedToValue = req.body?.assignedTo;
    const assignedTo = await resolveAssigneeId(assignedToValue);
    const items = buildItems(req.body?.items);

    if (!username || !orderId || !shippingAddress) {
      await transaction.rollback();
      return res.status(400).json({
        error: "username, orderId, and shippingAddress are required",
      });
    }
    if (!VALID_STATUSES.includes(status)) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid status" });
    }
    if (!VALID_PRIORITIES.includes(priority)) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid priority" });
    }

    const previousStatus = ticket.status;
    await ticket.update(
      {
        username,
        orderId,
        trackingNumber,
        shippingAddress,
        reason,
        notes,
        status,
        priority,
        needsReturnLabel,
        assignedTo,
        lastUpdatedBy: req.user?.id || null,
        closedAt: status === "done" ? ticket.closedAt || new Date() : null,
      },
      { transaction }
    );

    await ReshipmentTicketItem.destroy({
      where: { ticketId: ticket.id },
      transaction,
    });

    if (items.length > 0) {
      await ReshipmentTicketItem.bulkCreate(
        items.map((item) => ({
          ...item,
          ticketId: ticket.id,
        })),
        { transaction }
      );
    }

    await ReshipmentTicketActivity.create(
      {
        ticketId: ticket.id,
        actionType: previousStatus !== status ? "status_changed" : "updated",
        fromStatus: previousStatus !== status ? previousStatus : null,
        toStatus: status,
        details: `Ticket updated. Items now: ${items.length}`,
        createdBy: req.user?.id || null,
      },
      { transaction }
    );

    await transaction.commit();

    const updated = await ReshipmentTicket.findByPk(ticket.id, {
      include: ticketIncludes,
    });
    res.json(updated);
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating ticket:", error);
    if (error?.code === "INVALID_ASSIGNEE") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to update ticket" });
  }
});

router.patch("/:id/status", auth, checkPermission("tickets", "edit"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    const status = sanitizeString(req.body?.status);
    const note = sanitizeString(req.body?.note) || "";
    if (!Number.isInteger(id) || id <= 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid ticket id" });
    }
    if (!VALID_STATUSES.includes(status)) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid status" });
    }

    const ticket = await ReshipmentTicket.findOne({
      where: { id, isArchived: false },
      transaction,
    });
    if (!ticket) {
      await transaction.rollback();
      return res.status(404).json({ error: "Ticket not found" });
    }

    const expectedUpdatedAt = parseExpectedUpdatedAt(req.body?.expectedUpdatedAt);
    if (sanitizeString(req.body?.expectedUpdatedAt) && !expectedUpdatedAt) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid expectedUpdatedAt" });
    }
    const lockError = assertOptimisticLock(ticket, expectedUpdatedAt);
    if (lockError) {
      await transaction.rollback();
      return res.status(lockError.status).json(lockError.body);
    }

    const previousStatus = ticket.status;
    await ticket.update(
      {
        status,
        lastUpdatedBy: req.user?.id || null,
        closedAt: status === "done" ? ticket.closedAt || new Date() : null,
      },
      { transaction }
    );

    await ReshipmentTicketActivity.create(
      {
        ticketId: ticket.id,
        actionType: "status_changed",
        fromStatus: previousStatus,
        toStatus: status,
        details: note || `Status changed from ${previousStatus} to ${status}`,
        createdBy: req.user?.id || null,
      },
      { transaction }
    );

    await transaction.commit();
    res.json({ message: "Status updated successfully" });
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating ticket status:", error);
    res.status(500).json({ error: "Failed to update status" });
  }
});

router.post("/:id/comment", auth, checkPermission("tickets", "edit"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const comment = sanitizeString(req.body?.comment);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid ticket id" });
    }
    if (!comment) {
      return res.status(400).json({ error: "Comment is required" });
    }

    const ticket = await ReshipmentTicket.findOne({
      where: { id, isArchived: false },
    });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const expectedUpdatedAt = parseExpectedUpdatedAt(req.body?.expectedUpdatedAt);
    if (sanitizeString(req.body?.expectedUpdatedAt) && !expectedUpdatedAt) {
      return res.status(400).json({ error: "Invalid expectedUpdatedAt" });
    }
    const lockError = assertOptimisticLock(ticket, expectedUpdatedAt);
    if (lockError) {
      return res.status(lockError.status).json(lockError.body);
    }

    await ReshipmentTicketActivity.create({
      ticketId: ticket.id,
      actionType: "comment",
      details: comment,
      createdBy: req.user?.id || null,
    });

    await ticket.update({ lastUpdatedBy: req.user?.id || null });
    res.json({ message: "Comment added" });
  } catch (error) {
    console.error("Error adding ticket comment:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

router.delete("/:id", auth, checkPermission("tickets", "delete"), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid ticket id" });
    }

    const ticket = await ReshipmentTicket.findOne({
      where: { id, isArchived: false },
      transaction,
    });
    if (!ticket) {
      await transaction.rollback();
      return res.status(404).json({ error: "Ticket not found" });
    }

    const expectedUpdatedAt = parseExpectedUpdatedAt(req.body?.expectedUpdatedAt);
    if (sanitizeString(req.body?.expectedUpdatedAt) && !expectedUpdatedAt) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid expectedUpdatedAt" });
    }
    const lockError = assertOptimisticLock(ticket, expectedUpdatedAt);
    if (lockError) {
      await transaction.rollback();
      return res.status(lockError.status).json(lockError.body);
    }

    await ticket.update(
      {
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: req.user?.id || null,
        lastUpdatedBy: req.user?.id || null,
      },
      { transaction }
    );

    await ReshipmentTicketActivity.create(
      {
        ticketId: ticket.id,
        actionType: "updated",
        details: "Ticket archived",
        createdBy: req.user?.id || null,
      },
      { transaction }
    );

    await transaction.commit();
    res.json({ message: "Ticket archived successfully" });
  } catch (error) {
    await transaction.rollback();
    console.error("Error deleting ticket:", error);
    res.status(500).json({ error: "Failed to archive ticket" });
  }
});

module.exports = router;

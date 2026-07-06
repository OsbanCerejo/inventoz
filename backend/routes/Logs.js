const express = require("express");
const router = express.Router();
const { Logs, User } = require("../models");
const { auth } = require("../middleware/auth");
const { Op } = require("sequelize");

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
};

router.post("/addLog", async (req, res) => {
  const logData = req.body;
  try {
    const newLog = await Logs.create(logData);
    res.status(200).send({ success: true });
  } catch (error) {
    console.error("Error saving log data:", error);
    res.status(500).send({ success: false, error: "Failed to save log data" });
  }
});

router.get("/sku/:sku", auth, adminOnly, async (req, res) => {
  try {
    const { sku } = req.params;
    const { action, entityType, from, to } = req.query;

    const where = { entityId: sku };
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp[Op.gte] = new Date(from);
      if (to) where.timestamp[Op.lte] = new Date(to);
    }

    const logs = await Logs.findAll({
      where,
      order: [["timestamp", "DESC"]],
    });

    // Resolve userIds to names
    const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))];
    const users = userIds.length
      ? await User.findAll({ where: { id: userIds }, attributes: ["id", "name", "username"] })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [String(u.id), u.name || u.username]));

    const result = logs.map((l) => ({
      id: l.id,
      timestamp: l.timestamp,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      type: l.type,
      changes: l.changes,
      previousState: l.previousState,
      newState: l.newState,
      metaData: l.metaData,
      userId: l.userId,
      userName: l.userId ? (userMap[String(l.userId)] || `User #${l.userId}`) : "System",
    }));

    res.json({ sku, total: result.length, logs: result });
  } catch (err) {
    console.error("Error fetching logs:", err);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

module.exports = router;

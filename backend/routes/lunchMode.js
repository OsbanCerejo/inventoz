const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const { User } = require("../models");

// ── GET /lunch-mode/status ────────────────────────────────────────────────────
router.get("/status", auth, async (req, res) => {
  try {
    const simulate = req.query.simulate === "1";
    const user = await User.findByPk(req.user.id, {
      attributes: ["id", "role", "lunchModeEnabled", "lunchModeEnabledAt", "lunchModeEnabledBy", "lunchModeEndsAt"],
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Admins are never subject to lunch mode
    if (user.role === "admin") {
      return res.json({ enabled: false, shouldShow: false, releaseAt: null });
    }

    // Auto-release: if enabled and the end time has passed, clear it
    if (user.lunchModeEnabled && user.lunchModeEndsAt && new Date() >= new Date(user.lunchModeEndsAt)) {
      await user.update({ lunchModeEnabled: false, lunchModeEnabledAt: null, lunchModeEnabledBy: null, lunchModeEndsAt: null });
      return res.json({ enabled: false, shouldShow: false, releaseAt: null });
    }

    const enabled = simulate ? true : user.lunchModeEnabled;
    const releaseAt = simulate
      ? new Date(Date.now() + 30 * 60 * 1000).toISOString() // simulate: 30 min from now
      : (user.lunchModeEndsAt ? new Date(user.lunchModeEndsAt).toISOString() : null);

    return res.json({ enabled, shouldShow: enabled, releaseAt, simulate });
  } catch (err) {
    console.error("[LunchMode] status error:", err.message);
    return res.status(500).json({ error: "Failed to fetch lunch mode status" });
  }
});

// ── GET /lunch-mode/users ─────────────────────────────────────────────────────
router.get("/users", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  try {
    const users = await User.findAll({
      where: { isActive: true },
      attributes: ["id", "name", "username", "role", "lunchModeEnabled", "lunchModeEnabledAt", "lunchModeEnabledBy", "lunchModeEndsAt"],
      order: [["name", "ASC"]],
    });
    // Exclude admins — they can never be put in lunch mode
    return res.json(
      users
        .filter(u => u.role !== "admin")
        .map(u => ({
          id: u.id,
          name: u.name || u.username,
          username: u.username,
          role: u.role,
          lunchModeEnabled: u.lunchModeEnabled,
          lunchModeEnabledAt: u.lunchModeEnabledAt,
          lunchModeEndsAt: u.lunchModeEndsAt,
          lunchModeEnabledBy: u.lunchModeEnabledBy,
        }))
    );
  } catch (err) {
    console.error("[LunchMode] users error:", err.message);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ── POST /lunch-mode/toggle/:userId ──────────────────────────────────────────
// Body when enabling: { endsAt: ISO string }
router.post("/toggle/:userId", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  try {
    const target = await User.findByPk(Number(req.params.userId), {
      attributes: ["id", "name", "username", "role", "lunchModeEnabled"],
    });
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.role === "admin") return res.status(400).json({ error: "Cannot enable lunch mode for admins" });

    const newState = !target.lunchModeEnabled;

    let endsAt = null;
    if (newState) {
      if (!req.body.endsAt) return res.status(400).json({ error: "endsAt is required when enabling lunch mode" });
      endsAt = new Date(req.body.endsAt);
      if (isNaN(endsAt.getTime())) return res.status(400).json({ error: "endsAt is not a valid date" });
      if (endsAt <= new Date()) return res.status(400).json({ error: "endsAt must be in the future" });
    }

    await target.update({
      lunchModeEnabled: newState,
      lunchModeEnabledAt: newState ? new Date() : null,
      lunchModeEnabledBy: newState ? req.user.id : null,
      lunchModeEndsAt: newState ? endsAt : null,
    });

    console.log(`[LunchMode] Admin ${req.user.id} ${newState ? `enabled until ${endsAt?.toISOString()}` : "disabled"} lunch mode for user ${target.id} (${target.username})`);
    return res.json({ userId: target.id, lunchModeEnabled: newState, lunchModeEndsAt: endsAt });
  } catch (err) {
    console.error("[LunchMode] toggle error:", err.message);
    return res.status(500).json({ error: "Failed to toggle lunch mode" });
  }
});

// ── POST /lunch-mode/unlock ───────────────────────────────────────────────────
router.post("/unlock", auth, async (req, res) => {
  const { managerPassword, managerId } = req.body;
  if (!managerPassword) return res.status(400).json({ error: "managerPassword is required" });

  try {
    const manager = await User.findByPk(Number(managerId || req.user.id));
    if (!manager || manager.role !== "admin") {
      return res.status(403).json({ error: "Only an admin can unlock lunch mode" });
    }

    const valid = await manager.validatePassword(managerPassword);
    if (!valid) return res.status(401).json({ error: "Incorrect password" });

    const lockedUser = await User.findByPk(req.user.id);
    if (!lockedUser) return res.status(404).json({ error: "User not found" });

    await lockedUser.update({ lunchModeEnabled: false, lunchModeEnabledAt: null, lunchModeEnabledBy: null, lunchModeEndsAt: null });
    console.log(`[LunchMode] Admin ${manager.id} unlocked lunch mode for user ${lockedUser.id}`);
    return res.json({ unlocked: true });
  } catch (err) {
    console.error("[LunchMode] unlock error:", err.message);
    return res.status(500).json({ error: "Failed to unlock" });
  }
});

module.exports = router;

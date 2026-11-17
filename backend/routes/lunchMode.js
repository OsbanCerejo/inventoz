const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const { User } = require("../models");

// EST offsets
const EST_OFFSET = -5; // UTC-5; change to -4 during EDT if needed
const LUNCH_START_HOUR_EST  = 13; // 1:00 PM
const LUNCH_START_MIN_EST   = 30; // :30
const LUNCH_RELEASE_HOUR_EST = 14; // 2:00 PM

function getEstTime() {
  const now = new Date();
  const estHour = (now.getUTCHours() + 24 + EST_OFFSET) % 24;
  const estMin  = now.getUTCMinutes();
  return { estHour, estMin };
}

// True when current EST time >= 1:30 PM (lunch window open)
function isLunchWindowOpen(simulate = false) {
  if (simulate) return true;
  const { estHour, estMin } = getEstTime();
  return estHour > LUNCH_START_HOUR_EST || (estHour === LUNCH_START_HOUR_EST && estMin >= LUNCH_START_MIN_EST);
}

// True when current EST time >= 2:00 PM (auto-release)
function isPastReleaseTime(simulate = false) {
  if (simulate) return false;
  const { estHour } = getEstTime();
  return estHour >= LUNCH_RELEASE_HOUR_EST;
}

function getReleaseTime() {
  // Returns today's 2:00 PM EST as a UTC ISO string
  const now = new Date();
  const estOffset = -5;
  const utcRelease = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    LUNCH_RELEASE_HOUR_EST - estOffset, // 14 - (-5) = 19 UTC
    0, 0, 0
  ));
  // If it's already past that time today, next release is tomorrow
  if (now >= utcRelease) {
    utcRelease.setUTCDate(utcRelease.getUTCDate() + 1);
  }
  return utcRelease.toISOString();
}

// ── GET /lunch-mode/status ────────────────────────────────────────────────────
// Returns lunch mode state for the calling user.
// ?simulate=1  → pretend lunch mode is active (for testing)
router.get("/status", auth, async (req, res) => {
  try {
    const simulate = req.query.simulate === "1";
    const user = await User.findByPk(req.user.id, {
      attributes: ["id", "lunchModeEnabled", "lunchModeEnabledAt", "lunchModeEnabledBy"],
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Auto-release: if enabled but it's past 2 PM EST, clear it
    if (user.lunchModeEnabled && isPastReleaseTime(simulate)) {
      await user.update({ lunchModeEnabled: false, lunchModeEnabledAt: null, lunchModeEnabledBy: null });
      return res.json({ enabled: false, releaseAt: null, simulate: false });
    }

    const enabled = simulate ? true : user.lunchModeEnabled;
    // shouldShow = enabled — manager decides when to fire it, no time restriction
    const shouldShow = enabled;

    return res.json({
      enabled,
      shouldShow,
      enabledAt: simulate ? new Date().toISOString() : user.lunchModeEnabledAt,
      releaseAt: (simulate || user.lunchModeEnabled) ? getReleaseTime() : null,
      simulate,
    });
  } catch (err) {
    console.error("[LunchMode] status error:", err.message);
    return res.status(500).json({ error: "Failed to fetch lunch mode status" });
  }
});

// ── GET /lunch-mode/users ─────────────────────────────────────────────────────
// Admin: list all users with their lunch mode state.
router.get("/users", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  try {
    const users = await User.findAll({
      where: { isActive: true },
      attributes: ["id", "name", "username", "role", "lunchModeEnabled", "lunchModeEnabledAt", "lunchModeEnabledBy"],
      order: [["name", "ASC"]],
    });
    return res.json(users.map(u => ({
      id: u.id,
      name: u.name || u.username,
      username: u.username,
      role: u.role,
      lunchModeEnabled: u.lunchModeEnabled,
      lunchModeEnabledAt: u.lunchModeEnabledAt,
      lunchModeEnabledBy: u.lunchModeEnabledBy,
    })));
  } catch (err) {
    console.error("[LunchMode] users error:", err.message);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ── POST /lunch-mode/toggle/:userId ──────────────────────────────────────────
// Admin: enable or disable lunch mode for a user.
router.post("/toggle/:userId", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  try {
    const target = await User.findByPk(Number(req.params.userId), {
      attributes: ["id", "name", "username", "lunchModeEnabled"],
    });
    if (!target) return res.status(404).json({ error: "User not found" });

    const newState = !target.lunchModeEnabled;
    await target.update({
      lunchModeEnabled: newState,
      lunchModeEnabledAt: newState ? new Date() : null,
      lunchModeEnabledBy: newState ? req.user.id : null,
    });

    console.log(`[LunchMode] Admin ${req.user.id} ${newState ? "enabled" : "disabled"} lunch mode for user ${target.id} (${target.username})`);
    return res.json({ userId: target.id, lunchModeEnabled: newState });
  } catch (err) {
    console.error("[LunchMode] toggle error:", err.message);
    return res.status(500).json({ error: "Failed to toggle lunch mode" });
  }
});

// ── POST /lunch-mode/unlock ───────────────────────────────────────────────────
// Manager enters their own password to unlock the calling user's lunch mode.
// Body: { managerPassword: string }
router.post("/unlock", auth, async (req, res) => {
  const { managerPassword, managerId } = req.body;
  if (!managerPassword) return res.status(400).json({ error: "managerPassword is required" });

  try {
    // The person unlocking must be an admin (managers walk up and type their password)
    const manager = await User.findByPk(Number(managerId || req.user.id));
    if (!manager || manager.role !== "admin") {
      return res.status(403).json({ error: "Only an admin can unlock lunch mode" });
    }

    const valid = await manager.validatePassword(managerPassword);
    if (!valid) return res.status(401).json({ error: "Incorrect password" });

    // Unlock the calling user (the one locked out)
    const lockedUser = await User.findByPk(req.user.id);
    if (!lockedUser) return res.status(404).json({ error: "User not found" });

    await lockedUser.update({ lunchModeEnabled: false, lunchModeEnabledAt: null, lunchModeEnabledBy: null });
    console.log(`[LunchMode] Manager ${manager.id} unlocked lunch mode for user ${lockedUser.id}`);
    return res.json({ unlocked: true });
  } catch (err) {
    console.error("[LunchMode] unlock error:", err.message);
    return res.status(500).json({ error: "Failed to unlock" });
  }
});

module.exports = router;

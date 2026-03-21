const crypto = require("crypto");
const { UserSession } = require("../models");
const GeoIpService = require("./GeoIpService");
const { getClientIp, getDeviceNameFromUserAgent } = require("../utils/requestContext");

const TOUCH_INTERVAL_MS = Number(process.env.SESSION_TOUCH_INTERVAL_MS || 60000);
const touchTracker = new Map();

const shouldTouchNow = (sessionId) => {
  const now = Date.now();
  const last = touchTracker.get(sessionId) || 0;
  if (now - last < TOUCH_INTERVAL_MS) return false;
  touchTracker.set(sessionId, now);
  return true;
};

class UserSessionService {
  static async createSession(req, userId) {
    const sessionId = crypto.randomUUID();
    const ipAddress = getClientIp(req);
    const userAgent = String(req.headers["user-agent"] || "");
    const deviceName = getDeviceNameFromUserAgent(userAgent);
    const geo = await GeoIpService.lookup(ipAddress);
    const now = new Date();

    await UserSession.create({
      sessionId,
      userId,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      deviceName,
      geoCountry: geo.country,
      geoRegion: geo.region,
      geoCity: geo.city,
      geoLat: geo.lat,
      geoLng: geo.lng,
      geoSource: geo.source,
      loginAt: now,
      lastSeenAt: now,
      isActive: true,
    });

    return sessionId;
  }

  static async touchSession(sessionId) {
    const sid = String(sessionId || "").trim();
    if (!sid) return;
    if (!shouldTouchNow(sid)) return;

    try {
      await UserSession.update(
        { lastSeenAt: new Date() },
        { where: { sessionId: sid, isActive: true } }
      );
    } catch (error) {
      // Keep auth flow non-blocking.
    }
  }

  static async closeSession(sessionId) {
    const sid = String(sessionId || "").trim();
    if (!sid) return;
    touchTracker.delete(sid);
    await UserSession.update(
      { isActive: false, logoutAt: new Date() },
      { where: { sessionId: sid, isActive: true } }
    );
  }

  static async closeAllSessionsForUser(userId) {
    await UserSession.update(
      { isActive: false, logoutAt: new Date() },
      { where: { userId, isActive: true } }
    );
  }
}

module.exports = UserSessionService;


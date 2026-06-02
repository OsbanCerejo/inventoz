const express = require("express");
const { Op } = require("sequelize");
const { HbaVisitorSession, HbaTrackingEvent, HbaCartSnapshot } = require("../models");
const GeoIpService = require("../Services/GeoIpService");
const { auth } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permissions");
const { getClientIp } = require("../utils/requestContext");

const router = express.Router();

const TRACKABLE_EVENTS = new Set([
  "catalog_loaded",
  "search_used",
  "filter_changed",
  "new_arrivals_toggled",
  "sort_changed",
  "product_image_search_clicked",
  "cart_line_added",
  "cart_line_updated",
  "cart_line_removed",
  "cart_cleared",
  "cart_viewed",
  "checkout_started",
  "order_submitted",
  "submit_failed",
]);

const toStringValue = (value, maxLength = 255) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, maxLength) : "";
};

const toNullableNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPositiveInteger = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
};

const parseDateRange = (query) => {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const from = query.from ? new Date(`${query.from}T00:00:00`) : defaultFrom;
  const to = query.to ? new Date(`${query.to}T23:59:59`) : now;

  return {
    from: Number.isNaN(from.getTime()) ? defaultFrom : from,
    to: Number.isNaN(to.getTime()) ? now : to,
  };
};

const normalizeCartItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      sku: toStringValue(item?.sku, 128),
      brand: toStringValue(item?.brand, 255),
      itemName: toStringValue(item?.itemName, 255),
      quantity: toPositiveInteger(item?.quantity),
      hbaPrice: Number(toNullableNumber(item?.hbaPrice) || 0),
    }))
    .filter((item) => item.sku && item.quantity > 0);
};

const getCartSummaryFromBody = (body) => {
  const cart = body?.cart || {};
  const items = normalizeCartItems(cart.items);
  const fallbackTotal = items.reduce(
    (summary, item) => {
      summary.totalSkus += 1;
      summary.totalUnits += item.quantity;
      summary.totalPrice += item.quantity * item.hbaPrice;
      return summary;
    },
    { totalSkus: 0, totalUnits: 0, totalPrice: 0 }
  );

  return {
    items,
    totalSkus: toPositiveInteger(cart.totalSkus, fallbackTotal.totalSkus),
    totalUnits: toPositiveInteger(cart.totalUnits, fallbackTotal.totalUnits),
    totalPrice: Number(toNullableNumber(cart.totalPrice) ?? fallbackTotal.totalPrice),
  };
};

const parseDevice = (body, userAgent) => {
  const clientDevice = body?.device || {};
  let browser = toStringValue(clientDevice.browser, 64);
  let os = toStringValue(clientDevice.os, 64);
  let deviceType = toStringValue(clientDevice.deviceType, 64);

  if (!browser) {
    if (/Edg\//i.test(userAgent)) browser = "Edge";
    else if (/OPR\//i.test(userAgent)) browser = "Opera";
    else if (/Chrome\//i.test(userAgent)) browser = "Chrome";
    else if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) browser = "Safari";
    else if (/Firefox\//i.test(userAgent)) browser = "Firefox";
  }

  if (!os) {
    if (/Windows NT/i.test(userAgent)) os = "Windows";
    else if (/Mac OS X/i.test(userAgent)) os = "macOS";
    else if (/Android/i.test(userAgent)) os = "Android";
    else if (/(iPhone|iPad|iOS)/i.test(userAgent)) os = "iOS";
    else if (/Linux/i.test(userAgent)) os = "Linux";
  }

  if (!deviceType) {
    if (/Mobile|Android|iPhone/i.test(userAgent)) deviceType = "mobile";
    else if (/iPad|Tablet/i.test(userAgent)) deviceType = "tablet";
    else deviceType = "desktop";
  }

  return {
    browser: browser || "Unknown",
    os: os || "Unknown",
    deviceType,
    screenWidth: toNullableNumber(clientDevice.screenWidth),
    screenHeight: toNullableNumber(clientDevice.screenHeight),
  };
};

const upsertSession = async ({ body, req, now, eventType }) => {
  const sessionId = toStringValue(body.sessionId, 128);
  const visitorId = toStringValue(body.visitorId, 128);
  if (!sessionId || !visitorId) {
    const error = new Error("Tracking session is required.");
    error.status = 400;
    throw error;
  }

  const ipAddress = getClientIp(req);
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 2000);
  const device = parseDevice(body, userAgent);
  const [session, created] = await HbaVisitorSession.findOrCreate({
    where: { sessionId },
    defaults: {
      sessionId,
      visitorId,
      firstSeenAt: now,
      lastSeenAt: now,
      ipAddress,
      userAgent,
      ...device,
      referrer: toStringValue(body.referrer, 2000),
      landingPage: toStringValue(body.landingPage || body.pageUrl, 2000),
    },
  });

  const updates = {
    visitorId,
    lastSeenAt: now,
    ipAddress,
    userAgent,
    ...device,
    ...(eventType === "order_submitted" ? { orderSubmittedAt: now } : {}),
  };

  if (!created) {
    await session.update(updates);
  }

  if (created || !session.country) {
    GeoIpService.lookup(ipAddress)
      .then((geo) =>
        session.update({
          country: geo.country,
          region: geo.region,
          city: geo.city,
          geoSource: geo.source,
        })
      )
      .catch(() => {});
  }

  return { sessionId, visitorId };
};

router.post("/track", async (req, res) => {
  try {
    const now = new Date();
    const eventType = toStringValue(req.body?.eventType, 80);
    if (!TRACKABLE_EVENTS.has(eventType)) {
      return res.status(400).json({ error: "Unsupported HBA tracking event." });
    }

    const { sessionId, visitorId } = await upsertSession({ body: req.body || {}, req, now, eventType });
    const cartSummary = getCartSummaryFromBody(req.body || {});
    const metadata = req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {};

    await HbaTrackingEvent.create({
      sessionId,
      visitorId,
      eventType,
      sku: toStringValue(req.body?.sku, 128) || null,
      brand: toStringValue(req.body?.brand, 255) || null,
      itemName: toStringValue(req.body?.itemName, 255) || null,
      quantity: toNullableNumber(req.body?.quantity),
      searchTerm: toStringValue(req.body?.searchTerm, 255) || null,
      cartSkus: cartSummary.totalSkus,
      cartUnits: cartSummary.totalUnits,
      cartTotal: cartSummary.totalPrice.toFixed(2),
      metadata,
    });

    if (
      cartSummary.items.length > 0 ||
      eventType.startsWith("cart_") ||
      eventType === "checkout_started" ||
      eventType === "order_submitted"
    ) {
      const existingSnapshot = await HbaCartSnapshot.findOne({ where: { sessionId } });
      const snapshotPayload = {
        visitorId,
        items: cartSummary.items,
        totalSkus: cartSummary.totalSkus,
        totalUnits: cartSummary.totalUnits,
        totalPrice: cartSummary.totalPrice.toFixed(2),
        lastEventType: eventType,
        hasSubmittedOrder: eventType === "order_submitted" || Boolean(existingSnapshot?.hasSubmittedOrder),
        lastUpdatedAt: now,
      };

      if (existingSnapshot) {
        await existingSnapshot.update(snapshotPayload);
      } else {
        await HbaCartSnapshot.create({ sessionId, ...snapshotPayload });
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Error recording HBA tracking event:", error);
    return res.status(error.status || 500).json({ error: error.status ? error.message : "Failed to record tracking event." });
  }
});

const groupByCount = (rows, keyFn) => {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
};

const groupProducts = (events) => {
  const map = new Map();
  events.forEach((event) => {
    if (!event.sku) return;
    const current = map.get(event.sku) || {
      sku: event.sku,
      brand: event.brand || "",
      itemName: event.itemName || "",
      count: 0,
      quantity: 0,
    };
    current.count += 1;
    current.quantity += Number(event.quantity || 0);
    if (!current.brand && event.brand) current.brand = event.brand;
    if (!current.itemName && event.itemName) current.itemName = event.itemName;
    map.set(event.sku, current);
  });
  return Array.from(map.values()).sort((a, b) => b.count - a.count || b.quantity - a.quantity);
};

const getSnapshotItems = (snapshot) => {
  const items = snapshot.items || [];
  return Array.isArray(items) ? items : [];
};

router.get("/overview", auth, checkPermission("hbaAnalytics", "view"), async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const activeMinutes = Math.max(5, Number(req.query.activeMinutes || 1440));
    const activeSince = new Date(Date.now() - activeMinutes * 60 * 1000);

    const [sessions, events, snapshots] = await Promise.all([
      HbaVisitorSession.findAll({
        where: { firstSeenAt: { [Op.between]: [from, to] } },
        order: [["lastSeenAt", "DESC"]],
        limit: 10000,
      }),
      HbaTrackingEvent.findAll({
        where: { createdAt: { [Op.between]: [from, to] } },
        order: [["createdAt", "DESC"]],
        limit: 20000,
      }),
      HbaCartSnapshot.findAll({
        where: { lastUpdatedAt: { [Op.between]: [from, to] } },
        order: [["lastUpdatedAt", "DESC"]],
        limit: 10000,
      }),
    ]);

    const distinctSessionsForEvent = (eventType) =>
      new Set(events.filter((event) => event.eventType === eventType).map((event) => event.sessionId)).size;

    const cartSnapshots = snapshots.filter((snapshot) => Number(snapshot.totalUnits || 0) > 0);
    const activeCartRows = cartSnapshots.filter(
      (snapshot) => !snapshot.hasSubmittedOrder && new Date(snapshot.lastUpdatedAt) >= activeSince
    );
    const abandonedCartRows = cartSnapshots.filter(
      (snapshot) => !snapshot.hasSubmittedOrder && new Date(snapshot.lastUpdatedAt) < activeSince
    );
    const submittedSessions = new Set(events.filter((event) => event.eventType === "order_submitted").map((event) => event.sessionId));

    const topCartProductMap = new Map();
    cartSnapshots.forEach((snapshot) => {
      getSnapshotItems(snapshot).forEach((item) => {
        const current = topCartProductMap.get(item.sku) || {
          sku: item.sku,
          brand: item.brand || "",
          itemName: item.itemName || "",
          sessions: 0,
          units: 0,
          value: 0,
        };
        current.sessions += 1;
        current.units += Number(item.quantity || 0);
        current.value += Number(item.quantity || 0) * Number(item.hbaPrice || 0);
        topCartProductMap.set(item.sku, current);
      });
    });

    const eventJson = events.map((event) => event.toJSON());
    const sessionJson = sessions.map((session) => session.toJSON());

    return res.json({
      range: { from, to, activeMinutes },
      overview: {
        sessions: sessions.length,
        totalEvents: events.length,
        cartSessions: cartSnapshots.length,
        activeCarts: activeCartRows.length,
        abandonedCarts: abandonedCartRows.length,
        checkoutStarted: distinctSessionsForEvent("checkout_started"),
        ordersSubmitted: submittedSessions.size,
        submitFailures: events.filter((event) => event.eventType === "submit_failed").length,
        activeCartValue: activeCartRows.reduce((sum, row) => sum + Number(row.totalPrice || 0), 0),
        abandonedCartValue: abandonedCartRows.reduce((sum, row) => sum + Number(row.totalPrice || 0), 0),
      },
      funnel: [
        { label: "Visited", value: sessions.length },
        { label: "Cart Started", value: cartSnapshots.length },
        { label: "Checkout Started", value: distinctSessionsForEvent("checkout_started") },
        { label: "Order Submitted", value: submittedSessions.size },
      ],
      regions: groupByCount(sessionJson, (session) =>
        [session.city, session.region, session.country].filter(Boolean).join(", ") || "Unknown"
      ).slice(0, 20),
      devices: groupByCount(sessionJson, (session) => session.deviceType || "Unknown").slice(0, 10),
      browsers: groupByCount(sessionJson, (session) => session.browser || "Unknown").slice(0, 10),
      topImageClicks: groupProducts(eventJson.filter((event) => event.eventType === "product_image_search_clicked")).slice(0, 20),
      topCartProducts: Array.from(topCartProductMap.values())
        .sort((a, b) => b.sessions - a.sessions || b.units - a.units)
        .slice(0, 20),
      topSearchTerms: groupByCount(
        eventJson.filter((event) => event.eventType === "search_used"),
        (event) => event.searchTerm
      ).slice(0, 20),
      activeCarts: activeCartRows.slice(0, 25),
      abandonedCarts: abandonedCartRows.slice(0, 25),
      recentEvents: eventJson.slice(0, 100),
    });
  } catch (error) {
    console.error("Error loading HBA analytics overview:", error);
    return res.status(500).json({ error: "Failed to load HBA analytics." });
  }
});

module.exports = router;

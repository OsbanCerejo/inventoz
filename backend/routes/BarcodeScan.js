const express = require("express");
const router = express.Router();
const { BarcodeScan, User, WhatnotShipmentItem, TikTokShipmentItem } = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const { sequelize } = require("../models");
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

const toTableName = (model) => {
  const table = model.getTableName();
  if (typeof table === "string") return table;
  return table.tableName;
};

const TABLES = {
  scans: `\`${toTableName(BarcodeScan)}\``,
  users: `\`${toTableName(User)}\``,
};

const isDateOnly = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

const parseDateRange = (query) => {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const from = query.from ? new Date(query.from) : defaultFrom;
  let to = query.to ? new Date(query.to) : now;

  if (query.to && isDateOnly(query.to)) {
    to = new Date(to.getTime() + 24 * 60 * 60 * 1000);
  }

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return null;
  }

  return { from, to };
};

const normalizeTracking = (value) => String(value || "").trim();

const summarizeFulfillmentSource = (source, rows) => {
  const shipmentIds = [...new Set(rows.map((row) => String(row.shipmentId || "").trim()).filter(Boolean))];
  const closedRows = rows.filter((row) => Boolean(row.closedAt));
  const openRows = rows.filter((row) => !row.closedAt);

  return {
    source,
    found: rows.length > 0,
    shipmentIds,
    matchedRows: rows.length,
    closed: openRows.length === 0 && closedRows.length > 0,
    open: openRows.length > 0,
    closedRows: closedRows.length,
    openRows: openRows.length,
  };
};

const buildFulfillmentCheck = async (tracking) => {
  const normalizedTracking = normalizeTracking(tracking);
  if (!normalizedTracking) {
    return {
      tracking: normalizedTracking,
      status: "not_checked",
      alert: false,
      message: "No tracking number provided for fulfillment verification.",
      sources: [],
    };
  }

  const [whatnotRows, tiktokRows] = await Promise.all([
    WhatnotShipmentItem.findAll({
      where: { tracking: normalizedTracking },
      attributes: ["shipmentId", "tracking", "closedAt"],
      raw: true,
    }),
    TikTokShipmentItem.findAll({
      where: { tracking: normalizedTracking },
      attributes: ["shipmentId", "tracking", "closedAt"],
      raw: true,
    }),
  ]);

  const sources = [
    summarizeFulfillmentSource("whatnot", whatnotRows),
    summarizeFulfillmentSource("tiktok", tiktokRows),
  ].filter((source) => source.found);

  if (sources.length === 0) {
    return {
      tracking: normalizedTracking,
      status: "not_found",
      alert: false,
      message: "Tracking not found in Whatnot or TikTok fulfillment.",
      sources: [],
    };
  }

  const openSources = sources.filter((source) => source.open);
  if (openSources.length > 0) {
    const sourceList = openSources.map((source) => source.source).join(" and ");
    return {
      tracking: normalizedTracking,
      status: "open",
      alert: true,
      message: `Tracking exists in ${sourceList} fulfillment but is not closed yet.`,
      sources,
    };
  }

  const sourceList = sources.map((source) => source.source).join(" and ");
  return {
    tracking: normalizedTracking,
    status: "closed",
    alert: false,
    message: `Tracking is closed in ${sourceList} fulfillment.`,
    sources,
  };
};


// Simplified analytics schedule:
// Count all scans in each day, but for average/hour calculations use:
// Mon-Sat: 8h baseline, Sunday: 0h baseline.
const scheduledHoursForMySqlDay = (dayOfWeek) => {
  // MySQL DAYOFWEEK: 1=Sunday ... 7=Saturday
  if (dayOfWeek === 1) return 0;
  return 8;
};

// Save a barcode scan
router.post("/", auth, checkPermission('barcodeScan', 'create'), async (req, res) => {
  try {
    const { barcode } = req.body;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    // Use database NOW() function to get server's actual local time
    // This bypasses Sequelize timezone conversion issues
    // Capture userId from authenticated user
    const scan = await BarcodeScan.create({
      barcode: barcode.trim(),
      scannedAt: Sequelize.literal('NOW()'),
      userId: req.user.id
    });

    // Fetch the scan again with user information to get the actual stored timestamp
    const savedScan = await BarcodeScan.findByPk(scan.id, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'username', 'email']
      }]
    });
    const fulfillmentCheck = await buildFulfillmentCheck(barcode.trim());
    
    // Format timestamp to ISO string (UTC) - frontend will convert to local time
    const scannedAtDate = savedScan.scannedAt instanceof Date 
      ? savedScan.scannedAt 
      : new Date(savedScan.scannedAt);
    const formattedTime = scannedAtDate.toISOString();

    res.json({ 
      success: true, 
      scan: {
        id: savedScan.id,
        barcode: savedScan.barcode,
        scannedAt: formattedTime,
        userId: savedScan.userId,
        user: savedScan.user ? {
          id: savedScan.user.id,
          name: savedScan.user.name,
          username: savedScan.user.username
        } : null
      },
      fulfillmentCheck,
    });
  } catch (error) {
    console.error("Error saving barcode scan:", error);
    res.status(500).json({ error: "Failed to save barcode scan" });
  }
});

// Search for scans by barcode number
router.get("/search/:barcode", auth, checkPermission('barcodeScan', 'view'), async (req, res) => {
  try {
    const { barcode } = req.params;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    // Find all scans for this barcode, ordered by most recent first
    const scans = await BarcodeScan.findAll({
      where: {
        barcode: barcode.trim()
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'username', 'email']
      }],
      order: [['scannedAt', 'DESC']],
      raw: false // Ensure we get Sequelize model instances
    });

    res.json({ 
      success: true, 
      barcode: barcode.trim(),
      count: scans.length,
      scans: scans.map(scan => {
        // Format timestamp to ISO string for consistent timezone handling
        const scannedAt = scan.scannedAt instanceof Date 
          ? scan.scannedAt.toISOString() 
          : new Date(scan.scannedAt).toISOString();
        return {
          id: scan.id,
          barcode: scan.barcode,
          scannedAt: scannedAt,
          userId: scan.userId,
          user: scan.user ? {
            id: scan.user.id,
            name: scan.user.name,
            username: scan.user.username
          } : null
        };
      })
    });
  } catch (error) {
    console.error("Error searching barcode scans:", error);
    res.status(500).json({ error: "Failed to search barcode scans" });
  }
});

// Get all scans (optional, for admin viewing)
router.get("/", auth, checkPermission('barcodeScan', 'view'), async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    const scans = await BarcodeScan.findAll({
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'username', 'email']
      }],
      order: [['scannedAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      raw: false // Ensure we get Sequelize model instances
    });

    res.json({ 
      success: true, 
      count: scans.length,
      scans: scans.map(scan => {
        // Format timestamp to ISO string for consistent timezone handling
        const scannedAt = scan.scannedAt instanceof Date 
          ? scan.scannedAt.toISOString() 
          : new Date(scan.scannedAt).toISOString();
        return {
          id: scan.id,
          barcode: scan.barcode,
          scannedAt: scannedAt,
          userId: scan.userId,
          user: scan.user ? {
            id: scan.user.id,
            name: scan.user.name,
            username: scan.user.username
          } : null
        };
      })
    });
  } catch (error) {
    console.error("Error fetching barcode scans:", error);
    res.status(500).json({ error: "Failed to fetch barcode scans" });
  }
});

// Analytics: Overview KPIs
router.get("/analytics/overview", auth, checkPermission('packingAnalytics', 'view'), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const { userId } = req.query;
  const dedupedCte = `
    WITH deduped_scans AS (
      SELECT bs.*
      FROM ${TABLES.scans} bs
      INNER JOIN (
        SELECT MIN(id) AS id
        FROM ${TABLES.scans}
        WHERE scannedAt >= :from
          AND scannedAt < :to
          AND barcode IS NOT NULL
          AND TRIM(barcode) <> ''
        GROUP BY barcode
      ) d ON d.id = bs.id
    )
  `;

  try {
    const [rows] = await sequelize.query(
      `
      ${dedupedCte}
      SELECT
        COUNT(*) AS totalBoxesPacked,
        SUM(CASE WHEN DAYOFWEEK(bs.scannedAt) <> 1 THEN 1 ELSE 0 END) AS totalBoxesPackedMonSat,
        COUNT(DISTINCT bs.userId) AS activePackers,
        MIN(bs.scannedAt) AS firstScanAt,
        MAX(bs.scannedAt) AS lastScanAt
      FROM deduped_scans bs
      WHERE 1=1
        AND (:userId IS NULL OR bs.userId = :userId)
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          userId: userId ? Number(userId) : null,
        },
      }
    );

    const [activeBusinessDateRows] = await sequelize.query(
      `
      ${dedupedCte}
      SELECT
        DATE(bs.scannedAt) AS scanDate,
        DAYOFWEEK(bs.scannedAt) AS dayOfWeek,
        COUNT(*) AS boxesPacked
      FROM deduped_scans bs
      WHERE 1=1
        AND (:userId IS NULL OR bs.userId = :userId)
      GROUP BY DATE(bs.scannedAt), DAYOFWEEK(bs.scannedAt)
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          userId: userId ? Number(userId) : null,
        },
      }
    );

    const [activePackerDateRows] = await sequelize.query(
      `
      ${dedupedCte}
      SELECT
        bs.userId,
        DATE(bs.scannedAt) AS scanDate,
        DAYOFWEEK(bs.scannedAt) AS dayOfWeek
      FROM deduped_scans bs
      WHERE 1=1
        AND (:userId IS NULL OR bs.userId = :userId)
        AND bs.userId IS NOT NULL
        AND DAYOFWEEK(bs.scannedAt) <> 1
      GROUP BY bs.userId, DATE(bs.scannedAt), DAYOFWEEK(bs.scannedAt)
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          userId: userId ? Number(userId) : null,
        },
      }
    );

    const [peakRows] = await sequelize.query(
      `
      ${dedupedCte}
      SELECT
        DATE_FORMAT(bs.scannedAt, '%Y-%m-%d %H:00:00') AS hourBucket,
        COUNT(*) AS boxesPacked
      FROM deduped_scans bs
      WHERE 1=1
        AND (:userId IS NULL OR bs.userId = :userId)
      GROUP BY hourBucket
      ORDER BY boxesPacked DESC
      LIMIT 1
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          userId: userId ? Number(userId) : null,
        },
      }
    );

    const row = rows[0] || {};
    const totalBoxesPacked = Number(row.totalBoxesPacked || 0);
    const totalBoxesPackedMonSat = Number(row.totalBoxesPackedMonSat || 0);
    const monFriRows = activeBusinessDateRows.filter((r) => {
      const d = Number(r.dayOfWeek || 1);
      return d >= 2 && d <= 6;
    });
    const saturdayRows = activeBusinessDateRows.filter((r) => Number(r.dayOfWeek || 1) === 7);
    const sundayRows = activeBusinessDateRows.filter((r) => Number(r.dayOfWeek || 1) === 1);
    const activeBusinessDaysMonSat = activeBusinessDateRows.filter((r) => Number(r.dayOfWeek || 1) !== 1).length;
    const activePackerDaysMonSat = activePackerDateRows.length;
    const scheduledHoursBusinessDaysMonSat = activeBusinessDateRows.reduce(
      (sum, d) => sum + scheduledHoursForMySqlDay(Number(d.dayOfWeek || 1)),
      0
    );
    const scheduledHoursActivePackerDaysMonSat = activePackerDateRows.reduce(
      (sum, d) => sum + scheduledHoursForMySqlDay(Number(d.dayOfWeek || 1)),
      0
    );

    const avgBoxesPerBusinessDayMonSat =
      activeBusinessDaysMonSat > 0
        ? Number((totalBoxesPackedMonSat / activeBusinessDaysMonSat).toFixed(2))
        : 0;

    const avgBoxesPerActivePackerDayMonSat =
      activePackerDaysMonSat > 0
        ? Number((totalBoxesPackedMonSat / activePackerDaysMonSat).toFixed(2))
        : 0;

    const avgBoxesPerScheduledHourMonSat =
      scheduledHoursBusinessDaysMonSat > 0
        ? Number((totalBoxesPackedMonSat / scheduledHoursBusinessDaysMonSat).toFixed(2))
        : 0;

    const avgBoxesPerActivePackerScheduledHourMonSat =
      scheduledHoursActivePackerDaysMonSat > 0
        ? Number((totalBoxesPackedMonSat / scheduledHoursActivePackerDaysMonSat).toFixed(2))
        : 0;

    const monFriBoxesPacked = monFriRows.reduce((sum, r) => sum + Number(r.boxesPacked || 0), 0);
    const saturdayBoxesPacked = saturdayRows.reduce((sum, r) => sum + Number(r.boxesPacked || 0), 0);
    const sundayBoxesPacked = sundayRows.reduce((sum, r) => sum + Number(r.boxesPacked || 0), 0);

    const monFriActiveDays = monFriRows.length;
    const saturdayActiveDays = saturdayRows.length;
    const sundayActiveDays = sundayRows.length;

    const monFriAvgBoxesPerDay =
      monFriActiveDays > 0 ? Number((monFriBoxesPacked / monFriActiveDays).toFixed(2)) : 0;
    const saturdayAvgBoxesPerDay =
      saturdayActiveDays > 0 ? Number((saturdayBoxesPacked / saturdayActiveDays).toFixed(2)) : 0;
    const sundayAvgBoxesPerDay =
      sundayActiveDays > 0 ? Number((sundayBoxesPacked / sundayActiveDays).toFixed(2)) : 0;

    const monFriAvgBoxesPerHour8 =
      monFriActiveDays > 0 ? Number((monFriBoxesPacked / (monFriActiveDays * 8)).toFixed(2)) : 0;
    const saturdayAvgBoxesPerHour8 =
      saturdayActiveDays > 0 ? Number((saturdayBoxesPacked / (saturdayActiveDays * 8)).toFixed(2)) : 0;
    const sundayAvgBoxesPerHour8 =
      sundayActiveDays > 0 ? Number((sundayBoxesPacked / (sundayActiveDays * 8)).toFixed(2)) : 0;

    res.json({
      totalBoxesPacked,
      activePackers: Number(row.activePackers || 0),
      totalBoxesPackedMonSat,
      activeBusinessDaysMonSat,
      activePackerDaysMonSat,
      scheduledHoursBusinessDaysMonSat: Number(scheduledHoursBusinessDaysMonSat.toFixed(2)),
      scheduledHoursActivePackerDaysMonSat: Number(scheduledHoursActivePackerDaysMonSat.toFixed(2)),
      avgBoxesPerBusinessDayMonSat,
      avgBoxesPerActivePackerDayMonSat,
      avgBoxesPerScheduledHourMonSat,
      avgBoxesPerActivePackerScheduledHourMonSat,
      monFriBoxesPacked,
      monFriActiveDays,
      monFriAvgBoxesPerDay,
      monFriAvgBoxesPerHour8,
      saturdayBoxesPacked,
      saturdayActiveDays,
      saturdayAvgBoxesPerDay,
      saturdayAvgBoxesPerHour8,
      sundayBoxesPacked,
      sundayActiveDays,
      sundayAvgBoxesPerDay,
      sundayAvgBoxesPerHour8,
      firstScanAt: row.firstScanAt || null,
      lastScanAt: row.lastScanAt || null,
      peakHour: peakRows[0]?.hourBucket || null,
      peakHourBoxes: Number(peakRows[0]?.boxesPacked || 0),
    });
  } catch (error) {
    console.error("Error fetching barcode scan overview analytics:", error);
    res.status(500).json({ error: "Failed to fetch overview analytics" });
  }
});

// Analytics: Throughput trend
router.get("/analytics/trend", auth, checkPermission('packingAnalytics', 'view'), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });

  const { userId, granularity = "day" } = req.query;
  const dedupedCte = `
    WITH deduped_scans AS (
      SELECT bs.*
      FROM ${TABLES.scans} bs
      INNER JOIN (
        SELECT MIN(id) AS id
        FROM ${TABLES.scans}
        WHERE scannedAt >= :from
          AND scannedAt < :to
          AND barcode IS NOT NULL
          AND TRIM(barcode) <> ''
        GROUP BY barcode
      ) d ON d.id = bs.id
    )
  `;
  const bucketExpr =
    granularity === "week"
      ? "DATE_FORMAT(DATE_SUB(bs.scannedAt, INTERVAL WEEKDAY(bs.scannedAt) DAY), '%Y-%m-%d')"
      : granularity === "hour"
      ? "DATE_FORMAT(bs.scannedAt, '%Y-%m-%d %H:00:00')"
      : "DATE_FORMAT(bs.scannedAt, '%Y-%m-%d')";

  try {
    const [rows] = await sequelize.query(
      `
      ${dedupedCte}
      SELECT
        ${bucketExpr} AS bucket,
        COUNT(*) AS boxesPacked
      FROM deduped_scans bs
      WHERE 1=1
        AND (:userId IS NULL OR bs.userId = :userId)
      GROUP BY bucket
      ORDER BY bucket ASC
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          userId: userId ? Number(userId) : null,
        },
      }
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching barcode scan trend analytics:", error);
    res.status(500).json({ error: "Failed to fetch trend analytics" });
  }
});

// Analytics: Packers daily output (for comparison charts)
router.get("/analytics/packers-daily", auth, checkPermission('packingAnalytics', 'view'), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const { userId } = req.query;
  const dedupedCte = `
    WITH deduped_scans AS (
      SELECT bs.*
      FROM ${TABLES.scans} bs
      INNER JOIN (
        SELECT MIN(id) AS id
        FROM ${TABLES.scans}
        WHERE scannedAt >= :from
          AND scannedAt < :to
          AND barcode IS NOT NULL
          AND TRIM(barcode) <> ''
        GROUP BY barcode
      ) d ON d.id = bs.id
    )
  `;

  try {
    const [rows] = await sequelize.query(
      `
      ${dedupedCte}
      SELECT
        DATE_FORMAT(bs.scannedAt, '%Y-%m-%d') AS bucket,
        bs.userId,
        COALESCE(u.name, u.username, CONCAT('User ', bs.userId)) AS userLabel,
        COUNT(*) AS boxesPacked
      FROM deduped_scans bs
      LEFT JOIN ${TABLES.users} u ON u.id = bs.userId
      WHERE bs.userId IS NOT NULL
        AND (:userId IS NULL OR bs.userId = :userId)
      GROUP BY bucket, bs.userId, userLabel
      ORDER BY bucket ASC, boxesPacked DESC
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          userId: userId ? Number(userId) : null,
        },
      }
    );
    res.json(rows.map((r) => ({ ...r, boxesPacked: Number(r.boxesPacked || 0) })));
  } catch (error) {
    console.error("Error fetching barcode scan packers daily analytics:", error);
    res.status(500).json({ error: "Failed to fetch packers daily analytics" });
  }
});

// Analytics: Packers performance
router.get("/analytics/packers", auth, checkPermission('packingAnalytics', 'view'), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const { userId } = req.query;
  const dedupedCte = `
    WITH deduped_scans AS (
      SELECT bs.*
      FROM ${TABLES.scans} bs
      INNER JOIN (
        SELECT MIN(id) AS id
        FROM ${TABLES.scans}
        WHERE scannedAt >= :from
          AND scannedAt < :to
          AND barcode IS NOT NULL
          AND TRIM(barcode) <> ''
        GROUP BY barcode
      ) d ON d.id = bs.id
    )
  `;

  try {
    const [rows] = await sequelize.query(
      `
      ${dedupedCte}
      SELECT
        bs.userId,
        COALESCE(u.name, u.username, CONCAT('User ', bs.userId)) AS userLabel,
        COUNT(*) AS boxesPacked,
        MIN(bs.scannedAt) AS firstScanAt,
        MAX(bs.scannedAt) AS lastScanAt,
        ROUND(TIMESTAMPDIFF(MINUTE, MIN(bs.scannedAt), MAX(bs.scannedAt)) / 60, 2) AS activeHours
      FROM deduped_scans bs
      LEFT JOIN ${TABLES.users} u ON u.id = bs.userId
      WHERE 1=1
        AND (:userId IS NULL OR bs.userId = :userId)
      GROUP BY bs.userId, userLabel
      ORDER BY boxesPacked DESC
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          userId: userId ? Number(userId) : null,
        },
      }
    );

    const [userDayRows] = await sequelize.query(
      `
      ${dedupedCte}
      SELECT
        bs.userId,
        DATE(bs.scannedAt) AS scanDate,
        DAYOFWEEK(bs.scannedAt) AS dayOfWeek
      FROM deduped_scans bs
      WHERE 1=1
        AND (:userId IS NULL OR bs.userId = :userId)
        AND bs.userId IS NOT NULL
        AND DAYOFWEEK(bs.scannedAt) <> 1
      GROUP BY bs.userId, DATE(bs.scannedAt), DAYOFWEEK(bs.scannedAt)
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          userId: userId ? Number(userId) : null,
        },
      }
    );

    const scheduledHoursByUser = new Map();
    userDayRows.forEach((d) => {
      const uid = Number(d.userId);
      const prev = scheduledHoursByUser.get(uid) || 0;
      scheduledHoursByUser.set(
        uid,
        prev + scheduledHoursForMySqlDay(Number(d.dayOfWeek || 1))
      );
    });

    const output = rows.map((row) => {
      const boxesPacked = Number(row.boxesPacked || 0);
      const activeHours = Math.max(Number(row.activeHours || 0), 0.01);
      const scheduledHours = Number(
        (scheduledHoursByUser.get(Number(row.userId)) || 0).toFixed(2)
      );
      const boxesPerScheduledHourMonSat =
        scheduledHours > 0 ? Number((boxesPacked / scheduledHours).toFixed(2)) : 0;
      return {
        ...row,
        boxesPacked,
        activeHours,
        boxesPerHour: Number((boxesPacked / activeHours).toFixed(2)),
        scheduledHoursMonSat: scheduledHours,
        boxesPerScheduledHourMonSat,
      };
    });

    res.json(output);
  } catch (error) {
    console.error("Error fetching barcode scan packers analytics:", error);
    res.status(500).json({ error: "Failed to fetch packers analytics" });
  }
});

// Analytics: Day-of-week summary
router.get("/analytics/weekday-summary", auth, checkPermission('packingAnalytics', 'view'), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const { userId } = req.query;
  const dedupedCte = `
    WITH deduped_scans AS (
      SELECT bs.*
      FROM ${TABLES.scans} bs
      INNER JOIN (
        SELECT MIN(id) AS id
        FROM ${TABLES.scans}
        WHERE scannedAt >= :from
          AND scannedAt < :to
          AND barcode IS NOT NULL
          AND TRIM(barcode) <> ''
        GROUP BY barcode
      ) d ON d.id = bs.id
    )
  `;

  try {
    const [rows] = await sequelize.query(
      `
      ${dedupedCte}
      SELECT
        DAYOFWEEK(bs.scannedAt) AS dayIndex,
        CASE DAYOFWEEK(bs.scannedAt)
          WHEN 1 THEN 'Sunday'
          WHEN 2 THEN 'Monday'
          WHEN 3 THEN 'Tuesday'
          WHEN 4 THEN 'Wednesday'
          WHEN 5 THEN 'Thursday'
          WHEN 6 THEN 'Friday'
          WHEN 7 THEN 'Saturday'
        END AS dayName,
        COUNT(*) AS boxesPacked
      FROM deduped_scans bs
      WHERE 1=1
        AND (:userId IS NULL OR bs.userId = :userId)
      GROUP BY dayIndex, dayName
      ORDER BY dayIndex ASC
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          userId: userId ? Number(userId) : null,
        },
      }
    );

    const fullWeek = [
      { dayIndex: 1, dayName: "Sunday", boxesPacked: 0 },
      { dayIndex: 2, dayName: "Monday", boxesPacked: 0 },
      { dayIndex: 3, dayName: "Tuesday", boxesPacked: 0 },
      { dayIndex: 4, dayName: "Wednesday", boxesPacked: 0 },
      { dayIndex: 5, dayName: "Thursday", boxesPacked: 0 },
      { dayIndex: 6, dayName: "Friday", boxesPacked: 0 },
      { dayIndex: 7, dayName: "Saturday", boxesPacked: 0 },
    ];

    const map = new Map(rows.map((r) => [Number(r.dayIndex), Number(r.boxesPacked || 0)]));
    res.json(fullWeek.map((d) => ({ ...d, boxesPacked: map.get(d.dayIndex) || 0 })));
  } catch (error) {
    console.error("Error fetching barcode scan weekday analytics:", error);
    res.status(500).json({ error: "Failed to fetch weekday analytics" });
  }
});

// Analytics: Day x hour heatmap
router.get("/analytics/time-heatmap", auth, checkPermission('packingAnalytics', 'view'), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const { userId } = req.query;
  const dedupedCte = `
    WITH deduped_scans AS (
      SELECT bs.*
      FROM ${TABLES.scans} bs
      INNER JOIN (
        SELECT MIN(id) AS id
        FROM ${TABLES.scans}
        WHERE scannedAt >= :from
          AND scannedAt < :to
          AND barcode IS NOT NULL
          AND TRIM(barcode) <> ''
        GROUP BY barcode
      ) d ON d.id = bs.id
    )
  `;

  try {
    const [rows] = await sequelize.query(
      `
      ${dedupedCte}
      SELECT
        DAYOFWEEK(bs.scannedAt) AS dayIndex,
        HOUR(bs.scannedAt) AS hourOfDay,
        COUNT(*) AS boxesPacked
      FROM deduped_scans bs
      WHERE 1=1
        AND (:userId IS NULL OR bs.userId = :userId)
      GROUP BY dayIndex, hourOfDay
      ORDER BY dayIndex ASC, hourOfDay ASC
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          userId: userId ? Number(userId) : null,
        },
      }
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching barcode scan heatmap analytics:", error);
    res.status(500).json({ error: "Failed to fetch heatmap analytics" });
  }
});

// Analytics: Duplicate barcode scans
router.get("/analytics/duplicates", auth, checkPermission('packingAnalytics', 'view'), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        bs.barcode,
        COUNT(*) AS scanCount,
        COUNT(DISTINCT bs.userId) AS distinctUsers,
        MIN(bs.scannedAt) AS firstScanAt,
        MAX(bs.scannedAt) AS lastScanAt
      FROM ${TABLES.scans} bs
      WHERE bs.scannedAt >= :from
        AND bs.scannedAt < :to
      GROUP BY bs.barcode
      HAVING COUNT(*) > 1
      ORDER BY scanCount DESC, lastScanAt DESC
      LIMIT :limit
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          limit,
        },
      }
    );

    res.json(rows.map((r) => ({
      ...r,
      scanCount: Number(r.scanCount || 0),
      distinctUsers: Number(r.distinctUsers || 0),
    })));
  } catch (error) {
    console.error("Error fetching barcode scan duplicates analytics:", error);
    res.status(500).json({ error: "Failed to fetch duplicates analytics" });
  }
});

// Analytics: Duplicate scan rate by user (raw scans, non-deduped)
router.get("/analytics/duplicates-by-user", auth, checkPermission('packingAnalytics', 'view'), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const { userId } = req.query;

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        bs.userId,
        COALESCE(u.name, u.username, CONCAT('User ', bs.userId)) AS userLabel,
        COUNT(*) AS rawScans,
        COUNT(DISTINCT bs.barcode) AS uniqueBarcodes,
        COUNT(*) - COUNT(DISTINCT bs.barcode) AS duplicateExtraScans,
        CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND(((COUNT(*) - COUNT(DISTINCT bs.barcode)) / COUNT(*)) * 100, 2)
        END AS duplicateRatePct
      FROM ${TABLES.scans} bs
      LEFT JOIN ${TABLES.users} u ON u.id = bs.userId
      WHERE bs.scannedAt >= :from
        AND bs.scannedAt < :to
        AND bs.userId IS NOT NULL
        AND bs.barcode IS NOT NULL
        AND TRIM(bs.barcode) <> ''
        AND (:userId IS NULL OR bs.userId = :userId)
      GROUP BY bs.userId, userLabel
      ORDER BY duplicateRatePct DESC, duplicateExtraScans DESC
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          userId: userId ? Number(userId) : null,
        },
      }
    );

    res.json(
      rows.map((r) => ({
        ...r,
        rawScans: Number(r.rawScans || 0),
        uniqueBarcodes: Number(r.uniqueBarcodes || 0),
        duplicateExtraScans: Number(r.duplicateExtraScans || 0),
        duplicateRatePct: Number(r.duplicateRatePct || 0),
      }))
    );
  } catch (error) {
    console.error("Error fetching barcode scan duplicates by user analytics:", error);
    res.status(500).json({ error: "Failed to fetch duplicates by user analytics" });
  }
});

module.exports = router;



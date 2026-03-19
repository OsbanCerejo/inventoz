const express = require("express");
const Sequelize = require("sequelize");
const router = express.Router();
const { auth } = require("../middleware/auth");
const { sequelize, WhatnotLog, Products, ProductDetails, WhatnotShow } = require("../models");

const toTableName = (model) => {
  const table = model.getTableName();
  if (typeof table === "string") return table;
  return table.tableName;
};

const TABLES = {
  logs: `\`${toTableName(WhatnotLog)}\``,
  products: `\`${toTableName(Products)}\``,
  details: `\`${toTableName(ProductDetails)}\``,
  shows: `\`${toTableName(WhatnotShow)}\``,
};

const skuJoinCondition = (leftExpr, rightExpr) =>
  `${leftExpr} COLLATE utf8mb4_unicode_ci = ${rightExpr} COLLATE utf8mb4_unicode_ci`;

const isSaleCondition = `
  wl.status = 'found'
  AND wl.sku IS NOT NULL
  AND wl.previousQuantity IS NOT NULL
  AND wl.newQuantity = wl.previousQuantity - 1
`;

const isDateOnly = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

const parseDateRange = (query) => {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const from = query.from ? new Date(query.from) : defaultFrom;
  let to = query.to ? new Date(query.to) : now;

  // For date-only input (YYYY-MM-DD), treat "to" as end-exclusive next day
  // so selected day is fully included in analytics.
  if (query.to && isDateOnly(query.to)) {
    to = new Date(to.getTime() + 24 * 60 * 60 * 1000);
  }

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return null;
  }

  return { from, to };
};

const requireAdmin = (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Access denied. Admin only." });
    return false;
  }
  return true;
};

router.get("/overview", auth, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const { showId, sku, brand, userId } = req.query;

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        COUNT(*) AS scanAttempts,
        SUM(CASE WHEN wl.status = 'not_found' THEN 1 ELSE 0 END) AS notFoundScans,
        SUM(CASE WHEN wl.status = 'multiple_found' THEN 1 ELSE 0 END) AS multipleFoundScans,
        SUM(CASE WHEN wl.status = 'found' THEN 1 ELSE 0 END) AS foundScans,
        SUM(CASE WHEN ${isSaleCondition} THEN 1 ELSE 0 END) AS unitsSold,
        COUNT(DISTINCT CASE WHEN ${isSaleCondition} THEN wl.sku END) AS uniqueSkusSold,
        COUNT(DISTINCT CASE WHEN ${isSaleCondition} THEN wl.whatnotShowId END) AS uniqueShowsWithSales
      FROM ${TABLES.logs} wl
      LEFT JOIN ${TABLES.products} p ON ${skuJoinCondition("p.sku", "wl.sku")}
      WHERE wl.createdAt >= :from
        AND wl.createdAt < :to
        AND (:showId IS NULL OR wl.whatnotShowId = :showId)
        AND (:sku IS NULL OR wl.sku = :sku)
        AND (:brand IS NULL OR p.brand = :brand)
        AND (:userId IS NULL OR wl.userId = :userId)
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          showId: showId ? Number(showId) : null,
          sku: sku || null,
          brand: brand || null,
          userId: userId || null,
        },
      }
    );

    const row = rows[0] || {};
    const scanAttempts = Number(row.scanAttempts || 0);
    const unitsSold = Number(row.unitsSold || 0);

    res.json({
      ...row,
      scanAttempts,
      unitsSold,
      successRate: scanAttempts > 0 ? Number(((unitsSold / scanAttempts) * 100).toFixed(2)) : 0,
    });
  } catch (error) {
    console.error("Error fetching whatnot analytics overview:", error);
    res.status(500).json({ error: "Failed to fetch overview analytics" });
  }
});

router.get("/trend", auth, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const { showId, brand, granularity = "day" } = req.query;
  const bucketExpr =
    granularity === "month"
      ? "DATE_FORMAT(wl.createdAt, '%Y-%m-01')"
      : granularity === "week"
      ? "DATE_FORMAT(DATE_SUB(wl.createdAt, INTERVAL WEEKDAY(wl.createdAt) DAY), '%Y-%m-%d')"
      : "DATE_FORMAT(wl.createdAt, '%Y-%m-%d')";

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        ${bucketExpr} AS bucket,
        COUNT(*) AS scanAttempts,
        SUM(CASE WHEN ${isSaleCondition} THEN 1 ELSE 0 END) AS unitsSold
      FROM ${TABLES.logs} wl
      LEFT JOIN ${TABLES.products} p ON ${skuJoinCondition("p.sku", "wl.sku")}
      WHERE wl.createdAt >= :from
        AND wl.createdAt < :to
        AND (:showId IS NULL OR wl.whatnotShowId = :showId)
        AND (:brand IS NULL OR p.brand = :brand)
      GROUP BY bucket
      ORDER BY bucket ASC
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          showId: showId ? Number(showId) : null,
          brand: brand || null,
        },
      }
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching whatnot trend analytics:", error);
    res.status(500).json({ error: "Failed to fetch trend analytics" });
  }
});

router.get("/shows-performance", auth, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        ws.id AS showId,
        ws.name AS showName,
        COUNT(*) AS scanAttempts,
        SUM(CASE WHEN wl.status = 'found' THEN 1 ELSE 0 END) AS foundScans,
        SUM(CASE WHEN ${isSaleCondition} THEN 1 ELSE 0 END) AS unitsSold,
        SUM(CASE WHEN wl.status = 'not_found' THEN 1 ELSE 0 END) AS notFoundScans,
        SUM(CASE WHEN wl.status = 'multiple_found' THEN 1 ELSE 0 END) AS multipleFoundScans
      FROM ${TABLES.logs} wl
      JOIN ${TABLES.shows} ws ON ws.id = wl.whatnotShowId
      WHERE wl.createdAt >= :from
        AND wl.createdAt < :to
      GROUP BY ws.id, ws.name
      ORDER BY unitsSold DESC, scanAttempts DESC
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
        },
      }
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching show performance analytics:", error);
    res.status(500).json({ error: "Failed to fetch show performance analytics" });
  }
});

router.get("/shows-hourly", auth, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const showId = Number(req.query.showId);
  if (Number.isNaN(showId) || showId <= 0) {
    return res.status(400).json({ error: "showId is required" });
  }

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        HOUR(wl.createdAt) AS hourOfDay,
        COUNT(*) AS scanAttempts,
        SUM(CASE WHEN wl.status = 'found' THEN 1 ELSE 0 END) AS foundScans,
        SUM(CASE WHEN wl.status = 'not_found' THEN 1 ELSE 0 END) AS notFoundScans,
        SUM(CASE WHEN wl.status = 'multiple_found' THEN 1 ELSE 0 END) AS multipleFoundScans,
        SUM(CASE WHEN ${isSaleCondition} THEN 1 ELSE 0 END) AS unitsSold
      FROM ${TABLES.logs} wl
      WHERE wl.whatnotShowId = :showId
        AND wl.createdAt >= :from
        AND wl.createdAt < :to
      GROUP BY HOUR(wl.createdAt)
      ORDER BY hourOfDay ASC
      `,
      {
        replacements: {
          showId,
          from: range.from,
          to: range.to,
        },
      }
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching show hourly analytics:", error);
    res.status(500).json({ error: "Failed to fetch show hourly analytics" });
  }
});

router.get("/shows-top-skus", auth, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const showId = Number(req.query.showId);
  if (Number.isNaN(showId) || showId <= 0) {
    return res.status(400).json({ error: "showId is required" });
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        wl.sku,
        p.brand,
        p.itemName,
        p.strength,
        p.sizeOz,
        p.sizeMl,
        p.\`condition\`,
        pd.tester,
        COUNT(*) AS unitsSold
      FROM ${TABLES.logs} wl
      JOIN ${TABLES.products} p ON ${skuJoinCondition("p.sku", "wl.sku")}
      LEFT JOIN ${TABLES.details} pd ON ${skuJoinCondition("pd.sku", "p.sku")}
      WHERE wl.whatnotShowId = :showId
        AND wl.createdAt >= :from
        AND wl.createdAt < :to
        AND ${isSaleCondition}
      GROUP BY wl.sku, p.brand, p.itemName, p.strength, p.sizeOz, p.sizeMl, p.\`condition\`, pd.tester
      ORDER BY unitsSold DESC
      LIMIT :limit
      `,
      {
        replacements: {
          showId,
          from: range.from,
          to: range.to,
          limit,
        },
      }
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching show top SKU analytics:", error);
    res.status(500).json({ error: "Failed to fetch show top SKU analytics" });
  }
});

router.get("/products-top", auth, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const { showId, brand } = req.query;
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 200);

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        wl.sku,
        p.brand,
        p.itemName,
        p.strength,
        p.sizeOz,
        p.sizeMl,
        p.\`condition\`,
        pd.tester,
        COUNT(*) AS unitsSold
      FROM ${TABLES.logs} wl
      JOIN ${TABLES.products} p ON ${skuJoinCondition("p.sku", "wl.sku")}
      LEFT JOIN ${TABLES.details} pd ON ${skuJoinCondition("pd.sku", "p.sku")}
      WHERE wl.createdAt >= :from
        AND wl.createdAt < :to
        AND ${isSaleCondition}
        AND (:showId IS NULL OR wl.whatnotShowId = :showId)
        AND (:brand IS NULL OR p.brand = :brand)
      GROUP BY wl.sku, p.brand, p.itemName, p.strength, p.sizeOz, p.sizeMl, p.\`condition\`, pd.tester
      ORDER BY unitsSold DESC
      LIMIT :limit
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          showId: showId ? Number(showId) : null,
          brand: brand || null,
          limit,
        },
      }
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching top products analytics:", error);
    res.status(500).json({ error: "Failed to fetch top products analytics" });
  }
});

router.get("/products-pareto", auth, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const { showId, brand } = req.query;
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        wl.sku,
        p.brand,
        p.itemName,
        COUNT(*) AS unitsSold
      FROM ${TABLES.logs} wl
      JOIN ${TABLES.products} p ON ${skuJoinCondition("p.sku", "wl.sku")}
      WHERE wl.createdAt >= :from
        AND wl.createdAt < :to
        AND ${isSaleCondition}
        AND (:showId IS NULL OR wl.whatnotShowId = :showId)
        AND (:brand IS NULL OR p.brand = :brand)
      GROUP BY wl.sku, p.brand, p.itemName
      ORDER BY unitsSold DESC
      LIMIT :limit
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          showId: showId ? Number(showId) : null,
          brand: brand || null,
          limit,
        },
      }
    );

    const totalUnits = rows.reduce((sum, row) => sum + Number(row.unitsSold || 0), 0);
    let running = 0;
    const output = rows.map((row) => {
      running += Number(row.unitsSold || 0);
      return {
        ...row,
        cumulativeUnits: running,
        cumulativePct: totalUnits > 0 ? Number(((running / totalUnits) * 100).toFixed(2)) : 0,
      };
    });

    res.json({
      totalUnits,
      rows: output,
    });
  } catch (error) {
    console.error("Error fetching products pareto analytics:", error);
    res.status(500).json({ error: "Failed to fetch products pareto analytics" });
  }
});

router.get("/products-brand-contribution", auth, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const { showId } = req.query;
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        COALESCE(p.brand, 'Unknown') AS brand,
        COUNT(*) AS unitsSold
      FROM ${TABLES.logs} wl
      LEFT JOIN ${TABLES.products} p ON ${skuJoinCondition("p.sku", "wl.sku")}
      WHERE wl.createdAt >= :from
        AND wl.createdAt < :to
        AND ${isSaleCondition}
        AND (:showId IS NULL OR wl.whatnotShowId = :showId)
      GROUP BY COALESCE(p.brand, 'Unknown')
      ORDER BY unitsSold DESC
      LIMIT :limit
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          showId: showId ? Number(showId) : null,
          limit,
        },
      }
    );

    const totalUnits = rows.reduce((sum, row) => sum + Number(row.unitsSold || 0), 0);
    res.json({
      totalUnits,
      rows: rows.map((row) => ({
        ...row,
        pct: totalUnits > 0 ? Number(((Number(row.unitsSold || 0) / totalUnits) * 100).toFixed(2)) : 0,
      })),
    });
  } catch (error) {
    console.error("Error fetching products brand contribution analytics:", error);
    res.status(500).json({ error: "Failed to fetch products brand contribution analytics" });
  }
});

router.get("/products-velocity", auth, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const { showId, brand } = req.query;
  const limit = Math.min(Math.max(Number(req.query.limit) || 15, 1), 50);
  const granularity = req.query.granularity === "week" ? "week" : "day";
  const bucketExpr =
    granularity === "week"
      ? "DATE_FORMAT(DATE_SUB(wl.createdAt, INTERVAL WEEKDAY(wl.createdAt) DAY), '%Y-%m-%d')"
      : "DATE_FORMAT(wl.createdAt, '%Y-%m-%d')";

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        p.sku,
        p.brand,
        p.itemName,
        ${bucketExpr} AS bucket,
        COUNT(*) AS unitsSold,
        MAX(top.totalUnits) AS totalUnits
      FROM ${TABLES.logs} wl
      JOIN ${TABLES.products} p ON ${skuJoinCondition("p.sku", "wl.sku")}
      JOIN (
        SELECT
          wl2.sku,
          COUNT(*) AS totalUnits
        FROM ${TABLES.logs} wl2
        LEFT JOIN ${TABLES.products} p2 ON ${skuJoinCondition("p2.sku", "wl2.sku")}
        WHERE wl2.createdAt >= :from
          AND wl2.createdAt < :to
          AND ${isSaleCondition.replaceAll("wl.", "wl2.")}
          AND (:showId IS NULL OR wl2.whatnotShowId = :showId)
          AND (:brand IS NULL OR p2.brand = :brand)
        GROUP BY wl2.sku
        ORDER BY totalUnits DESC
        LIMIT :limit
      ) top ON ${skuJoinCondition("top.sku", "wl.sku")}
      WHERE wl.createdAt >= :from
        AND wl.createdAt < :to
        AND ${isSaleCondition}
        AND (:showId IS NULL OR wl.whatnotShowId = :showId)
        AND (:brand IS NULL OR p.brand = :brand)
      GROUP BY p.sku, p.brand, p.itemName, bucket
      ORDER BY totalUnits DESC, bucket ASC
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          showId: showId ? Number(showId) : null,
          brand: brand || null,
          limit,
        },
      }
    );

    const bySku = new Map();
    for (const row of rows) {
      const sku = row.sku;
      if (!bySku.has(sku)) {
        bySku.set(sku, {
          sku,
          brand: row.brand,
          itemName: row.itemName,
          totalUnits: Number(row.totalUnits || 0),
          points: [],
        });
      }
      bySku.get(sku).points.push({
        bucket: row.bucket,
        unitsSold: Number(row.unitsSold || 0),
      });
    }

    const output = Array.from(bySku.values()).sort(
      (a, b) => Number(b.totalUnits || 0) - Number(a.totalUnits || 0)
    );

    res.json(output);
  } catch (error) {
    console.error("Error fetching products velocity analytics:", error);
    res.status(500).json({ error: "Failed to fetch products velocity analytics" });
  }
});

router.get("/products-day-of-week", auth, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const { showId, brand } = req.query;

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        DAYOFWEEK(wl.createdAt) AS dayIndex,
        CASE DAYOFWEEK(wl.createdAt)
          WHEN 1 THEN 'Sunday'
          WHEN 2 THEN 'Monday'
          WHEN 3 THEN 'Tuesday'
          WHEN 4 THEN 'Wednesday'
          WHEN 5 THEN 'Thursday'
          WHEN 6 THEN 'Friday'
          WHEN 7 THEN 'Saturday'
        END AS dayName,
        COUNT(*) AS unitsSold
      FROM ${TABLES.logs} wl
      LEFT JOIN ${TABLES.products} p ON ${skuJoinCondition("p.sku", "wl.sku")}
      WHERE wl.createdAt >= :from
        AND wl.createdAt < :to
        AND ${isSaleCondition}
        AND (:showId IS NULL OR wl.whatnotShowId = :showId)
        AND (:brand IS NULL OR p.brand = :brand)
      GROUP BY dayIndex, dayName
      ORDER BY dayIndex ASC
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          showId: showId ? Number(showId) : null,
          brand: brand || null,
        },
      }
    );

    const fullWeek = [
      { dayIndex: 1, dayName: "Sunday", unitsSold: 0 },
      { dayIndex: 2, dayName: "Monday", unitsSold: 0 },
      { dayIndex: 3, dayName: "Tuesday", unitsSold: 0 },
      { dayIndex: 4, dayName: "Wednesday", unitsSold: 0 },
      { dayIndex: 5, dayName: "Thursday", unitsSold: 0 },
      { dayIndex: 6, dayName: "Friday", unitsSold: 0 },
      { dayIndex: 7, dayName: "Saturday", unitsSold: 0 },
    ];

    const unitsByIndex = new Map(
      rows.map((row) => [Number(row.dayIndex), Number(row.unitsSold || 0)])
    );

    const output = fullWeek.map((row) => ({
      ...row,
      unitsSold: unitsByIndex.get(row.dayIndex) || 0,
    }));

    res.json(output);
  } catch (error) {
    console.error("Error fetching products day-of-week analytics:", error);
    res.status(500).json({ error: "Failed to fetch products day-of-week analytics" });
  }
});

router.get("/products-sku-trend", auth, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const sku = req.query.sku;
  const granularity = req.query.granularity === "week" ? "week" : "day";
  const { showId } = req.query;

  if (!sku || typeof sku !== "string") {
    return res.status(400).json({ error: "sku is required" });
  }

  const bucketExpr =
    granularity === "week"
      ? "DATE_FORMAT(DATE_SUB(wl.createdAt, INTERVAL WEEKDAY(wl.createdAt) DAY), '%Y-%m-%d')"
      : "DATE_FORMAT(wl.createdAt, '%Y-%m-%d')";

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        ${bucketExpr} AS bucket,
        COUNT(*) AS unitsSold
      FROM ${TABLES.logs} wl
      WHERE wl.createdAt >= :from
        AND wl.createdAt < :to
        AND ${isSaleCondition}
        AND wl.sku COLLATE utf8mb4_unicode_ci = :sku COLLATE utf8mb4_unicode_ci
        AND (:showId IS NULL OR wl.whatnotShowId = :showId)
      GROUP BY bucket
      ORDER BY bucket ASC
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          sku,
          showId: showId ? Number(showId) : null,
        },
      }
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching SKU trend analytics:", error);
    res.status(500).json({ error: "Failed to fetch SKU trend analytics" });
  }
});

router.get("/brand-mix", auth, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const { showId } = req.query;
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        COALESCE(p.brand, 'Unknown') AS brand,
        COUNT(*) AS unitsSold
      FROM ${TABLES.logs} wl
      LEFT JOIN ${TABLES.products} p ON ${skuJoinCondition("p.sku", "wl.sku")}
      WHERE wl.createdAt >= :from
        AND wl.createdAt < :to
        AND ${isSaleCondition}
        AND (:showId IS NULL OR wl.whatnotShowId = :showId)
      GROUP BY COALESCE(p.brand, 'Unknown')
      ORDER BY unitsSold DESC
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          showId: showId ? Number(showId) : null,
        },
      }
    );

    const normalizedRows = (rows || []).map((row) => ({
      brand: row.brand,
      unitsSold: Number(row.unitsSold || 0),
    }));

    const totalUnits = normalizedRows.reduce((sum, row) => sum + row.unitsSold, 0);
    const topRows = normalizedRows.slice(0, limit);
    const otherUnits = normalizedRows
      .slice(limit)
      .reduce((sum, row) => sum + row.unitsSold, 0);

    const output = [...topRows];
    if (otherUnits > 0) {
      output.push({ brand: "Other", unitsSold: otherUnits });
    }

    res.json({
      totalUnits,
      rows: output.map((row) => ({
        ...row,
        pct: totalUnits > 0 ? Number(((row.unitsSold / totalUnits) * 100).toFixed(2)) : 0,
      })),
    });
  } catch (error) {
    console.error("Error fetching brand mix analytics:", error);
    res.status(500).json({ error: "Failed to fetch brand mix analytics" });
  }
});

router.get("/operations-users", auth, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const { showId } = req.query;

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        wl.userId,
        COUNT(*) AS scanAttempts,
        SUM(CASE WHEN ${isSaleCondition} THEN 1 ELSE 0 END) AS unitsSold,
        SUM(CASE WHEN wl.status IN ('not_found', 'multiple_found') THEN 1 ELSE 0 END) AS issueScans
      FROM ${TABLES.logs} wl
      WHERE wl.createdAt >= :from
        AND wl.createdAt < :to
        AND (:showId IS NULL OR wl.whatnotShowId = :showId)
      GROUP BY wl.userId
      ORDER BY unitsSold DESC
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          showId: showId ? Number(showId) : null,
        },
      }
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching operations analytics:", error);
    res.status(500).json({ error: "Failed to fetch operations analytics" });
  }
});

router.get("/operations-user-hourly", auth, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const { showId, userId } = req.query;

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        HOUR(wl.createdAt) AS hourOfDay,
        COUNT(*) AS scanAttempts,
        SUM(CASE WHEN ${isSaleCondition} THEN 1 ELSE 0 END) AS unitsSold,
        SUM(CASE WHEN wl.status IN ('not_found', 'multiple_found') THEN 1 ELSE 0 END) AS issueScans
      FROM ${TABLES.logs} wl
      WHERE wl.createdAt >= :from
        AND wl.createdAt < :to
        AND (:showId IS NULL OR wl.whatnotShowId = :showId)
        AND (:userId IS NULL OR wl.userId = :userId)
      GROUP BY HOUR(wl.createdAt)
      ORDER BY hourOfDay ASC
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          showId: showId ? Number(showId) : null,
          userId: userId || null,
        },
      }
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching operations hourly analytics:", error);
    res.status(500).json({ error: "Failed to fetch operations hourly analytics" });
  }
});

router.get("/operations-errors-trend", auth, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const { showId, userId, granularity = "day" } = req.query;
  const bucketExpr =
    granularity === "week"
      ? "DATE_FORMAT(DATE_SUB(wl.createdAt, INTERVAL WEEKDAY(wl.createdAt) DAY), '%Y-%m-%d')"
      : "DATE_FORMAT(wl.createdAt, '%Y-%m-%d')";

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        ${bucketExpr} AS bucket,
        SUM(CASE WHEN wl.status = 'not_found' THEN 1 ELSE 0 END) AS notFoundScans,
        SUM(CASE WHEN wl.status = 'multiple_found' THEN 1 ELSE 0 END) AS multipleFoundScans,
        SUM(CASE WHEN wl.status IN ('not_found', 'multiple_found') THEN 1 ELSE 0 END) AS totalIssueScans
      FROM ${TABLES.logs} wl
      WHERE wl.createdAt >= :from
        AND wl.createdAt < :to
        AND (:showId IS NULL OR wl.whatnotShowId = :showId)
        AND (:userId IS NULL OR wl.userId = :userId)
      GROUP BY bucket
      ORDER BY bucket ASC
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          showId: showId ? Number(showId) : null,
          userId: userId || null,
        },
      }
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching operations error trend analytics:", error);
    res.status(500).json({ error: "Failed to fetch operations error trend analytics" });
  }
});

router.get("/operations-errors-table", auth, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const { showId, userId, status } = req.query;
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

  const allowedStatus = ["not_found", "multiple_found"];
  const statusFilter = allowedStatus.includes(String(status)) ? status : null;

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        wl.id,
        wl.createdAt,
        wl.userId,
        wl.whatnotShowId,
        wl.barcode,
        wl.sku,
        wl.status,
        wl.errors,
        ws.name AS showName
      FROM ${TABLES.logs} wl
      LEFT JOIN ${TABLES.shows} ws ON ws.id = wl.whatnotShowId
      WHERE wl.createdAt >= :from
        AND wl.createdAt < :to
        AND wl.status IN ('not_found', 'multiple_found')
        AND (:statusFilter IS NULL OR wl.status = :statusFilter)
        AND (:showId IS NULL OR wl.whatnotShowId = :showId)
        AND (:userId IS NULL OR wl.userId = :userId)
      ORDER BY wl.createdAt DESC, wl.id DESC
      LIMIT :limit
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          statusFilter,
          showId: showId ? Number(showId) : null,
          userId: userId || null,
          limit,
        },
      }
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching operations error table analytics:", error);
    res.status(500).json({ error: "Failed to fetch operations error table analytics" });
  }
});

router.get("/inventory-risk", auth, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const { showId, brand } = req.query;
  const lookbackDays = Math.min(Math.max(Number(req.query.lookbackDays) || 14, 1), 90);
  const lookbackFrom = new Date(range.to);
  lookbackFrom.setDate(lookbackFrom.getDate() - lookbackDays);

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        p.sku,
        p.brand,
        p.itemName,
        p.quantity AS currentQty,
        COALESCE(s.unitsSold, 0) AS unitsSoldLookback,
        ROUND(COALESCE(s.unitsSold, 0) / :lookbackDays, 2) AS avgDailySales,
        CASE
          WHEN COALESCE(s.unitsSold, 0) = 0 THEN NULL
          ELSE ROUND(p.quantity / (s.unitsSold / :lookbackDays), 1)
        END AS daysOfCover
      FROM ${TABLES.products} p
      LEFT JOIN (
        SELECT
          wl.sku,
          COUNT(*) AS unitsSold
        FROM ${TABLES.logs} wl
        WHERE wl.createdAt >= :lookbackFrom
          AND wl.createdAt < :toDate
          AND ${isSaleCondition}
          AND (:showId IS NULL OR wl.whatnotShowId = :showId)
        GROUP BY wl.sku
      ) s ON ${skuJoinCondition("s.sku", "p.sku")}
      WHERE (:brand IS NULL OR p.brand = :brand)
      ORDER BY
        CASE
          WHEN COALESCE(s.unitsSold, 0) = 0 THEN 999999
          ELSE p.quantity / (s.unitsSold / :lookbackDays)
        END ASC,
        unitsSoldLookback DESC
      LIMIT 200
      `,
      {
        replacements: {
          toDate: range.to,
          lookbackFrom,
          lookbackDays,
          showId: showId ? Number(showId) : null,
          brand: brand || null,
        },
      }
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching inventory risk analytics:", error);
    res.status(500).json({ error: "Failed to fetch inventory risk analytics" });
  }
});

module.exports = router;

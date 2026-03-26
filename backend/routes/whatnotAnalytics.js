const express = require("express");
const Sequelize = require("sequelize");
const router = express.Router();
const { auth } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permissions");
const {
  sequelize,
  WhatnotLog,
  Products,
  ProductDetails,
  WhatnotShow,
  WhatnotShipmentItem,
  WhatnotShipmentScan,
  WhatnotShipmentImport,
} = require("../models");

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
  shipmentItems: `\`${toTableName(WhatnotShipmentItem)}\``,
  shipmentScans: `\`${toTableName(WhatnotShipmentScan)}\``,
  shipmentImports: `\`${toTableName(WhatnotShipmentImport)}\``,
};

const skuJoinCondition = (leftExpr, rightExpr) =>
  `${leftExpr} COLLATE utf8mb4_unicode_ci = ${rightExpr} COLLATE utf8mb4_unicode_ci`;

const isSaleCondition = `
  wl.status = 'found'
  AND wl.sku IS NOT NULL
  AND wl.previousQuantity IS NOT NULL
  AND wl.newQuantity = wl.previousQuantity - 1
`;

const fulfilledSaleCondition = (alias = "wss") => `
  ${alias}.result = 'matched'
  AND ${alias}.productSku IS NOT NULL
  AND ${alias}.productSku <> ''
  AND ${alias}.previousQuantity IS NOT NULL
  AND ${alias}.newQuantity = ${alias}.previousQuantity - 1
`;

const SHIPMENT_CLOSE_SUMMARY_SUBQUERY = `
  (
    SELECT
      whatnotShowId,
      importId,
      shipmentId,
      MAX(closedAt) AS closedAt,
      MAX(closedBy) AS closedBy,
      MAX(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) AS hasPendingReview,
      MAX(createdAt) AS importedAt
    FROM ${TABLES.shipmentItems}
    GROUP BY whatnotShowId, importId, shipmentId
  )
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

router.get("/fulfillment-overview", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const showId = req.query.showId ? Number(req.query.showId) : null;

  try {
    const [[salesRows], [pipelineRows]] = await Promise.all([
      sequelize.query(
        `
        SELECT
          COUNT(*) AS unitsSold,
          COALESCE(SUM(COALESCE(wss.soldPrice, 0)), 0) AS revenue,
          COUNT(DISTINCT CONCAT(wss.whatnotShowId, ':', wss.importId, ':', wss.shipmentId)) AS completedShipments,
          COUNT(DISTINCT wss.productSku) AS uniqueSkusSold,
          COUNT(DISTINCT wss.whatnotShowId) AS uniqueShows
        FROM ${TABLES.shipmentScans} wss
        JOIN ${SHIPMENT_CLOSE_SUMMARY_SUBQUERY} sc
          ON sc.whatnotShowId = wss.whatnotShowId
         AND sc.importId = wss.importId
         AND sc.shipmentId = wss.shipmentId
        WHERE ${fulfilledSaleCondition("wss")}
          AND sc.closedAt >= :from
          AND sc.closedAt < :to
          AND (:showId IS NULL OR wss.whatnotShowId = :showId)
        `,
        {
          replacements: {
            from: range.from,
            to: range.to,
            showId,
          },
        }
      ),
      sequelize.query(
        `
        SELECT
          COUNT(DISTINCT CASE WHEN itemStatus = 'ready' OR itemStatus = 'in_progress' THEN shipmentKey END) AS pendingShipments,
          COALESCE(SUM(CASE WHEN itemStatus = 'ready' OR itemStatus = 'in_progress' THEN rowRevenue ELSE 0 END), 0) AS pendingRevenue,
          COUNT(DISTINCT CASE WHEN itemStatus = 'pending_review' THEN shipmentKey END) AS reviewShipments,
          COALESCE(SUM(CASE WHEN itemStatus = 'pending_review' THEN rowRevenue ELSE 0 END), 0) AS reviewRevenue
        FROM (
          SELECT
            CONCAT(wsi.whatnotShowId, ':', wsi.importId, ':', wsi.shipmentId) AS shipmentKey,
            wsi.status AS itemStatus,
            COALESCE(
              wsi.totalCost,
              CASE
                WHEN wsi.soldPrice IS NOT NULL THEN COALESCE(wsi.soldPrice, 0) * COALESCE(wsi.expectedQty, 0)
                ELSE 0
              END
            ) AS rowRevenue
          FROM ${TABLES.shipmentItems} wsi
          WHERE wsi.closedAt IS NULL
            AND (:showId IS NULL OR wsi.whatnotShowId = :showId)
        ) pendingRows
        `,
        {
          replacements: {
            showId,
          },
        }
      ),
    ]);

    const salesRow = Array.isArray(salesRows) ? salesRows[0] || {} : salesRows || {};
    const pipelineRow = Array.isArray(pipelineRows) ? pipelineRows[0] || {} : pipelineRows || {};

    const unitsSold = Number(salesRow?.unitsSold || 0);
    const revenue = Number(salesRow?.revenue || 0);

    return res.json({
      unitsSold,
      revenue: Number(revenue.toFixed(2)),
      avgSoldPrice: unitsSold > 0 ? Number((revenue / unitsSold).toFixed(2)) : 0,
      completedShipments: Number(salesRow?.completedShipments || 0),
      uniqueSkusSold: Number(salesRow?.uniqueSkusSold || 0),
      uniqueShows: Number(salesRow?.uniqueShows || 0),
      pendingShipments: Number(pipelineRow?.pendingShipments || 0),
      pendingRevenue: Number(Number(pipelineRow?.pendingRevenue || 0).toFixed(2)),
      reviewShipments: Number(pipelineRow?.reviewShipments || 0),
      reviewRevenue: Number(Number(pipelineRow?.reviewRevenue || 0).toFixed(2)),
    });
  } catch (error) {
    console.error("Error fetching fulfillment overview analytics:", error);
    return res.status(500).json({ error: "Failed to fetch fulfillment overview analytics" });
  }
});

router.get("/fulfillment-trend", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const { granularity = "day" } = req.query;
  const showId = req.query.showId ? Number(req.query.showId) : null;

  const bucketExpr =
    granularity === "month"
      ? "DATE_FORMAT(sc.closedAt, '%Y-%m-01')"
      : granularity === "week"
      ? "DATE_FORMAT(DATE_SUB(sc.closedAt, INTERVAL WEEKDAY(sc.closedAt) DAY), '%Y-%m-%d')"
      : "DATE_FORMAT(sc.closedAt, '%Y-%m-%d')";

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        ${bucketExpr} AS bucket,
        COUNT(*) AS unitsSold,
        COALESCE(SUM(COALESCE(wss.soldPrice, 0)), 0) AS revenue,
        COUNT(DISTINCT CONCAT(wss.whatnotShowId, ':', wss.importId, ':', wss.shipmentId)) AS completedShipments
      FROM ${TABLES.shipmentScans} wss
      JOIN ${SHIPMENT_CLOSE_SUMMARY_SUBQUERY} sc
        ON sc.whatnotShowId = wss.whatnotShowId
       AND sc.importId = wss.importId
       AND sc.shipmentId = wss.shipmentId
      WHERE ${fulfilledSaleCondition("wss")}
        AND sc.closedAt >= :from
        AND sc.closedAt < :to
        AND (:showId IS NULL OR wss.whatnotShowId = :showId)
      GROUP BY bucket
      ORDER BY bucket ASC
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          showId,
        },
      }
    );

    return res.json(
      rows.map((row) => ({
        ...row,
        unitsSold: Number(row.unitsSold || 0),
        revenue: Number(Number(row.revenue || 0).toFixed(2)),
        completedShipments: Number(row.completedShipments || 0),
      }))
    );
  } catch (error) {
    console.error("Error fetching fulfillment trend analytics:", error);
    return res.status(500).json({ error: "Failed to fetch fulfillment trend analytics" });
  }
});

router.get("/fulfillment-shows", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
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
        COUNT(*) AS unitsSold,
        COALESCE(SUM(COALESCE(wss.soldPrice, 0)), 0) AS revenue,
        COUNT(DISTINCT CONCAT(wss.whatnotShowId, ':', wss.importId, ':', wss.shipmentId)) AS completedShipments,
        COUNT(DISTINCT wss.productSku) AS uniqueSkusSold
      FROM ${TABLES.shipmentScans} wss
      JOIN ${SHIPMENT_CLOSE_SUMMARY_SUBQUERY} sc
        ON sc.whatnotShowId = wss.whatnotShowId
       AND sc.importId = wss.importId
       AND sc.shipmentId = wss.shipmentId
      JOIN ${TABLES.shows} ws ON ws.id = wss.whatnotShowId
      WHERE ${fulfilledSaleCondition("wss")}
        AND sc.closedAt >= :from
        AND sc.closedAt < :to
      GROUP BY ws.id, ws.name
      ORDER BY revenue DESC, unitsSold DESC
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
        },
      }
    );

    return res.json(
      rows.map((row) => ({
        ...row,
        unitsSold: Number(row.unitsSold || 0),
        revenue: Number(Number(row.revenue || 0).toFixed(2)),
        completedShipments: Number(row.completedShipments || 0),
        uniqueSkusSold: Number(row.uniqueSkusSold || 0),
      }))
    );
  } catch (error) {
    console.error("Error fetching fulfillment show analytics:", error);
    return res.status(500).json({ error: "Failed to fetch fulfillment show analytics" });
  }
});

router.get("/fulfillment-products-top", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const showId = req.query.showId ? Number(req.query.showId) : null;
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        wss.productSku AS sku,
        p.brand,
        p.itemName,
        p.strength,
        p.sizeOz,
        p.sizeMl,
        p.\`condition\`,
        pd.tester,
        COUNT(*) AS unitsSold,
        COALESCE(SUM(COALESCE(wss.soldPrice, 0)), 0) AS revenue,
        AVG(wss.soldPrice) AS avgSoldPrice
      FROM ${TABLES.shipmentScans} wss
      LEFT JOIN ${TABLES.products} p ON ${skuJoinCondition("p.sku", "wss.productSku")}
      LEFT JOIN ${TABLES.details} pd ON ${skuJoinCondition("pd.sku", "wss.productSku")}
      JOIN ${SHIPMENT_CLOSE_SUMMARY_SUBQUERY} sc
        ON sc.whatnotShowId = wss.whatnotShowId
       AND sc.importId = wss.importId
       AND sc.shipmentId = wss.shipmentId
      WHERE ${fulfilledSaleCondition("wss")}
        AND sc.closedAt >= :from
        AND sc.closedAt < :to
        AND (:showId IS NULL OR wss.whatnotShowId = :showId)
      GROUP BY wss.productSku, p.brand, p.itemName, p.strength, p.sizeOz, p.sizeMl, p.\`condition\`, pd.tester
      ORDER BY revenue DESC, unitsSold DESC
      LIMIT :limit
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          showId,
          limit,
        },
      }
    );

    return res.json(
      rows.map((row) => ({
        ...row,
        unitsSold: Number(row.unitsSold || 0),
        revenue: Number(Number(row.revenue || 0).toFixed(2)),
        avgSoldPrice: Number(Number(row.avgSoldPrice || 0).toFixed(2)),
      }))
    );
  } catch (error) {
    console.error("Error fetching fulfillment top products analytics:", error);
    return res.status(500).json({ error: "Failed to fetch fulfillment top products analytics" });
  }
});

router.get("/fulfillment-brand-mix", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const showId = req.query.showId ? Number(req.query.showId) : null;
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 30);

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        COALESCE(NULLIF(TRIM(p.brand), ''), 'Unknown') AS brand,
        COUNT(*) AS unitsSold,
        COALESCE(SUM(COALESCE(wss.soldPrice, 0)), 0) AS revenue
      FROM ${TABLES.shipmentScans} wss
      LEFT JOIN ${TABLES.products} p ON ${skuJoinCondition("p.sku", "wss.productSku")}
      JOIN ${SHIPMENT_CLOSE_SUMMARY_SUBQUERY} sc
        ON sc.whatnotShowId = wss.whatnotShowId
       AND sc.importId = wss.importId
       AND sc.shipmentId = wss.shipmentId
      WHERE ${fulfilledSaleCondition("wss")}
        AND sc.closedAt >= :from
        AND sc.closedAt < :to
        AND (:showId IS NULL OR wss.whatnotShowId = :showId)
      GROUP BY COALESCE(NULLIF(TRIM(p.brand), ''), 'Unknown')
      ORDER BY revenue DESC, unitsSold DESC
      LIMIT :limit
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          showId,
          limit,
        },
      }
    );

    const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
    return res.json({
      totalRevenue: Number(totalRevenue.toFixed(2)),
      rows: rows.map((row) => ({
        ...row,
        unitsSold: Number(row.unitsSold || 0),
        revenue: Number(Number(row.revenue || 0).toFixed(2)),
      })),
    });
  } catch (error) {
    console.error("Error fetching fulfillment brand mix analytics:", error);
    return res.status(500).json({ error: "Failed to fetch fulfillment brand mix analytics" });
  }
});

router.get("/fulfillment-sales-mix", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const showId = req.query.showId ? Number(req.query.showId) : null;

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        CASE
          WHEN wss.auctionStickerNumber LIKE 'NON-AUCTION-CONTEXT:%' THEN COALESCE(contextScan.auctionStickerNumber, 'NON-AUCTION')
          ELSE 'AUCTION'
        END AS contextType,
        COUNT(*) AS unitsSold,
        COALESCE(SUM(COALESCE(wss.soldPrice, 0)), 0) AS revenue
      FROM ${TABLES.shipmentScans} wss
      LEFT JOIN ${TABLES.shipmentScans} contextScan
        ON contextScan.id = CAST(SUBSTRING_INDEX(wss.auctionStickerNumber, ':', -1) AS UNSIGNED)
      JOIN ${SHIPMENT_CLOSE_SUMMARY_SUBQUERY} sc
        ON sc.whatnotShowId = wss.whatnotShowId
       AND sc.importId = wss.importId
       AND sc.shipmentId = wss.shipmentId
      WHERE ${fulfilledSaleCondition("wss")}
        AND sc.closedAt >= :from
        AND sc.closedAt < :to
        AND (:showId IS NULL OR wss.whatnotShowId = :showId)
      GROUP BY contextType
      ORDER BY revenue DESC, unitsSold DESC
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          showId,
        },
      }
    );

    return res.json(
      rows.map((row) => ({
        ...row,
        unitsSold: Number(row.unitsSold || 0),
        revenue: Number(Number(row.revenue || 0).toFixed(2)),
      }))
    );
  } catch (error) {
    console.error("Error fetching fulfillment sales mix analytics:", error);
    return res.status(500).json({ error: "Failed to fetch fulfillment sales mix analytics" });
  }
});

router.get("/overview", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
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

router.get("/trend", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
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

router.get("/shows-performance", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
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

router.get("/shows-hourly", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
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

router.get("/shows-top-skus", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
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

router.get("/products-top", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
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

router.get("/products-pareto", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
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

router.get("/products-brand-contribution", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
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

router.get("/products-velocity", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
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

router.get("/products-day-of-week", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
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

router.get("/products-sku-trend", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
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

router.get("/brand-mix", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
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

router.get("/operations-users", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
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

router.get("/operations-user-hourly", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
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

router.get("/operations-errors-trend", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
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

router.get("/operations-errors-table", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
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

router.get("/inventory-risk", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
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


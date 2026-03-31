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
  ProductVendorPrice,
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
  vendorPrices: `\`${toTableName(ProductVendorPrice)}\``,
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

const ACTIVE_VENDOR_COST_SUBQUERY = `
  (
    SELECT
      sku,
      ROUND(
        SUM(COALESCE(price, 0) * COALESCE(NULLIF(quantity, 0), 1)) /
        NULLIF(SUM(COALESCE(NULLIF(quantity, 0), 1)), 0),
        2
      ) AS avgVendorCost
    FROM ${TABLES.vendorPrices}
    WHERE isActive = 1
    GROUP BY sku
  )
`;

const WHATNOT_COMMISSION_RATE = 0.08;
const WHATNOT_PROCESSING_RATE = 0.029;
const WHATNOT_PROCESSING_FIXED_FEE = 0.30;

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

router.get("/fulfillment-profitability-overview", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const showId = req.query.showId ? Number(req.query.showId) : null;

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        COUNT(*) AS unitsSold,
        COALESCE(SUM(COALESCE(wss.soldPrice, 0)), 0) AS revenue,
        SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN 1 ELSE 0 END) AS knownCostUnits,
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN COALESCE(wss.soldPrice, 0) ELSE 0 END), 0) AS knownCostRevenue,
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN vc.avgVendorCost ELSE 0 END), 0) AS estimatedCost,
        SUM(CASE WHEN vc.avgVendorCost IS NULL THEN 1 ELSE 0 END) AS unknownCostUnits,
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NULL THEN COALESCE(wss.soldPrice, 0) ELSE 0 END), 0) AS unknownCostRevenue,
        COALESCE(SUM(COALESCE(wss.soldPrice, 0) * ${WHATNOT_COMMISSION_RATE}), 0) AS totalCommissionFees,
        COALESCE(SUM(COALESCE(wss.soldPrice, 0) * ${WHATNOT_PROCESSING_RATE}), 0) AS totalProcessingRateFees,
        COUNT(DISTINCT CONCAT(wss.whatnotShowId, ':', wss.importId, ':', wss.shipmentId)) AS totalFeeShipmentCount,
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN COALESCE(wss.soldPrice, 0) * ${WHATNOT_COMMISSION_RATE} ELSE 0 END), 0) AS knownCostCommissionFees,
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN COALESCE(wss.soldPrice, 0) * ${WHATNOT_PROCESSING_RATE} ELSE 0 END), 0) AS knownCostProcessingRateFees,
        COUNT(DISTINCT CASE WHEN vc.avgVendorCost IS NOT NULL THEN CONCAT(wss.whatnotShowId, ':', wss.importId, ':', wss.shipmentId) END) AS knownCostShipmentCount,
        SUM(CASE WHEN vc.avgVendorCost IS NOT NULL AND COALESCE(wss.soldPrice, 0) - vc.avgVendorCost < 0 THEN 1 ELSE 0 END) AS negativeMarginUnits,
        SUM(CASE
          WHEN vc.avgVendorCost IS NOT NULL
           AND COALESCE(wss.soldPrice, 0) - vc.avgVendorCost >= 0
           AND COALESCE(wss.soldPrice, 0) - vc.avgVendorCost < 5
          THEN 1
          ELSE 0
        END) AS lowMarginUnits
      FROM ${TABLES.shipmentScans} wss
      LEFT JOIN ${ACTIVE_VENDOR_COST_SUBQUERY} vc ON ${skuJoinCondition("vc.sku", "wss.productSku")}
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
    );

    const row = rows[0] || {};
    const revenue = Number(row.knownCostRevenue || 0);
    const estimatedCost = Number(row.estimatedCost || 0);
    const grossMargin = revenue - estimatedCost;
    const totalWhatnotFees =
      Number(row.totalCommissionFees || 0) +
      Number(row.totalProcessingRateFees || 0) +
      Number(row.totalFeeShipmentCount || 0) * WHATNOT_PROCESSING_FIXED_FEE;
    const knownCostWhatnotFees =
      Number(row.knownCostCommissionFees || 0) +
      Number(row.knownCostProcessingRateFees || 0) +
      Number(row.knownCostShipmentCount || 0) * WHATNOT_PROCESSING_FIXED_FEE;
    const netMarginAfterFees = grossMargin - knownCostWhatnotFees;

    return res.json({
      unitsSold: Number(row.unitsSold || 0),
      revenue: Number(Number(row.revenue || 0).toFixed(2)),
      knownCostUnits: Number(row.knownCostUnits || 0),
      knownCostRevenue: Number(revenue.toFixed(2)),
      estimatedCost: Number(estimatedCost.toFixed(2)),
      grossMargin: Number(grossMargin.toFixed(2)),
      grossMarginPct: revenue > 0 ? Number(((grossMargin / revenue) * 100).toFixed(2)) : 0,
      whatnotFees: Number(totalWhatnotFees.toFixed(2)),
      knownCostWhatnotFees: Number(knownCostWhatnotFees.toFixed(2)),
      netMarginAfterFees: Number(netMarginAfterFees.toFixed(2)),
      netMarginAfterFeesPct: revenue > 0 ? Number(((netMarginAfterFees / revenue) * 100).toFixed(2)) : 0,
      unknownCostUnits: Number(row.unknownCostUnits || 0),
      unknownCostRevenue: Number(Number(row.unknownCostRevenue || 0).toFixed(2)),
      negativeMarginUnits: Number(row.negativeMarginUnits || 0),
      lowMarginUnits: Number(row.lowMarginUnits || 0),
    });
  } catch (error) {
    console.error("Error fetching fulfillment profitability overview analytics:", error);
    return res.status(500).json({ error: "Failed to fetch fulfillment profitability overview analytics" });
  }
});

router.get("/fulfillment-profitability-shows", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const showId = req.query.showId ? Number(req.query.showId) : null;
  const limit = Math.min(Math.max(Number(req.query.limit) || 15, 1), 50);

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        ws.id AS showId,
        ws.name AS showName,
        COUNT(*) AS unitsSold,
        COALESCE(SUM(COALESCE(wss.soldPrice, 0)), 0) AS revenue,
        SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN 1 ELSE 0 END) AS knownCostUnits,
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN COALESCE(wss.soldPrice, 0) ELSE 0 END), 0) AS knownCostRevenue,
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN vc.avgVendorCost ELSE 0 END), 0) AS estimatedCost,
        SUM(CASE WHEN vc.avgVendorCost IS NULL THEN 1 ELSE 0 END) AS unknownCostUnits,
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NULL THEN COALESCE(wss.soldPrice, 0) ELSE 0 END), 0) AS unknownCostRevenue,
        COALESCE(SUM(COALESCE(wss.soldPrice, 0) * ${WHATNOT_COMMISSION_RATE}), 0) AS totalCommissionFees,
        COALESCE(SUM(COALESCE(wss.soldPrice, 0) * ${WHATNOT_PROCESSING_RATE}), 0) AS totalProcessingRateFees,
        COUNT(DISTINCT CONCAT(wss.whatnotShowId, ':', wss.importId, ':', wss.shipmentId)) AS totalFeeShipmentCount,
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN COALESCE(wss.soldPrice, 0) * ${WHATNOT_COMMISSION_RATE} ELSE 0 END), 0) AS knownCostCommissionFees,
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN COALESCE(wss.soldPrice, 0) * ${WHATNOT_PROCESSING_RATE} ELSE 0 END), 0) AS knownCostProcessingRateFees,
        COUNT(DISTINCT CASE WHEN vc.avgVendorCost IS NOT NULL THEN CONCAT(wss.whatnotShowId, ':', wss.importId, ':', wss.shipmentId) END) AS knownCostShipmentCount
      FROM ${TABLES.shipmentScans} wss
      LEFT JOIN ${ACTIVE_VENDOR_COST_SUBQUERY} vc ON ${skuJoinCondition("vc.sku", "wss.productSku")}
      JOIN ${SHIPMENT_CLOSE_SUMMARY_SUBQUERY} sc
        ON sc.whatnotShowId = wss.whatnotShowId
       AND sc.importId = wss.importId
       AND sc.shipmentId = wss.shipmentId
      JOIN ${TABLES.shows} ws ON ws.id = wss.whatnotShowId
      WHERE ${fulfilledSaleCondition("wss")}
        AND sc.closedAt >= :from
        AND sc.closedAt < :to
        AND (:showId IS NULL OR wss.whatnotShowId = :showId)
      GROUP BY ws.id, ws.name
      ORDER BY revenue DESC
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
      rows.map((row) => {
        const revenue = Number(row.knownCostRevenue || 0);
        const estimatedCost = Number(row.estimatedCost || 0);
        const grossMargin = revenue - estimatedCost;
        const totalWhatnotFees =
          Number(row.totalCommissionFees || 0) +
          Number(row.totalProcessingRateFees || 0) +
          Number(row.totalFeeShipmentCount || 0) * WHATNOT_PROCESSING_FIXED_FEE;
        const knownCostWhatnotFees =
          Number(row.knownCostCommissionFees || 0) +
          Number(row.knownCostProcessingRateFees || 0) +
          Number(row.knownCostShipmentCount || 0) * WHATNOT_PROCESSING_FIXED_FEE;
        const netMarginAfterFees = grossMargin - knownCostWhatnotFees;
        return {
          ...row,
          unitsSold: Number(row.unitsSold || 0),
          revenue: Number(Number(row.revenue || 0).toFixed(2)),
          knownCostUnits: Number(row.knownCostUnits || 0),
          knownCostRevenue: Number(revenue.toFixed(2)),
          estimatedCost: Number(estimatedCost.toFixed(2)),
          grossMargin: Number(grossMargin.toFixed(2)),
          grossMarginPct: revenue > 0 ? Number(((grossMargin / revenue) * 100).toFixed(2)) : 0,
          whatnotFees: Number(totalWhatnotFees.toFixed(2)),
          knownCostWhatnotFees: Number(knownCostWhatnotFees.toFixed(2)),
          netMarginAfterFees: Number(netMarginAfterFees.toFixed(2)),
          netMarginAfterFeesPct: revenue > 0 ? Number(((netMarginAfterFees / revenue) * 100).toFixed(2)) : 0,
          unknownCostUnits: Number(row.unknownCostUnits || 0),
          unknownCostRevenue: Number(Number(row.unknownCostRevenue || 0).toFixed(2)),
        };
      })
    );
  } catch (error) {
    console.error("Error fetching fulfillment profitability by show analytics:", error);
    return res.status(500).json({ error: "Failed to fetch fulfillment profitability by show analytics" });
  }
});

router.get("/fulfillment-review-queue", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
  const showId = req.query.showId ? Number(req.query.showId) : null;
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);

  try {
    const [reasonRows, agingRows, shipmentRows] = await Promise.all([
      sequelize.query(
        `
        SELECT
          COALESCE(NULLIF(TRIM(wsi.mismatchReason), ''), 'Unspecified') AS mismatchReason,
          COUNT(*) AS rowCount,
          COUNT(DISTINCT CONCAT(wsi.whatnotShowId, ':', wsi.importId, ':', wsi.shipmentId)) AS shipmentCount
        FROM ${TABLES.shipmentItems} wsi
        WHERE wsi.status = 'pending_review'
          AND (:showId IS NULL OR wsi.whatnotShowId = :showId)
        GROUP BY COALESCE(NULLIF(TRIM(wsi.mismatchReason), ''), 'Unspecified')
        ORDER BY shipmentCount DESC, rowCount DESC
        LIMIT 12
        `,
        { replacements: { showId } }
      ),
      sequelize.query(
        `
        SELECT
          CASE
            WHEN TIMESTAMPDIFF(DAY, COALESCE(MIN(wsi.createdAt), NOW()), NOW()) <= 1 THEN '0-1 days'
            WHEN TIMESTAMPDIFF(DAY, COALESCE(MIN(wsi.createdAt), NOW()), NOW()) <= 3 THEN '2-3 days'
            WHEN TIMESTAMPDIFF(DAY, COALESCE(MIN(wsi.createdAt), NOW()), NOW()) <= 7 THEN '4-7 days'
            ELSE '8+ days'
          END AS ageBucket,
          COUNT(*) AS shipmentCount
        FROM ${TABLES.shipmentItems} wsi
        WHERE wsi.status = 'pending_review'
          AND (:showId IS NULL OR wsi.whatnotShowId = :showId)
        GROUP BY wsi.whatnotShowId, wsi.importId, wsi.shipmentId
        `,
        { replacements: { showId } }
      ),
      sequelize.query(
        `
        SELECT
          wsi.whatnotShowId AS showId,
          ws.name AS showName,
          wsi.importId,
          wsi.shipmentId,
          MAX(wsi.tracking) AS tracking,
          COALESCE(NULLIF(TRIM(MAX(wsi.mismatchReason)), ''), 'Unspecified') AS mismatchReason,
          SUM(COALESCE(wsi.expectedQty, 0)) AS expectedQty,
          SUM(COALESCE(wsi.scannedQty, 0)) AS scannedQty,
          COALESCE(SUM(COALESCE(wsi.totalCost, COALESCE(wsi.soldPrice, 0) * COALESCE(wsi.expectedQty, 0))), 0) AS affectedRevenue,
          TIMESTAMPDIFF(DAY, MIN(wsi.createdAt), NOW()) AS ageDays
        FROM ${TABLES.shipmentItems} wsi
        LEFT JOIN ${TABLES.shows} ws ON ws.id = wsi.whatnotShowId
        WHERE wsi.status = 'pending_review'
          AND (:showId IS NULL OR wsi.whatnotShowId = :showId)
        GROUP BY wsi.whatnotShowId, ws.name, wsi.importId, wsi.shipmentId
        ORDER BY ageDays DESC, affectedRevenue DESC
        LIMIT :limit
        `,
        { replacements: { showId, limit } }
      ),
    ]);

    const ageOrder = ["0-1 days", "2-3 days", "4-7 days", "8+ days"];
    const bucketMap = new Map((agingRows[0] || agingRows).map((row) => [row.ageBucket, Number(row.shipmentCount || 0)]));

    return res.json({
      reasons: (reasonRows[0] || reasonRows).map((row) => ({
        mismatchReason: row.mismatchReason,
        rowCount: Number(row.rowCount || 0),
        shipmentCount: Number(row.shipmentCount || 0),
      })),
      aging: ageOrder.map((bucket) => ({
        ageBucket: bucket,
        shipmentCount: bucketMap.get(bucket) || 0,
      })),
      shipments: (shipmentRows[0] || shipmentRows).map((row) => ({
        ...row,
        expectedQty: Number(row.expectedQty || 0),
        scannedQty: Number(row.scannedQty || 0),
        affectedRevenue: Number(Number(row.affectedRevenue || 0).toFixed(2)),
        ageDays: Number(row.ageDays || 0),
      })),
    });
  } catch (error) {
    console.error("Error fetching fulfillment review queue analytics:", error);
    return res.status(500).json({ error: "Failed to fetch fulfillment review queue analytics" });
  }
});

router.get("/fulfillment-inventory-exposure", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const showId = req.query.showId ? Number(req.query.showId) : null;
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        wss.productSku AS sku,
        p.brand,
        p.itemName,
        p.quantity AS currentQty,
        p.minimumQuantity,
        COUNT(*) AS unitsSold,
        COALESCE(SUM(COALESCE(wss.soldPrice, 0)), 0) AS revenue,
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN vc.avgVendorCost ELSE 0 END), 0) AS estimatedCost,
        SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN 1 ELSE 0 END) AS knownCostUnits,
        SUM(CASE WHEN vc.avgVendorCost IS NULL THEN 1 ELSE 0 END) AS unknownCostUnits
      FROM ${TABLES.shipmentScans} wss
      LEFT JOIN ${TABLES.products} p ON ${skuJoinCondition("p.sku", "wss.productSku")}
      LEFT JOIN ${ACTIVE_VENDOR_COST_SUBQUERY} vc ON ${skuJoinCondition("vc.sku", "wss.productSku")}
      JOIN ${SHIPMENT_CLOSE_SUMMARY_SUBQUERY} sc
        ON sc.whatnotShowId = wss.whatnotShowId
       AND sc.importId = wss.importId
       AND sc.shipmentId = wss.shipmentId
      WHERE ${fulfilledSaleCondition("wss")}
        AND sc.closedAt >= :from
        AND sc.closedAt < :to
        AND (:showId IS NULL OR wss.whatnotShowId = :showId)
      GROUP BY wss.productSku, p.brand, p.itemName, p.quantity, p.minimumQuantity
      ORDER BY unitsSold DESC
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

    const daysInRange = Math.max(1, Math.ceil((range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000)));

    return res.json(
      rows.map((row) => {
        const currentQty = Number(row.currentQty || 0);
        const unitsSold = Number(row.unitsSold || 0);
        const avgDailySales = unitsSold / daysInRange;
        const daysOfCover = avgDailySales > 0 ? Number((currentQty / avgDailySales).toFixed(1)) : null;
        const estimatedCost = Number(row.estimatedCost || 0);
        const revenue = Number(row.revenue || 0);
        return {
          sku: row.sku,
          brand: row.brand,
          itemName: row.itemName,
          currentQty,
          minimumQuantity: row.minimumQuantity === null ? null : Number(row.minimumQuantity || 0),
          unitsSold,
          revenue: Number(revenue.toFixed(2)),
          grossMargin:
            Number(row.knownCostUnits || 0) > 0
              ? Number((revenue - estimatedCost).toFixed(2))
              : null,
          knownCostUnits: Number(row.knownCostUnits || 0),
          unknownCostUnits: Number(row.unknownCostUnits || 0),
          avgDailySales: Number(avgDailySales.toFixed(2)),
          daysOfCover,
          riskBand:
            daysOfCover === null
              ? "no_signal"
              : daysOfCover <= 3
              ? "critical"
              : daysOfCover <= 7
              ? "high"
              : daysOfCover <= 14
              ? "medium"
              : "stable",
        };
      })
    );
  } catch (error) {
    console.error("Error fetching fulfillment inventory exposure analytics:", error);
    return res.status(500).json({ error: "Failed to fetch fulfillment inventory exposure analytics" });
  }
});

router.get("/fulfillment-sku-search", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const showId = req.query.showId ? Number(req.query.showId) : null;
  const q = String(req.query.q || "").trim();
  const qTokens = q
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 8);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);

  const tokenCondition =
    qTokens.length > 0
      ? qTokens
          .map(
            (_, idx) => `
              LOWER(
                CONCAT_WS(
                  ' ',
                  COALESCE(wss.productSku, ''),
                  COALESCE(p.brand, ''),
                  COALESCE(p.itemName, ''),
                  COALESCE(p.strength, ''),
                  COALESCE(p.sizeOz, ''),
                  COALESCE(p.sizeMl, ''),
                  CASE WHEN pd.tester = 1 THEN 'tester' ELSE 'non tester' END
                )
              ) LIKE :tokenLike${idx}
            `
          )
          .join(" AND ")
      : "1 = 1";

  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        wss.productSku AS sku,
        COALESCE(NULLIF(TRIM(p.brand), ''), 'Unknown') AS brand,
        COALESCE(NULLIF(TRIM(p.itemName), ''), 'Unknown Item') AS itemName,
        p.strength,
        p.sizeOz,
        p.sizeMl,
        pd.tester,
        COUNT(*) AS unitsSold
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
        AND (
          :q = ''
          OR wss.productSku LIKE :qLike
          OR p.brand LIKE :qLike
          OR p.itemName LIKE :qLike
          OR CONCAT(COALESCE(p.brand, ''), ' ', COALESCE(p.itemName, '')) LIKE :qLike
          OR (${tokenCondition})
        )
      GROUP BY wss.productSku, p.brand, p.itemName, p.strength, p.sizeOz, p.sizeMl, pd.tester
      ORDER BY unitsSold DESC, wss.productSku ASC
      LIMIT :limit
      `,
      {
        replacements: {
          from: range.from,
          to: range.to,
          showId,
          q,
          qLike: `%${q}%`,
          limit,
          ...qTokens.reduce((acc, token, idx) => {
            acc[`tokenLike${idx}`] = `%${token}%`;
            return acc;
          }, {}),
        },
      }
    );

    return res.json(
      rows.map((row) => ({
        sku: row.sku,
        brand: row.brand,
        itemName: row.itemName,
        strength: row.strength,
        sizeOz: row.sizeOz,
        sizeMl: row.sizeMl,
        tester: row.tester,
        unitsSold: Number(row.unitsSold || 0),
      }))
    );
  } catch (error) {
    console.error("Error fetching fulfillment SKU search analytics:", error);
    return res.status(500).json({ error: "Failed to fetch fulfillment SKU search analytics" });
  }
});

router.get("/fulfillment-sku-detail", auth, checkPermission("whatnotAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const showId = req.query.showId ? Number(req.query.showId) : null;
  const sku = String(req.query.sku || "").trim();

  if (!sku) {
    return res.status(400).json({ error: "sku is required" });
  }

  try {
    const [
      [summaryRows],
      [showRows],
      [dayRows],
      [dayOfWeekRows],
      [hourRows],
      [recentSalesRows],
    ] = await Promise.all([
      sequelize.query(
        `
        SELECT
          p.sku,
          p.brand,
          p.itemName,
          p.strength,
          p.sizeOz,
          p.sizeMl,
          p.location,
          p.quantity,
          p.minimumQuantity,
          p.averagePrice,
          p.\`condition\`,
          pd.tester,
          COUNT(*) AS unitsSold,
          COALESCE(SUM(COALESCE(wss.soldPrice, 0)), 0) AS revenue,
          SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN 1 ELSE 0 END) AS knownCostUnits,
          COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN COALESCE(wss.soldPrice, 0) ELSE 0 END), 0) AS knownCostRevenue,
          COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN vc.avgVendorCost ELSE 0 END), 0) AS estimatedCost,
          SUM(CASE WHEN vc.avgVendorCost IS NULL THEN 1 ELSE 0 END) AS unknownCostUnits,
          COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NULL THEN COALESCE(wss.soldPrice, 0) ELSE 0 END), 0) AS unknownCostRevenue,
          COUNT(DISTINCT wss.whatnotShowId) AS uniqueShows,
          COUNT(DISTINCT CONCAT(wss.whatnotShowId, ':', wss.importId, ':', wss.shipmentId)) AS uniqueShipments,
          MIN(CASE WHEN COALESCE(wss.soldPrice, 0) > 0 THEN wss.soldPrice ELSE NULL END) AS lowestSoldPrice,
          MAX(wss.soldPrice) AS highestSoldPrice,
          MIN(wss.createdAt) AS firstSaleAt,
          MAX(wss.createdAt) AS lastSaleAt
        FROM ${TABLES.shipmentScans} wss
        LEFT JOIN ${TABLES.products} p ON ${skuJoinCondition("p.sku", "wss.productSku")}
        LEFT JOIN ${TABLES.details} pd ON ${skuJoinCondition("pd.sku", "wss.productSku")}
        LEFT JOIN ${ACTIVE_VENDOR_COST_SUBQUERY} vc ON ${skuJoinCondition("vc.sku", "wss.productSku")}
        JOIN ${SHIPMENT_CLOSE_SUMMARY_SUBQUERY} sc
          ON sc.whatnotShowId = wss.whatnotShowId
         AND sc.importId = wss.importId
         AND sc.shipmentId = wss.shipmentId
        WHERE ${fulfilledSaleCondition("wss")}
          AND sc.closedAt >= :from
          AND sc.closedAt < :to
          AND (:showId IS NULL OR wss.whatnotShowId = :showId)
          AND ${skuJoinCondition("wss.productSku", ":sku")}
        GROUP BY
          p.sku, p.brand, p.itemName, p.strength, p.sizeOz, p.sizeMl,
          p.location, p.quantity, p.minimumQuantity, p.averagePrice,
          p.\`condition\`, pd.tester
        `,
        { replacements: { from: range.from, to: range.to, showId, sku } }
      ),
      sequelize.query(
        `
        SELECT
          ws.id AS showId,
          ws.name AS showName,
          COUNT(*) AS unitsSold,
          COALESCE(SUM(COALESCE(wss.soldPrice, 0)), 0) AS revenue,
          SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN 1 ELSE 0 END) AS knownCostUnits,
          COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN COALESCE(wss.soldPrice, 0) ELSE 0 END), 0) AS knownCostRevenue,
          COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN vc.avgVendorCost ELSE 0 END), 0) AS estimatedCost,
          SUM(CASE WHEN vc.avgVendorCost IS NULL THEN 1 ELSE 0 END) AS unknownCostUnits,
          COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NULL THEN COALESCE(wss.soldPrice, 0) ELSE 0 END), 0) AS unknownCostRevenue
        FROM ${TABLES.shipmentScans} wss
        LEFT JOIN ${ACTIVE_VENDOR_COST_SUBQUERY} vc ON ${skuJoinCondition("vc.sku", "wss.productSku")}
        JOIN ${SHIPMENT_CLOSE_SUMMARY_SUBQUERY} sc
          ON sc.whatnotShowId = wss.whatnotShowId
         AND sc.importId = wss.importId
         AND sc.shipmentId = wss.shipmentId
        JOIN ${TABLES.shows} ws ON ws.id = wss.whatnotShowId
        WHERE ${fulfilledSaleCondition("wss")}
          AND sc.closedAt >= :from
          AND sc.closedAt < :to
          AND (:showId IS NULL OR wss.whatnotShowId = :showId)
          AND ${skuJoinCondition("wss.productSku", ":sku")}
        GROUP BY ws.id, ws.name
        ORDER BY revenue DESC, unitsSold DESC
        LIMIT 20
        `,
        { replacements: { from: range.from, to: range.to, showId, sku } }
      ),
      sequelize.query(
        `
        SELECT
          DATE_FORMAT(wss.createdAt, '%Y-%m-%d') AS bucket,
          COUNT(*) AS unitsSold,
          COALESCE(SUM(COALESCE(wss.soldPrice, 0)), 0) AS revenue,
          AVG(wss.soldPrice) AS avgSoldPrice
        FROM ${TABLES.shipmentScans} wss
        JOIN ${SHIPMENT_CLOSE_SUMMARY_SUBQUERY} sc
          ON sc.whatnotShowId = wss.whatnotShowId
         AND sc.importId = wss.importId
         AND sc.shipmentId = wss.shipmentId
        WHERE ${fulfilledSaleCondition("wss")}
          AND sc.closedAt >= :from
          AND sc.closedAt < :to
          AND (:showId IS NULL OR wss.whatnotShowId = :showId)
          AND ${skuJoinCondition("wss.productSku", ":sku")}
        GROUP BY bucket
        ORDER BY bucket ASC
        `,
        { replacements: { from: range.from, to: range.to, showId, sku } }
      ),
      sequelize.query(
        `
        SELECT
          DAYOFWEEK(wss.createdAt) AS dayIndex,
          CASE DAYOFWEEK(wss.createdAt)
            WHEN 1 THEN 'Sunday'
            WHEN 2 THEN 'Monday'
            WHEN 3 THEN 'Tuesday'
            WHEN 4 THEN 'Wednesday'
            WHEN 5 THEN 'Thursday'
            WHEN 6 THEN 'Friday'
            WHEN 7 THEN 'Saturday'
          END AS dayName,
          COUNT(*) AS unitsSold,
          COALESCE(SUM(COALESCE(wss.soldPrice, 0)), 0) AS revenue
        FROM ${TABLES.shipmentScans} wss
        JOIN ${SHIPMENT_CLOSE_SUMMARY_SUBQUERY} sc
          ON sc.whatnotShowId = wss.whatnotShowId
         AND sc.importId = wss.importId
         AND sc.shipmentId = wss.shipmentId
        WHERE ${fulfilledSaleCondition("wss")}
          AND sc.closedAt >= :from
          AND sc.closedAt < :to
          AND (:showId IS NULL OR wss.whatnotShowId = :showId)
          AND ${skuJoinCondition("wss.productSku", ":sku")}
        GROUP BY dayIndex, dayName
        ORDER BY dayIndex ASC
        `,
        { replacements: { from: range.from, to: range.to, showId, sku } }
      ),
      sequelize.query(
        `
        SELECT
          HOUR(wss.createdAt) AS hourOfDay,
          COUNT(*) AS unitsSold,
          COALESCE(SUM(COALESCE(wss.soldPrice, 0)), 0) AS revenue
        FROM ${TABLES.shipmentScans} wss
        JOIN ${SHIPMENT_CLOSE_SUMMARY_SUBQUERY} sc
          ON sc.whatnotShowId = wss.whatnotShowId
         AND sc.importId = wss.importId
         AND sc.shipmentId = wss.shipmentId
        WHERE ${fulfilledSaleCondition("wss")}
          AND sc.closedAt >= :from
          AND sc.closedAt < :to
          AND (:showId IS NULL OR wss.whatnotShowId = :showId)
          AND ${skuJoinCondition("wss.productSku", ":sku")}
        GROUP BY HOUR(wss.createdAt)
        ORDER BY hourOfDay ASC
        `,
        { replacements: { from: range.from, to: range.to, showId, sku } }
      ),
      sequelize.query(
        `
        SELECT
          wss.id,
          wss.createdAt,
          ws.name AS showName,
          wss.shipmentId,
          wss.tracking,
          wss.soldPrice,
          wss.auctionStickerNumber,
          wss.userId
        FROM ${TABLES.shipmentScans} wss
        LEFT JOIN ${TABLES.shows} ws ON ws.id = wss.whatnotShowId
        JOIN ${SHIPMENT_CLOSE_SUMMARY_SUBQUERY} sc
          ON sc.whatnotShowId = wss.whatnotShowId
         AND sc.importId = wss.importId
         AND sc.shipmentId = wss.shipmentId
        WHERE ${fulfilledSaleCondition("wss")}
          AND sc.closedAt >= :from
          AND sc.closedAt < :to
          AND (:showId IS NULL OR wss.whatnotShowId = :showId)
          AND ${skuJoinCondition("wss.productSku", ":sku")}
        ORDER BY wss.createdAt DESC, wss.id DESC
        LIMIT 25
        `,
        { replacements: { from: range.from, to: range.to, showId, sku } }
      ),
    ]);

    const summaryRow = (summaryRows || [])[0];
    if (!summaryRow) {
      return res.status(404).json({ error: "SKU not found in fulfillment analytics for the selected range" });
    }

    const knownCostRevenue = Number(summaryRow.knownCostRevenue || 0);
    const estimatedCost = Number(summaryRow.estimatedCost || 0);
    const grossMargin = knownCostRevenue - estimatedCost;

    return res.json({
      product: {
        sku: summaryRow.sku || sku,
        brand: summaryRow.brand,
        itemName: summaryRow.itemName,
        strength: summaryRow.strength,
        sizeOz: summaryRow.sizeOz,
        sizeMl: summaryRow.sizeMl,
        location: summaryRow.location,
        quantity: summaryRow.quantity === null ? null : Number(summaryRow.quantity || 0),
        minimumQuantity: summaryRow.minimumQuantity === null ? null : Number(summaryRow.minimumQuantity || 0),
        averagePrice: summaryRow.averagePrice === null ? null : Number(summaryRow.averagePrice || 0),
        condition: summaryRow.condition,
        tester: summaryRow.tester,
      },
      summary: {
        unitsSold: Number(summaryRow.unitsSold || 0),
        revenue: Number(Number(summaryRow.revenue || 0).toFixed(2)),
        avgSoldPrice:
          Number(summaryRow.unitsSold || 0) > 0
            ? Number((Number(summaryRow.revenue || 0) / Number(summaryRow.unitsSold || 0)).toFixed(2))
            : 0,
        knownCostUnits: Number(summaryRow.knownCostUnits || 0),
        knownCostRevenue: Number(knownCostRevenue.toFixed(2)),
        estimatedCost: Number(estimatedCost.toFixed(2)),
        grossMargin: Number(grossMargin.toFixed(2)),
        grossMarginPct: knownCostRevenue > 0 ? Number(((grossMargin / knownCostRevenue) * 100).toFixed(2)) : 0,
        unknownCostUnits: Number(summaryRow.unknownCostUnits || 0),
        unknownCostRevenue: Number(Number(summaryRow.unknownCostRevenue || 0).toFixed(2)),
        uniqueShows: Number(summaryRow.uniqueShows || 0),
        uniqueShipments: Number(summaryRow.uniqueShipments || 0),
        lowestSoldPrice: Number(Number(summaryRow.lowestSoldPrice || 0).toFixed(2)),
        highestSoldPrice: Number(Number(summaryRow.highestSoldPrice || 0).toFixed(2)),
        firstSaleAt: summaryRow.firstSaleAt,
        lastSaleAt: summaryRow.lastSaleAt,
      },
      byShow: (showRows || []).map((row) => {
        const rowKnownRevenue = Number(row.knownCostRevenue || 0);
        const rowCost = Number(row.estimatedCost || 0);
        const rowMargin = rowKnownRevenue - rowCost;
        return {
          showId: row.showId,
          showName: row.showName,
          unitsSold: Number(row.unitsSold || 0),
          revenue: Number(Number(row.revenue || 0).toFixed(2)),
          knownCostUnits: Number(row.knownCostUnits || 0),
          knownCostRevenue: Number(rowKnownRevenue.toFixed(2)),
          estimatedCost: Number(rowCost.toFixed(2)),
          grossMargin: Number(rowMargin.toFixed(2)),
          grossMarginPct: rowKnownRevenue > 0 ? Number(((rowMargin / rowKnownRevenue) * 100).toFixed(2)) : 0,
          unknownCostUnits: Number(row.unknownCostUnits || 0),
          unknownCostRevenue: Number(Number(row.unknownCostRevenue || 0).toFixed(2)),
        };
      }),
      byDay: (dayRows || []).map((row) => ({
        bucket: row.bucket,
        unitsSold: Number(row.unitsSold || 0),
        revenue: Number(Number(row.revenue || 0).toFixed(2)),
        avgSoldPrice: Number(Number(row.avgSoldPrice || 0).toFixed(2)),
      })),
      dayOfWeek: (dayOfWeekRows || []).map((row) => ({
        dayIndex: Number(row.dayIndex || 0),
        dayName: row.dayName,
        unitsSold: Number(row.unitsSold || 0),
        revenue: Number(Number(row.revenue || 0).toFixed(2)),
      })),
      hourOfDay: (hourRows || []).map((row) => ({
        hourOfDay: Number(row.hourOfDay || 0),
        unitsSold: Number(row.unitsSold || 0),
        revenue: Number(Number(row.revenue || 0).toFixed(2)),
      })),
      recentSales: (recentSalesRows || []).map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        showName: row.showName,
        shipmentId: row.shipmentId,
        tracking: row.tracking,
        soldPrice: Number(Number(row.soldPrice || 0).toFixed(2)),
        auctionStickerNumber: row.auctionStickerNumber,
        userId: row.userId,
      })),
    });
  } catch (error) {
    console.error("Error fetching fulfillment SKU detail analytics:", error);
    return res.status(500).json({ error: "Failed to fetch fulfillment SKU detail analytics" });
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


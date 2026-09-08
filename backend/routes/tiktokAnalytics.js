const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permissions");
const {
  sequelize,
  TikTokShow,
  TikTokShipmentItem,
  TikTokShipmentScan,
  TikTokShipmentImport,
  Products,
  ProductDetails,
  ProductVendorPrice,
  User,
} = require("../models");

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const toTableName = (model) => {
  const table = model.getTableName();
  return typeof table === "string" ? table : table.tableName;
};

const TABLES = {
  products:       `\`${toTableName(Products)}\``,
  details:        `\`${toTableName(ProductDetails)}\``,
  vendorPrices:   `\`${toTableName(ProductVendorPrice)}\``,
  shows:          `\`${toTableName(TikTokShow)}\``,
  shipmentItems:  `\`${toTableName(TikTokShipmentItem)}\``,
  shipmentScans:  `\`${toTableName(TikTokShipmentScan)}\``,
  shipmentImports:`\`${toTableName(TikTokShipmentImport)}\``,
  users:          `\`${toTableName(User)}\``,
};

const skuJoinCondition = (l, r) =>
  `${l} COLLATE utf8mb4_unicode_ci = ${r} COLLATE utf8mb4_unicode_ci`;

// A fulfilled TikTok scan = matched + has a product SKU + inventory was decremented
const fulfilledSaleCondition = (alias = "tss") => `
  ${alias}.result = 'matched'
  AND ${alias}.productSku IS NOT NULL
  AND ${alias}.productSku <> ''
  AND ${alias}.previousQuantity IS NOT NULL
  AND ${alias}.newQuantity = ${alias}.previousQuantity - 1
`;

// EXISTS filter replacing the fan-out-causing JOIN to tsi for date range filtering.
// One tsi (shipmentItems) row per (showId,importId,shipmentId) is NOT guaranteed â€”
// there may be multiple items per shipment â€” so a direct JOIN multiplies scan rows.
const tsiExistsDateFilter = (tssAlias = "tss") => `
  EXISTS (
    SELECT 1 FROM ${TABLES.shipmentItems} _tsi
    WHERE _tsi.tiktokShowId = ${tssAlias}.tiktokShowId
      AND _tsi.importId     = ${tssAlias}.importId
      AND _tsi.shipmentId   = ${tssAlias}.shipmentId
      AND _tsi.placedAt >= :from
      AND _tsi.placedAt  < :to
  )
`;

// Aggregated tsi subquery â€” one row per (showId,importId,shipmentId), safe to JOIN.
// Used when we need tsi columns (like placedAt, itemCategory) for bucketing/grouping.
const TSI_ONE_PER_SHIPMENT = `
  (
    SELECT
      tiktokShowId,
      importId,
      shipmentId,
      MIN(placedAt)    AS placedAt,
      MAX(itemCategory) AS itemCategory
    FROM ${TABLES.shipmentItems}
    GROUP BY tiktokShowId, importId, shipmentId
  )
`;

// Scan count per sticker within a shipment — used to pro-rate bundle revenue.
// A bundle = one sticker (e.g. AUC1-95) sold as a set of N physical items, all recording the same set price.
// Dividing soldPrice by sticker_scan_count gives correct per-item revenue contribution.
// Different stickers in the same shipment are separate auction wins — each has sticker_scan_count=1.
const TSS_STICKER_SCAN_COUNT = `
  (
    SELECT tiktokShowId, importId, shipmentId, auctionStickerNumber,
           COUNT(*) AS sticker_scan_count
    FROM ${TABLES.shipmentScans}
    WHERE result = 'matched'
      AND productSku IS NOT NULL AND productSku <> ''
      AND previousQuantity IS NOT NULL
      AND newQuantity = previousQuantity - 1
    GROUP BY tiktokShowId, importId, shipmentId, auctionStickerNumber
  )
`;

// Total fulfilled scan count per shipment — used to split the $0.30 flat fee across all items in that shipment.
// A shipment with 3 different stickers (3 auction wins) shares one $0.30 fee, so each item bears $0.10.
// This is distinct from TSS_STICKER_SCAN_COUNT which groups within a sticker (for bundle revenue pro-rating).
const TSS_SHIPMENT_SCAN_COUNT = `
  (
    SELECT tiktokShowId, importId, shipmentId,
           COUNT(*) AS shipment_scan_count
    FROM ${TABLES.shipmentScans}
    WHERE result = 'matched'
      AND productSku IS NOT NULL AND productSku <> ''
      AND previousQuantity IS NOT NULL
      AND newQuantity = previousQuantity - 1
    GROUP BY tiktokShowId, importId, shipmentId
  )
`;

// TikTok fee constants (referral 6% + payment processing 2.9% + $0.30/shipment)
const TIKTOK_COMMISSION_RATE    = 0.06;
const TIKTOK_PROCESSING_RATE    = 0.029;
const TIKTOK_PROCESSING_FIXED   = 0.30;

// â”€â”€â”€ Subqueries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Per-shipment close summary (mirrors Whatnot pattern)
const SHIPMENT_CLOSE_SUMMARY_SUBQUERY = `
  (
    SELECT
      tiktokShowId,
      importId,
      shipmentId,
      MAX(closedAt)  AS closedAt,
      MAX(closedBy)  AS closedBy,
      MAX(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) AS hasPendingReview,
      MAX(createdAt) AS importedAt
    FROM ${TABLES.shipmentItems}
    GROUP BY tiktokShowId, importId, shipmentId
  )
`;

// Weighted-average active vendor cost per SKU
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

// â”€â”€â”€ Date-range parser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const isDateOnly = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

const parseDateRange = (query) => {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const from = query.from ? new Date(query.from) : defaultFrom;
  let to = query.to ? new Date(query.to) : now;

  if (query.to && isDateOnly(query.to)) {
    to = new Date(to.getTime() + 24 * 60 * 60 * 1000);
  }

  if (isNaN(from.getTime()) || isNaN(to.getTime())) return null;
  return { from: from.toISOString(), to: to.toISOString() };
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Overview KPIs
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-overview", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const showId = req.query.showId ? Number(req.query.showId) : null;

  try {
    const [[completedRow], [discountRow], [pendingRow], [reviewRow], [giveawayRow]] = await Promise.all([
      // Completed (fulfilled via scans) â€” drive from scans to avoid fan-out
      sequelize.query(`
        SELECT
          COUNT(*)                                                          AS completedShipments,
          COUNT(DISTINCT tss.productSku)                                    AS uniqueSkusSold,
          COUNT(DISTINCT CONCAT(tss.tiktokShowId,':',tss.importId,':',tss.shipmentId)) AS uniqueShipments,
          COUNT(DISTINCT tss.tiktokShowId)                                  AS uniqueShows,
          COALESCE(SUM(COALESCE(tss.soldPrice,0) / sc.sticker_scan_count),0)         AS revenue,
          COALESCE(AVG(NULLIF(tss.soldPrice,0) / sc.sticker_scan_count),0)                               AS avgSoldPrice
        FROM ${TABLES.shipmentScans} tss
        JOIN ${TSS_STICKER_SCAN_COUNT} sc ON sc.tiktokShowId=tss.tiktokShowId AND sc.importId=tss.importId AND sc.shipmentId=tss.shipmentId AND sc.auctionStickerNumber=tss.auctionStickerNumber
        WHERE ${fulfilledSaleCondition("tss")}
          AND ${tsiExistsDateFilter("tss")}
          AND (:showId IS NULL OR tss.tiktokShowId = :showId)
      `, { replacements: { from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT }),

      // Total discounts â€” drive from items (tsi has totalDiscount), use EXISTS for scan filter
      sequelize.query(`
        SELECT COALESCE(SUM(COALESCE(tsi.totalDiscount,0)),0) AS totalDiscounts
        FROM ${TABLES.shipmentItems} tsi
        WHERE tsi.placedAt >= :from
          AND tsi.placedAt  < :to
          AND (:showId IS NULL OR tsi.tiktokShowId = :showId)
          AND EXISTS (
            SELECT 1 FROM ${TABLES.shipmentScans} _tss
            WHERE _tss.tiktokShowId = tsi.tiktokShowId
              AND _tss.importId     = tsi.importId
              AND _tss.shipmentId   = tsi.shipmentId
              AND ${fulfilledSaleCondition("_tss")}
          )
      `, { replacements: { from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT }),

      // Pending (not closed, not review, not terminal)
      sequelize.query(`
        SELECT
          COUNT(DISTINCT CONCAT(tsi.tiktokShowId,':',tsi.importId,':',tsi.shipmentId)) AS pendingShipments,
          COALESCE(SUM(COALESCE(tsi.soldPrice,0)),0) AS pendingRevenue
        FROM ${TABLES.shipmentItems} tsi
        WHERE tsi.status = 'ready'
          AND tsi.placedAt >= :from
          AND tsi.placedAt  < :to
          AND tsi.itemCategory NOT IN ('cancelled_order','failed_order','random_giveaway')
          AND (:showId IS NULL OR tsi.tiktokShowId = :showId)
      `, { replacements: { from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT }),

      // Under review
      sequelize.query(`
        SELECT
          COUNT(DISTINCT CONCAT(tsi.tiktokShowId,':',tsi.importId,':',tsi.shipmentId)) AS reviewShipments,
          COALESCE(SUM(COALESCE(tsi.soldPrice,0)),0) AS reviewRevenue
        FROM ${TABLES.shipmentItems} tsi
        WHERE tsi.status = 'pending_review'
          AND tsi.placedAt >= :from
          AND tsi.placedAt  < :to
          AND (:showId IS NULL OR tsi.tiktokShowId = :showId)
      `, { replacements: { from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT }),

      // Random giveaways
      sequelize.query(`
        SELECT
          COUNT(DISTINCT CONCAT(tsi.tiktokShowId,':',tsi.importId,':',tsi.shipmentId)) AS randomGiveawayShipments,
          COALESCE(SUM(COALESCE(tsi.expectedQty,0)),0) AS randomGiveawayUnits
        FROM ${TABLES.shipmentItems} tsi
        WHERE tsi.itemCategory = 'random_giveaway'
          AND tsi.placedAt >= :from
          AND tsi.placedAt  < :to
          AND (:showId IS NULL OR tsi.tiktokShowId = :showId)
      `, { replacements: { from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT }),
    ]);

    return res.json({
      revenue:                  Number(completedRow?.revenue               || 0),
      avgSoldPrice:             Number(Number(completedRow?.avgSoldPrice   || 0).toFixed(2)),
      completedShipments:       Number(completedRow?.completedShipments    || 0),
      uniqueSkusSold:           Number(completedRow?.uniqueSkusSold        || 0),
      uniqueShows:              Number(completedRow?.uniqueShows           || 0),
      totalDiscounts:           Number(discountRow?.totalDiscounts         || 0),
      pendingShipments:         Number(pendingRow?.pendingShipments        || 0),
      pendingRevenue:           Number(pendingRow?.pendingRevenue          || 0),
      reviewShipments:          Number(reviewRow?.reviewShipments          || 0),
      reviewRevenue:            Number(reviewRow?.reviewRevenue            || 0),
      randomGiveawayShipments:  Number(giveawayRow?.randomGiveawayShipments || 0),
      randomGiveawayUnits:      Number(giveawayRow?.randomGiveawayUnits    || 0),
    });
  } catch (err) {
    console.error("TikTok analytics overview error:", err);
    return res.status(500).json({ error: "Failed to fetch overview" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Revenue Trend (by placedAt)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-trend", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });

  const { granularity = "day" } = req.query;
  const showId = req.query.showId ? Number(req.query.showId) : null;

  const bucketExpr =
    granularity === "month" ? "DATE_FORMAT(tsi.placedAt, '%Y-%m-01')"
    : granularity === "week" ? "DATE_FORMAT(DATE_SUB(tsi.placedAt, INTERVAL WEEKDAY(tsi.placedAt) DAY), '%Y-%m-%d')"
    : "DATE_FORMAT(tsi.placedAt, '%Y-%m-%d')";

  try {
    const rows = await sequelize.query(`
      SELECT
        ${bucketExpr} AS bucket,
        COUNT(*) AS unitsSold,
        COALESCE(SUM(COALESCE(tss.soldPrice,0) / sc.sticker_scan_count),0) AS revenue,
        COUNT(DISTINCT CONCAT(tss.tiktokShowId,':',tss.importId,':',tss.shipmentId)) AS completedShipments
      FROM ${TABLES.shipmentScans} tss
      JOIN ${TSI_ONE_PER_SHIPMENT} tsi
        ON tsi.tiktokShowId = tss.tiktokShowId
       AND tsi.importId     = tss.importId
       AND tsi.shipmentId   = tss.shipmentId
      JOIN ${TSS_STICKER_SCAN_COUNT} sc ON sc.tiktokShowId=tss.tiktokShowId AND sc.importId=tss.importId AND sc.shipmentId=tss.shipmentId AND sc.auctionStickerNumber=tss.auctionStickerNumber
      WHERE ${fulfilledSaleCondition("tss")}
        AND tsi.placedAt >= :from
        AND tsi.placedAt  < :to
        AND (:showId IS NULL OR tss.tiktokShowId = :showId)
      GROUP BY bucket
      ORDER BY bucket ASC
    `, { replacements: { from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT });

    return res.json(rows.map(r => ({
      ...r,
      unitsSold:           Number(r.unitsSold           || 0),
      revenue:             Number(Number(r.revenue       || 0).toFixed(2)),
      completedShipments:  Number(r.completedShipments  || 0),
    })));
  } catch (err) {
    console.error("TikTok trend error:", err);
    return res.status(500).json({ error: "Failed to fetch trend" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Shows list (for filter dropdown)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-shows", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  try {
    const shows = await TikTokShow.findAll({
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
      raw: true,
    });
    return res.json(shows);
  } catch (err) {
    console.error("TikTok shows error:", err);
    return res.status(500).json({ error: "Failed to fetch shows" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Revenue / units by show
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-by-show", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const showId = req.query.showId ? Number(req.query.showId) : null;
  const limit  = Math.min(Number(req.query.limit || 15), 50);

  try {
    const rows = await sequelize.query(`
      SELECT
        tss.tiktokShowId                                                           AS showId,
        MAX(ts.name)                                                               AS showName,
        COUNT(*)                                                                   AS unitsSold,
        COALESCE(SUM(COALESCE(tss.soldPrice,0) / sc.sticker_scan_count),0)                AS revenue,
        COALESCE(AVG(NULLIF(tss.soldPrice,0) / sc.sticker_scan_count),0)             AS avgSoldPrice,
        COUNT(DISTINCT CONCAT(tss.tiktokShowId,':',tss.importId,':',tss.shipmentId)) AS completedShipments
      FROM ${TABLES.shipmentScans} tss
      JOIN ${TABLES.shows} ts  ON ts.id = tss.tiktokShowId
      JOIN ${TSS_STICKER_SCAN_COUNT} sc ON sc.tiktokShowId=tss.tiktokShowId AND sc.importId=tss.importId AND sc.shipmentId=tss.shipmentId AND sc.auctionStickerNumber=tss.auctionStickerNumber
      WHERE ${fulfilledSaleCondition("tss")}
        AND ${tsiExistsDateFilter("tss")}
        AND (:showId IS NULL OR tss.tiktokShowId = :showId)
      GROUP BY tss.tiktokShowId
      ORDER BY revenue DESC
      LIMIT :limit
    `, { replacements: { from: range.from, to: range.to, showId, limit }, type: sequelize.QueryTypes.SELECT });

    return res.json(rows.map(r => ({
      ...r,
      unitsSold:          Number(r.unitsSold          || 0),
      revenue:            Number(Number(r.revenue      || 0).toFixed(2)),
      avgSoldPrice:       Number(Number(r.avgSoldPrice || 0).toFixed(2)),
      completedShipments: Number(r.completedShipments || 0),
    })));
  } catch (err) {
    console.error("TikTok by-show error:", err);
    return res.status(500).json({ error: "Failed to fetch show revenue" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Top products by revenue
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-top-products", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const showId = req.query.showId ? Number(req.query.showId) : null;
  const limit  = Math.min(Number(req.query.limit || 25), 100);

  try {
    const rows = await sequelize.query(`
      SELECT
        tss.productSku                                    AS sku,
        MAX(p.brand)                                      AS brand,
        MAX(p.itemName)                                   AS itemName,
        COUNT(*)                                          AS unitsSold,
        COALESCE(SUM(COALESCE(tss.soldPrice,0) / sc.sticker_scan_count),0) AS revenue,
        COALESCE(AVG(NULLIF(tss.soldPrice,0) / sc.sticker_scan_count),0)          AS avgSoldPrice,
        COALESCE(MIN(tss.soldPrice / sc.sticker_scan_count),0)                    AS lowestSoldPrice,
        COALESCE(MAX(tss.soldPrice / sc.sticker_scan_count),0)                    AS highestSoldPrice
      FROM ${TABLES.shipmentScans} tss
      LEFT JOIN ${TABLES.products} p
        ON ${skuJoinCondition("p.sku", "tss.productSku")}
      JOIN ${TSS_STICKER_SCAN_COUNT} sc ON sc.tiktokShowId=tss.tiktokShowId AND sc.importId=tss.importId AND sc.shipmentId=tss.shipmentId AND sc.auctionStickerNumber=tss.auctionStickerNumber
      WHERE ${fulfilledSaleCondition("tss")}
        AND ${tsiExistsDateFilter("tss")}
        AND (:showId IS NULL OR tss.tiktokShowId = :showId)
      GROUP BY tss.productSku
      ORDER BY revenue DESC
      LIMIT :limit
    `, { replacements: { from: range.from, to: range.to, showId, limit }, type: sequelize.QueryTypes.SELECT });

    return res.json(rows.map(r => ({
      ...r,
      unitsSold:       Number(r.unitsSold       || 0),
      revenue:         Number(Number(r.revenue   || 0).toFixed(2)),
      avgSoldPrice:    Number(Number(r.avgSoldPrice || 0).toFixed(2)),
      lowestSoldPrice: Number(Number(r.lowestSoldPrice || 0).toFixed(2)),
      highestSoldPrice:Number(Number(r.highestSoldPrice|| 0).toFixed(2)),
    })));
  } catch (err) {
    console.error("TikTok top-products error:", err);
    return res.status(500).json({ error: "Failed to fetch top products" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Brand revenue mix
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-brand-mix", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const showId = req.query.showId ? Number(req.query.showId) : null;
  const limit  = Math.min(Number(req.query.limit || 15), 50);

  try {
    const rows = await sequelize.query(`
      SELECT
        COALESCE(p.brand, 'Unknown') AS brand,
        COUNT(*)                      AS unitsSold,
        COALESCE(SUM(COALESCE(tss.soldPrice,0) / sc.sticker_scan_count),0) AS revenue
      FROM ${TABLES.shipmentScans} tss
      LEFT JOIN ${TABLES.products} p
        ON ${skuJoinCondition("p.sku", "tss.productSku")}
      JOIN ${TSS_STICKER_SCAN_COUNT} sc ON sc.tiktokShowId=tss.tiktokShowId AND sc.importId=tss.importId AND sc.shipmentId=tss.shipmentId AND sc.auctionStickerNumber=tss.auctionStickerNumber
      WHERE ${fulfilledSaleCondition("tss")}
        AND ${tsiExistsDateFilter("tss")}
        AND (:showId IS NULL OR tss.tiktokShowId = :showId)
      GROUP BY COALESCE(p.brand,'Unknown')
      ORDER BY revenue DESC
      LIMIT :limit
    `, { replacements: { from: range.from, to: range.to, showId, limit }, type: sequelize.QueryTypes.SELECT });

    return res.json(rows.map(r => ({
      ...r,
      unitsSold: Number(r.unitsSold || 0),
      revenue:   Number(Number(r.revenue || 0).toFixed(2)),
    })));
  } catch (err) {
    console.error("TikTok brand-mix error:", err);
    return res.status(500).json({ error: "Failed to fetch brand mix" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Sales mix by item category
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-sales-mix", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const showId = req.query.showId ? Number(req.query.showId) : null;

  try {
    const rows = await sequelize.query(`
      SELECT
        COALESCE(tsi.itemCategory,'others') AS contextType,
        COUNT(*)                             AS unitsSold,
        COALESCE(SUM(COALESCE(tss.soldPrice,0) / sc.sticker_scan_count),0) AS revenue
      FROM ${TABLES.shipmentScans} tss
      JOIN ${TSI_ONE_PER_SHIPMENT} tsi
        ON tsi.tiktokShowId = tss.tiktokShowId
       AND tsi.importId     = tss.importId
       AND tsi.shipmentId   = tss.shipmentId
      JOIN ${TSS_STICKER_SCAN_COUNT} sc ON sc.tiktokShowId=tss.tiktokShowId AND sc.importId=tss.importId AND sc.shipmentId=tss.shipmentId AND sc.auctionStickerNumber=tss.auctionStickerNumber
      WHERE ${fulfilledSaleCondition("tss")}
        AND tsi.placedAt >= :from
        AND tsi.placedAt  < :to
        AND (:showId IS NULL OR tss.tiktokShowId = :showId)
      GROUP BY COALESCE(tsi.itemCategory,'others')
      ORDER BY revenue DESC
    `, { replacements: { from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT });

    return res.json(rows.map(r => ({
      ...r,
      unitsSold: Number(r.unitsSold || 0),
      revenue:   Number(Number(r.revenue || 0).toFixed(2)),
    })));
  } catch (err) {
    console.error("TikTok sales-mix error:", err);
    return res.status(500).json({ error: "Failed to fetch sales mix" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Profitability overview
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-profitability-overview", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const showId = req.query.showId ? Number(req.query.showId) : null;

  try {
    const [rows] = await sequelize.query(`
      SELECT
        COUNT(*)                                                            AS totalUnitsSold,
        COALESCE(SUM(COALESCE(tss.soldPrice,0) / sc.sticker_scan_count),0)         AS totalRevenue,

        -- Known-cost units (have a vendor price on file)
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN COALESCE(tss.soldPrice,0) / sc.sticker_scan_count ELSE 0 END),0) AS knownCostRevenue,
        COUNT(CASE WHEN vc.avgVendorCost IS NOT NULL THEN 1 END)            AS knownCostUnits,

        -- Unknown-cost units
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NULL THEN COALESCE(tss.soldPrice,0) / sc.sticker_scan_count ELSE 0 END),0)  AS unknownCostRevenue,
        COUNT(CASE WHEN vc.avgVendorCost IS NULL THEN 1 END)                AS unknownCostUnits,

        -- Estimated vendor cost
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN vc.avgVendorCost ELSE 0 END),0) AS estimatedCost,

        -- Gross margin (revenue - cost on known units)
        COALESCE(
          SUM(CASE WHEN vc.avgVendorCost IS NOT NULL
            THEN COALESCE(tss.soldPrice,0) / sc.sticker_scan_count - vc.avgVendorCost
            ELSE 0 END),
          0
        ) AS grossMargin,

        -- TikTok fees (commission + processing) on all revenue
        COALESCE(
          SUM(
            (COALESCE(tss.soldPrice,0) / sc.sticker_scan_count * ${TIKTOK_COMMISSION_RATE})
            + (COALESCE(tss.soldPrice,0) / sc.sticker_scan_count * ${TIKTOK_PROCESSING_RATE} + ${TIKTOK_PROCESSING_FIXED} / ss.shipment_scan_count)
          ),
          0
        ) AS tiktokFees,

        -- Net margin after fees
        COALESCE(
          SUM(CASE WHEN vc.avgVendorCost IS NOT NULL
            THEN COALESCE(tss.soldPrice,0) / sc.sticker_scan_count - vc.avgVendorCost
               - (COALESCE(tss.soldPrice,0) / sc.sticker_scan_count * ${TIKTOK_COMMISSION_RATE})
               - (COALESCE(tss.soldPrice,0) / sc.sticker_scan_count * ${TIKTOK_PROCESSING_RATE} + ${TIKTOK_PROCESSING_FIXED} / ss.shipment_scan_count)
            ELSE 0 END),
          0
        ) AS netMarginAfterFees,

        -- Negative-margin units
        COUNT(CASE WHEN vc.avgVendorCost IS NOT NULL
          AND (COALESCE(tss.soldPrice,0) / sc.sticker_scan_count - vc.avgVendorCost
               - (COALESCE(tss.soldPrice,0) / sc.sticker_scan_count * ${TIKTOK_COMMISSION_RATE})
               - (COALESCE(tss.soldPrice,0) / sc.sticker_scan_count * ${TIKTOK_PROCESSING_RATE} + ${TIKTOK_PROCESSING_FIXED} / ss.shipment_scan_count)
              ) < 0
          THEN 1 END) AS negativeMarginUnits,

        -- Low-margin units (â‰¥0 but <10%)
        COUNT(CASE WHEN vc.avgVendorCost IS NOT NULL
          AND COALESCE(tss.soldPrice,0) / sc.sticker_scan_count > 0
          AND (COALESCE(tss.soldPrice,0) / sc.sticker_scan_count - vc.avgVendorCost
               - (COALESCE(tss.soldPrice,0) / sc.sticker_scan_count * ${TIKTOK_COMMISSION_RATE})
               - (COALESCE(tss.soldPrice,0) / sc.sticker_scan_count * ${TIKTOK_PROCESSING_RATE} + ${TIKTOK_PROCESSING_FIXED} / ss.shipment_scan_count)
              ) / (COALESCE(tss.soldPrice,0) / sc.sticker_scan_count) BETWEEN 0 AND 0.10
          THEN 1 END) AS lowMarginUnits
      FROM ${TABLES.shipmentScans} tss
      LEFT JOIN ${ACTIVE_VENDOR_COST_SUBQUERY} vc
        ON ${skuJoinCondition("vc.sku", "tss.productSku")}
      JOIN ${TSS_STICKER_SCAN_COUNT} sc ON sc.tiktokShowId=tss.tiktokShowId AND sc.importId=tss.importId AND sc.shipmentId=tss.shipmentId AND sc.auctionStickerNumber=tss.auctionStickerNumber
      JOIN ${TSS_SHIPMENT_SCAN_COUNT} ss ON ss.tiktokShowId=tss.tiktokShowId AND ss.importId=tss.importId AND ss.shipmentId=tss.shipmentId
      WHERE ${fulfilledSaleCondition("tss")}
        AND ${tsiExistsDateFilter("tss")}
        AND (:showId IS NULL OR tss.tiktokShowId = :showId)
    `, { replacements: { from: range.from, to: range.to, showId } });

    const r = rows[0] || {};
    const totalRevenue       = Number(r.totalRevenue       || 0);
    const grossMargin        = Number(r.grossMargin        || 0);
    const tiktokFees         = Number(r.tiktokFees         || 0);
    const netMarginAfterFees = Number(r.netMarginAfterFees || 0);

    return res.json({
      totalUnitsSold:       Number(r.totalUnitsSold       || 0),
      totalRevenue:         Number(totalRevenue.toFixed(2)),
      knownCostRevenue:     Number(Number(r.knownCostRevenue || 0).toFixed(2)),
      knownCostUnits:       Number(r.knownCostUnits        || 0),
      unknownCostRevenue:   Number(Number(r.unknownCostRevenue || 0).toFixed(2)),
      unknownCostUnits:     Number(r.unknownCostUnits       || 0),
      estimatedCost:        Number(Number(r.estimatedCost   || 0).toFixed(2)),
      grossMargin:          Number(grossMargin.toFixed(2)),
      grossMarginPct:       totalRevenue > 0 ? Number((grossMargin / totalRevenue * 100).toFixed(1)) : 0,
      tiktokFees:           Number(tiktokFees.toFixed(2)),
      netMarginAfterFees:   Number(netMarginAfterFees.toFixed(2)),
      netMarginAfterFeesPct:totalRevenue > 0 ? Number((netMarginAfterFees / totalRevenue * 100).toFixed(1)) : 0,
      negativeMarginUnits:  Number(r.negativeMarginUnits   || 0),
      lowMarginUnits:       Number(r.lowMarginUnits         || 0),
    });
  } catch (err) {
    console.error("TikTok profitability-overview error:", err);
    return res.status(500).json({ error: "Failed to fetch profitability overview" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Profitability by show
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-profitability-shows", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const showId = req.query.showId ? Number(req.query.showId) : null;
  const limit  = Math.min(Number(req.query.limit || 15), 50);

  try {
    const rows = await sequelize.query(`
      SELECT
        tss.tiktokShowId AS showId,
        MAX(ts.name)     AS showName,
        COUNT(*)         AS unitsSold,
        COALESCE(SUM(COALESCE(tss.soldPrice,0) / sc.sticker_scan_count),0) AS revenue,
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN COALESCE(tss.soldPrice,0) / sc.sticker_scan_count ELSE 0 END),0) AS knownCostRevenue,
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN vc.avgVendorCost ELSE 0 END),0) AS estimatedCost,
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN COALESCE(tss.soldPrice,0) / sc.sticker_scan_count - vc.avgVendorCost ELSE 0 END),0) AS grossMargin,
        COALESCE(SUM(
          (COALESCE(tss.soldPrice,0) / sc.sticker_scan_count * ${TIKTOK_COMMISSION_RATE})
          + (COALESCE(tss.soldPrice,0) / sc.sticker_scan_count * ${TIKTOK_PROCESSING_RATE} + ${TIKTOK_PROCESSING_FIXED} / ss.shipment_scan_count)
        ),0) AS tiktokFees,
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL
          THEN COALESCE(tss.soldPrice,0) / sc.sticker_scan_count - vc.avgVendorCost
             - (COALESCE(tss.soldPrice,0) / sc.sticker_scan_count * ${TIKTOK_COMMISSION_RATE})
             - (COALESCE(tss.soldPrice,0) / sc.sticker_scan_count * ${TIKTOK_PROCESSING_RATE} + ${TIKTOK_PROCESSING_FIXED} / ss.shipment_scan_count)
          ELSE 0 END),0) AS netMarginAfterFees
      FROM ${TABLES.shipmentScans} tss
      JOIN ${TABLES.shows} ts ON ts.id = tss.tiktokShowId
      LEFT JOIN ${ACTIVE_VENDOR_COST_SUBQUERY} vc ON ${skuJoinCondition("vc.sku","tss.productSku")}
      JOIN ${TSS_STICKER_SCAN_COUNT} sc ON sc.tiktokShowId=tss.tiktokShowId AND sc.importId=tss.importId AND sc.shipmentId=tss.shipmentId AND sc.auctionStickerNumber=tss.auctionStickerNumber
      JOIN ${TSS_SHIPMENT_SCAN_COUNT} ss ON ss.tiktokShowId=tss.tiktokShowId AND ss.importId=tss.importId AND ss.shipmentId=tss.shipmentId
      WHERE ${fulfilledSaleCondition("tss")}
        AND ${tsiExistsDateFilter("tss")}
        AND (:showId IS NULL OR tss.tiktokShowId = :showId)
      GROUP BY tss.tiktokShowId
      ORDER BY revenue DESC
      LIMIT :limit
    `, { replacements: { from: range.from, to: range.to, showId, limit }, type: sequelize.QueryTypes.SELECT });

    return res.json(rows.map(r => {
      const knownCostRevenue  = Number(r.knownCostRevenue  || 0);
      const netMarginAfterFees = Number(r.netMarginAfterFees || 0);
      return {
        ...r,
        unitsSold:            Number(r.unitsSold           || 0),
        revenue:              Number(Number(r.revenue      || 0).toFixed(2)),
        knownCostRevenue:     Number(knownCostRevenue.toFixed(2)),
        estimatedCost:        Number(Number(r.estimatedCost|| 0).toFixed(2)),
        grossMargin:          Number(Number(r.grossMargin  || 0).toFixed(2)),
        tiktokFees:           Number(Number(r.tiktokFees   || 0).toFixed(2)),
        netMarginAfterFees:   Number(netMarginAfterFees.toFixed(2)),
        netMarginAfterFeesPct:knownCostRevenue > 0 ? Number((netMarginAfterFees / knownCostRevenue * 100).toFixed(1)) : 0,
      };
    }));
  } catch (err) {
    console.error("TikTok profitability-shows error:", err);
    return res.status(500).json({ error: "Failed to fetch show profitability" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Brand profitability
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-brand-profitability", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const showId = req.query.showId ? Number(req.query.showId) : null;
  const limit  = Math.min(Number(req.query.limit || 15), 50);

  try {
    const rows = await sequelize.query(`
      SELECT
        COALESCE(p.brand,'Unknown') AS brand,
        COUNT(*) AS unitsSold,
        COALESCE(SUM(COALESCE(tss.soldPrice,0) / sc.sticker_scan_count),0) AS revenue,
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN COALESCE(tss.soldPrice,0) / sc.sticker_scan_count ELSE 0 END),0) AS knownCostRevenue,
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN vc.avgVendorCost ELSE 0 END),0) AS estimatedCost,
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN COALESCE(tss.soldPrice,0) / sc.sticker_scan_count - vc.avgVendorCost ELSE 0 END),0) AS grossMargin,
        COUNT(CASE WHEN vc.avgVendorCost IS NULL THEN 1 END) AS unknownCostUnits
      FROM ${TABLES.shipmentScans} tss
      LEFT JOIN ${TABLES.products} p ON ${skuJoinCondition("p.sku","tss.productSku")}
      LEFT JOIN ${ACTIVE_VENDOR_COST_SUBQUERY} vc ON ${skuJoinCondition("vc.sku","tss.productSku")}
      JOIN ${TSS_STICKER_SCAN_COUNT} sc ON sc.tiktokShowId=tss.tiktokShowId AND sc.importId=tss.importId AND sc.shipmentId=tss.shipmentId AND sc.auctionStickerNumber=tss.auctionStickerNumber
      WHERE ${fulfilledSaleCondition("tss")}
        AND ${tsiExistsDateFilter("tss")}
        AND (:showId IS NULL OR tss.tiktokShowId = :showId)
      GROUP BY COALESCE(p.brand,'Unknown')
      ORDER BY revenue DESC
      LIMIT :limit
    `, { replacements: { from: range.from, to: range.to, showId, limit }, type: sequelize.QueryTypes.SELECT });

    return res.json(rows.map(r => ({
      ...r,
      unitsSold:        Number(r.unitsSold        || 0),
      revenue:          Number(Number(r.revenue    || 0).toFixed(2)),
      knownCostRevenue: Number(Number(r.knownCostRevenue || 0).toFixed(2)),
      estimatedCost:    Number(Number(r.estimatedCost    || 0).toFixed(2)),
      grossMargin:      Number(Number(r.grossMargin      || 0).toFixed(2)),
      grossMarginPct:   Number(r.knownCostRevenue) > 0
        ? Number((Number(r.grossMargin) / Number(r.knownCostRevenue) * 100).toFixed(1)) : 0,
      unknownCostUnits: Number(r.unknownCostUnits || 0),
    })));
  } catch (err) {
    console.error("TikTok brand-profitability error:", err);
    return res.status(500).json({ error: "Failed to fetch brand profitability" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Review queue (aging + reasons + shipment list)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-review-queue", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const showId = req.query.showId ? Number(req.query.showId) : null;

  try {
    const [aging, reasons, shipments] = await Promise.all([
      sequelize.query(`
        SELECT
          CASE
            WHEN DATEDIFF(NOW(), sc.closedAt) <= 1  THEN '0-1 days'
            WHEN DATEDIFF(NOW(), sc.closedAt) <= 3  THEN '2-3 days'
            WHEN DATEDIFF(NOW(), sc.closedAt) <= 7  THEN '4-7 days'
            WHEN DATEDIFF(NOW(), sc.closedAt) <= 14 THEN '8-14 days'
            ELSE '14+ days'
          END AS ageBucket,
          COUNT(DISTINCT CONCAT(tsi.tiktokShowId,':',tsi.importId,':',tsi.shipmentId)) AS shipmentCount,
          COALESCE(SUM(COALESCE(tsi.soldPrice,0)),0) AS affectedRevenue
        FROM ${TABLES.shipmentItems} tsi
        JOIN ${SHIPMENT_CLOSE_SUMMARY_SUBQUERY} sc
          ON sc.tiktokShowId = tsi.tiktokShowId AND sc.importId = tsi.importId AND sc.shipmentId = tsi.shipmentId
        WHERE tsi.status = 'pending_review'
          AND (:showId IS NULL OR tsi.tiktokShowId = :showId)
        GROUP BY ageBucket
        ORDER BY MIN(DATEDIFF(NOW(), sc.closedAt)) ASC
      `, { replacements: { showId }, type: sequelize.QueryTypes.SELECT }),

      sequelize.query(`
        SELECT
          COALESCE(tsi.mismatchReason,'Unknown') AS mismatchReason,
          COUNT(DISTINCT CONCAT(tsi.tiktokShowId,':',tsi.importId,':',tsi.shipmentId)) AS shipmentCount
        FROM ${TABLES.shipmentItems} tsi
        WHERE tsi.status = 'pending_review'
          AND (:showId IS NULL OR tsi.tiktokShowId = :showId)
        GROUP BY COALESCE(tsi.mismatchReason,'Unknown')
        ORDER BY shipmentCount DESC
        LIMIT 10
      `, { replacements: { showId }, type: sequelize.QueryTypes.SELECT }),

      sequelize.query(`
        SELECT
          tsi.tiktokShowId AS showId,
          MAX(ts.name)     AS showName,
          tsi.shipmentId,
          MAX(tsi.tracking)        AS tracking,
          MAX(tsi.mismatchReason)  AS mismatchReason,
          SUM(tsi.expectedQty)     AS expectedQty,
          SUM(tsi.scannedQty)      AS scannedQty,
          COALESCE(SUM(COALESCE(tsi.soldPrice,0)),0) AS affectedRevenue,
          DATEDIFF(NOW(), MAX(sc.closedAt)) AS ageDays,
          tsi.importId
        FROM ${TABLES.shipmentItems} tsi
        JOIN ${TABLES.shows} ts ON ts.id = tsi.tiktokShowId
        JOIN ${SHIPMENT_CLOSE_SUMMARY_SUBQUERY} sc
          ON sc.tiktokShowId = tsi.tiktokShowId AND sc.importId = tsi.importId AND sc.shipmentId = tsi.shipmentId
        WHERE tsi.status = 'pending_review'
          AND (:showId IS NULL OR tsi.tiktokShowId = :showId)
        GROUP BY tsi.tiktokShowId, tsi.importId, tsi.shipmentId
        ORDER BY ageDays DESC
        LIMIT 50
      `, { replacements: { showId }, type: sequelize.QueryTypes.SELECT }),
    ]);

    return res.json({
      aging:     aging.map(r => ({ ...r, shipmentCount: Number(r.shipmentCount || 0), affectedRevenue: Number(Number(r.affectedRevenue || 0).toFixed(2)) })),
      reasons:   reasons.map(r => ({ ...r, shipmentCount: Number(r.shipmentCount || 0) })),
      shipments: shipments.map(r => ({ ...r, expectedQty: Number(r.expectedQty || 0), scannedQty: Number(r.scannedQty || 0), affectedRevenue: Number(Number(r.affectedRevenue || 0).toFixed(2)), ageDays: Number(r.ageDays || 0) })),
    });
  } catch (err) {
    console.error("TikTok review-queue error:", err);
    return res.status(500).json({ error: "Failed to fetch review queue" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Inventory exposure
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-inventory-exposure", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const showId = req.query.showId ? Number(req.query.showId) : null;
  const limit  = Math.min(Number(req.query.limit || 100), 500);

  try {
    const rows = await sequelize.query(`
      SELECT
        tss.productSku                                              AS sku,
        MAX(p.brand)                                               AS brand,
        MAX(p.itemName)                                            AS itemName,
        MAX(COALESCE(p.quantity,0))                                AS currentQty,
        MAX(p.minimumQuantity)                                     AS minimumQuantity,
        COUNT(*)                                                   AS unitsSold,
        ROUND(COUNT(*) / GREATEST(DATEDIFF(:to,:from),1), 2)      AS avgDailySales,
        CASE
          WHEN MAX(COALESCE(p.quantity,0)) = 0 THEN NULL
          WHEN ROUND(COUNT(*) / GREATEST(DATEDIFF(:to,:from),1), 2) = 0 THEN NULL
          ELSE ROUND(MAX(COALESCE(p.quantity,0)) / (COUNT(*) / GREATEST(DATEDIFF(:to,:from),1)))
        END AS daysOfCover,
        -- Gross margin on known-cost units (bundles excluded â€” price can't be attributed per SKU)
        COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN COALESCE(tss.soldPrice,0) / sc.sticker_scan_count - vc.avgVendorCost ELSE 0 END),0) AS grossMargin,
        COUNT(CASE WHEN vc.avgVendorCost IS NULL THEN 1 END) AS unknownCostUnits,
        CASE
          WHEN MAX(COALESCE(p.quantity,0)) = 0 THEN 'critical'
          WHEN (ROUND(COUNT(*) / GREATEST(DATEDIFF(:to,:from),1), 2) = 0) THEN 'no_signal'
          WHEN ROUND(MAX(COALESCE(p.quantity,0)) / (COUNT(*) / GREATEST(DATEDIFF(:to,:from),1))) <= 7  THEN 'critical'
          WHEN ROUND(MAX(COALESCE(p.quantity,0)) / (COUNT(*) / GREATEST(DATEDIFF(:to,:from),1))) <= 14 THEN 'high'
          WHEN ROUND(MAX(COALESCE(p.quantity,0)) / (COUNT(*) / GREATEST(DATEDIFF(:to,:from),1))) <= 30 THEN 'medium'
          ELSE 'low'
        END AS riskBand
      FROM ${TABLES.shipmentScans} tss
      LEFT JOIN ${TABLES.products} p    ON ${skuJoinCondition("p.sku","tss.productSku")}
      LEFT JOIN ${ACTIVE_VENDOR_COST_SUBQUERY} vc ON ${skuJoinCondition("vc.sku","tss.productSku")}
      JOIN ${TSS_STICKER_SCAN_COUNT} sc ON sc.tiktokShowId=tss.tiktokShowId AND sc.importId=tss.importId AND sc.shipmentId=tss.shipmentId AND sc.auctionStickerNumber=tss.auctionStickerNumber
      WHERE ${fulfilledSaleCondition("tss")}
        AND ${tsiExistsDateFilter("tss")}
        AND (:showId IS NULL OR tss.tiktokShowId = :showId)
      GROUP BY tss.productSku
      ORDER BY FIELD(riskBand,'critical','high','medium','low','no_signal'), unitsSold DESC
      LIMIT :limit
    `, { replacements: { from: range.from, to: range.to, showId, limit }, type: sequelize.QueryTypes.SELECT });

    return res.json(rows.map(r => ({
      ...r,
      currentQty:       Number(r.currentQty       || 0),
      unitsSold:        Number(r.unitsSold         || 0),
      avgDailySales:    Number(r.avgDailySales      || 0),
      daysOfCover:      r.daysOfCover !== null ? Number(r.daysOfCover) : null,
      grossMargin:      r.grossMargin  !== null ? Number(Number(r.grossMargin).toFixed(2)) : null,
      unknownCostUnits: Number(r.unknownCostUnits  || 0),
      minimumQuantity:  r.minimumQuantity !== null ? Number(r.minimumQuantity) : null,
    })));
  } catch (err) {
    console.error("TikTok inventory-exposure error:", err);
    return res.status(500).json({ error: "Failed to fetch inventory exposure" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Fulfilment velocity (order lifecycle timing)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-velocity", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const showId = req.query.showId ? Number(req.query.showId) : null;

  try {
    const [summary] = await sequelize.query(`
      SELECT
        COUNT(*)                                                              AS totalOrders,
        -- Avg days: placed â†' paid
        ROUND(AVG(CASE WHEN tsi.paidAt IS NOT NULL AND tsi.placedAt IS NOT NULL
          THEN TIMESTAMPDIFF(HOUR, tsi.placedAt, tsi.paidAt) / 24.0 END),1) AS avgDaysPlacedToPaid,
        -- Avg days: placed â†' RTS
        ROUND(AVG(CASE WHEN tsi.rtsAt IS NOT NULL AND tsi.placedAt IS NOT NULL
          THEN TIMESTAMPDIFF(HOUR, tsi.placedAt, tsi.rtsAt) / 24.0 END),1)  AS avgDaysPlacedToRts,
        -- Avg days: placed â†' shipped
        ROUND(AVG(CASE WHEN tsi.shippedAt IS NOT NULL AND tsi.placedAt IS NOT NULL
          THEN TIMESTAMPDIFF(HOUR, tsi.placedAt, tsi.shippedAt) / 24.0 END),1) AS avgDaysPlacedToShipped,
        -- Avg days: placed â†' delivered
        ROUND(AVG(CASE WHEN tsi.deliveredAt IS NOT NULL AND tsi.placedAt IS NOT NULL
          THEN TIMESTAMPDIFF(HOUR, tsi.placedAt, tsi.deliveredAt) / 24.0 END),1) AS avgDaysPlacedToDelivered,
        -- Avg days: shipped â†' delivered (transit time)
        ROUND(AVG(CASE WHEN tsi.deliveredAt IS NOT NULL AND tsi.shippedAt IS NOT NULL
          THEN TIMESTAMPDIFF(HOUR, tsi.shippedAt, tsi.deliveredAt) / 24.0 END),1) AS avgTransitDays,
        -- Cancelled count
        COUNT(CASE WHEN tsi.cancelledAt IS NOT NULL THEN 1 END)              AS cancelledOrders,
        -- Pct with tracking
        ROUND(100.0 * COUNT(CASE WHEN tsi.tracking IS NOT NULL AND tsi.tracking <> '' THEN 1 END) / COUNT(*), 1) AS pctWithTracking
      FROM ${TABLES.shipmentItems} tsi
      WHERE tsi.placedAt >= :from AND tsi.placedAt < :to
        AND tsi.itemCategory NOT IN ('cancelled_order','failed_order')
        AND (:showId IS NULL OR tsi.tiktokShowId = :showId)
    `, { replacements: { from: range.from, to: range.to, showId } });

    // Time-to-ship distribution (histogram)
    const histogram = await sequelize.query(`
      SELECT
        CASE
          WHEN TIMESTAMPDIFF(HOUR, tsi.placedAt, tsi.shippedAt) < 24    THEN 'Same Day'
          WHEN TIMESTAMPDIFF(HOUR, tsi.placedAt, tsi.shippedAt) < 48    THEN '1 Day'
          WHEN TIMESTAMPDIFF(HOUR, tsi.placedAt, tsi.shippedAt) < 72    THEN '2 Days'
          WHEN TIMESTAMPDIFF(HOUR, tsi.placedAt, tsi.shippedAt) < 120   THEN '3-4 Days'
          WHEN TIMESTAMPDIFF(HOUR, tsi.placedAt, tsi.shippedAt) < 168   THEN '5-6 Days'
          ELSE '7+ Days'
        END AS bucket,
        COUNT(DISTINCT tsi.shipmentId) AS shipmentCount
      FROM ${TABLES.shipmentItems} tsi
      WHERE tsi.shippedAt IS NOT NULL AND tsi.placedAt IS NOT NULL
        AND tsi.placedAt >= :from AND tsi.placedAt < :to
        AND (:showId IS NULL OR tsi.tiktokShowId = :showId)
      GROUP BY bucket
      ORDER BY MIN(TIMESTAMPDIFF(HOUR, tsi.placedAt, tsi.shippedAt)) ASC
    `, { replacements: { from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT });

    const s = summary[0][0] || {};
    return res.json({
      totalOrders:              Number(s.totalOrders              || 0),
      avgDaysPlacedToPaid:      s.avgDaysPlacedToPaid      != null ? Number(s.avgDaysPlacedToPaid)      : null,
      avgDaysPlacedToRts:       s.avgDaysPlacedToRts       != null ? Number(s.avgDaysPlacedToRts)       : null,
      avgDaysPlacedToShipped:   s.avgDaysPlacedToShipped   != null ? Number(s.avgDaysPlacedToShipped)   : null,
      avgDaysPlacedToDelivered: s.avgDaysPlacedToDelivered != null ? Number(s.avgDaysPlacedToDelivered) : null,
      avgTransitDays:           s.avgTransitDays           != null ? Number(s.avgTransitDays)           : null,
      cancelledOrders:          Number(s.cancelledOrders   || 0),
      pctWithTracking:          Number(s.pctWithTracking   || 0),
      histogram: histogram.map(r => ({ ...r, shipmentCount: Number(r.shipmentCount || 0) })),
    });
  } catch (err) {
    console.error("TikTok velocity error:", err);
    return res.status(500).json({ error: "Failed to fetch velocity" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Shipping providers
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-shipping-providers", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const showId = req.query.showId ? Number(req.query.showId) : null;

  try {
    const rows = await sequelize.query(`
      SELECT
        COALESCE(tsi.shippingProviderName,'Unknown') AS provider,
        COUNT(DISTINCT tsi.shipmentId)               AS shipmentCount,
        COALESCE(SUM(COALESCE(tsi.soldPrice,0)),0)   AS revenue
      FROM ${TABLES.shipmentItems} tsi
      WHERE tsi.placedAt >= :from AND tsi.placedAt < :to
        AND tsi.itemCategory NOT IN ('cancelled_order','failed_order')
        AND (:showId IS NULL OR tsi.tiktokShowId = :showId)
      GROUP BY COALESCE(tsi.shippingProviderName,'Unknown')
      ORDER BY shipmentCount DESC
      LIMIT 15
    `, { replacements: { from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT });

    return res.json(rows.map(r => ({
      ...r,
      shipmentCount: Number(r.shipmentCount || 0),
      revenue:       Number(Number(r.revenue || 0).toFixed(2)),
    })));
  } catch (err) {
    console.error("TikTok shipping-providers error:", err);
    return res.status(500).json({ error: "Failed to fetch shipping providers" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Delivery options
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-delivery-options", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const showId = req.query.showId ? Number(req.query.showId) : null;

  try {
    const rows = await sequelize.query(`
      SELECT
        COALESCE(tsi.deliveryOption,'Unknown') AS deliveryOption,
        COUNT(DISTINCT tsi.shipmentId)          AS shipmentCount,
        COALESCE(SUM(COALESCE(tsi.soldPrice,0)),0) AS revenue
      FROM ${TABLES.shipmentItems} tsi
      WHERE tsi.placedAt >= :from AND tsi.placedAt < :to
        AND tsi.itemCategory NOT IN ('cancelled_order','failed_order')
        AND (:showId IS NULL OR tsi.tiktokShowId = :showId)
      GROUP BY COALESCE(tsi.deliveryOption,'Unknown')
      ORDER BY shipmentCount DESC
      LIMIT 10
    `, { replacements: { from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT });

    return res.json(rows.map(r => ({
      ...r,
      shipmentCount: Number(r.shipmentCount || 0),
      revenue:       Number(Number(r.revenue || 0).toFixed(2)),
    })));
  } catch (err) {
    console.error("TikTok delivery-options error:", err);
    return res.status(500).json({ error: "Failed to fetch delivery options" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Payment methods
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-payment-methods", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const showId = req.query.showId ? Number(req.query.showId) : null;

  try {
    const rows = await sequelize.query(`
      SELECT
        COALESCE(tsi.paymentMethod,'Unknown') AS paymentMethod,
        COUNT(DISTINCT tsi.shipmentId)         AS shipmentCount,
        COALESCE(SUM(COALESCE(tsi.soldPrice,0)),0) AS revenue
      FROM ${TABLES.shipmentItems} tsi
      WHERE tsi.placedAt >= :from AND tsi.placedAt < :to
        AND tsi.itemCategory NOT IN ('cancelled_order','failed_order')
        AND (:showId IS NULL OR tsi.tiktokShowId = :showId)
      GROUP BY COALESCE(tsi.paymentMethod,'Unknown')
      ORDER BY revenue DESC
      LIMIT 10
    `, { replacements: { from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT });

    return res.json(rows.map(r => ({
      ...r,
      shipmentCount: Number(r.shipmentCount || 0),
      revenue:       Number(Number(r.revenue || 0).toFixed(2)),
    })));
  } catch (err) {
    console.error("TikTok payment-methods error:", err);
    return res.status(500).json({ error: "Failed to fetch payment methods" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Revenue by state
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-by-state", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const showId = req.query.showId ? Number(req.query.showId) : null;

  try {
    const rows = await sequelize.query(`
      SELECT
        COALESCE(NULLIF(TRIM(tsi.state),''),'Unknown') AS state,
        COUNT(DISTINCT tsi.shipmentId)                   AS orderCount,
        COALESCE(SUM(COALESCE(tsi.soldPrice,0)),0)       AS revenue,
        COUNT(*)                                          AS unitsSold
      FROM ${TABLES.shipmentItems} tsi
      WHERE tsi.placedAt >= :from AND tsi.placedAt < :to
        AND tsi.itemCategory NOT IN ('cancelled_order','failed_order')
        AND (:showId IS NULL OR tsi.tiktokShowId = :showId)
      GROUP BY COALESCE(NULLIF(TRIM(tsi.state),''),'Unknown')
      ORDER BY revenue DESC
      LIMIT 20
    `, { replacements: { from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT });

    return res.json(rows.map(r => ({
      ...r,
      orderCount: Number(r.orderCount || 0),
      revenue:    Number(Number(r.revenue || 0).toFixed(2)),
      unitsSold:  Number(r.unitsSold  || 0),
    })));
  } catch (err) {
    console.error("TikTok by-state error:", err);
    return res.status(500).json({ error: "Failed to fetch state data" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Revenue by city
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-by-city", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const showId = req.query.showId ? Number(req.query.showId) : null;

  try {
    const rows = await sequelize.query(`
      SELECT
        COALESCE(NULLIF(TRIM(tsi.city),''),'Unknown')  AS city,
        COALESCE(NULLIF(TRIM(tsi.state),''),'')        AS state,
        COUNT(DISTINCT tsi.shipmentId)                   AS orderCount,
        COALESCE(SUM(COALESCE(tsi.soldPrice,0)),0)       AS revenue
      FROM ${TABLES.shipmentItems} tsi
      WHERE tsi.placedAt >= :from AND tsi.placedAt < :to
        AND tsi.itemCategory NOT IN ('cancelled_order','failed_order')
        AND (:showId IS NULL OR tsi.tiktokShowId = :showId)
      GROUP BY COALESCE(NULLIF(TRIM(tsi.city),''),'Unknown'), COALESCE(NULLIF(TRIM(tsi.state),''),'')
      ORDER BY revenue DESC
      LIMIT 20
    `, { replacements: { from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT });

    return res.json(rows.map(r => ({
      ...r,
      orderCount: Number(r.orderCount || 0),
      revenue:    Number(Number(r.revenue || 0).toFixed(2)),
    })));
  } catch (err) {
    console.error("TikTok by-city error:", err);
    return res.status(500).json({ error: "Failed to fetch city data" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Discount impact by show
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-discount-impact", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const showId = req.query.showId ? Number(req.query.showId) : null;

  try {
    const rows = await sequelize.query(`
      SELECT
        tsi.tiktokShowId AS showId,
        MAX(ts.name)     AS showName,
        COUNT(DISTINCT tsi.shipmentId) AS orderCount,
        COALESCE(SUM(COALESCE(tsi.soldPrice,0)),0)            AS revenue,
        COALESCE(SUM(COALESCE(tsi.totalDiscount,0)),0)         AS totalDiscounts,
        COALESCE(SUM(COALESCE(tsi.orderAmount,0)),0)           AS orderAmount,
        COALESCE(SUM(COALESCE(tsi.shippingFeeAfterDiscount,0)),0) AS shippingRevenue,
        COALESCE(SUM(COALESCE(tsi.taxes,0)),0)                 AS taxes,
        ROUND(
          100.0 * COALESCE(SUM(COALESCE(tsi.totalDiscount,0)),0)
          / NULLIF(COALESCE(SUM(COALESCE(tsi.orderAmount,0)),0) + COALESCE(SUM(COALESCE(tsi.totalDiscount,0)),0), 0),
          1
        ) AS discountPct
      FROM ${TABLES.shipmentItems} tsi
      JOIN ${TABLES.shows} ts ON ts.id = tsi.tiktokShowId
      WHERE tsi.placedAt >= :from AND tsi.placedAt < :to
        AND tsi.itemCategory NOT IN ('cancelled_order','failed_order')
        AND (:showId IS NULL OR tsi.tiktokShowId = :showId)
      GROUP BY tsi.tiktokShowId
      ORDER BY totalDiscounts DESC
      LIMIT 15
    `, { replacements: { from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT });

    return res.json(rows.map(r => ({
      ...r,
      orderCount:      Number(r.orderCount      || 0),
      revenue:         Number(Number(r.revenue   || 0).toFixed(2)),
      totalDiscounts:  Number(Number(r.totalDiscounts || 0).toFixed(2)),
      orderAmount:     Number(Number(r.orderAmount    || 0).toFixed(2)),
      shippingRevenue: Number(Number(r.shippingRevenue|| 0).toFixed(2)),
      taxes:           Number(Number(r.taxes          || 0).toFixed(2)),
      discountPct:     Number(r.discountPct      || 0),
    })));
  } catch (err) {
    console.error("TikTok discount-impact error:", err);
    return res.status(500).json({ error: "Failed to fetch discount impact" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: SKU search (item lookup autocomplete)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-sku-search", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) return res.json([]);

  try {
    const rows = await sequelize.query(`
      SELECT DISTINCT
        p.sku, p.brand, p.itemName, p.strength, p.sizeOz, p.sizeMl, pd.tester, p.condition
      FROM ${TABLES.products} p
      LEFT JOIN ${TABLES.details} pd ON ${skuJoinCondition("pd.sku","p.sku")}
      WHERE (p.sku LIKE :q OR p.brand LIKE :q OR p.itemName LIKE :q)
        AND EXISTS (
          SELECT 1 FROM ${TABLES.shipmentScans} tss
          WHERE ${fulfilledSaleCondition("tss")}
            AND ${skuJoinCondition("tss.productSku","p.sku")}
        )
      ORDER BY p.brand, p.itemName
      LIMIT 30
    `, { replacements: { q: `%${q}%` }, type: sequelize.QueryTypes.SELECT });

    return res.json(rows);
  } catch (err) {
    console.error("TikTok sku-search error:", err);
    return res.status(500).json({ error: "Failed to search SKUs" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: SKU detail (item lookup full data)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get("/fulfillment-sku-detail", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const { sku } = req.query;
  if (!sku) return res.status(400).json({ error: "sku is required" });
  const range = parseDateRange(req.query);
  if (!range) return res.status(400).json({ error: "Invalid date range" });
  const showId = req.query.showId ? Number(req.query.showId) : null;

  try {
    const [productRows, summaryRows, skuDiscountRows, byShowRows, byDayRows, hourRows, dayOfWeekRows, recentRows] = await Promise.all([
      // Product info + current stock + vendor cost
      sequelize.query(`
        SELECT p.sku, p.brand, p.itemName, p.strength, p.sizeOz, p.sizeMl, pd.tester, p.condition,
          p.quantity, p.minimumQuantity, p.location, vc.avgVendorCost AS averagePrice
        FROM ${TABLES.products} p
        LEFT JOIN ${TABLES.details}       pd ON ${skuJoinCondition("pd.sku","p.sku")}
        LEFT JOIN ${ACTIVE_VENDOR_COST_SUBQUERY} vc ON ${skuJoinCondition("vc.sku","p.sku")}
        WHERE ${skuJoinCondition("p.sku",":sku")}
        LIMIT 1
      `, { replacements: { sku }, type: sequelize.QueryTypes.SELECT }),

      // Summary stats â€” drive from scans to avoid tsi fan-out
      sequelize.query(`
        SELECT
          COUNT(*) AS unitsSold,
          COALESCE(SUM(COALESCE(tss.soldPrice,0) / sc.sticker_scan_count),0) AS revenue,
          COALESCE(AVG(NULLIF(tss.soldPrice,0) / sc.sticker_scan_count),0)          AS avgSoldPrice,
          COALESCE(MIN(tss.soldPrice / sc.sticker_scan_count),0)                    AS lowestSoldPrice,
          COALESCE(MAX(tss.soldPrice / sc.sticker_scan_count),0)                    AS highestSoldPrice,
          COUNT(DISTINCT tss.tiktokShowId)           AS uniqueShows,
          COUNT(DISTINCT CONCAT(tss.tiktokShowId,':',tss.importId,':',tss.shipmentId)) AS uniqueShipments,
          COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NOT NULL THEN COALESCE(tss.soldPrice,0) / sc.sticker_scan_count - vc.avgVendorCost ELSE 0 END),0) AS grossMargin,
          COALESCE(SUM(CASE WHEN vc.avgVendorCost IS NULL THEN COALESCE(tss.soldPrice,0) / sc.sticker_scan_count ELSE 0 END),0) AS unknownCostRevenue
        FROM ${TABLES.shipmentScans} tss
        LEFT JOIN ${ACTIVE_VENDOR_COST_SUBQUERY} vc ON ${skuJoinCondition("vc.sku","tss.productSku")}
        JOIN ${TSS_STICKER_SCAN_COUNT} sc ON sc.tiktokShowId=tss.tiktokShowId AND sc.importId=tss.importId AND sc.shipmentId=tss.shipmentId AND sc.auctionStickerNumber=tss.auctionStickerNumber
        WHERE ${fulfilledSaleCondition("tss")}
          AND ${skuJoinCondition("tss.productSku",":sku")}
          AND ${tsiExistsDateFilter("tss")}
          AND (:showId IS NULL OR tss.tiktokShowId = :showId)
      `, { replacements: { sku, from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT }),

      // Total discounts for this SKU â€” drive from items to avoid tss fan-out
      sequelize.query(`
        SELECT COALESCE(SUM(COALESCE(tsi.totalDiscount,0)),0) AS totalDiscounts
        FROM ${TABLES.shipmentItems} tsi
        WHERE tsi.placedAt >= :from AND tsi.placedAt < :to
          AND (:showId IS NULL OR tsi.tiktokShowId = :showId)
          AND EXISTS (
            SELECT 1 FROM ${TABLES.shipmentScans} _tss
            WHERE _tss.tiktokShowId = tsi.tiktokShowId
              AND _tss.importId     = tsi.importId
              AND _tss.shipmentId   = tsi.shipmentId
              AND ${fulfilledSaleCondition("_tss")}
              AND ${skuJoinCondition("_tss.productSku",":sku")}
          )
      `, { replacements: { sku, from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT }),

      // By show
      sequelize.query(`
        SELECT MAX(ts.name) AS showName, COUNT(*) AS unitsSold,
          COALESCE(SUM(COALESCE(tss.soldPrice,0) / sc.sticker_scan_count),0) AS revenue
        FROM ${TABLES.shipmentScans} tss
        JOIN ${TABLES.shows} ts ON ts.id = tss.tiktokShowId
        JOIN ${TSS_STICKER_SCAN_COUNT} sc ON sc.tiktokShowId=tss.tiktokShowId AND sc.importId=tss.importId AND sc.shipmentId=tss.shipmentId AND sc.auctionStickerNumber=tss.auctionStickerNumber
        WHERE ${fulfilledSaleCondition("tss")}
          AND ${skuJoinCondition("tss.productSku",":sku")}
          AND ${tsiExistsDateFilter("tss")}
          AND (:showId IS NULL OR tss.tiktokShowId = :showId)
        GROUP BY tss.tiktokShowId ORDER BY revenue DESC LIMIT 10
      `, { replacements: { sku, from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT }),

      // By day (recent trend) â€” use aggregated tsi subquery for placedAt bucketing
      sequelize.query(`
        SELECT DATE_FORMAT(tsi.placedAt,'%Y-%m-%d') AS bucket, COUNT(*) AS unitsSold,
          COALESCE(SUM(COALESCE(tss.soldPrice,0) / sc.sticker_scan_count),0) AS revenue
        FROM ${TABLES.shipmentScans} tss
        JOIN ${TSI_ONE_PER_SHIPMENT} tsi
          ON tsi.tiktokShowId = tss.tiktokShowId AND tsi.importId = tss.importId AND tsi.shipmentId = tss.shipmentId
        JOIN ${TSS_STICKER_SCAN_COUNT} sc ON sc.tiktokShowId=tss.tiktokShowId AND sc.importId=tss.importId AND sc.shipmentId=tss.shipmentId AND sc.auctionStickerNumber=tss.auctionStickerNumber
        WHERE ${fulfilledSaleCondition("tss")}
          AND ${skuJoinCondition("tss.productSku",":sku")}
          AND tsi.placedAt >= :from AND tsi.placedAt < :to
          AND (:showId IS NULL OR tss.tiktokShowId = :showId)
        GROUP BY DATE_FORMAT(tsi.placedAt,'%Y-%m-%d') ORDER BY bucket DESC LIMIT 14
      `, { replacements: { sku, from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT }),

      // Hour of day
      sequelize.query(`
        SELECT HOUR(tsi.placedAt) AS hourOfDay, COUNT(*) AS unitsSold,
          COALESCE(SUM(COALESCE(tss.soldPrice,0) / sc.sticker_scan_count),0) AS revenue
        FROM ${TABLES.shipmentScans} tss
        JOIN ${TSI_ONE_PER_SHIPMENT} tsi
          ON tsi.tiktokShowId = tss.tiktokShowId AND tsi.importId = tss.importId AND tsi.shipmentId = tss.shipmentId
        JOIN ${TSS_STICKER_SCAN_COUNT} sc ON sc.tiktokShowId=tss.tiktokShowId AND sc.importId=tss.importId AND sc.shipmentId=tss.shipmentId AND sc.auctionStickerNumber=tss.auctionStickerNumber
        WHERE ${fulfilledSaleCondition("tss")}
          AND ${skuJoinCondition("tss.productSku",":sku")}
          AND tsi.placedAt >= :from AND tsi.placedAt < :to AND tsi.placedAt IS NOT NULL
          AND (:showId IS NULL OR tss.tiktokShowId = :showId)
        GROUP BY HOUR(tsi.placedAt) ORDER BY hourOfDay ASC
      `, { replacements: { sku, from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT }),

      // Day of week
      sequelize.query(`
        SELECT DAYNAME(tsi.placedAt) AS dayName, DAYOFWEEK(tsi.placedAt) AS dayNum,
          COUNT(*) AS unitsSold, COALESCE(SUM(COALESCE(tss.soldPrice,0) / sc.sticker_scan_count),0) AS revenue
        FROM ${TABLES.shipmentScans} tss
        JOIN ${TSI_ONE_PER_SHIPMENT} tsi
          ON tsi.tiktokShowId = tss.tiktokShowId AND tsi.importId = tss.importId AND tsi.shipmentId = tss.shipmentId
        JOIN ${TSS_STICKER_SCAN_COUNT} sc ON sc.tiktokShowId=tss.tiktokShowId AND sc.importId=tss.importId AND sc.shipmentId=tss.shipmentId AND sc.auctionStickerNumber=tss.auctionStickerNumber
        WHERE ${fulfilledSaleCondition("tss")}
          AND ${skuJoinCondition("tss.productSku",":sku")}
          AND tsi.placedAt >= :from AND tsi.placedAt < :to AND tsi.placedAt IS NOT NULL
          AND (:showId IS NULL OR tss.tiktokShowId = :showId)
        GROUP BY DAYNAME(tsi.placedAt), DAYOFWEEK(tsi.placedAt) ORDER BY dayNum ASC
      `, { replacements: { sku, from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT }),

      // Recent sales â€” aggregated tsi subquery picks one row per shipment (state/city/paymentMethod)
      sequelize.query(`
        SELECT tss.id, MAX(ts.name) AS showName, tss.shipmentId,
          tss.soldPrice, tss.tracking, tss.auctionStickerNumber, tss.userId,
          tsi.placedAt AS createdAt, tsi.state, tsi.city, tsi.paymentMethod
        FROM ${TABLES.shipmentScans} tss
        JOIN ${TABLES.shows} ts ON ts.id = tss.tiktokShowId
        JOIN (
          SELECT tiktokShowId, importId, shipmentId,
            MIN(placedAt) AS placedAt, MAX(state) AS state,
            MAX(city) AS city, MAX(paymentMethod) AS paymentMethod
          FROM ${TABLES.shipmentItems}
          GROUP BY tiktokShowId, importId, shipmentId
        ) tsi ON tsi.tiktokShowId = tss.tiktokShowId AND tsi.importId = tss.importId AND tsi.shipmentId = tss.shipmentId
        WHERE ${fulfilledSaleCondition("tss")}
          AND ${skuJoinCondition("tss.productSku",":sku")}
          AND tsi.placedAt >= :from AND tsi.placedAt < :to
          AND (:showId IS NULL OR tss.tiktokShowId = :showId)
        ORDER BY tsi.placedAt DESC LIMIT 20
      `, { replacements: { sku, from: range.from, to: range.to, showId }, type: sequelize.QueryTypes.SELECT }),
    ]);

    if (!productRows.length) return res.status(404).json({ error: "SKU not found" });

    const s = summaryRows[0] || {};
    return res.json({
      product: productRows[0],
      summary: {
        unitsSold:         Number(s.unitsSold         || 0),
        revenue:           Number(Number(s.revenue     || 0).toFixed(2)),
        avgSoldPrice:      Number(Number(s.avgSoldPrice|| 0).toFixed(2)),
        lowestSoldPrice:   Number(Number(s.lowestSoldPrice  || 0).toFixed(2)),
        highestSoldPrice:  Number(Number(s.highestSoldPrice || 0).toFixed(2)),
        uniqueShows:       Number(s.uniqueShows        || 0),
        uniqueShipments:   Number(s.uniqueShipments    || 0),
        grossMargin:       Number(Number(s.grossMargin || 0).toFixed(2)),
        unknownCostRevenue:Number(Number(s.unknownCostRevenue || 0).toFixed(2)),
        totalDiscounts:    Number(Number((skuDiscountRows[0]?.totalDiscounts) || 0).toFixed(2)),
      },
      byShow:    byShowRows.map(r => ({ ...r, unitsSold: Number(r.unitsSold || 0), revenue: Number(Number(r.revenue || 0).toFixed(2)) })),
      byDay:     byDayRows.map(r => ({ ...r, unitsSold: Number(r.unitsSold || 0), revenue: Number(Number(r.revenue || 0).toFixed(2)) })),
      hourOfDay: hourRows.map(r => ({ ...r, hourOfDay: Number(r.hourOfDay || 0), unitsSold: Number(r.unitsSold || 0), revenue: Number(Number(r.revenue || 0).toFixed(2)) })),
      dayOfWeek: dayOfWeekRows.map(r => ({ ...r, unitsSold: Number(r.unitsSold || 0), revenue: Number(Number(r.revenue || 0).toFixed(2)) })),
      recentSales: recentRows.map(r => ({ ...r, soldPrice: Number(Number(r.soldPrice || 0).toFixed(2)) })),
    });
  } catch (err) {
    console.error("TikTok sku-detail error:", err);
    return res.status(500).json({ error: "Failed to fetch SKU detail" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENDPOINT: Hourly sales (revenue + orders by hour of day, EDT)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Returns the current Eastern UTC offset string (e.g. '-04:00' for EDT, '-05:00' for EST)
function getEasternUtcOffset() {
  const now = new Date();
  // Format a recognizable string in Eastern time and check for EDT vs EST
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  }).format(now);
  return formatted.includes('EDT') ? '-04:00' : '-05:00';
}

router.get("/fulfillment-hourly", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const { breakdown = "combined" } = req.query;
  const easternOffset = getEasternUtcOffset();

  // showIds takes priority over date range; validate as positive integers
  const showIdNums = String(req.query.showIds || "")
    .split(",")
    .map(Number)
    .filter(n => Number.isInteger(n) && n > 0);

  let whereClause;
  let replacements = {};

  if (showIdNums.length > 0) {
    whereClause = `tsi.tiktokShowId IN (${showIdNums.join(",")})`;
  } else {
    const range = parseDateRange(req.query);
    if (!range) return res.status(400).json({ error: "Invalid date range" });
    whereClause = `tsi.placedAt >= :from AND tsi.placedAt < :to`;
    replacements = { from: range.from, to: range.to };
  }

  const baseWhere = `
    tsi.placedAt IS NOT NULL
    AND tsi.orderAmount IS NOT NULL
    AND tsi.itemCategory NOT IN ('cancelled_order','failed_order')
    AND ${whereClause}
  `;

  try {
    if (breakdown === "byShow") {
      const rows = await sequelize.query(`
        SELECT
          HOUR(CONVERT_TZ(tsi.placedAt, '+00:00', '${easternOffset}')) AS hour,
          tsi.tiktokShowId                                    AS showId,
          MAX(ts.name)                                        AS showName,
          COUNT(*)                                            AS orders,
          ROUND(SUM(COALESCE(tsi.orderAmount, 0)), 2)        AS revenue
        FROM ${TABLES.shipmentItems} tsi
        JOIN ${TABLES.shows} ts ON ts.id = tsi.tiktokShowId
        WHERE ${baseWhere}
        GROUP BY hour, tsi.tiktokShowId
        ORDER BY hour ASC, revenue DESC
      `, { replacements, type: sequelize.QueryTypes.SELECT });

      return res.json(rows.map(r => ({
        hour:     Number(r.hour),
        showId:   Number(r.showId),
        showName: r.showName || "",
        orders:   Number(r.orders   || 0),
        revenue:  Number(Number(r.revenue || 0).toFixed(2)),
      })));
    }

    // combined (default)
    const rows = await sequelize.query(`
      SELECT
        HOUR(CONVERT_TZ(tsi.placedAt, '+00:00', '${easternOffset}')) AS hour,
        COUNT(*)                                            AS orders,
        ROUND(SUM(COALESCE(tsi.orderAmount, 0)), 2)        AS revenue
      FROM ${TABLES.shipmentItems} tsi
      WHERE ${baseWhere}
      GROUP BY hour
      ORDER BY hour ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    return res.json(rows.map(r => ({
      hour:    Number(r.hour),
      orders:  Number(r.orders   || 0),
      revenue: Number(Number(r.revenue || 0).toFixed(2)),
    })));
  } catch (err) {
    console.error("TikTok hourly error:", err);
    return res.status(500).json({ error: "Failed to fetch hourly data" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ENDPOINT: Brand Analytics — units sold, revenue, and % of show total
// Query params: showIds (comma-separated), brand (partial match), startDate, endDate
// ══════════════════════════════════════════════════════════════════════════════
router.get("/brand-analytics", auth, checkPermission("tiktokAnalytics", "view"), async (req, res) => {
  const { showIds: showIdsRaw, brand, startDate, endDate } = req.query;

  if (!showIdsRaw) return res.status(400).json({ error: "showIds is required" });
  if (!brand)     return res.status(400).json({ error: "brand is required" });

  const showIds = String(showIdsRaw).split(",").map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);
  if (showIds.length === 0) return res.status(400).json({ error: "No valid showIds provided" });

  const showIdPlaceholders = showIds.map(() => "?").join(",");

  // Build optional date filter via EXISTS on shipmentItems.placedAt
  let dateFilter = "";
  const dateParams = [];
  if (startDate && endDate) {
    dateFilter = `
      AND EXISTS (
        SELECT 1 FROM ${TABLES.shipmentItems} _tsi
        WHERE _tsi.tiktokShowId = tss.tiktokShowId
          AND _tsi.importId     = tss.importId
          AND _tsi.shipmentId   = tss.shipmentId
          AND _tsi.placedAt >= ?
          AND _tsi.placedAt  < ?
      )`;
    dateParams.push(startDate, endDate);
  }

  const fulfilledWhere = `
    tss.result = 'matched'
    AND tss.productSku IS NOT NULL AND tss.productSku <> ''
    AND tss.previousQuantity IS NOT NULL
    AND tss.newQuantity = tss.previousQuantity - 1
  `;

  try {
    // Per-show breakdown for the selected brand
    const brandRows = await sequelize.query(`
      SELECT
        tss.tiktokShowId                                        AS showId,
        MAX(ts.name)                                            AS showName,
        COUNT(*)                                                AS unitsSold,
        COALESCE(SUM(COALESCE(tss.soldPrice, 0) / sc.sticker_scan_count), 0) AS revenue
      FROM ${TABLES.shipmentScans} tss
      JOIN ${TABLES.shows} ts ON ts.id = tss.tiktokShowId
      JOIN ${TABLES.products} p ON p.sku COLLATE utf8mb4_unicode_ci = tss.productSku COLLATE utf8mb4_unicode_ci
      JOIN ${TSS_STICKER_SCAN_COUNT} sc
        ON sc.tiktokShowId = tss.tiktokShowId
        AND sc.importId    = tss.importId
        AND sc.shipmentId  = tss.shipmentId
        AND sc.auctionStickerNumber = tss.auctionStickerNumber
      WHERE ${fulfilledWhere}
        AND tss.tiktokShowId IN (${showIdPlaceholders})
        AND p.brand LIKE ?
        ${dateFilter}
      GROUP BY tss.tiktokShowId
      ORDER BY revenue DESC
    `, {
      replacements: [...showIds, `%${brand}%`, ...dateParams],
      type: sequelize.QueryTypes.SELECT,
    });

    // Total fulfilled scans per show (any brand) to compute brand %
    const totalRows = await sequelize.query(`
      SELECT
        tss.tiktokShowId AS showId,
        COUNT(*)         AS totalUnitsSold,
        COALESCE(SUM(COALESCE(tss.soldPrice, 0) / sc.sticker_scan_count), 0) AS totalRevenue
      FROM ${TABLES.shipmentScans} tss
      JOIN ${TSS_STICKER_SCAN_COUNT} sc
        ON sc.tiktokShowId = tss.tiktokShowId
        AND sc.importId    = tss.importId
        AND sc.shipmentId  = tss.shipmentId
        AND sc.auctionStickerNumber = tss.auctionStickerNumber
      WHERE ${fulfilledWhere}
        AND tss.tiktokShowId IN (${showIdPlaceholders})
        ${dateFilter}
      GROUP BY tss.tiktokShowId
    `, {
      replacements: [...showIds, ...dateParams],
      type: sequelize.QueryTypes.SELECT,
    });

    const totalMap = new Map(totalRows.map(r => [Number(r.showId), r]));

    const byShow = brandRows.map(r => {
      const showId = Number(r.showId);
      const tot = totalMap.get(showId);
      const unitsSold = Number(r.unitsSold || 0);
      const revenue   = Number(Number(r.revenue || 0).toFixed(2));
      const totalUnits   = tot ? Number(tot.totalUnitsSold || 0) : 0;
      const totalRevenue = tot ? Number(Number(tot.totalRevenue || 0).toFixed(2)) : 0;
      return {
        showId,
        showName: r.showName,
        unitsSold,
        revenue,
        totalUnitsSold: totalUnits,
        totalRevenue,
        unitsPct:   totalUnits   > 0 ? Number((unitsSold / totalUnits   * 100).toFixed(1)) : 0,
        revenuePct: totalRevenue > 0 ? Number((revenue   / totalRevenue * 100).toFixed(1)) : 0,
      };
    });

    const grandUnitsSold    = byShow.reduce((a, r) => a + r.unitsSold, 0);
    const grandRevenue      = byShow.reduce((a, r) => a + r.revenue,   0);
    const grandTotalUnits   = byShow.reduce((a, r) => a + r.totalUnitsSold, 0);
    const grandTotalRevenue = byShow.reduce((a, r) => a + r.totalRevenue,   0);

    return res.json({
      brand,
      byShow,
      totals: {
        unitsSold:      grandUnitsSold,
        revenue:        Number(grandRevenue.toFixed(2)),
        totalUnitsSold: grandTotalUnits,
        totalRevenue:   Number(grandTotalRevenue.toFixed(2)),
        unitsPct:   grandTotalUnits   > 0 ? Number((grandUnitsSold  / grandTotalUnits   * 100).toFixed(1)) : 0,
        revenuePct: grandTotalRevenue > 0 ? Number((grandRevenue    / grandTotalRevenue * 100).toFixed(1)) : 0,
      },
    });
  } catch (err) {
    console.error("TikTok brand-analytics error:", err);
    return res.status(500).json({ error: "Failed to fetch brand analytics" });
  }
});

module.exports = router;


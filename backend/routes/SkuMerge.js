const express = require('express');
const router = express.Router();
const { sequelize, Products, ProductDetails, Sales, MarketplaceSale, SkuSalesSummary, Inbound,
  InvoiceTrackerInboundRow, InvoiceTrackerInvoiceItem, InvoiceShipmentItem,
  ProductVendorPrice, EbayOrders, WhatnotLog, StockUpdateHistory,
  HbaOrderItem, HbaTrackingEvent, ReshipmentTicketItem, SalesOrderItem,
  Listings, ProductFragranceNote, TikTokShipmentScan, WhatnotShipmentScan,
  WalmartProductMapping,
} = require('../models');
const { auth } = require('../middleware/auth');
const { QueryTypes } = require('sequelize');

// All routes admin-only
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

// Helper: count rows referencing a SKU across all tables
async function buildCounts(sku) {
  const q = (model, field) => model.count({ where: { [field]: sku } });
  const [
    sales, marketplaceSales, skuSalesSummary, inbound,
    invoiceInboundRows, invoiceItems, invoiceShipmentItems,
    vendorPrices, ebayOrders, whatnotLogs, stockHistory,
    hbaOrderItems, hbaTrackingEvents, reshipmentItems, salesOrderItems,
    listings, fragranceNotes, tiktokScans, whatnotScans, walmartMappings,
    productDetails,
  ] = await Promise.all([
    q(Sales, 'sku'), q(MarketplaceSale, 'sku'), q(SkuSalesSummary, 'sku'), q(Inbound, 'sku'),
    q(InvoiceTrackerInboundRow, 'sku'), q(InvoiceTrackerInvoiceItem, 'sku'), q(InvoiceShipmentItem, 'sku'),
    q(ProductVendorPrice, 'sku'), q(EbayOrders, 'sku'), q(WhatnotLog, 'sku'), q(StockUpdateHistory, 'sku'),
    q(HbaOrderItem, 'sku'), q(HbaTrackingEvent, 'sku'), q(ReshipmentTicketItem, 'sku'), q(SalesOrderItem, 'sku'),
    q(Listings, 'sku'), q(ProductFragranceNote, 'productSku'), q(TikTokShipmentScan, 'productSku'),
    q(WhatnotShipmentScan, 'productSku'), q(WalmartProductMapping, 'localSku'),
    q(ProductDetails, 'sku'),
  ]);

  return {
    'Sales': sales,
    'Marketplace Sales': marketplaceSales,
    'SKU Sales Summary': skuSalesSummary,
    'Inbound Records': inbound,
    'Invoice Inbound Rows': invoiceInboundRows,
    'Invoice Items': invoiceItems,
    'Invoice Shipment Items': invoiceShipmentItems,
    'Vendor Prices': vendorPrices,
    'eBay Orders': ebayOrders,
    'Whatnot Logs': whatnotLogs,
    'Stock History': stockHistory,
    'HBA Order Items': hbaOrderItems,
    'HBA Tracking Events': hbaTrackingEvents,
    'Reshipment Items': reshipmentItems,
    'Sales Order Items': salesOrderItems,
    'Listings': listings,
    'Fragrance Notes': fragranceNotes,
    'TikTok Scans': tiktokScans,
    'Whatnot Scans': whatnotScans,
    'Walmart Mappings': walmartMappings,
    'Product Details': productDetails,
  };
}

// GET /sku-merge/preview?source=X&target=Y
router.get('/preview', auth, adminOnly, async (req, res) => {
  try {
    const { source, target } = req.query;
    if (!source || !target) return res.status(400).json({ error: 'source and target are required' });
    if (source === target) return res.status(400).json({ error: 'source and target must be different' });

    const [sourceProduct, targetProduct] = await Promise.all([
      Products.findOne({ where: { sku: source }, attributes: ['sku', 'brand', 'itemName', 'category', 'image'] }),
      Products.findOne({ where: { sku: target }, attributes: ['sku', 'brand', 'itemName', 'category', 'image'] }),
    ]);

    if (!sourceProduct) return res.status(404).json({ error: `Source SKU "${source}" not found` });
    if (!targetProduct) return res.status(404).json({ error: `Target SKU "${target}" not found` });

    const counts = await buildCounts(source);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    res.json({ sourceProduct, targetProduct, counts, total });
  } catch (err) {
    console.error('SKU merge preview error:', err);
    res.status(500).json({ error: 'Preview failed. Check server logs for details.' });
  }
});

// POST /sku-merge  { source, target }
router.post('/', auth, adminOnly, async (req, res) => {
  const source = req.body.source?.trim();
  const target = req.body.target?.trim();
  if (!source || !target) return res.status(400).json({ error: 'source and target are required' });
  if (source === target) return res.status(400).json({ error: 'source and target must be different' });

  const [sourceProduct, targetProduct] = await Promise.all([
    Products.findOne({ where: { sku: source } }),
    Products.findOne({ where: { sku: target } }),
  ]);
  if (!sourceProduct) return res.status(404).json({ error: `Source SKU "${source}" not found` });
  if (!targetProduct) return res.status(404).json({ error: `Target SKU "${target}" not found` });

  const moved = {};

  try {
    await sequelize.transaction(async (t) => {
      const opts = { transaction: t };
      const up = (model, field) => model.update({ [field]: target }, { where: { [field]: source }, ...opts });

      // Simple reassignments
      moved['Sales'] = (await up(Sales, 'sku'))[0];
      moved['Marketplace Sales'] = (await up(MarketplaceSale, 'sku'))[0];
      moved['Inbound Records'] = (await up(Inbound, 'sku'))[0];
      moved['Invoice Inbound Rows'] = (await up(InvoiceTrackerInboundRow, 'sku'))[0];
      moved['Invoice Items'] = (await up(InvoiceTrackerInvoiceItem, 'sku'))[0];
      moved['Invoice Shipment Items'] = (await up(InvoiceShipmentItem, 'sku'))[0];
      moved['Vendor Prices'] = (await up(ProductVendorPrice, 'sku'))[0];
      moved['eBay Orders'] = (await up(EbayOrders, 'sku'))[0];
      moved['Whatnot Logs'] = (await up(WhatnotLog, 'sku'))[0];
      moved['Stock History'] = (await up(StockUpdateHistory, 'sku'))[0];
      moved['HBA Order Items'] = (await up(HbaOrderItem, 'sku'))[0];
      moved['HBA Tracking Events'] = (await up(HbaTrackingEvent, 'sku'))[0];
      moved['Reshipment Items'] = (await up(ReshipmentTicketItem, 'sku'))[0];
      moved['Sales Order Items'] = (await up(SalesOrderItem, 'sku'))[0];
      moved['TikTok Scans'] = (await up(TikTokShipmentScan, 'productSku'))[0];
      moved['Whatnot Scans'] = (await up(WhatnotShipmentScan, 'productSku'))[0];
      moved['Walmart Mappings'] = (await up(WalmartProductMapping, 'localSku'))[0];

      // ProductFragranceNote: composite PK (productSku, noteId, tier)
      // Delete source rows that already exist on target (same noteId+tier) to avoid PK collision,
      // then reassign the rest via raw SQL (model.update strips PK columns from SET clause).
      await sequelize.query(
        `DELETE FROM product_fragrance_notes
         WHERE productSku = :source
           AND (noteId, tier) IN (
             SELECT noteId, tier FROM (
               SELECT noteId, tier FROM product_fragrance_notes WHERE productSku = :target
             ) AS existing
           )`,
        { replacements: { source, target }, type: QueryTypes.DELETE, transaction: t }
      );
      const [, fragranceMoved] = await sequelize.query(
        `UPDATE product_fragrance_notes SET productSku = :target WHERE productSku = :source`,
        { replacements: { source, target }, type: QueryTypes.UPDATE, transaction: t }
      );
      moved['Fragrance Notes'] = fragranceMoved ?? 0;

      // Listings: sku is PK — merge column values into target first, then destroy source
      const [srcListing, targetListing] = await Promise.all([
        Listings.findOne({ where: { sku: source }, ...opts }),
        Listings.findOne({ where: { sku: target }, ...opts }),
      ]);
      if (srcListing && targetListing) {
        // Fill any NULLs on the target with the source's values
        await targetListing.update({
          ebayBuy4LessToday: targetListing.ebayBuy4LessToday ?? srcListing.ebayBuy4LessToday,
          ebayOneLifeLuxuries4: targetListing.ebayOneLifeLuxuries4 ?? srcListing.ebayOneLifeLuxuries4,
          walmartOneLifeLuxuries: targetListing.walmartOneLifeLuxuries ?? srcListing.walmartOneLifeLuxuries,
        }, opts);
        moved['Listings'] = await Listings.destroy({ where: { sku: source }, ...opts });
      } else if (srcListing) {
        // sku is PK — model.update strips PK columns from SET clause, use raw SQL
        const [, listingsMoved] = await sequelize.query(
          `UPDATE \`Listings\` SET sku = :target WHERE sku = :source`,
          { replacements: { source, target }, type: QueryTypes.UPDATE, transaction: t }
        );
        moved['Listings'] = listingsMoved ?? 0;
      } else {
        moved['Listings'] = 0;
      }

      // ProductDetails: sku is PK — Sequelize strips PK columns from model.update(), so use raw SQL.
      // If target already has details, null-fill its empty columns from source then destroy source.
      // If target has no details, reassign source row to target.
      const [srcDetails, targetDetails] = await Promise.all([
        ProductDetails.findOne({ where: { sku: source }, ...opts }),
        ProductDetails.findOne({ where: { sku: target }, ...opts }),
      ]);
      if (srcDetails && targetDetails) {
        const detailCols = ['description','setOf','sizeType','activeIngredients','pao','skinType',
          'mainPurpose','bodyArea','countryOfManufacture','gender','seo','ingredientDesc',
          'discontinued','tester','isHazmat','isLimitedEdition'];
        const fillValues = {};
        for (const col of detailCols) {
          if (targetDetails[col] == null && srcDetails[col] != null) fillValues[col] = srcDetails[col];
        }
        if (Object.keys(fillValues).length > 0) await targetDetails.update(fillValues, opts);
        moved['Product Details'] = await ProductDetails.destroy({ where: { sku: source }, ...opts });
      } else if (srcDetails) {
        const [, affectedRows] = await sequelize.query(
          `UPDATE \`ProductDetails\` SET sku = :target WHERE sku = :source`,
          { replacements: { source, target }, type: QueryTypes.UPDATE, transaction: t }
        );
        moved['Product Details'] = affectedRows ?? 0;
      } else {
        moved['Product Details'] = 0;
      }

      // SkuSalesSummary: unique on (sku, platform, year, month) — merge overlapping rows
      // Step 1: add qty from source rows into matching target rows
      await sequelize.query(
        `UPDATE skuSalesSummary t
         JOIN skuSalesSummary s ON s.sku = :source AND t.sku = :target
           AND s.platform = t.platform AND s.year = t.year AND s.month = t.month
         SET t.qty = t.qty + s.qty, t.updatedAt = NOW()`,
        { replacements: { source, target }, type: QueryTypes.UPDATE, transaction: t }
      );
      // Step 2: delete source rows that were merged (have matching target row)
      await sequelize.query(
        `DELETE s FROM skuSalesSummary s
         JOIN skuSalesSummary t ON t.sku = :target
           AND s.sku = :source AND s.platform = t.platform AND s.year = t.year AND s.month = t.month`,
        { replacements: { source, target }, type: QueryTypes.DELETE, transaction: t }
      );
      // Step 3: reassign remaining source rows (no overlap with target)
      const [, skuSummaryMoved] = await sequelize.query(
        `UPDATE skuSalesSummary SET sku = :target WHERE sku = :source`,
        { replacements: { source, target }, type: QueryTypes.UPDATE, transaction: t }
      );
      moved['SKU Sales Summary'] = skuSummaryMoved ?? 0;

      // Merge quantity: re-fetch inside transaction with a row lock to avoid stale reads
      // from concurrent inbound/sales operations modifying quantity between our pre-check and here.
      const [srcProd, tgtProd] = await Promise.all([
        Products.findOne({ where: { sku: source }, attributes: ['quantity'], lock: t.LOCK.UPDATE, transaction: t }),
        Products.findOne({ where: { sku: target }, attributes: ['quantity'], lock: t.LOCK.UPDATE, transaction: t }),
      ]);
      const srcQty = parseInt(srcProd?.quantity ?? 0, 10);
      const tgtQty = parseInt(tgtProd?.quantity ?? 0, 10);
      await Products.update({ quantity: tgtQty + srcQty }, { where: { sku: target }, transaction: t });
      await Products.update({ quantity: 0 }, { where: { sku: source }, transaction: t });
      moved['Product Quantity Adjustment'] = 1;
    });

    res.json({ success: true, source, target, moved, total: Object.values(moved).reduce((a, b) => a + b, 0) });
  } catch (err) {
    console.error('SKU merge error:', err);
    res.status(500).json({ error: 'Merge failed and was rolled back. Check server logs for details.' });
  }
});

module.exports = router;

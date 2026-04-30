const express = require("express");
const { auth } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permissions");
const WalmartSyncService = require("../Services/WalmartSyncService");

const router = express.Router();

const extractWalmartErrorMessage = (error, fallbackMessage) => {
  const body = error?.response?.data;
  if (!body) return error?.message || fallbackMessage;
  if (typeof body === "string" && body.trim()) return body.trim();
  if (typeof body?.error_description === "string" && body.error_description.trim()) return body.error_description.trim();
  if (typeof body?.message === "string" && body.message.trim()) return body.message.trim();
  if (Array.isArray(body?.errors) && body.errors[0]?.description) return body.errors[0].description;
  if (Array.isArray(body?.error) && body.error[0]?.description) return body.error[0].description;
  if (typeof body?.error === "string" && body.error.trim()) return body.error.trim();
  return error?.message || fallbackMessage;
};

router.get("/", auth, checkPermission("walmartIntegration", "view"), async (req, res) => {
  try {
    const catalog = await WalmartSyncService.getCatalog({
      search: req.query.search,
      mappingStatus: req.query.mappingStatus,
      listingStatus: req.query.listingStatus,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    res.json(catalog);
  } catch (error) {
    console.error("Walmart product catalog route error:", error);
    res.status(500).json({ error: error.message || "Failed to load Walmart product catalog." });
  }
});

router.put("/:sku/inventory", auth, checkPermission("walmartIntegration", "edit"), async (req, res) => {
  try {
    const result = await WalmartSyncService.updateInventoryForSku({
      walmartSku: req.params.sku,
      quantity: req.body?.quantity,
      inventoryAvailableDate: req.body?.inventoryAvailableDate,
      shipNode: req.body?.shipNode,
      userId: req.user.id,
    });
    res.json({
      success: true,
      message: "Walmart inventory updated.",
      result,
    });
  } catch (error) {
    console.error("Walmart product inventory update error:", error);
    console.error("Walmart product inventory update response body:", error?.response?.data);
    res.status(error?.response?.status || 500).json({
      error: extractWalmartErrorMessage(error, "Failed to update Walmart inventory."),
      details: error?.response?.data || null,
    });
  }
});

router.put("/:sku/price", auth, checkPermission("walmartIntegration", "edit"), async (req, res) => {
  try {
    const result = await WalmartSyncService.updatePriceForSku({
      walmartSku: req.params.sku,
      price: req.body?.price,
      currency: req.body?.currency,
      userId: req.user.id,
    });
    res.json({
      success: true,
      message: "Walmart price updated.",
      result,
    });
  } catch (error) {
    console.error("Walmart product price update error:", error);
    res.status(error?.response?.status || 500).json({
      error: extractWalmartErrorMessage(error, "Failed to update Walmart price."),
      details: error?.response?.data || null,
    });
  }
});

router.get("/sku/:sku", auth, checkPermission("products", "view"), async (req, res) => {
  try {
    const snapshot = await WalmartSyncService.getSkuSnapshot(req.params.sku);
    res.json(snapshot);
  } catch (error) {
    console.error("Walmart product route error:", error);
    res.status(500).json({ error: error.message || "Failed to load Walmart SKU data." });
  }
});

module.exports = router;

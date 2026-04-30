const express = require("express");
const { auth } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permissions");
const {
  WalmartItem,
  WalmartInventorySnapshot,
  WalmartPricingSnapshot,
  WalmartOrder,
  WalmartProductMapping,
} = require("../models");
const WalmartAuthService = require("../Services/WalmartAuthService");
const WalmartSyncService = require("../Services/WalmartSyncService");

const router = express.Router();

const extractWalmartErrorMessage = (error) => {
  const body = error?.response?.data;
  if (!body) {
    return error?.message || "Walmart integration request failed.";
  }

  if (typeof body === "string" && body.trim()) {
    return body.trim();
  }

  if (typeof body?.error_description === "string" && body.error_description.trim()) {
    return body.error_description.trim();
  }

  if (typeof body?.error === "string" && body.error.trim()) {
    return body.error.trim();
  }

  if (Array.isArray(body?.errors) && body.errors[0]?.description) {
    return body.errors[0].description;
  }

  if (Array.isArray(body?.error) && body.error[0]?.description) {
    return body.error[0].description;
  }

  if (typeof body?.message === "string" && body.message.trim()) {
    return body.message.trim();
  }

  return error?.message || "Walmart integration request failed.";
};

const safeAsync = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error("Walmart integration route error:", error);
    const status = error?.response?.status || 500;
    const message = extractWalmartErrorMessage(error);
    res.status(status).json({ error: message, details: error?.response?.data || null });
  }
};

router.get(
  "/status",
  auth,
  checkPermission("walmartIntegration", "view"),
  safeAsync(async (req, res) => {
    const [connection, recentRuns, recentErrors, counts] = await Promise.all([
      WalmartSyncService.getConnection(),
      WalmartSyncService.getRecentRuns(),
      WalmartSyncService.getRecentErrors(),
      Promise.all([
        WalmartItem.count(),
        WalmartInventorySnapshot.count(),
        WalmartPricingSnapshot.count(),
        WalmartOrder.count(),
        WalmartProductMapping.count(),
      ]),
    ]);

    res.json({
      connection,
      counts: {
        items: counts[0],
        inventorySnapshots: counts[1],
        pricingSnapshots: counts[2],
        orders: counts[3],
        productMappings: counts[4],
      },
      recentRuns,
      recentErrors,
      hasCredentials: WalmartAuthService.hasCredentials(),
    });
  })
);

router.post(
  "/test-connection",
  auth,
  checkPermission("walmartIntegration", "edit"),
  safeAsync(async (req, res) => {
    const connection = await WalmartSyncService.testConnection(req.user.id);
    res.json({
      success: true,
      message: "Walmart connection verified successfully.",
      connection,
    });
  })
);

router.post(
  "/sync/:resource",
  auth,
  checkPermission("walmartIntegration", "edit"),
  safeAsync(async (req, res) => {
    const resource = String(req.params.resource || "").trim().toLowerCase();
    const syncMap = {
      orders: WalmartSyncService.syncOrders,
      items: WalmartSyncService.syncItems,
      inventory: WalmartSyncService.syncInventory,
      pricing: WalmartSyncService.syncPricing,
      catalog: WalmartSyncService.syncCatalog,
      all: WalmartSyncService.syncAll,
    };
    const syncFn = syncMap[resource];
    if (!syncFn) {
      return res.status(400).json({ error: "Unsupported Walmart sync resource." });
    }

    const run = await syncFn({ userId: req.user.id, triggerType: "manual" });
    return res.json({
      success: true,
      message: `Walmart ${resource} sync completed.`,
      run,
    });
  })
);

router.get(
  "/sync-runs",
  auth,
  checkPermission("walmartIntegration", "view"),
  safeAsync(async (req, res) => {
    const runs = await WalmartSyncService.getRecentRuns();
    res.json(runs);
  })
);

router.get(
  "/errors",
  auth,
  checkPermission("walmartIntegration", "view"),
  safeAsync(async (req, res) => {
    const errors = await WalmartSyncService.getRecentErrors();
    res.json(errors);
  })
);

module.exports = router;

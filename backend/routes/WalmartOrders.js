const express = require("express");
const { auth } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permissions");
const WalmartSyncService = require("../Services/WalmartSyncService");

const router = express.Router();

const safeAsync = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error("Walmart orders route error:", error);
    res.status(500).json({ error: error.message || "Failed to load Walmart orders." });
  }
};

router.get(
  "/",
  auth,
  checkPermission("walmartOrders", "view"),
  safeAsync(async (req, res) => {
    const orders = await WalmartSyncService.getOrders({
      status: req.query.status,
      fulfilledBy: req.query.fulfilledBy,
      purchaseOrderId: req.query.purchaseOrderId,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    res.json(orders);
  })
);

router.get(
  "/:purchaseOrderId",
  auth,
  checkPermission("walmartOrders", "view"),
  safeAsync(async (req, res) => {
    const order = await WalmartSyncService.getOrderByPurchaseOrderId(req.params.purchaseOrderId);
    if (!order) {
      return res.status(404).json({ error: "Walmart order not found." });
    }
    return res.json(order);
  })
);

module.exports = router;

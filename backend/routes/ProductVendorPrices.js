const express = require("express");
const router = express.Router();
const PricingService = require("../Services/PricingService");
const { auth } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permissions");

// Get vendor prices and average price by SKU
router.get(
  "/:sku",
  auth,
  checkPermission("pricing", "view"),
  async (req, res) => {
    try {
      const { sku } = req.params;
      const result = await PricingService.getPricesBySku(sku);
      res.json(result);
    } catch (error) {
      console.error("Error fetching vendor prices:", error);
      res.status(500).json({ error: "Failed to fetch vendor prices" });
    }
  }
);

// Create a new vendor price entry
router.post(
  "/",
  auth,
  checkPermission("pricing", "create"),
  async (req, res) => {
    try {
      const data = req.body;
      const result = await PricingService.createPrice(data, req.user);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating vendor price:", error);
      res.status(400).json({ error: error.message || "Failed to create vendor price" });
    }
  }
);

// Update an existing vendor price entry
router.put(
  "/:id",
  auth,
  checkPermission("pricing", "edit"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const result = await PricingService.updatePrice(id, data);
      res.json(result);
    } catch (error) {
      console.error("Error updating vendor price:", error);
      res.status(400).json({ error: error.message || "Failed to update vendor price" });
    }
  }
);

// Delete (soft-delete) a vendor price entry
router.delete(
  "/:id",
  auth,
  checkPermission("pricing", "delete"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const result = await PricingService.deletePrice(id);
      res.json(result);
    } catch (error) {
      console.error("Error deleting vendor price:", error);
      res.status(400).json({ error: error.message || "Failed to delete vendor price" });
    }
  }
);

module.exports = router;


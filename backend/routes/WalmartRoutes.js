const express = require("express");
const router = express.Router();
const { updateWalmartInventory } = require("../Services/WalmartInventory");
// const { updateWalmartPrice } = require("../walmartPricing");

// Update Walmart Inventory
router.post("/updateInventory", async (req, res) => {
  const { sku, quantity } = req.body;

  if (!sku || quantity === undefined) {
    return res.status(400).json({ error: "SKU and quantity are required" });
  }

  try {
    await updateWalmartInventory(sku, quantity);
    res.json({ message: "Inventory updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update inventory", details: error });
  }
});

// // Update Walmart Price
// router.post("/update-price", async (req, res) => {
//   const { sku, price } = req.body;

//   if (!sku || price === undefined) {
//     return res.status(400).json({ error: "SKU and price are required" });
//   }

//   try {
//     await updateWalmartPrice(sku, price);
//     res.json({ message: "Price updated successfully" });
//   } catch (error) {
//     res.status(500).json({ error: "Failed to update price", details: error });
//   }
// });

module.exports = router;

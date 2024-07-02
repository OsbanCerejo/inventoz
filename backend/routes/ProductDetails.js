const express = require("express");
const router = express.Router();
const { ProductDetails } = require("../models");

// Get all product details
router.get("/", async (req, res) => {
  try {
    const listOfProductDetails = await ProductDetails.findAll();
    res.json(listOfProductDetails);
  } catch (error) {
    console.error("Error fetching product details:", error);
    res.status(500).json({ error: "Failed to fetch product details" });
  }
});

// Get product details by SKU
router.get("/bySku", async (req, res) => {
  const { sku } = req.query;
  try {
    const productDetails = await ProductDetails.findByPk(sku);
    if (productDetails) {
      res.json(productDetails);
    } else {
      res.status(404).json({ error: "Product details not found" });
    }
  } catch (error) {
    console.error("Error fetching product details by SKU:", error);
    res.status(500).json({ error: "Failed to fetch product details" });
  }
});

// Add product details
router.post("/addProductDetails", async (req, res) => {
  const product = req.body;
  try {
    const [found, created] = await ProductDetails.findOrCreate({
      where: { sku: product.sku },
      defaults: product,
    });
    res.json(created ? "Created New" : "Already Exists");
  } catch (error) {
    console.error("Error adding product details:", error);
    res.status(500).json({ error: "Failed to add product details" });
  }
});

// Update product details
router.put("/", async (req, res) => {
  const productDetails = req.body;
  try {
    const [productDetailsResponse, created] = await ProductDetails.findOrCreate(
      {
        where: { sku: productDetails.sku },
        defaults: productDetails,
      }
    );

    if (!created) {
      await ProductDetails.update(productDetails, {
        where: { sku: productDetails.sku },
      });
    }

    res.json(productDetails);
  } catch (error) {
    console.error("Error updating product details:", error);
    res.status(500).json({ error: "Failed to update product details" });
  }
});

module.exports = router;

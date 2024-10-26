const express = require("express");
const router = express.Router();
const { Listings } = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;

router.post("/", async (req, res) => {
  const listingsObject = req.body;
  console.log("Listings object in backend is : ", listingsObject);

  const [found, created] = await Listings.findOrCreate({
    where: { sku: listingsObject.sku },
    defaults: listingsObject,
  });
  if (created) {
    console.log("Created New");
  } else {
    console.log("Already Exists");
  }
  res.json(created ? "Created New" : "Already Exists");
});

// Get product listings by SKU
router.get("/bySku", async (req, res) => {
  const { sku } = req.query;
  try {
    const productListings = await Listings.findByPk(sku);
    if (productListings) {
      res.json(productListings);
    } else {
      res.status(404).json({ error: "Product Listings not found" });
    }
  } catch (error) {
    console.error("Error fetching product listings by SKU:", error);
    res.status(500).json({ error: "Failed to fetch product listings" });
  }
});

router.put("/", async (req, res) => {
  const productListings = req.body;
  try {
    const [productListingsResponse, created] = await Listings.findOrCreate({
      where: { sku: productListings.sku },
      defaults: productListings,
    });

    if (!created) {
      await Listings.update(productListings, {
        where: { sku: productListings.sku },
      });
    }

    res.json(productListings);
  } catch (error) {
    console.error("Error updating product listings:", error);
    res.status(500).json({ error: "Failed to update product listings" });
  }
});

router.post("/updateQuantities", async (req, res) => {
  const listingsUpdates = req.body; // An array of updates with sku, quantitySold, and storeId
  console.log("UPdate quantities by store in router: ", listingsUpdates)
  try {
    const updatePromises = listingsUpdates.map(
      async ({ sku, quantitySold, storeId }) => {
        // Find the existing listing for the SKU
        const listing = await Listings.findByPk(sku);
        console.log("LISTINGS :", listing)
        if (!listing) {
          console.log("LISTINGS ENTRY NOT FOUND")
          return `Listing not found for SKU: ${sku}`;
        }
        // Determine the column to update based on the storeId
        let columnToUpdate;
        if (storeId === 983189) {
          columnToUpdate = "ebayBuy4LessToday";
          console.log("COLUMN TO UPDATE: " ,columnToUpdate)
        } else if (storeId === 1034120) {
          columnToUpdate = "ebayOneLifeLuxuries4";
          console.log("COLUMN TO UPDATE: " ,columnToUpdate)
        } else if (storeId === 1027789) {
          columnToUpdate = "walmartOneLifeLuxuries";
          console.log("COLUMN TO UPDATE: " ,columnToUpdate)
        } else {
          console.log("INSIDE else:::")
          return `Invalid storeId: ${storeId} for SKU: ${sku}`;
        }
        console.log("COLUMN TO UPDATE: " ,columnToUpdate)
        
        // Decrement the quantity for the specified store column
        const newQuantity = Math.max(
          (listing[columnToUpdate] || 0) - quantitySold,
          0
        );

        // Update the listing with the new quantity
        listing[columnToUpdate] = newQuantity;
        await listing.save();

        return `Updated SKU: ${sku} for store: ${storeId} with new quantity: ${newQuantity}`;
      }
    );

    // Wait for all updates to complete
    const updateResults = await Promise.all(updatePromises);

    res.json({
      message: "Listings updated successfully",
      results: updateResults,
    });
  } catch (error) {
    console.error("Error updating product listings:", error);
    res.status(500).json({ error: "Failed to update product listings" });
  }
});

module.exports = router;

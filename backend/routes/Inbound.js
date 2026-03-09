const express = require("express");
const router = express.Router();
const { Inbound, Products } = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const StockUpdateService = require("../Services/StockUpdateService");
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const PricingService = require("../Services/PricingService");

router.post("/", auth, checkPermission('inbound', 'create'), async (req, res) => {
  try {
    const inboundItem = req.body;
    // console.log("Inbound object in backend is : ", inboundItem);

    const [found, created] = await Inbound.findOrCreate({
      where: { compositeSku: inboundItem.compositeSku },
      defaults: inboundItem,
    });

    // Only create a vendor price entry when a brand-new inbound record was created.
    // If the record already existed (duplicate compositeSku), skip pricing to avoid
    // double-counting entries in the weighted average calculation.
    if (created) {
      try {
        await PricingService.createPriceFromInbound(
          {
            sku: inboundItem.sku,
            vendor: inboundItem.vendor,
            price: inboundItem.price,
            quantity: inboundItem.quantity,
            currency: inboundItem.currency,
            inboundCompositeSku: inboundItem.compositeSku,
            notes: inboundItem.priceNotes,
          },
          req.user
        );
      } catch (pricingError) {
        console.error("Error creating vendor price from inbound:", pricingError);
        // Do not fail the inbound operation if pricing fails
      }
    }

    res.json(created ? "Created New" : "Already Exists");
  } catch (error) {
    console.error("Error creating inbound record:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/", auth, checkPermission('inbound', 'edit'), async (req, res) => {
  try {
    const { sku, quantity } = req.body;
    await StockUpdateService.updateProductQuantity(sku, quantity);
    res.json("Updated");
  } catch (error) {
    console.error("Error updating product quantity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", auth, checkPermission('inbound', 'view'), async (req, res) => {
  const listOfInbound = await Inbound.findAll({
    include: {
      model: Products,
      attributes: ["itemName", "location", "listed"],
    },
  });
  res.json(listOfInbound);
});

router.get("/search/:itemName", auth, checkPermission('inbound', 'view'), async (req, res) => {
  const searchQuery = req.params.itemName;
  const searchResults = await Inbound.findAll({
    where: { sku: { [Op.like]: searchQuery + "%" } },
  });
  res.json(searchResults);
});

router.get("/bySku/:sku", auth, checkPermission('inbound', 'view'), async (req, res) => {
  try {
    const { sku } = req.params;
    const records = await Inbound.findAll({
      where: { sku },
      order: [["date", "DESC"]],
    });
    res.json(records);
  } catch (error) {
    console.error("Error fetching inbound by SKU:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

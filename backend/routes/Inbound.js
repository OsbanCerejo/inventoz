const express = require("express");
const router = express.Router();
const { Inbound, Products, Logs } = require("../models");
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

    const vendorInvoiceNumber =
      inboundItem.vendorInvoiceNumber || inboundItem.vendor || null;
    const vendorName =
      inboundItem.vendorName || inboundItem.vendor || null;

    const inboundDefaults = {
      sku: inboundItem.sku,
      quantity: inboundItem.quantity,
      date: inboundItem.date,
      batch: inboundItem.batch,
      compositeSku: inboundItem.compositeSku,
      vendorInvoiceNumber,
      vendorName,
    };

    const [found, created] = await Inbound.findOrCreate({
      where: { compositeSku: inboundItem.compositeSku },
      defaults: inboundDefaults,
    });

    // Only create a vendor price entry when a brand-new inbound record was created.
    // If the record already existed (duplicate compositeSku), skip pricing to avoid
    // double-counting entries in the weighted average calculation.
    if (created) {
      try {
        await PricingService.createPriceFromInbound(
          {
            sku: inboundItem.sku,
            vendorInvoiceNumber,
            vendorName,
            price: inboundItem.price,
            quantity: inboundItem.quantity,
            inboundCompositeSku: inboundItem.compositeSku,
            notes: inboundItem.priceNotes,
          },
          req.user
        );
      } catch (pricingError) {
        console.error("Error creating vendor price from inbound:", pricingError);
        // Do not fail the inbound operation if pricing fails
      }

      try {
        await Logs.create({
          type: "inbound",
          action: "create",
          entityType: "inbound",
          entityId: inboundItem.compositeSku,
          changes: null,
          previousState: null,
          newState: inboundItem,
          userId: req.user ? String(req.user.id) : null,
          metaData: {
            source: "inbound_post",
            createdWithPricing: true,
          },
        });
      } catch (logError) {
        console.error("Failed to create inbound log:", logError);
      }
    } else {
      try {
        await Logs.create({
          type: "inbound",
          action: "create",
          entityType: "inbound",
          entityId: inboundItem.compositeSku,
          changes: null,
          previousState: found,
          newState: inboundItem,
          userId: req.user ? String(req.user.id) : null,
          metaData: {
            source: "inbound_post",
            note: "Duplicate compositeSku, inbound record already existed",
          },
        });
      } catch (logError) {
        console.error("Failed to create inbound duplicate log:", logError);
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
    const previousInboundRecords = await Inbound.findAll({ where: { sku } });

    await StockUpdateService.updateProductQuantity(sku, quantity);

    try {
      await Logs.create({
        type: "inbound",
        action: "update",
        entityType: "inbound",
        entityId: sku,
        changes: { quantity },
        previousState: previousInboundRecords,
        newState: null,
        userId: req.user ? String(req.user.id) : null,
        metaData: {
          source: "inbound_put",
        },
      });
    } catch (logError) {
      console.error("Failed to create inbound update log:", logError);
    }

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

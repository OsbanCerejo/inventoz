const express = require("express");
const router = express.Router();
const { Inbound, Products, Logs, sequelize } = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const StockUpdateService = require("../Services/StockUpdateService");
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const PricingService = require("../Services/PricingService");

router.post("/", auth, checkPermission('inbound', 'create'), async (req, res) => {
  try {
    const inboundItem = req.body;
    const sku = inboundItem?.sku;
    const compositeSku = inboundItem?.compositeSku;
    const parsedQuantity = Number.parseInt(inboundItem?.quantity, 10);
    const parsedDate = new Date(inboundItem?.date);

    if (!sku || !compositeSku) {
      return res.status(400).json({ error: "sku and compositeSku are required" });
    }
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ error: "quantity must be a positive integer" });
    }
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: "date must be a valid date" });
    }

    const isAdmin = req.user?.role === "admin";
    const vendorInvoiceNumber = isAdmin
      ? (inboundItem.vendorInvoiceNumber || inboundItem.vendor || null)
      : null;
    const vendorName = isAdmin
      ? (inboundItem.vendorName || inboundItem.vendor || null)
      : null;

    const createResult = await sequelize.transaction(async (transaction) => {
      const product = await Products.findOne({
        where: { sku },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!product) {
        const error = new Error("Product not found");
        error.statusCode = 404;
        throw error;
      }

      const inboundDefaults = {
        sku,
        quantity: String(parsedQuantity),
        date: parsedDate,
        batch: inboundItem.batch,
        compositeSku,
        vendorInvoiceNumber,
        vendorName,
      };

      const [found, created] = await Inbound.findOrCreate({
        where: { compositeSku },
        defaults: inboundDefaults,
        transaction,
      });

      if (!created) {
        return { created: false, found };
      }

      const currentProductQuantity = Number.parseInt(product.quantity, 10) || 0;
      const newQuantity = currentProductQuantity + parsedQuantity;
      await product.update({ quantity: newQuantity }, { transaction });

      return { created: true, found, newQuantity };
    });

    // Only create a vendor price entry when a brand-new inbound record was created.
    // If the record already existed (duplicate compositeSku), skip pricing to avoid
    // double-counting entries in the weighted average calculation.
    if (createResult.created) {
      try {
        await PricingService.createPriceFromInbound(
          {
            sku,
            vendorInvoiceNumber,
            vendorName,
            price: isAdmin ? inboundItem.price : null,
            quantity: parsedQuantity,
            inboundCompositeSku: compositeSku,
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
          entityId: compositeSku,
          changes: null,
          previousState: null,
          newState: {
            ...inboundItem,
            quantity: parsedQuantity,
            vendorInvoiceNumber,
            vendorName,
          },
          userId: req.user ? String(req.user.id) : null,
          metaData: {
            source: "inbound_post",
            createdWithPricing: true,
            stockUpdated: true,
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
          entityId: compositeSku,
          changes: null,
          previousState: createResult.found,
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

    res.json(createResult.created ? "Created New" : "Already Exists");
  } catch (error) {
    console.error("Error creating inbound record:", error);
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/", auth, checkPermission('inbound', 'edit'), async (req, res) => {
  try {
    const { sku, quantity } = req.body;
    const parsedQuantity = Number.parseInt(quantity, 10);

    if (!sku) {
      return res.status(400).json({ error: "sku is required" });
    }
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
      return res.status(400).json({ error: "quantity must be a non-negative integer" });
    }

    const previousInboundRecords = await Inbound.findAll({ where: { sku } });

    await StockUpdateService.updateProductQuantity(sku, parsedQuantity);

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
  try {
    const listOfInbound = await Inbound.findAll({
      include: {
        model: Products,
        attributes: ["itemName", "location", "listed"],
      },
    });
    res.json(listOfInbound);
  } catch (error) {
    console.error("Error fetching inbound records:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/search/:itemName", auth, checkPermission('inbound', 'view'), async (req, res) => {
  try {
    const searchQuery = req.params.itemName;
    const searchResults = await Inbound.findAll({
      where: { sku: { [Op.like]: searchQuery + "%" } },
    });
    res.json(searchResults);
  } catch (error) {
    console.error("Error searching inbound records:", error);
    res.status(500).json({ error: "Internal server error" });
  }
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

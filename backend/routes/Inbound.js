const express = require("express");
const router = express.Router();
const { Inbound, Products } = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const StockUpdateService = require("../Services/StockUpdateService");
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

router.post("/", auth, checkPermission('inbound', 'create'), async (req, res) => {
  const inboundItem = req.body;
  // console.log("Inbound object in backend is : ", inboundItem);

  const [found, created] = await Inbound.findOrCreate({
    where: { compositeSku: inboundItem.compositeSku },
    defaults: inboundItem,
  });
  if (created) {
    // console.log("Created New");
  } else {
    // console.log("Already Exists");
  }
  res.json(created ? "Created New" : "Already Exists");
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

module.exports = router;

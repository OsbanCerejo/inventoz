const express = require("express");
const router = express.Router();
const { Inbound, Products } = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;

router.post("/", async (req, res) => {
  const inboundItem = req.body;
  console.log("Inbound object in backend is : ", inboundItem);
  const [found, created] = await Inbound.findOrCreate({
    where: { compositeSku: inboundItem.compositeSku },
    defaults: inboundItem,
  });
  if (created) {
    console.log("Created New");
  } else {
    console.log("Already Exists");
  }
  res.json(created ? "Created New" : "Already Exists");
});

router.put("/", async (req, res) => {
  console.log(req.body);
  await Products.update(
    {
      quantity: req.body.quantity,
    },
    { where: { sku: req.body.sku } }
  );
  res.json("Updated");
});

router.get("/", async (req, res) => {
  const listOfInbound = await Inbound.findAll({
    include: {
      model: Products,
      attributes: ["itemName", "location", "listed"],
    },
  });
  res.json(listOfInbound);
});

router.get("/search/:itemName", async (req, res) => {
  const searchQuery = req.params.itemName;
  const searchResults = await Inbound.findAll({
    where: { sku: { [Op.like]: searchQuery + "%" } },
  });
  res.json(searchResults);
});

module.exports = router;

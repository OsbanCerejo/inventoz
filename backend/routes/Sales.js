const express = require("express");
const router = express.Router();
const { Sales,Products } = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;

router.post("/", async (req, res) => {
    const saleItem = req.body;
    const [found, created] = await Sales.findOrCreate({
        where: { compositeSalesSku: saleItem.compositeSalesSku},
        defaults: saleItem
    });
    if(created) {
        console.log("Created New")
    } else {
        console.log("Already Exists")
    }
    res.json(created ? "Created New" : "Already Exists");
});

router.put("/", async (req, res) => {
    console.log(req.body)
    await Products.update({ 
        quantity: req.body.quantity,
        }, 
        {where: {sku: req.body.sku}});
    res.json("Updated");
});

module.exports = router;
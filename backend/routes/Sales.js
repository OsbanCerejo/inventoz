const express = require("express");
const router = express.Router();
const { Sales, Products } = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const StockUpdateService = require("../Services/StockUpdateService");

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
    try {
        const { sku, quantity } = req.body;
        await StockUpdateService.updateProductQuantity(sku, quantity);
        res.json("Updated");
    } catch (error) {
        console.error("Error updating product quantity:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;
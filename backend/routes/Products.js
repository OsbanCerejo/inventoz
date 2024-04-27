const express = require("express");
const router = express.Router();
const { Products } = require("../models");

router.get("/", async (req, res) => {
    const listOfProducts = await Products.findAll();
    res.json(listOfProducts);
});

router.get("/byId/:id", async (req, res) => {
    const id = req.params.id;
    const product = await Products.findByPk(id);
    res.json(product);
});

router.post("/", async (req, res) => {
    const product = req.body;
    await Products.create(product);
    res.json(product);
});

router.put("/", async (req, res) => {
    const product = req.body;
    await Products.update({brand: product.brand, 
        itemName : product.itemName, 
        quantity: product.quantity,
        location: product.location,
        sizeOz: product.sizeOz,
        sizeMl: product.sizeMl,
        strength: product.strength,
        shade: product.shade,
        formulation: product.formulation,
        category: product.category,
        type: product.type,
        upc: product.upc,
        batch: product.batch,
        condition: product.condition,}, 
        {where: {sku: product.sku}});
    res.json(product);
});

module.exports = router;
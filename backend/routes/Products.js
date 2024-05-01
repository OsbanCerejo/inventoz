const express = require("express");
const router = express.Router();
const { Products } = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;

router.get("/", async (req, res) => {
    const listOfProducts = await Products.findAll();
    res.json(listOfProducts);
});

router.get("/byId/:id", async (req, res) => {
    const id = req.params.id;
    const product = await Products.findByPk(id);
    res.json(product);
});

router.get("/search/:itemName", async (req, res) => {
    const searchQuery = req.params.itemName;
    const searchResults = await Products.findAll({
        where: { itemName: {[Op.like]: '%' + searchQuery + '%'}}
    })
    res.json(searchResults);
})

router.post("/", async (req, res) => {
    const product = req.body;
    // await Products.create(product);
    const [found, created] = await Products.findOrCreate({
        where: { sku: product.sku},
        defaults: product
    });
    if(created) {
        console.log("Created New")
    } else {
        console.log("Already Exists")
    }
    res.json(created ? "Created New" : "Already Exists");
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

router.delete("/delete/:id", async(req, res) => {
    const id = req.params.id;
    const status = await Products.destroy({
        where: {
            sku: id
        }
    })
})

module.exports = router;
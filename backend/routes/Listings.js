const express = require("express");
const router = express.Router();
const { Listings } = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;

router.get("/", async (req, res) => {
    const listOfListings = await Listings.findAll();
    res.json(listOfListings);
});

router.get("/search/:itemName", async (req, res) => {
    const searchQuery = req.params.itemName;
    const searchResults = await Listings.findAll({
        where: { itemName: {[Op.like]: '%' + searchQuery + '%'}}
    })
    res.json(searchResults);
})

// router.post("/", async (req, res) => {
//     const saleItem = req.body;
//     const [found, created] = await Sales.findOrCreate({
//         where: { compositeSalesSku: saleItem.compositeSalesSku},
//         defaults: saleItem
//     });
//     if(created) {
//         console.log("Created New")
//     } else {
//         console.log("Already Exists")
//     }
//     res.json(created ? "Created New" : "Already Exists");
// });

// router.put("/", async (req, res) => {
//     console.log(req.body)
//     await Products.update({ 
//         quantity: req.body.quantity,
//         }, 
//         {where: {sku: req.body.sku}});
//     res.json("Updated");
// });s

module.exports = router;
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

router.get("/search", async (req, res) => {
  const { searchString, searchType } = req.query;
  console.log(searchType);
  const searchResults = await Products.findAll({
    where: {
      [searchType]: {
        [Op.like]: "%" + searchString + "%",
      },
    },
  });
  res.json(searchResults);
});

router.post("/", async (req, res) => {
  const product = req.body;
  // await Products.create(product);
  const [found, created] = await Products.findOrCreate({
    where: { sku: product.sku },
    defaults: product,
  });
  if (created) {
    console.log("Created New");
  } else {
    console.log("Already Exists");
  }
  res.json(created ? "Created New" : "Already Exists");
});

router.put("/", async (req, res) => {
  const product = req.body;
  console.log("Edited Product Value in Server : ", product);
  await Products.update(
    {
      brand: product.brand,
      itemName: product.itemName,
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
      warehouseLocations: product.warehouseLocations,
      batch: product.batch,
      condition: product.condition,
      verified: product.verified,
      listed: product.listed,
      final: product.final,
      image: product.image,
    },
    { where: { sku: product.sku } }
  );
  res.json(product);
});

router.delete("/delete/:id", async (req, res) => {
  const id = req.params.id;
  const status = await Products.destroy({
    where: {
      sku: id,
    },
  });
  res.json(status);
});

router.get("/findAndCount/:skuPrefix", async (req, res) => {
  console.log("Here inside find and count all in backend");
  const skuPrefix = req.params.skuPrefix;
  const { count, rows } = await Products.findAndCountAll({
    where: {
      sku: {
        [Op.like]: skuPrefix + "-" + "%",
      },
    },
    // offset: 10,
    // limit: 2,
  });
  //   console.log(count);
  res.json(count + 1);
});

router.post("/updateQuantities", async (req, res) => {
  const skusToUpdate = req.body;

  try {
    const updatePromises = skusToUpdate.map(async (skuUpdate) => {
      const product = await Products.findOne({ where: { sku: skuUpdate.sku } });

      if (product) {
        const newQuantity = product.quantity - skuUpdate.quantitySold;
        await product.update({ quantity: newQuantity });

        return {
          sku: skuUpdate.sku,
          itemName: product.itemName,
          oldQuantity: product.quantity,
          newQuantity: newQuantity,
        };
      }
    });

    const updateResults = await Promise.all(updatePromises);

    res.json({
      success: true,
      updatedProducts: updateResults.filter(Boolean),
    });
  } catch (error) {
    console.error("Error updating product quantities:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;

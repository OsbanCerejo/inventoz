const express = require("express");
const router = express.Router();
const { Products, ProductHistory, StockUpdateHistory } = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const StockUpdateService = require("../Services/StockUpdateService");

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
  
  try {
    // Get the current product state
    const currentProduct = await Products.findOne({ where: { sku: product.sku } });
    
    if (!currentProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    // If quantity is being updated, use the StockUpdateService
    if (currentProduct.quantity !== product.quantity) {
      await StockUpdateService.updateProductQuantity(
        product.sku,
        product.quantity
      );
    }

    // Update the product
    await Products.update(
      {
        brand: product.brand,
        itemName: product.itemName,
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
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Internal server error" });
  }
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
    const updates = await Promise.all(skusToUpdate.map(async (skuUpdate) => {
      const product = await Products.findOne({ where: { sku: skuUpdate.sku } });
      if (!product) {
        throw new Error(`Product not found for SKU: ${skuUpdate.sku}`);
      }
      return {
        sku: skuUpdate.sku,
        newQuantity: product.quantity - skuUpdate.quantitySold
      };
    }));

    const result = await StockUpdateService.updateMultipleProductQuantities(updates);

    res.json({
      success: true,
      updatedProducts: result.results.map(r => r.product)
    });
  } catch (error) {
    console.error("Error updating product quantities:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const { Products, ProductHistory, StockUpdateHistory, Logs } = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const StockUpdateService = require("../Services/StockUpdateService");
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

router.get("/", auth, checkPermission('products', 'view'), async (req, res) => {
  const listOfProducts = await Products.findAll();
  res.json(listOfProducts);
});

router.get("/byId/:id", auth, checkPermission('products', 'view'), async (req, res) => {
  const id = req.params.id;
  const product = await Products.findByPk(id);
  res.json(product);
});

router.get("/search", auth, checkPermission('products', 'view'), async (req, res) => {
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

router.post("/", auth, checkPermission('products', 'create'), async (req, res) => {
  const product = req.body;
  try {
    const [found, created] = await Products.findOrCreate({
      where: { sku: product.sku },
      defaults: product,
    });

    if (created) {
      // Log the product creation
      await Logs.create({
        type: "Product",
        action: "create",
        entityType: "product",
        entityId: product.sku,
        userId: req.user.id.toString(),
        changes: [{
          sku: product.sku,
          changes: []
        }],
        newState: product,
        metaData: {
          message: "New product created"
        }
      });
      res.json("Created New");
    } else {
      res.json("Already Exists");
    }
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.put("/", auth, checkPermission('products', 'edit'), async (req, res) => {
  const product = req.body;
  console.log("Edited Product Value in Server : ", product);
  
  try {
    // Get the current product state
    const currentProduct = await Products.findOne({ where: { sku: product.sku } });
    
    if (!currentProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Store the previous state
    const previousState = currentProduct.toJSON();

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
        alternativeSku: product.alternativeSku,
      },
      { where: { sku: product.sku } }
    );

    // If a quantity is being updated, use the StockUpdateService
    if (currentProduct.quantity !== product.quantity || product.verified !== currentProduct.verified) {
      await StockUpdateService.updateProductQuantity(
          product.sku,
          product.quantity
      );
    }

    // Get the updated product data
    const updatedProduct = await Products.findOne({ where: { sku: product.sku } });
    
    // Calculate changes
    const changes = [];
    Object.keys(product).forEach(key => {
      if (JSON.stringify(previousState[key]) !== JSON.stringify(product[key])) {
        changes.push({
          field: key,
          oldValue: previousState[key],
          newValue: product[key]
        });
      }
    });

    // Log the product update
    await Logs.create({
      type: "Product",
      action: "update",
      entityType: "product",
      entityId: product.sku,
      userId: req.user.id.toString(),
      changes: [{
        sku: product.sku,
        changes: changes
      }],
      previousState: previousState,
      newState: updatedProduct.toJSON(),
      metaData: {
        message: "Product updated",
        quantityChanged: currentProduct.quantity !== product.quantity,
        verificationChanged: currentProduct.verified !== product.verified
      }
    });

    res.json(updatedProduct);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/delete/:id", auth, checkPermission('products', 'delete'), async (req, res) => {
  const id = req.params.id;
  const status = await Products.destroy({
    where: {
      sku: id,
    },
  });
  res.json(status);
});

router.get("/findAndCount/:skuPrefix", auth, checkPermission('products', 'view'), async (req, res) => {
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

router.post("/updateQuantities", auth, checkPermission('products', 'edit'), async (req, res) => {
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
      message: "Quantities updated successfully",
      result
    });
  } catch (error) {
    console.error("Error updating quantities:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

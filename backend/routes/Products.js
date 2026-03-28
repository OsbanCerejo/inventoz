const express = require("express");
const router = express.Router();
const { Products, ProductDetails, ProductHistory, StockUpdateHistory, Logs } = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const StockUpdateService = require("../Services/StockUpdateService");
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

const LIST_SORT_KEYS = new Set([
  "sku",
  "brand",
  "itemName",
  "quantity",
  "sizeOz",
  "strength",
  "shade",
  "location",
  "upc",
]);

const buildContainsFilter = (columnName, rawValue, options = {}) => {
  const value = String(rawValue || "").trim();
  if (!value) return null;
  if (options.castToChar) {
    return Sequelize.where(
      Sequelize.cast(Sequelize.col(columnName), "CHAR"),
      { [Op.like]: `%${value}%` }
    );
  }
  return {
    [columnName]: {
      [Op.like]: `%${value}%`,
    },
  };
};

router.get("/", auth, checkPermission('products', 'view'), async (req, res) => {
  const db = require("../models");
  const listOfProducts = await db.Products.findAll({
    include: [{
      model: db.ProductDetails,
      required: false,
      attributes: ['tester']
    }]
  });
  res.json(listOfProducts);
});

router.get("/list", auth, checkPermission('products', 'view'), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const requestedSortKey = String(req.query.sortKey || "sku").trim();
    const sortKey = LIST_SORT_KEYS.has(requestedSortKey) ? requestedSortKey : "sku";
    const sortDirection = String(req.query.sortDirection || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";

    const filters = {
      upc: req.query.upc,
      sku: req.query.sku,
      brand: req.query.brand,
      itemName: req.query.itemName,
      sizeOz: req.query.sizeOz,
      strength: req.query.strength,
      shade: req.query.shade,
      location: req.query.location,
    };

    const whereClauses = [
      buildContainsFilter("sku", filters.sku),
      buildContainsFilter("brand", filters.brand),
      buildContainsFilter("itemName", filters.itemName),
      buildContainsFilter("strength", filters.strength),
      buildContainsFilter("shade", filters.shade),
      buildContainsFilter("location", filters.location),
      buildContainsFilter("upc", filters.upc, { castToChar: true }),
      buildContainsFilter("sizeOz", filters.sizeOz, { castToChar: true }),
    ].filter(Boolean);

    const where = whereClauses.length ? { [Op.and]: whereClauses } : {};
    const offset = (page - 1) * pageSize;

    const { count, rows } = await Products.findAndCountAll({
      attributes: [
        "sku",
        "brand",
        "itemName",
        "sizeOz",
        "sizeMl",
        "strength",
        "shade",
        "location",
        "quantity",
        "image",
        "verified",
        "upc",
      ],
      where,
      include: [
        {
          model: ProductDetails,
          required: false,
          attributes: ["tester", "discontinued"],
        },
      ],
      order: [[sortKey, sortDirection]],
      limit: pageSize,
      offset,
      distinct: true,
      subQuery: false,
    });

    return res.json({
      rows,
      total: count,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Error loading paginated products list:", error);
    return res.status(500).json({ error: "Failed to load products list" });
  }
});

router.get("/byId/:id", auth, checkPermission('products', 'view'), async (req, res) => {
  const id = req.params.id;
  const product = await Products.findByPk(id);
  res.json(product);
});

router.get("/search", auth, checkPermission('products', 'view'), async (req, res) => {
  const { searchString, searchType } = req.query;
  // console.log(searchType);
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
    // Ensure trackQuantity and minimumQuantity are set properly
    const productData = {
      ...product,
      trackQuantity: product.trackQuantity || false,
      minimumQuantity: product.minimumQuantity || null,
      lowStockAlertSent: false
    };
    
    const [found, created] = await Products.findOrCreate({
      where: { sku: product.sku },
      defaults: productData,
    });

    if (created) {
      // Log the product creation
      try {
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
      } catch (logError) {
        console.error("Failed to create product log:", logError);
      }
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
  // console.log("Edited Product Value in Server : ", product);

  const normalizeMinimumQuantity = (value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };
  
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
        trackQuantity: product.trackQuantity !== undefined ? product.trackQuantity : currentProduct.trackQuantity,
        minimumQuantity:
          product.minimumQuantity !== undefined
            ? normalizeMinimumQuantity(product.minimumQuantity)
            : currentProduct.minimumQuantity,
      },
      { where: { sku: product.sku } }
    );

    // Get the updated quantity (use new quantity if provided, otherwise keep current)
    const updatedQuantity = product.quantity !== undefined ? product.quantity : currentProduct.quantity;

    // If a quantity is being updated, use the StockUpdateService
    if (currentProduct.quantity !== product.quantity || product.verified !== currentProduct.verified) {
      await StockUpdateService.updateProductQuantity(
          product.sku,
          updatedQuantity
      );
    }

    // If trackQuantity or minimumQuantity changed, handle tracking status
    // This handles: tracking turned on/off, minimum quantity changed
    if (currentProduct.trackQuantity !== product.trackQuantity || 
        currentProduct.minimumQuantity !== product.minimumQuantity) {
      const LowStockAlertService = require("../Services/LowStockAlertService");
      
      // If tracking was just turned ON (from OFF), reset the alert flag first
      // This ensures we can send an alert if stock is currently low
      if (!currentProduct.trackQuantity && product.trackQuantity) {
        await Products.update(
          { lowStockAlertSent: false },
          { where: { sku: product.sku } }
        );
        
        // Check if stock is currently low and send alert if needed
        const lowStockCheck = await LowStockAlertService.checkAndHandleLowStock(product.sku, updatedQuantity);
        
        // Send email if needed
        if (lowStockCheck.shouldAlert) {
          const EmailService = require("../Services/EmailService");
          const recipientEmail = process.env.LOW_STOCK_ALERT_EMAIL || process.env.ALERT_EMAIL;
          if (recipientEmail) {
            EmailService.sendLowStockAlert(lowStockCheck.product, recipientEmail).catch(err => {
              console.error('Failed to send low stock alert email:', err);
            });
          }
        }
      } 
      // If tracking was turned OFF, the checkAndHandleLowStock will reset the flag
      // But we should also check if tracking is still ON and quantity/minimum changed
      else if (product.trackQuantity) {
        // Tracking is still ON, check low stock status with current quantity
        const lowStockCheck = await LowStockAlertService.checkAndHandleLowStock(product.sku, updatedQuantity);
        
        // Send email if needed
        if (lowStockCheck.shouldAlert) {
          const EmailService = require("../Services/EmailService");
          const recipientEmail = process.env.LOW_STOCK_ALERT_EMAIL || process.env.ALERT_EMAIL;
          if (recipientEmail) {
            EmailService.sendLowStockAlert(lowStockCheck.product, recipientEmail).catch(err => {
              console.error('Failed to send low stock alert email:', err);
            });
          }
        }
      }
      // If tracking was turned OFF, checkAndHandleLowStock will handle resetting the flag
      // No need to do anything else here
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
    try {
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
    } catch (logError) {
      console.error("Failed to create product update log:", logError);
    }

    res.json(updatedProduct);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/delete/:id", auth, checkPermission('products', 'delete'), async (req, res) => {
  try {
    const id = req.params.id;

    const currentProduct = await Products.findOne({ where: { sku: id } });
    if (!currentProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    const status = await Products.destroy({
      where: {
        sku: id,
      },
    });

    try {
      await Logs.create({
        type: "Product",
        action: "delete",
        entityType: "product",
        entityId: currentProduct.sku,
        userId: req.user.id.toString(),
        changes: [],
        previousState: currentProduct.toJSON(),
        newState: [],
        metaData: {
          message: "Product has been deleted",
        }
      });
    } catch (logError) {
      console.error("Failed to create product delete log:", logError);
    }

    res.json(status);
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

router.get("/findAndCount/:skuPrefix", auth, checkPermission('products', 'view'), async (req, res) => {
  // console.log("Here inside find and count all in backend");
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
    const skipped = [];
    const updates = await Promise.all(skusToUpdate.map(async (skuUpdate) => {
      let product = await Products.findOne({ where: { sku: skuUpdate.sku } });

      if (!product) {
        product = await Products.findOne({ where: { alternativeSku: skuUpdate.sku } });
        if (product) {
          return {
            sku: product.sku,
            newQuantity: product.quantity - skuUpdate.quantitySold,
            originalRequestedSku: skuUpdate.sku
          };
        }
      }
      
      if (!product) {
        skipped.push(skuUpdate.sku);
        return null; // skip this one
      }
      
      return {
        sku: skuUpdate.sku,
        newQuantity: product.quantity - skuUpdate.quantitySold
      };
    }));

    // Filter out nulls (skipped)
    const validUpdates = updates.filter(Boolean);
    const result = await StockUpdateService.updateMultipleProductQuantities(validUpdates);

    res.json({
      success: true,
      message: "Quantities updated successfully",
      result,
      skipped,
    });
  } catch (error) {
    console.error("Error updating quantities:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get low stock products (admin only)
router.get("/low-stock", auth, checkPermission('lowStock', 'view'), async (req, res) => {
  try {
    const LowStockAlertService = require("../Services/LowStockAlertService");
    const lowStockProducts = await LowStockAlertService.getLowStockProducts();
    res.json(lowStockProducts);
  } catch (error) {
    console.error("Error getting low stock products:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Test email configuration (admin only)
router.post("/test-email", auth, checkPermission('lowStock', 'view'), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const EmailService = require("../Services/EmailService");
    const success = await EmailService.sendTestEmail(email);
    
    if (success) {
      res.json({ success: true, message: 'Test email sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send test email. Check server logs for details.' });
    }
  } catch (error) {
    console.error("Error sending test email:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

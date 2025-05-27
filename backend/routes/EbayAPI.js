const express = require("express");
const router = express.Router();
const axios = require("axios");
const authService = require("../Services/AuthService");
const service = new authService();
const fs = require("fs");
const { parse } = require("csv-parse");
const path = require("path");
const { Products } = require("../models");

router.get("/getItem", async (req, res) => {
  const { sku } = req.query;
  if (!sku) {
    return res.status(400).json({ message: "SKU is required" });
  }

  try {
    // Get the product to check for alternative SKU
    const product = await Products.findOne({ where: { sku } });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Use alternative SKU if available, otherwise use original SKU, and trim any spaces
    const ebaySku = product.alternativeSku ? product.alternativeSku.trim() : sku;
    const TOKEN = await service.getAccessToken();
    const EBAY_API_URL = "https://api.ebay.com/sell/inventory/v1/inventory_item/";

    const response = await axios.get(EBAY_API_URL + ebaySku, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    });

    if (response.status === 200 && response.data) {
      return res.json(response.data);
    } else {
      console.error("Unexpected response from eBay API:", response.statusText);
      return res.status(response.status).json({
        message: "Unexpected response from eBay API",
        details: response.statusText,
      });
    }
  } catch (error) {
    console.error(
      "Error fetching eBay API:",
      error.response ? error.response.data : error.message
    );

    return res.status(500).json({
      message: "Failed to fetch eBay API",
      error: error.response ? error.response.data : error.message,
    });
  }
});

router.post("/updateQuantity", async (req, res) => {
  const { sku, quantity } = req.body;
  if (!sku || quantity === undefined) {
    return res.status(400).json({ message: "SKU and quantity are required." });
  }

  try {
    // Get the product to check for alternative SKU
    const product = await Products.findOne({ where: { sku } });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Use alternative SKU if available, otherwise use original SKU, and trim any spaces
    const ebaySku = product.alternativeSku ? product.alternativeSku.trim() : sku;
    const TOKEN = await service.getAccessToken();
    const EBAY_API_URL = "https://api.ebay.com/sell/inventory/v1/bulk_update_price_quantity";

    const payload = {
      requests: [
        {
          sku: ebaySku,
          shipToLocationAvailability: {
            quantity: parseInt(quantity),
          },
        },
      ],
    };

    const response = await axios.post(EBAY_API_URL, payload, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 200 && response.data) {
      return res.json(response.data);
    } else {
      console.error("Unexpected response from eBay API:", response.statusText);
      return res.status(response.status).json({
        message: "Unexpected response from eBay API",
        details: response.statusText,
      });
    }
  } catch (error) {
    console.error(
      "Error fetching eBay API:",
      error.response ? error.response.data : error.message
    );

    return res.status(500).json({
      message: "Failed to fetch eBay API",
      error: error.response ? error.response.data : error.message,
    });
  }
});

router.get("/testebay", async (req, res) => {
  const TOKEN = await service.getAccessToken();

  const EBAY_API_URL =
    "https://api.ebay.com/sell/inventory/v1/inventory_item/PHI-CO-US-00001";

  try {
    const response = await axios.get(EBAY_API_URL, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    });

    if (response.status === 200 && response.data) {
      return res.json(response.data);
    } else {
      console.error("Unexpected response from eBay API:", response.statusText);
      return res.status(response.status).json({
        message: "Unexpected response from eBay API",
        details: response.statusText,
      });
    }
  } catch (error) {
    console.error(
      "Error fetching eBay API:",
      error.response ? error.response.data : error.message
    );

    return res.status(500).json({
      message: "Failed to fetch eBay API",
      error: error.response ? error.response.data : error.message,
    });
  }
});

router.get("/bulk-migrate", async (req, res) => {
    try {
        const csvFilePath = './uploads/active listings oll.csv';
        const items = [];
        
        // Read and parse CSV file
        const parser = fs
            .createReadStream(csvFilePath)
            .pipe(parse({
                columns: true,
                skip_empty_lines: true
            }));

        for await (const record of parser) {
            if (record['Item ID']) {
                items.push({
                    itemId: record['Item ID'],
                    sku: record['Custom Label (SKU)'] || '',
                    title: record['Title'] || ''
                });
            }
        }
        
        const TOKEN = await service.getAccessToken();
        const EBAY_API_URL = "https://api.ebay.com/sell/inventory/v1/bulk_migrate_listing";
        const migratedItems = [];
        const failedItems = [];

        // Process items in batches of 5 (eBay's limit)
        const batchSize = 5;
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const payload = {
                requests: batch.map(item => ({
                    listingId: item.itemId
                }))
            };

            try {
                const response = await axios.post(EBAY_API_URL, payload, {
                    headers: {
                        Authorization: `Bearer ${TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                // Add successfully migrated items to the list
                batch.forEach(item => {
                    migratedItems.push({
                        itemId: item.itemId,
                        sku: item.sku,
                        title: item.title,
                        migratedAt: new Date().toISOString()
                    });
                });
            } catch (error) {
                console.error(`Error processing batch ${Math.floor(i/batchSize) + 1}:`, error.response?.data || error.message);
                
                // Add failed items to the list
                batch.forEach(item => {
                    failedItems.push({
                        itemId: item.itemId,
                        sku: item.sku,
                        title: item.title,
                        error: error.response?.data || error.message,
                        failedAt: new Date().toISOString()
                    });
                });
            }

            // Add a small delay between batches to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Save migration results to JSON files
        const resultsDir = path.join(__dirname, '../migration_results');
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // Save successful migrations
        if (migratedItems.length > 0) {
            fs.writeFileSync(
                path.join(resultsDir, `successful_migrations_${timestamp}.json`),
                JSON.stringify(migratedItems, null, 2)
            );
        }

        // Save failed migrations
        if (failedItems.length > 0) {
            fs.writeFileSync(
                path.join(resultsDir, `failed_migrations_${timestamp}.json`),
                JSON.stringify(failedItems, null, 2)
            );
        }

        res.json({
            success: true,
            summary: {
                totalItems: items.length,
                successfullyMigrated: migratedItems.length,
                failed: failedItems.length
            },
            migratedItems,
            failedItems
        });

    } catch (error) {
        console.error('Error in bulk migration:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;

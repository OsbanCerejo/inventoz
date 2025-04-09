const express = require("express");
const router = express.Router();
const axios = require("axios");
const authService = require("../Services/AuthService");
const service = new authService();

router.get("/getItem", async (req, res) => {
  const { sku } = req.query;
  if (!sku) {
    return res.status(400).json({ message: "SKU is required" });
  }
  const TOKEN = await service.getAccessToken();

  const EBAY_API_URL = "https://api.ebay.com/sell/inventory/v1/inventory_item/";

  try {
    const response = await axios.get(EBAY_API_URL + sku, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    });

    if (response.status === 200 && response.data) {
      console.log("eBay API Response:", response.data);
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
  const TOKEN = await service.getAccessToken();

  const EBAY_API_URL =
    "https://api.ebay.com/sell/inventory/v1/bulk_update_price_quantity";

  const payload = {
    requests: [
      {
        sku,
        shipToLocationAvailability: {
          quantity: parseInt(quantity),
        },
      },
    ],
  };

  try {
    const response = await axios.post(EBAY_API_URL, payload, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 200 && response.data) {
      console.log("eBay API Response:", response.data);
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

  // const EBAY_API_URL =
  //   "https://api.ebay.com/sell/inventory/v1/bulk_migrate_listing";

  const EBAY_API_URL =
    "https://api.ebay.com/sell/inventory/v1/inventory_item/PHI-CO-US-00001";

  const payload = {
    requests: [
      {
        listingId: "195728146053",
      },
    ],
  };
  try {
    const response = await axios.get(EBAY_API_URL, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    });

    // const response = await axios.post(EBAY_API_URL, payload, {
    //   headers: {
    //     Authorization: `Bearer ${TOKEN}`,
    //     "Content-Type": "application/json",
    //   },
    // });

    if (response.status === 200 && response.data) {
      console.log("eBay API Response:", response.data);
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

module.exports = router;

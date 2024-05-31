const express = require("express");
const router = express.Router();
const axios = require("axios");
// const authService = require('../services/AuthService');

// const service = new authService();
router.get("/allOrders", async (req, res) => {
  const TOKEN = process.env.API_KEY_ENCODED;

  const SHIPSTATION_URL = "https://ssapi.shipstation.com/orders";

  try {
    const response = await axios.get(SHIPSTATION_URL, {
      headers: {
        Authorization: `Basic ${TOKEN}`,
      },
      params: {
        limit: 200,
        offset: 0,
        orderStatus: "awaiting_shipment",
      },
    });

    if (response.status === 200) {
      const orders = response.data;
      //   console.log(orders);
      res.json(orders);
    } else {
      console.error(
        "Error fetching orders:",
        response.status,
        response.statusText
      );
    }
  } catch (error) {
    console.log(error);
    console.error(
      "Error:",
      error.response ? error.response.data : error.message
    );
  }
});

module.exports = router;

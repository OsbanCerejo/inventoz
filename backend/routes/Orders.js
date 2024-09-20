const express = require("express");
const router = express.Router();
const axios = require("axios");
// const authService = require("../Services/AuthService");
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
        pageSize: 500,
        // modifyDateStart: "2024-09-20T12:00:05.000Z",
        // storeid: 1027789,
      },
    });

    if (response.status === 200) {
      const orders = response.data;
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

// Fetch order details by order ID
router.get("/order/:orderNumber", async (req, res) => {
  const TOKEN = process.env.API_KEY_ENCODED;

  const SHIPSTATION_URL = "https://ssapi.shipstation.com/orders";

  const { orderNumber } = req.params;

  try {
    const response = await axios.get(SHIPSTATION_URL, {
      headers: {
        Authorization: `Basic ${TOKEN}`,
      },
      params: {
        orderNumber: orderNumber,
      },
    });

    if (response.status === 200) {
      const orders = response.data.orders; // ShipStation API response structure
      if (orders.length > 0) {
        const order = orders[0];
        const transformedOrder = {
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          items: order.items.map((item) => ({
            sku: item.sku,
            name: item.name,
            quantity: item.quantity,
            imageUrl: item.imageUrl,
            options: item.options,
          })),
        };
        res.json(transformedOrder);
      } else {
        res.status(404).json({ error: "Order not found" });
      }
    } else {
      console.error(
        "Error fetching order details:",
        response.status,
        response.statusText
      );
      res.status(response.status).json({ error: response.statusText });
    }
  } catch (error) {
    console.error(
      "Error:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: error.message });
  }
});

// router.get("/testebay", async (req, res) => {
//   const TOKEN = await service.getAccessToken();

//   const EBAY_API_URL = "https://api.ebay.com/sell/fulfillment/v1/order";
//   try {
//     const response = await axios.get(EBAY_API_URL, {
//       headers: {
//         Authorization: `Bearer ${TOKEN}`,
//       },
//       params: {
//         limit: 100,
//         offset: 0,
//       },
//     });

//     if (response.status === 200) {
//       const orders = response.data;
//       console.log(orders);
//     } else {
//       console.error(
//         "Error fetching orders:",
//         response.status,
//         response.statusText
//       );
//     }
//   } catch (error) {
//     console.log(error);
//     console.error(
//       "Error:",
//       error.response ? error.response.data : error.message
//     );
//   }

//   res.json("Completed");
// });

module.exports = router;

const express = require("express");
const router = express.Router();
const axios = require('axios');

router.get("/allOrders", async (req, res) => {

  // const EBAY_API_URL = 'https://api.ebay.com/sell/fulfillment/v1/order';
  // const AUTH_TOKEN = 'v^1.1#i^1#p^3#f^0#r^1#I^3#t^Ul4xMF83Ojc2NjAwQUJCMTkyNThERDA3RTM0MjM1RDM3Rjc5RjY0XzBfMSNFXjI2MA==';


  // try {
  //     const response = await axios.get(EBAY_API_URL, {
  //       headers: {
  //         Authorization: `Bearer ${AUTH_TOKEN}`
  //       },
  //       params: {
  //         limit: 100,
  //         offset: 0,  
  //       },
  //     });
  
  //     if (response.status === 200) {
  //       const orders = response.data.orders;
  //       console.log('Orders:', orders);
  //     } else {
  //       console.error('Error fetching orders:', response.status, response.statusText);
  //     }
  //   } catch (error) {
  //     console.log(error)
  //     console.error('Error:', error.response ? error.response.data : error.message);
  // }

  res.json("Completed");
});

module.exports = router;
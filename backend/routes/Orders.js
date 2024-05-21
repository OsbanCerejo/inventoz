const express = require("express");
const router = express.Router();
const axios = require('axios');
const authService = require('../Services/AuthService');

const service = new authService();
router.get("/allOrders", async (req, res) => {
    const TOKEN = await service.getAccessToken();

    const EBAY_API_URL = 'https://api.ebay.com/sell/fulfillment/v1/order';
    try {
        const response = await axios.get(EBAY_API_URL, {
            headers: {
                Authorization: `Bearer ${TOKEN}`
            },
            params: {
                limit: 100,
                offset: 0,
            },
        });

        if (response.status === 200) {
            const orders = response.data;
            console.log(orders);
        } else {
            console.error('Error fetching orders:', response.status, response.statusText);
        }
    } catch (error) {
        console.log(error)
        console.error('Error:', error.response ? error.response.data : error.message);
    }

    res.json("Completed");
});

module.exports = router;
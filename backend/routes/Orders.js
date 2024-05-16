const express = require("express");
const router = express.Router();
const axios = require("axios");
const EbayAuthToken = require('ebay-oauth-nodejs-client');
const scopes = ['https://api.ebay.com/oauth/api_scope',
    'https://api.ebay.com/oauth/api_scope/sell.marketing.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.marketing',
    'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.account',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment'
];

router.get('/allOrders', async (req, res) => {
    const ebayAuthToken = new EbayAuthToken({
        clientId: 'ShanksRe-Inventor-PRD-95ec4ed98-41a5d4f1',
        clientSecret: 'PRD-5ec4ed9865c0-97c7-48d2-a88c-e11f',
        redirectUri: 'http://localhost:3001'
    });
    
    const getAllOrders = async () => {
        try {
          // Construct API request URL for fetching orders
          const url = 'https://api.ebay.com/sell/fulfillment/v1/order';
      
          // Make authenticated request to eBay API
          const response = await axios.get(url, {
            headers: {
              Authorization: `Bearer ${ebayAuthToken.getAccessToken('PRODUCTION', scopes)}`,
              'Content-Type': 'application/json',
            },
          });
      
          // Extract and return orders from the response
          const orders = response.data.orders;
          return orders;
        } catch (error) {
          console.error('Error fetching orders:', error);
          throw error;
        }
      };
      
      // Usage example
      getAllOrders()
        .then((orders) => {
          console.log('All orders:', orders);
        })
        .catch((error) => {
          console.error('Error:', error);
        });

    
});

module.exports = router;
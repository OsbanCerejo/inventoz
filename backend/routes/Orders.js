const express = require("express");
const router = express.Router();
const eBayApi = require('ebay-api')

router.get("/allOrders", async (req, res) => {

    const eBay = new eBayApi({
        appId: 'ShanksRe-Inventor-PRD-95ec4ed98-41a5d4f1',
        certId: 'PRD-5ec4ed9865c0-97c7-48d2-a88c-e11f',
        sandbox: false
    });
    const code = req.query.code;
    console.log(code)

    eBay.OAuth2.setScope([
        'https://api.ebay.com/oauth/api_scope',
        'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
        'https://api.ebay.com/oauth/api_scope/sell.fulfillment'
    ]);

    // try {
    //     const token = await eBay.OAuth2.getToken(code);
    //     eBay.OAuth2.setCredentials(token);
    //     req.session.token = token
    
    //     const orders = await eBay.sell.fulfillment.getOrders();
    //     console.log(orders);
    // } catch (error) {
    //     console.error(error)
    // }

    res.json("Completed");
});

module.exports = router;
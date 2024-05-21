const axios = require('axios');
const qs = require('qs');

const CLIENT_ID = 'ShanksRe-Inventor-PRD-95ec4ed98-41a5d4f1';
const CLIENT_SECRET = 'PRD-5ec4ed988579-123f-45d9-a81b-0c07';
const REDIRECT_URI = 'Shanks_RedHair-ShanksRe-Invent-yvmkakqhx';

const SCOPE = 'https://api.ebay.com/oauth/api_scope';

const ORDER_SCOPE = "https://api.ebay.com/oauth/api_scope/sell.account https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.fulfillment";
class AuthService {
    async getAccessToken() {
        const RF_TOKEN = "v^1.1#i^1#r^1#p^3#f^0#I^3#t^Ul4xMF8xMDpBOTFDQTQ5NkFBNjJBNUVCQzRDNzM5NDg5REE0Mjk0QV8wXzEjRV4yNjA=";
        const postData = {
            refresh_token: RF_TOKEN, grant_type: 'refresh_token', scope: ORDER_SCOPE
        };
        const headers = this.getHeaders();

        try {
            const response = await axios.post('https://api.ebay.com/identity/v1/oauth2/token', qs.stringify(postData), {headers});
            return response.data.access_token;
        } catch (error) {
            console.error('Error fetching access token:', error.response ? error.response.data : error.message);
            throw error;
        }
    }

    getHeaders() {
        return {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
        };
    }
}


module.exports = AuthService





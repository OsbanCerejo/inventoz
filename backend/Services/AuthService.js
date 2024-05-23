const axios = require("axios");
const qs = require("qs");

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const SCOPE = "https://api.ebay.com/oauth/api_scope";

const ORDER_SCOPE =
  "https://api.ebay.com/oauth/api_scope/sell.account https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.fulfillment";
class AuthService {
  async getAccessToken() {
    const RF_TOKEN = process.env.REFRESH_TOKEN;
    const postData = {
      refresh_token: RF_TOKEN,
      grant_type: "refresh_token",
      scope: ORDER_SCOPE,
    };
    const headers = this.getHeaders();

    try {
      const response = await axios.post(
        "https://api.ebay.com/identity/v1/oauth2/token",
        qs.stringify(postData),
        { headers }
      );
      return response.data.access_token;
    } catch (error) {
      console.error(
        "Error fetching access token:",
        error.response ? error.response.data : error.message
      );
      throw error;
    }
  }

  getHeaders() {
    return {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
    };
  }
}

module.exports = AuthService;

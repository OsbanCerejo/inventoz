const axios = require("axios");
require("dotenv").config();

const WALMART_CLIENT_ID = process.env.WALMART_CLIENT_ID;
const WALMART_CLIENT_SECRET = process.env.WALMART_CLIENT_SECRET;

async function getWalmartToken() {
  try {
    const response = await axios.post(
      "https://marketplace.walmartapis.com/v3/token",
      {},
      {
        headers: {
          Accept: "application/json",
          "WM_SVC.NAME": "Walmart Marketplace",
          "WM_QOS.CORRELATION_ID": "123456abcdef",
          "Content-Type": "application/json",
          Authorization:
            "Basic " +
            Buffer.from(`${WALMART_CLIENT_ID}:${WALMART_CLIENT_SECRET}`).toString("base64"),
        },
      }
    );
    console.log("ACCESS TOKEN WALMART : ",response.data.access_token)

    return response.data.access_token;
  } catch (error) {
    console.error("Error fetching Walmart Token:", error);
    return null;
  }
}

module.exports = { getWalmartToken };

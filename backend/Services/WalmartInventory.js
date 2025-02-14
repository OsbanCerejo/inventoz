const axios = require("axios");
const { getWalmartToken } = require("./WalmartAuth");

async function updateWalmartInventory(sku, quantity) {
  const accessToken = await getWalmartToken();
  if (!accessToken) return;

  const url = `https://marketplace.walmartapis.com/v3/inventory?sku=${sku}`;

  const body = {
    quantity: quantity,
    fulfillmentLagTime: 1, // Default delay before order fulfillment
  };

  try {
    const response = await axios.put(url, body, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "WM_SVC.NAME": "Walmart Marketplace",
        "WM_QOS.CORRELATION_ID": "123456abcdef",
        "WM_SEC.ACCESS_TOKEN": accessToken,
      },
    });

    console.log("Inventory Updated:", response.data);
  } catch (error) {
    console.error("Error updating Walmart Inventory:", error.response.data);
  }
}

module.exports = { updateWalmartInventory };

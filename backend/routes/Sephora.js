require("dotenv").config();
const express = require("express");
const router = express.Router();
const axios = require("axios");
const API_KEY = process.env.X_RAPID_API_KEY;
const BASE_URL = process.env.X_RAPID_BASE_URL;
const HOST = process.env.X_RAPID_HOST;

router.get("/search", async (req, res) => {
  const { searchString, searchType } = req.query;
  console.log(searchType);
  console.log(searchString);

  try {
    const response = await axios.get(`${BASE_URL}/products/search-by-barcode`, {
      params: {
        upccode: searchString,
      },
      headers: {
        "x-rapidapi-key": API_KEY,
        "x-rapidapi-host": HOST,
      },
    });

    const productDetails = response.data;
    // console.log(productDetails);
    res.json(productDetails);
  } catch (error) {
    console.error("Error fetching product details:", error.message);
  }
});

router.get("/getMoreDetails", async (req, res) => {
  const { productId, skuId } = req.query;
  console.log("Product ID : ", productId);
  console.log("SKU ID : ", skuId);

  try {
    const response = await axios.get(`${BASE_URL}/us/products/v2/detail`, {
      params: {
        productId: productId,
        preferedSku: skuId,
      },
      headers: {
        "x-rapidapi-key": API_KEY,
        "x-rapidapi-host": HOST,
      },
    });

    const productDetails = response.data;
    res.json(productDetails);
  } catch (error) {
    console.error("Error fetching product details:", error.message);
  }
});

module.exports = router;

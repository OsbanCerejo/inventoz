import axios from "axios";
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Typography, Box } from "@mui/material";

const EbayAPI = () => {
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [message, setMessage] = useState("");
  const [itemDetails, setItemDetails] = useState(null);

  useEffect(() => {
    setSku("");
    setPrice("");
    setQuantity("");
    setMessage("");
    setItemDetails(null);
  }, []);

  const handleGetItem = async () => {
    if (!sku) {
      setMessage("SKU is required to fetch item.");
      return;
    }

    try {
      const response = await axios.get(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/ebayAPI/getItem`, {
        params: { sku },
      });

      setItemDetails(response.data);
      setMessage(`Item fetched successfully for SKU: ${sku}`);
      toast.success(`Item fetched successfully for SKU: ${sku}`, { position: "top-right" });
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setMessage(
          error.response?.data?.message || "Failed to fetch item from eBay."
        );
      } else {
        setMessage("An unexpected error occurred.");
      }
    }
  };

  const handleUpdatePrice = async () => {
    if (!sku) {
      setMessage("SKU is required to update price.");
      return;
    }

    try {
      const response = await axios.post("/api/ebay/update-price", {
        sku,
        price,
      });
      // Price update response received

      setMessage(`Price updated successfully for SKU: ${sku}`);
    } catch (error) {
      console.error(error);
      if (axios.isAxiosError(error)) {
        setMessage(
          error.response?.data?.message || "Failed to update price on eBay."
        );
      } else {
        setMessage("An unexpected error occurred.");
      }
    }
  };

  const handleUpdateQuantity = async () => {
    if (!sku) {
      setMessage("SKU is required to update quantity.");
      return;
    }

    try {
      const response = await axios.post(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/ebayAPI/updateQuantity`, {
        sku,
        quantity,
      });

      // Quantity update response received
      setMessage(`Quantity updated successfully for SKU: ${sku}`);
      toast.success(`Quantity updated successfully to : ${quantity}`, { position: "top-right" });
    } catch (error) {
      console.error(error);
      if (axios.isAxiosError(error)) {
        setMessage(
          error.response?.data?.message || "Failed to update price on eBay."
        );
      } else {
        setMessage("An unexpected error occurred.");
      }
    }
  };
  return (
    <div>
      <Box sx={{ mt: 4, mb: 3, px: 2 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 0 }}>
          eBay API
        </Typography>
      </Box>
      
      <h2>eBay Listing Updater</h2>

      <div style={{ marginBottom: "1rem" }}>
        <label>SKU (required)</label>
        <input
          type="text"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          required
          style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
        />
        <button
          onClick={handleGetItem}
          style={{ marginTop: "0.5rem", padding: "0.5rem", width: "100%" }}
        >
          Get Item
        </button>
      </div>

      {itemDetails && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem",
            border: "1px solid #ccc",
            borderRadius: "5px",
            background: "#f9f9f9",
          }}
        >
          <strong>Item Details:</strong>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(itemDetails, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <label>Price</label>
        <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
        />
        <button
          onClick={handleUpdatePrice}
          style={{ marginTop: "0.5rem", padding: "0.5rem", width: "100%" }}
        >
          Update Price
        </button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label>Quantity</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
        />
        <button
          onClick={handleUpdateQuantity}
          style={{ marginTop: "0.5rem", padding: "0.5rem", width: "100%" }}
        >
          Update Quantity
        </button>
      </div>

      {message && (
        <div
          style={{
            marginTop: "1rem",
            backgroundColor: "#f0f0f0",
            padding: "0.75rem",
            borderRadius: "5px",
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
};

export default EbayAPI;

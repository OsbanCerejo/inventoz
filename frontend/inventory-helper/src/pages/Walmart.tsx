import React, { useState } from "react";
import axios from "axios";

const WalmartUpdate = () => {
  const [sku, setSku] = useState<string>("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [price, setPrice] = useState<number | "">("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle Inventory Update
  const handleInventoryUpdate = async () => {
    if (!sku || quantity === "" || quantity < 0) {
      setError("Please enter a valid SKU and quantity.");
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const response = await axios.post("http://localhost:3001/walmart/updateInventory", {
        sku,
        quantity: Number(quantity),
      });
      setMessage(response.data.message);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update inventory.");
    }
  };

//   // Handle Price Update
//   const handlePriceUpdate = async () => {
//     if (!sku || price === "" || price < 0) {
//       setError("Please enter a valid SKU and price.");
//       return;
//     }

//     setError(null);
//     setMessage(null);

//     try {
//       const response = await axios.post("http://localhost:3001/walmart/update-price", {
//         sku,
//         price: Number(price),
//       });
//       setMessage(response.data.message);
//     } catch (err: any) {
//       setError(err.response?.data?.error || "Failed to update price.");
//     }
//   };

  return (
    <div>
      <h2>Walmart Inventory & Price Update</h2>

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      <div>
        <label>SKU:</label>
        <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} />
      </div>

      <div>
        <label>Quantity:</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value === "" ? "" : Number(e.target.value))}
        />
        <button onClick={handleInventoryUpdate}>Update Inventory</button>
      </div>

      {/* <div>
        <label>Price:</label>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
        />
        <button onClick={handlePriceUpdate}>Update Price</button>
      </div> */}
    </div>
  );
};

export default WalmartUpdate;

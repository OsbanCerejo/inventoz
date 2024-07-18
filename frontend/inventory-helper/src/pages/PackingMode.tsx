import React, { useState } from "react";
import axios from "axios";

type Item = {
  sku: string;
  name: string;
  title: string;
  quantity: number;
  imageUrl?: string;
};

type Order = {
  orderId: string;
  orderNumber: string;
  items: Item[];
};

const OrderDetails = () => {
  const [orderId, setOrderId] = useState<string>("");
  const [orderDetails, setOrderDetails] = useState<Order | null>(null);
  const [error, setError] = useState<string>("");

  const handleFetchOrderDetails = async () => {
    try {
      const response = await axios.get(
        `http://localhost:3001/orders/order/${orderId}`
      );
      setOrderDetails(response.data);
      setError("");
    } catch (error) {
      setError("Order not found");
      setOrderDetails(null);
    }
  };

  return (
    <div>
      <h1>Order Details</h1>
      <input
        type="text"
        value={orderId}
        onChange={(e) => setOrderId(e.target.value)}
        placeholder="Enter order ID"
      />
      <button onClick={handleFetchOrderDetails}>Get Order Details</button>
      {error && <p>{error}</p>}
      {orderDetails && (
        <div>
          <h2>Order Number: {orderDetails.orderNumber}</h2>
          <ul>
            {orderDetails.items.map((item) => (
              <li key={item.sku}>
                <img src={item.imageUrl} alt={item.title} width="100" />
                <div>
                  <p>Title: {item.title}</p>
                  <p>Quantity: {item.quantity}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default OrderDetails;

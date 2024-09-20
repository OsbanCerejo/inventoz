import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Grid } from "@mui/material";

type Item = {
  sku: string;
  name: string;
  title: string;
  quantity: number;
  imageUrl?: string;
  options: { name: string; value: string }[];
};

type Order = {
  orderId: string;
  orderNumber: string;
  items: Item[];
};

type Product = {
  sku: string;
  image: string;
};

const OrderDetails = () => {
  const [orderId, setOrderId] = useState<string>("");
  const [orderDetails, setOrderDetails] = useState<Order | null>(null);
  const [error, setError] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [productsData, setProductsData] = useState<Product[]>([]);

  useEffect(() => {
    // Focus the input field when the component mounts
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // Fetch all products from backend to match with SKUs
    const fetchProducts = async () => {
      try {
        const productsResponse = await axios.get(
          "http://localhost:3001/products"
        );
        setProductsData(productsResponse.data);
      } catch (error) {
        console.error("Failed to fetch products", error);
      }
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    // Focus the input field after fetching order details
    if (orderDetails || error) {
      setOrderId("");
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [orderDetails, error]);

  const handleFetchOrderDetails = async () => {
    try {
      const response = await axios.get(
        `http://localhost:3001/orders/order/${orderId}`
      );
      console.log(response.data);
      setOrderDetails(response.data);
      setError("");
    } catch (error) {
      setError("Order not found");
      setOrderDetails(null);
    }
  };

  // Function to match the SKU from the order items to the product data
  const findProductImage = (sku: string): string => {
    const product = productsData.find((product) => product.sku === sku);
    return product && product.image && product.image !== "null"
      ? product.image
      : "";
  };

  function parseSku(sku: string) {
    if (sku) {
      const match = sku.match(/_lot_of_(\d+)$/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return 1;
  }

  return (
    <div>
      <Grid container spacing={0} textAlign={"center"}>
        <Grid item xs={12}>
          <h1>Order Details</h1>
        </Grid>
        <Grid item xs={4}></Grid>
        <Grid item xs={4} p={2}>
          <input
            type="text"
            ref={inputRef}
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="Enter order ID"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleFetchOrderDetails();
              }
            }}
          />
          <button onClick={handleFetchOrderDetails}>Get Order Details</button>
        </Grid>
        <Grid item xs={4}></Grid>
        <Grid item xs={12}>
          {error && <p>{error}</p>}
        </Grid>
        <Grid item xs={12}>
          {orderDetails && (
            <div>
              <Grid item xs={12}>
                <h3>Order Number: {orderDetails.orderNumber}</h3>
              </Grid>

              {orderDetails.items.map((item) => {
                const lotSize = parseSku(item.sku);
                const adjustedQuantity = item.quantity * lotSize;

                return (
                  <Grid container>
                    <Grid item xs={8}>
                      <img
                        src={findProductImage(item.sku)}
                        alt={item.title}
                        height="400"
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <h4>Title: {item.name}</h4>
                      <h1 style={{ fontSize: 100 }}>{adjustedQuantity}</h1>
                      <h1>{item.sku}</h1>
                      {item.options.length > 0 && (
                        <h1 style={{ backgroundColor: "yellow" }}>
                          {item.options[0].name} {item.options[0].value}
                        </h1>
                      )}
                    </Grid>
                  </Grid>
                );
              })}
            </div>
          )}
        </Grid>
      </Grid>
    </div>
  );
};

export default OrderDetails;

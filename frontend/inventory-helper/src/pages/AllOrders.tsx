import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Grid,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useEffect, useState } from "react";

function AllOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [groupedOrders, setGroupedOrders] = useState<any>({});
  const [orderMetrics, setOrderMetrics] = useState({
    totalOrders: 0,
    totalItems: 0,
  });

  useEffect(() => {
    // Fetch orders when component mounts
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(
        "http://localhost:3001/orders/allOrders"
      );
      const ordersData = response.data.orders;
      const totalOrders = response.data.total;

      const grouped = groupOrdersByProduct(ordersData);

      setOrders(ordersData);
      setGroupedOrders(grouped.groupedOrders);
      setOrderMetrics({ totalOrders, totalItems: grouped.totalItems });
    } catch (error) {
      console.error("Fetch orders error:", error);
    }
  };

  function groupOrdersByProduct(orders: any) {
    const result = {
      groupedOrders: {},
      totalItems: 0,
    };

    result.groupedOrders = orders.reduce((acc: any, order: any) => {
      order.items.forEach((item: any) => {
        const { sku } = item;
        if (!acc[sku]) {
          acc[sku] = [];
        }
        acc[sku].push({
          ...item,
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          orderDate: order.orderDate,
          customerName: order.customerUsername,
          orderStatus: order.orderStatus,
        });
        result.totalItems += item.quantity;
      });
      return acc;
    }, {});
    return result;
  }

  return (
    <div>
      <div id="orders-container">
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
          }}
        >
          <Typography>Total Items: {orderMetrics.totalItems}</Typography>
          <Typography>Total Orders: {orderMetrics.totalOrders}</Typography>
        </Box>

        {Object.keys(groupedOrders)
          .sort()
          .map((sku) => (
            <Box key={sku} sx={{ marginBottom: 2 }}>
              <Grid container spacing={1}>
                {groupedOrders[sku].map((item: any) => (
                  <Grid item xs={12} key={item.orderItemId}>
                    <Card sx={{ display: "flex" }}>
                      <CardMedia
                        component="img"
                        sx={{ width: 150, objectFit: "contain" }}
                        image={item.imageUrl}
                        alt={item.name}
                      />
                      <CardContent
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          width: "100%",
                        }}
                      >
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography component="div" variant="h6">
                            {item.name}
                          </Typography>
                        </Box>
                        {item.options.length > 0 && (
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography>
                              <b>Shade/Variant:</b> {item.options[0].value}
                            </Typography>
                          </Box>
                        )}
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-end",
                            flexGrow: 1,
                          }}
                        >
                          <Typography>Quantity: {item.quantity}</Typography>
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-end",
                            }}
                          >
                            <Typography>
                              Location: {item.warehouseLocation}
                            </Typography>
                            <Typography>SKU: {item.sku}</Typography>
                          </Box>
                        </Box>
                      </CardContent>
                      <Box
                        border={1}
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "20px",
                          backgroundColor: "#f0f0f0",
                        }}
                      >
                        <Typography>R</Typography>
                        <Typography>Q</Typography>
                        <Typography>I</Typography>
                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          ))}
      </div>
    </div>
  );
}

export default AllOrders;

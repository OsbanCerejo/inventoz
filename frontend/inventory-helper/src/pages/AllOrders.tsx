import { AssignmentTurnedIn, Cancel, Check } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import axios from "axios";
import { toast } from "react-toastify";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function AllOrders() {
  const [groupedOrders, setGroupedOrders] = useState<any>({});
  const [orderMetrics, setOrderMetrics] = useState({
    totalOrders: 0,
    totalItems: 0,
  });
  const [approveOrders, setApproveOrders] = useState(false);
  const [productsData, setProductsData] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
  }, []);

  function createProductMap(productsData: any) {
    const productMap = new Map();
    productsData.forEach((product: any) => {
      productMap.set(product.sku, product);
    });
    return productMap;
  }

  const fetchOrders = async () => {
    try {
      const [ordersResponse, productsResponse] = await Promise.all([
        axios.get(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/orders/allOrders`),
        axios.get(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/products`),
      ]);
      setProductsData(productsResponse.data);
      const productMap = createProductMap(productsResponse.data);
      console.log(ordersResponse)
      const grouped = groupOrdersByProduct(
        ordersResponse.data.orders,
        productMap
      );

      setGroupedOrders(grouped.groupedOrders);
      setOrderMetrics({
        totalOrders: grouped.totalOrders,
        totalItems: grouped.totalItems,
      });
    } catch (error) {
      console.error("Fetch orders error:", error);
    }
  };

  function groupOrdersByProduct(orders: any, productMap: any) {
    const result = {
      groupedOrders: {},
      totalItems: 0,
      totalOrders: 0,
    };

    result.groupedOrders = orders.reduce((acc: any, order: any) => {
      result.totalOrders += 1;
      order.items.forEach((item: any) => {
        const { sku } = item;
        const [actualSku, lotSize] = parseSku(sku);
        if (!acc[actualSku]) {
          acc[actualSku] = [];
        }

        // Find the product in productsData to get the location
        const product = productMap.get(actualSku);

        acc[actualSku].push({
          ...item,
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          orderDate: order.orderDate,
          customerName: order.customerUsername,
          orderStatus: order.orderStatus,
          warehouseLocation: product ? product.location : "____",
          isverified: product ? product.verified : false,
          lotSize: parseInt(lotSize, 10) || 1,
          variant: product ? product.shade : "",
          store: order.advancedOptions.storeId,
          image:
            product && product.image && product.image !== "null"
              ? product.image // Use product image if available
              : item.imageUrl || "",
          qty: product ? product.quantity : "N/A",
        });
        result.totalItems += item.quantity * (parseInt(lotSize, 10) || 1);
      });
      return acc;
    }, {});
    return result;
  }

  function parseSku(sku: string) {
    if (sku && sku.includes("_lot_of_")) {
      const skuParts = sku.split("_lot_of_");
      return [skuParts[0], skuParts[1]];
    }
    return [sku, "1"];
  }

  const handleOrdersApprove = () => {
    setApproveOrders(true);
  };

  const handleOrdersApproveCancel = () => {
    setApproveOrders(false);
  };

  const handleOrdersApproveFinal = async () => {
    const skuStoreTotals = getSkuStoreTotals();
    const skusToUpdate = Object.keys(skuStoreTotals).map((sku) => {
      const totalQuantitySold = skuStoreTotals[sku].reduce(
        (sum, { quantitySold }) => sum + quantitySold,
        0
      );
      return {
        sku,
        totalQuantitySold,
        stores: skuStoreTotals[sku],
      };
    });

    try {
      // Update product quantities in the products table
      const response = await axios.post(
        `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/products/updateQuantities`,
        skusToUpdate.map(({ sku, totalQuantitySold }) => ({
          sku,
          quantitySold: totalQuantitySold,
        }))
      );

      if (response.data.success) {
        // Log the update quantities action
        await logUpdateQuantities(skusToUpdate);

        // Update quantities in the listings table for each store
        await updateStoreQuantities(skusToUpdate);
        toast.success("Quantities Updated!", { position: "top-right" });
        navigate("/", { state: { clearFilters: true } });
      }

      setApproveOrders(true);
    } catch (error) {
      console.error("Error updating product quantities:", error);
    }
  };

  const logUpdateQuantities = async (skusToUpdate: any) => {
    const logData = {
      timestamp: new Date().toISOString(),
      type: "Sales Update",
      metaData: skusToUpdate,
    };

    try {
      await axios.post(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/logs/addLog`, logData);
    } catch (error) {
      console.error("Error logging update quantities:", error);
    }
  };

  const getSkuTotals = () => {
    const skuTotals: { [sku: string]: { quantity: number; product?: any } } =
      {};

    Object.keys(groupedOrders).forEach((sku) => {
      const totalQuantity = groupedOrders[sku].reduce(
        (sum: number, item: any) => sum + item.quantity * item.lotSize,
        0
      );
      const product = productsData.find((p: any) => p.sku === sku);
      skuTotals[sku] = {
        quantity: totalQuantity,
        product: product || { quantity: 0, itemName: "Unknown Product" },
      };
    });
    return skuTotals;
  };

  // Function to get the total quantities sold by SKU and store
  const getSkuStoreTotals = () => {
    const skuStoreTotals: {
      [sku: string]: { storeId: string; quantitySold: number }[];
    } = {};

    Object.keys(groupedOrders).forEach((sku) => {
      const storeQuantities = groupedOrders[sku].reduce(
        (acc: any, item: any) => {
          const { store, quantity, lotSize } = item;
          const quantitySold = quantity * lotSize;

          const existingStore = acc.find((s: any) => s.storeId === store);
          if (existingStore) {
            existingStore.quantitySold += quantitySold;
          } else {
            acc.push({ storeId: store, quantitySold });
          }

          return acc;
        },
        []
      );

      skuStoreTotals[sku] = storeQuantities;
    });

    return skuStoreTotals;
  };

  // Function to update quantities in the listings table for each store
  const updateStoreQuantities = async (
    skusToUpdate: {
      sku: string;
      totalQuantitySold: number;
      stores: { storeId: string; quantitySold: number }[];
    }[]
  ) => {
    try {
      // Prepare the request payload to update the listings table
      const listingsUpdate = skusToUpdate.flatMap(({ sku, stores }) =>
        stores.map(
          ({
            storeId,
            quantitySold,
          }: {
            storeId: string;
            quantitySold: number;
          }) => ({
            sku,
            quantitySold,
            storeId,
          })
        )
      );

      // Send a POST request to update the listings table
      await axios.post(
        `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/listings/updateQuantities`,
        listingsUpdate
      );
    } catch (error) {
      console.error(
        "Error updating store quantities in listings table:",
        error
      );
    }
  };

  const skuTotals = getSkuTotals();
  // console.log(groupedOrders);

  // const testEbay = async () => {
  //   try {
  //     const ebayResponse = await axios.get(
  //       "http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/orders/testebay"
  //     );
  //     console.log(ebayResponse);
  //   } catch (error) {
  //     console.error("Testing eBay Failed with: ", error);
  //   }
  // };

  return (
    <div>
      <Box sx={{ mt: 4, mb: 3, px: 2 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 0 }}>
          Orders
        </Typography>
      </Box>
      
      {/* <Button onClick={testEbay}>Test eBay</Button> */}
      <Grid container spacing={2} mb={10}>
        <Grid item xs={12}>
          <Grid container spacing={0} p={4}>
            {!approveOrders && (
              <Grid item xs={6}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<AssignmentTurnedIn />}
                  onClick={handleOrdersApprove}
                  sx={{ mx: 1 }}
                >
                  Approve
                </Button>
              </Grid>
            )}
            {approveOrders && (
              <Grid item xs={6}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Cancel />}
                  onClick={handleOrdersApproveCancel}
                  sx={{ mx: 1 }}
                >
                  Cancel
                </Button>
              </Grid>
            )}

            <Grid item xs={6}>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                }}
              >
                <Typography>Total Items: {orderMetrics.totalItems}</Typography>
                <Typography>
                  Total Orders: {orderMetrics.totalOrders}
                </Typography>
              </Box>
            </Grid>
            {approveOrders && (
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<Check />}
                  onClick={handleOrdersApproveFinal}
                  sx={{ mx: 1 }}
                >
                  Update Quantity
                </Button>
              </Grid>
            )}
          </Grid>
        </Grid>
        {!approveOrders && (
          <Grid item xs={12}>
            {Object.keys(groupedOrders)
              .sort((skuA, skuB) => {
                const locationA = groupedOrders[skuA][0].warehouseLocation;
                const locationB = groupedOrders[skuB][0].warehouseLocation;

                if (locationA === "____" && locationB === "____") {
                  return skuA.localeCompare(skuB);
                } else if (locationA === "____") {
                  return skuA.localeCompare(locationB);
                } else if (locationB === "____") {
                  return locationA.localeCompare(skuB);
                } else {
                  return locationA.localeCompare(locationB);
                }
              })
              .map((sku) => (
                <Box key={sku} sx={{ marginBottom: 1 }}>
                  <Grid container spacing={0.5}>
                    {groupedOrders[sku].map((item: any) => (
                      <Grid item xs={12} key={item.orderItemId}>
                        <Card sx={{ display: "flex", padding: "5px" }}>
                          <CardMedia
                            component="img"
                            sx={{ width: 100, objectFit: "contain" }}
                            image={item.image}
                            alt={item.image}
                          />
                          {item.imageUrl1}
                          <CardContent
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              width: "100%",
                              padding: "5px",
                            }}
                          >
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography
                                component="div"
                                variant="h6"
                                sx={{ fontSize: "1rem" }}
                              >
                                {item.name}
                              </Typography>
                            </Box>
                            {item.options.length > 0 && (
                              <Box sx={{ flexGrow: 1 }}>
                                <Typography sx={{ fontSize: "0.875rem" }}>
                                  <b>{item.options[0].name} :</b>{" "}
                                  {item.options[0].value}
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
                              <Typography sx={{ fontSize: "0.875rem" }}>
                                Quantity: {item.quantity}
                              </Typography>
                              <Box
                                sx={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "flex-end",
                                }}
                              >
                                <Typography sx={{ fontSize: "0.875rem" }}>
                                  Location:{" "}
                                  <strong>{item.warehouseLocation}</strong>
                                </Typography>
                                <Typography sx={{ fontSize: "0.875rem" }}>
                                  SKU: {item.sku}
                                </Typography>
                                <Typography
                                  sx={{
                                    fontSize: "0.875rem",
                                    backgroundColor: "yellow",
                                  }}
                                >
                                  <strong>{item.variant}</strong>
                                </Typography>
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
                              padding: "10px",
                              backgroundColor: item.isverified
                                ? "#B2FF59"
                                : "#FF5252",
                            }}
                          >
                            <Typography sx={{ fontSize: "0.875rem" }}>
                              R
                            </Typography>
                            <Typography sx={{ fontSize: "0.875rem" }}>
                              Q
                            </Typography>
                            <Typography sx={{ fontSize: "0.875rem" }}>
                              I
                            </Typography>
                          </Box>
                          <Box
                            border={1}
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "10px",
                              backgroundColor:
                                item.store == "1040538"
                                  ? "#0071ce"
                                  : item.store == "983189"
                                  ? "#EE66A6"
                                  : "#FFEB55",
                            }}
                          >
                            <Typography sx={{ fontSize: "0.875rem" }}>
                              <b>{item.qty}</b>
                            </Typography>
                          </Box>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              ))}
          </Grid>
        )}
        {approveOrders && (
          <Grid item xs={12}>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <strong>SKU</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Product Name</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Total Ordered Quantity</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Original Quantity</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.keys(skuTotals).map((sku) => (
                    <TableRow key={sku}>
                      <TableCell>{sku}</TableCell>
                      <TableCell>{skuTotals[sku].product.itemName}</TableCell>
                      <TableCell>{skuTotals[sku].quantity}</TableCell>
                      <TableCell>{skuTotals[sku].product.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        )}
      </Grid>
    </div>
  );
}

export default AllOrders;

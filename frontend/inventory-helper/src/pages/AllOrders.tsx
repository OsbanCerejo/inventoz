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
  Select,
  MenuItem,
  InputLabel,
  OutlinedInput,
  Checkbox,
  ListItemText,
  FormControl,
} from "@mui/material";
import axios from "axios";
import { toast } from "react-toastify";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiUrl } from '../config/api';
import CircularProgress from '@mui/material/CircularProgress';
import './AllOrdersPrint.css';

function AllOrders() {
  const [groupedOrders, setGroupedOrders] = useState<any>({});
  const [orderMetrics, setOrderMetrics] = useState({
    totalOrders: 0,
    totalItems: 0,
  });
  const [approveOrders, setApproveOrders] = useState(false);
  const [productsData, setProductsData] = useState<any[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Hardcoded store list (should match backend logic)
  const storeOptions = [
    { id: "1040538", name: "Walmart OneLifeLuxuries", color: "#0071ce" },
    { id: "983189", name: "eBay Buy4LessToday", color: "#EE66A6" },
    { id: "1034120", name: "eBay OneLifeLuxuries4", color: "#FFEB55", text: '#222' },
  ];

  // Fetch orders and products, then fetch listings for all SKUs
  useEffect(() => {
    fetchOrders(selectedStores);
    // eslint-disable-next-line
  }, [selectedStores]);

  function createProductMap(productsData: any) {
    const productMap = new Map();
    productsData.forEach((product: any) => {
      productMap.set(product.sku, product);
    });
    return productMap;
  }

  const fetchOrders = async (storeIds?: string[]) => {
    try {
      setLoading(true);
      let params = {};
      if (storeIds && storeIds.length > 0) {
        params = { storeid: storeIds.join(",") };
      }
      const [ordersResponse, productsResponse] = await Promise.all([
        axios.get(getApiUrl('orders/allOrders'), { params }),
        axios.get(getApiUrl('products')),
      ]);
      setProductsData(productsResponse.data);
      const productMap = createProductMap(productsResponse.data);
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
    } finally {
      setLoading(false);
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
        if(item.options.length > 0){
          console.log(JSON.stringify(order));
        }
        const { sku } = item;
        const [actualSku, lotSize] = parseSku(sku);

        const product = productMap.get(actualSku);

        const finalSku = product && product.alternativeSku ? product.alternativeSku : actualSku;

        if (!acc[finalSku]) {
          acc[finalSku] = [];
        }

        acc[finalSku].push({
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
          condition: product ? product.condition : "",
          store: order.advancedOptions.storeId,
          image:
            product && product.image && product.image !== "null"
              ? product.image
              : item.imageUrl || "",
          qty: product ? product.quantity : "N/A",
          // Store the original SKU and the final SKU being used
          originalSku: actualSku,
          finalSku: finalSku,
        });
        result.totalItems += item.quantity * (parseInt(lotSize, 10) || 1);
      });
      return acc;
    }, {});
    return result;
  }

  function parseSku(sku: string) {
    // Handles both _lot_of_ and _lot_of (with or without the second underscore)
    if (sku) {
      const lotOfRegex = /(.+)_lot_of_?(\d+)/i;
      const match = sku.match(lotOfRegex);
      if (match) {
        return [match[1], match[2]];
      }
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
        getApiUrl('products/updateQuantities'),
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
    // Create a log entry for each SKU being updated
    for (const skuData of skusToUpdate) {
      const logData = {
        timestamp: new Date().toISOString(),
        type: "Sales Update",
        action: "update",
        entityType: "product",
        entityId: skuData.sku, // Use the actual SKU
        userId: user?.id?.toString(),
        metaData: {
          sku: skuData.sku,
          totalQuantitySold: skuData.totalQuantitySold,
          stores: skuData.stores
        },
      };

      console.log("Attempting to log update quantities for SKU:", skuData.sku, logData);
      try {
        const response = await axios.post(getApiUrl('logs/addLog'), logData);
        console.log("Log response for SKU", skuData.sku, ":", response.data);
      } catch (error) {
        console.error("Error logging update quantities for SKU", skuData.sku, ":", error);
      }
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
        getApiUrl('listings/updateQuantities'),
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

  // Helper to flatten groupedOrders into a single array for table rendering, sorted by location
  const getOrderItemsForTable = () => {
    const items: any[] = [];
    Object.keys(groupedOrders).forEach((sku) => {
      groupedOrders[sku].forEach((item: any) => {
        items.push(item);
      });
    });
    // Sort by warehouseLocation (ascending, blanks last), using natural sort for locations like B-36, B-122
    items.sort((a, b) => {
      const parseLoc = (loc: string) => {
        if (!loc) return ["", 0];
        const match = loc.match(/^([A-Za-z]+)-(\d+)$/);
        if (match) {
          return [match[1], parseInt(match[2], 10)];
        }
        return [loc, 0];
      };
      const [aLetter, aNum] = parseLoc(a.warehouseLocation);
      const [bLetter, bNum] = parseLoc(b.warehouseLocation);
      if (aLetter === bLetter) {
        // Only subtract if both are numbers
        if (typeof aNum === 'number' && typeof bNum === 'number') {
          return aNum - bNum;
        }
        return 0;
      }
      if (!aLetter && !bLetter) return 0;
      if (!aLetter) return 1;
      if (!bLetter) return -1;
      // Ensure both are strings before localeCompare
      if (typeof aLetter === 'string' && typeof bLetter === 'string') {
        return aLetter.localeCompare(bLetter);
      }
      return 0;
    });
    return items;
  };
  const orderItems = getOrderItemsForTable();

  // Helper to get store cell color by storeId (text color only)
  const getStoreTextColor = (storeId: string) => {
    const colorMap: { [key: string]: string } = {
      "983189": '#fff', // Deep Pink for eBay 1
      "1040538": '#fff', // Deep Orange for Walmart
      "1034120": '#fff', // Deep Purple for eBay 2
    };
    const bgColorMap: { [key: string]: string } = {
      "983189": '#ad1457',
      "1040538": '#e65100',
      "1034120": '#6a1b9a',
    };
    // If you want to use the original color, you can set a different color here
    // For now, let's use the background color as the text color for visibility
    // Or you can set a unique color for each store
    // Example: return { color: bgColorMap[storeId] || undefined };
    // For now, let's use a unique color for each store:
    const textColorMap: { [key: string]: string } = {
      "983189": '#ad1457', // Deep Pink for eBay 1
      "1040538": '#e65100', // Deep Orange for Walmart
      "1034120": '#6a1b9a', // Deep Purple for eBay 2
    };
    return { color: textColorMap[storeId] || undefined };
  };

  // const testEbay = async () => {
  //   try {
  //     const ebayResponse = await axios.get(
  
  //     );
  //     console.log(ebayResponse);
  //   } catch (error) {
  //     console.error("Testing eBay Failed with: ", error);
  //   }
  // };

  // Print handler
  const handlePrintPickList = () => {
    window.print();
  };

  // Store color indicator (badge/border at row start)
  const StoreColorBadge = ({ storeId }: { storeId: string }) => {
    const store = storeOptions.find(s => s.id === storeId);
    return (
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 60,
          borderRadius: 6,
          background: store?.color,
          marginRight: 8,
          verticalAlign: 'middle',
        }}
        title={store?.name}
      />
    );
  };

  return (
    <div>
      <Box sx={{ mt: 4, mb: 5, px: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4" component="h1" sx={{ mb: 0 }}>
          Orders
        </Typography>
      </Box>
      {/* Approve button and Shop selection dropdown in the same row */}
      <Box sx={{ mb: 0, px: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          {!approveOrders && (
            <Button
              variant="contained"
              color="success"
              startIcon={<AssignmentTurnedIn />}
              onClick={handleOrdersApprove}
              sx={{ mx: 1 }}
            >
              Approve
            </Button>
          )}
          {approveOrders && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<Cancel />}
              onClick={handleOrdersApproveCancel}
              sx={{ mx: 1 }}
            >
              Cancel
            </Button>
          )}
        </Box>
        <FormControl sx={{ minWidth: 300 }}>
          <InputLabel id="store-select-label">Select Shop(s)</InputLabel>
          <Select
            labelId="store-select-label"
            multiple
            value={selectedStores}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedStores(typeof value === 'string' ? value.split(',') : value);
            }}
            input={<OutlinedInput label="Select Shop(s)" />}
            renderValue={(selected) =>
              (selected as string[])
                .map((id) => storeOptions.find((s) => s.id === id)?.name || id)
                .join(", ")
            }
          >
            {storeOptions.map((store) => (
              <MenuItem key={store.id} value={store.id}>
                <Checkbox checked={selectedStores.indexOf(store.id) > -1} />
                <ListItemText primary={store.name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      {/* Simple Total Items/Orders summary directly under the store selection dropdown */}
      <Box sx={{ px: 2, mb: 0, display: 'flex', justifyContent: 'flex-end' }}>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          Total Items: {orderMetrics.totalItems} | Total Orders: {orderMetrics.totalOrders}
        </Typography>
      </Box>
      {/* Print Pick List Button */}
      <Box sx={{ px: 2, mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="outlined" color="primary" onClick={handlePrintPickList}>
          Print Pick List
        </Button>
      </Box>
      {/* Pick List Print Table (print-only) */}
      {!loading && (
        <div className="pick-list-table" style={{ display: 'none' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell></TableCell> {/* Badge */}
                <TableCell><strong>Image</strong></TableCell>
                <TableCell><strong>SKU</strong></TableCell>
                <TableCell><strong>Product Name</strong></TableCell>
                <TableCell><strong>Quantity</strong></TableCell>
                <TableCell><strong>Remaining</strong></TableCell>
                <TableCell><strong>Location</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orderItems.map((item, idx) => (
                <TableRow key={item.orderId + '-' + item.sku + '-' + idx}>
                  <TableCell>
                    <StoreColorBadge storeId={String(item.store)} />
                  </TableCell>
                  <TableCell>
                    {item.image && (
                      <img src={item.image} alt={item.name} style={{ width: 120, height: 120, objectFit: 'contain', borderRadius: 8 }} />
                    )}
                  </TableCell>
                  <TableCell>
                    {item.finalSku}
                    {item.finalSku !== item.originalSku && (
                      <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                        (was: {item.originalSku})
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    {item.variant && (
                      <div style={{
                        display: 'inline-block',
                        marginTop: 4,
                        marginBottom: 2,
                        padding: '2px 10px',
                        background: '#ffe082',
                        color: '#6a1b9a',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: 0.5,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        marginRight: 6,
                      }}>{item.variant}</div>
                    )}
                    {item.options && item.options.length > 0 && (
                      <div style={{
                        display: 'inline-block',
                        marginTop: 4,
                        marginBottom: 2,
                        padding: '2px 10px',
                        background: '#e3f2fd',
                        color: '#1565c0',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: 0.5,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        marginRight: 6,
                      }}>
                        <b>{item.options[0].name}:</b> {item.options[0].value}
                      </div>
                    )}
                    {item.condition && (
                      <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{item.condition}</div>
                    )}
                  </TableCell>
                                        <TableCell>
                        {item.quantity}
                        {item.lotSize > 1 && (
                          <div style={{ fontSize: 12, color: '#e65100', marginTop: 2 }}>
                            × {item.lotSize} (lot)
                          </div>
                        )}
                      </TableCell>
                  <TableCell>
                    {item.qty !== null && item.qty !== undefined ? item.qty : 'N/A'}
                  </TableCell>
                  <TableCell>{item.warehouseLocation}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {/* Modern Table View */}
      <Grid container spacing={2} mb={10}>
        <Grid item xs={12}>
          <Grid container spacing={0} p={4}>
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
        {/* Modern Table View */}
        <Grid item xs={12}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell></TableCell> {/* Badge */}
                    <TableCell><strong>Image</strong></TableCell>
                    <TableCell><strong>SKU</strong></TableCell>
                    <TableCell><strong>Product Name</strong></TableCell>
                    <TableCell><strong>Quantity</strong></TableCell>
                    <TableCell><strong>Remaining</strong></TableCell>
                    <TableCell><strong>Location</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orderItems.map((item, idx) => (
                    <TableRow key={item.orderId + '-' + item.sku + '-' + idx}>
                      <TableCell>
                        <StoreColorBadge storeId={String(item.store)} />
                      </TableCell>
                      <TableCell>
                        {item.image && (
                          <img src={item.image} alt={item.name} style={{ width: 120, height: 120, objectFit: 'contain', borderRadius: 8 }} />
                        )}
                      </TableCell>
                      <TableCell>
                        {item.finalSku}
                        {item.finalSku !== item.originalSku && (
                          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                            (was: {item.originalSku})
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                        {item.variant && (
                          <div style={{
                            display: 'inline-block',
                            marginTop: 4,
                            marginBottom: 2,
                            padding: '2px 10px',
                            background: '#ffe082',
                            color: '#6a1b9a',
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            letterSpacing: 0.5,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                            marginRight: 6,
                          }}>{item.variant}</div>
                        )}
                        {item.options && item.options.length > 0 && (
                          <div style={{
                            display: 'inline-block',
                            marginTop: 4,
                            marginBottom: 2,
                            padding: '2px 10px',
                            background: '#e3f2fd',
                            color: '#1565c0',
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            letterSpacing: 0.5,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                            marginRight: 6,
                          }}>
                            <b>{item.options[0].name}:</b> {item.options[0].value}
                          </div>
                        )}
                        {item.condition && (
                          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{item.condition}</div>
                        )}
                      </TableCell>
                      <TableCell>
                    {item.quantity}
                    {item.lotSize > 1 && (
                      <div style={{ fontSize: 12, color: '#e65100', marginTop: 2 }}>
                        × {item.lotSize} (lot)
                      </div>
                    )}
                  </TableCell>
                      <TableCell>
                        {item.qty !== null && item.qty !== undefined ? item.qty : 'N/A'}
                      </TableCell>
                      <TableCell>{item.warehouseLocation}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Grid>
      </Grid>
    </div>
  );
}

export default AllOrders;

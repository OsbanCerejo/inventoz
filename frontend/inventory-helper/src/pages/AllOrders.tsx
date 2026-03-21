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
import { invalidateProductsCache } from "../utils/productCache";

function AllOrders() {
  type ApprovalPreviewRow = {
    requestedSku: string;
    deductedSku: string | null;
    quantityToDeduct: number;
    currentQuantity: number | null;
    projectedQuantity: number | null;
    status: "ready" | "missing_product";
  };

  const [groupedOrders, setGroupedOrders] = useState<any>({});
  const [orderMetrics, setOrderMetrics] = useState({
    totalOrders: 0,
    totalItems: 0,
  });
  const [approveOrders, setApproveOrders] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [approvalPreviewRows, setApprovalPreviewRows] = useState<ApprovalPreviewRow[]>([]);
  const [approvalPreviewSummary, setApprovalPreviewSummary] = useState<any>(null);
  const [productsData, setProductsData] = useState<any[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
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
    setApproveOrders(false);
    setApprovalPreviewRows([]);
    setApprovalPreviewSummary(null);
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

  const buildApprovalItems = () =>
    orderItems.map((item: any) => ({
      orderId: item.orderId,
      store: item.store,
      sku: item.originalSku || item.sku,
      finalSku: item.finalSku || item.sku,
      quantity: item.quantity,
      lotSize: item.lotSize || 1,
    }));

  const handleOrdersApprove = async () => {
    const approvalItems = buildApprovalItems();
    if (approvalItems.length === 0) {
      toast.warning("No order items available to approve.");
      return;
    }

    try {
      setPreviewLoading(true);
      const response = await axios.post(getApiUrl('orders/approve-preview'), {
        items: approvalItems,
        selectedStores,
      });

      setApprovalPreviewRows(response.data?.previewRows || []);
      setApprovalPreviewSummary(response.data?.summary || null);
      setApproveOrders(true);
      toast.success("Approval preview generated. Please review before updating.");
    } catch (error) {
      console.error("Error generating approval preview:", error);
      toast.error("Failed to build approval preview.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleOrdersApproveCancel = () => {
    setApproveOrders(false);
    setApprovalPreviewRows([]);
    setApprovalPreviewSummary(null);
  };

  const handleOrdersApproveFinal = async () => {
    const approvalItems = buildApprovalItems();
    try {
      setApproving(true);
      const response = await axios.post(getApiUrl('orders/approve-batch'), {
        items: approvalItems,
        selectedStores,
      });
      if (response.data?.success) {
        const summary = response.data.summary || {};
        invalidateProductsCache();
        toast.success(
          `Batch approved. Processed: ${summary.ordersProcessed || 0} | Skipped: ${summary.ordersSkippedAlreadyApproved || 0} | SKUs updated: ${summary.skusUpdated || 0}`,
          { position: "top-right" }
        );
        setApproveOrders(false);
        setApprovalPreviewRows([]);
        setApprovalPreviewSummary(null);
        navigate("/", { state: { clearFilters: true } });
      }
    } catch (error) {
      console.error("Error updating product quantities:", error);
      toast.error("Failed to approve orders. Please check logs and retry.", {
        position: "top-right",
      });
    } finally {
      setApproving(false);
    }
  };

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
              disabled={loading || previewLoading}
              sx={{ mx: 1 }}
            >
              {previewLoading ? "Preparing..." : "Approve"}
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
                {approvalPreviewSummary && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h6" sx={{ mb: 0.5 }}>
                      Deduction Preview
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Orders to process: {approvalPreviewSummary.ordersToProcess || 0} | Already approved (skipped): {approvalPreviewSummary.ordersSkippedAlreadyApproved || 0} | SKUs ready: {approvalPreviewSummary.skusReadyToUpdate || 0} | Missing SKUs: {approvalPreviewSummary.skusMissing || 0}
                    </Typography>
                  </Box>
                )}

                <TableContainer component={Paper} sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Requested SKU</strong></TableCell>
                        <TableCell><strong>Deducted SKU</strong></TableCell>
                        <TableCell><strong>Qty Deduct</strong></TableCell>
                        <TableCell><strong>Current Qty</strong></TableCell>
                        <TableCell><strong>Projected Qty</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {approvalPreviewRows.map((row, idx) => (
                        <TableRow key={`${row.requestedSku}-${idx}`}>
                          <TableCell>{row.requestedSku}</TableCell>
                          <TableCell>{row.deductedSku || "N/A"}</TableCell>
                          <TableCell>{row.quantityToDeduct}</TableCell>
                          <TableCell>{row.currentQuantity ?? "N/A"}</TableCell>
                          <TableCell>{row.projectedQuantity ?? "N/A"}</TableCell>
                          <TableCell>{row.status === "ready" ? "Ready" : "Missing product"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Button
                  variant="contained"
                  color="success"
                  startIcon={<Check />}
                  onClick={handleOrdersApproveFinal}
                  disabled={approving || loading || previewLoading}
                  sx={{ mx: 1 }}
                >
                  {approving ? "Updating..." : "Update Quantity"}
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

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { toast } from "react-toastify";
import { getApiUrl } from "../config/api";

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
};

const normalizeStatus = (value?: string | null) => String(value || "").trim().toLowerCase();

const getStatusChipColor = (value?: string | null) => {
  const status = normalizeStatus(value);

  if (!status) return "default";
  if (status.includes("created") || status.includes("released") || status.includes("acknowledged")) {
    return "info";
  }
  if (status.includes("shipped")) {
    return "warning";
  }
  if (status.includes("delivered")) {
    return "success";
  }
  if (status.includes("cancel")) {
    return "error";
  }
  if (status.includes("refund") || status.includes("return")) {
    return "secondary";
  }
  return "default";
};

const getFulfilledByLabel = (order: any) => {
  const raw = String(order?.fulfillmentOption || "").trim().toLowerCase();
  if (!raw) return "—";
  if (raw.includes("wfs")) return "WFS";
  if (raw.includes("seller") || raw.includes("s2h")) return "Seller";
  if (raw.includes("3pl")) return "3PL";
  return order?.fulfillmentOption || "—";
};

const getItemNames = (lines: any[] = []) =>
  Array.isArray(lines) && lines.length > 0
    ? lines.map((line) => line?.productName || line?.walmartSku || "Item")
    : ["—"];

const getItemQuantities = (lines: any[] = []) =>
  Array.isArray(lines) && lines.length > 0
    ? lines.map((line) => String(Number(line?.quantity || 0) || 1))
    : ["—"];

const getOrderTotalLabel = (order: any) => {
  const directTotal = Number(order?.totalAmount);
  const currencySymbol = order?.currency === "USD" || !order?.currency ? "$" : `${order.currency} `;
  if (Number.isFinite(directTotal) && directTotal > 0) {
    return `${currencySymbol}${directTotal.toFixed(2)}`;
  }

  const calculatedTotal = (order?.lines || []).reduce((sum: number, line: any) => {
    const productAmount = Number(line?.unitPrice || 0);
    const shippingAmount = Number(line?.shippingPrice || 0);
    const taxAmount = Number(line?.taxAmount || 0);
    return sum + productAmount + shippingAmount + taxAmount;
  }, 0);

  if (calculatedTotal > 0) {
    return `${currencySymbol}${calculatedTotal.toFixed(2)}`;
  }

  return "—";
};

function WalmartOrders() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [fulfilledByOptions, setFulfilledByOptions] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    purchaseOrderId: "",
    status: "",
    fulfilledBy: "",
    fromDate: "",
    toDate: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({
    purchaseOrderId: "",
    status: "",
    fulfilledBy: "",
    fromDate: "",
    toDate: "",
  });

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(getApiUrl("walmart-orders"), {
        params: { ...appliedFilters, page: page + 1, pageSize },
      });
      setOrders(data?.rows || []);
      setTotalCount(Number(data?.count || 0));
      setStatusOptions(Array.isArray(data?.statusOptions) ? data.statusOptions : []);
      setFulfilledByOptions(Array.isArray(data?.fulfilledByOptions) ? data.fulfilledByOptions : []);
    } catch (error: any) {
      console.error("Failed to load Walmart orders:", error);
      toast.error(error?.response?.data?.error || "Failed to load Walmart orders.");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page, pageSize]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const summary = useMemo(() => {
    const totalUnits = orders.reduce(
      (sum, order) =>
        sum +
        (order.lines || []).reduce((lineTotal: number, line: any) => lineTotal + Number(line.quantity || 0), 0),
      0
    );
    return { totalOrders: totalCount, totalUnits };
  }, [orders, totalCount]);

  const openOrder = async (purchaseOrderId: string) => {
    try {
      const { data } = await axios.get(getApiUrl(`walmart-orders/${purchaseOrderId}`));
      setSelectedOrder(data);
    } catch (error: any) {
      console.error("Failed to load Walmart order detail:", error);
      toast.error(error?.response?.data?.error || "Failed to load Walmart order detail.");
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Walmart Orders
          </Typography>
          <Typography color="text.secondary">
            Read-only Walmart order intake, searchable by PO and status.
          </Typography>
        </Box>

        <Paper sx={{ p: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Purchase Order ID"
                value={filters.purchaseOrderId}
                onChange={(event) => setFilters((current) => ({ ...current, purchaseOrderId: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel id="walmart-status-label">Status</InputLabel>
                <Select
                  labelId="walmart-status-label"
                  label="Status"
                  value={filters.status}
                  onChange={(event) => setFilters((current) => ({ ...current, status: String(event.target.value) }))}
                >
                  <MenuItem value="">All</MenuItem>
                  {statusOptions.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel id="walmart-fulfilled-by-label">Fulfilled By</InputLabel>
                <Select
                  labelId="walmart-fulfilled-by-label"
                  label="Fulfilled By"
                  value={filters.fulfilledBy}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, fulfilledBy: String(event.target.value) }))
                  }
                >
                  <MenuItem value="">All</MenuItem>
                  {fulfilledByOptions.map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                type="date"
                label="From"
                InputLabelProps={{ shrink: true }}
                value={filters.fromDate}
                onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={1.5}>
              <TextField
                fullWidth
                type="date"
                label="To"
                InputLabelProps={{ shrink: true }}
                value={filters.toDate}
                onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={1.5}>
              <Stack direction="row" spacing={1} sx={{ height: "100%" }} alignItems="center">
                <Button
                  variant="contained"
                  onClick={() => {
                    const nextFilters = { ...filters };
                    const sameFilters = JSON.stringify(nextFilters) === JSON.stringify(appliedFilters);
                    setAppliedFilters(nextFilters);
                    if (page === 0 && sameFilters) {
                      loadOrders();
                    } else {
                      setPage(0);
                    }
                  }}
                  fullWidth
                >
                  Apply
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setPage(0);
                    const clearedFilters = {
                      purchaseOrderId: "",
                      status: "",
                      fulfilledBy: "",
                      fromDate: "",
                      toDate: "",
                    };
                    setFilters(clearedFilters);
                    setAppliedFilters(clearedFilters);
                  }}
                  fullWidth
                >
                  Clear
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="overline">Orders</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {summary.totalOrders}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="overline">Units On Page</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {summary.totalUnits}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="overline">Page Size</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {pageSize}
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        <Paper sx={{ p: 3 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress />
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Order Date</TableCell>
                  <TableCell>Order #</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Order Total</TableCell>
                  <TableCell>Items</TableCell>
                  <TableCell>Qty</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} hover>
                    <TableCell>{formatDateTime(order.orderDate)}</TableCell>
                    <TableCell>{order.purchaseOrderId}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={order.orderStatus || "unknown"}
                        color={getStatusChipColor(order.orderStatus) as any}
                      />
                    </TableCell>
                    <TableCell>{order.customerName || "—"}</TableCell>
                    <TableCell>{getOrderTotalLabel(order)}</TableCell>
                    <TableCell sx={{ maxWidth: 420 }}>
                      <Stack spacing={0.5}>
                        {getItemNames(order.lines || []).map((name, index) => (
                          <Typography
                            key={`${order.id}-item-${index}`}
                            variant="body2"
                            sx={{ whiteSpace: "normal", wordBreak: "break-word" }}
                          >
                            {name}
                          </Typography>
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        {getItemQuantities(order.lines || []).map((quantity, index) => (
                          <Typography key={`${order.id}-qty-${index}`} variant="body2">
                            {quantity}
                          </Typography>
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Button variant="outlined" size="small" onClick={() => openOrder(order.purchaseOrderId)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={(_event, newPage) => setPage(newPage)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[50, 100, 200]}
          />
        </Paper>
      </Stack>

      <Dialog open={Boolean(selectedOrder)} onClose={() => setSelectedOrder(null)} maxWidth="lg" fullWidth>
        <DialogTitle>Walmart Order Detail</DialogTitle>
        <DialogContent dividers>
          {selectedOrder && (
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2">Purchase Order ID</Typography>
                    <Typography sx={{ mb: 1 }}>{selectedOrder.purchaseOrderId}</Typography>
                    <Typography variant="subtitle2">Status</Typography>
                    <Typography sx={{ mb: 1 }}>{selectedOrder.orderStatus || "—"}</Typography>
                    <Typography variant="subtitle2">Customer</Typography>
                    <Typography>{selectedOrder.customerName || "—"}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2">Shipping</Typography>
                    <Typography>
                      {selectedOrder.shippingCity || "—"}, {selectedOrder.shippingState || "—"} {selectedOrder.shippingPostalCode || ""}
                    </Typography>
                    <Typography sx={{ mt: 1 }}>
                      {selectedOrder.shippingCountry || "—"}
                    </Typography>
                    <Typography sx={{ mt: 1 }}>
                      Last synced: {formatDateTime(selectedOrder.lastSyncedAt)}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
                  Order Lines
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Line</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell>Qty</TableCell>
                      <TableCell>Unit Price</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selectedOrder.lines || []).map((line: any) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.lineNumber || "—"}</TableCell>
                        <TableCell>{line.walmartSku || "—"}</TableCell>
                        <TableCell>{line.productName || "—"}</TableCell>
                        <TableCell>{line.quantity || "—"}</TableCell>
                        <TableCell>{line.unitPrice || "—"}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={line.lineStatus || "unknown"}
                            color={getStatusChipColor(line.lineStatus) as any}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default WalmartOrders;

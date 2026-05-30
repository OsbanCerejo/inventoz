import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
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
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import { toast } from "react-toastify";
import { getApiUrl } from "../config/api";
import { useAuth } from "../context/AuthContext";

const statusOptions = [
  { value: "new", label: "New" },
  { value: "in_review", label: "In Review" },
  { value: "invoiced", label: "Invoiced" },
  { value: "paid", label: "Paid" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "cancelled", label: "Cancelled" },
];

const emailStatuses = ["sent", "pending", "failed", "skipped"];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const formatMoney = (value: any) => money.format(Number(value || 0));
const formatDate = (value: any) => (value ? new Date(value).toLocaleString() : "-");
const statusLabel = (value: string) => statusOptions.find((option) => option.value === value)?.label || value;

function HbaOrders() {
  const { user, hasPermission } = useAuth();
  const canEdit = user?.role === "admin" || hasPermission("hbaOrders", "edit");
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [salesPeople, setSalesPeople] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    salesPerson: "all",
    emailStatus: "all",
    dateFrom: "",
    dateTo: "",
  });
  const [draftStatus, setDraftStatus] = useState("new");
  const [draftNotes, setDraftNotes] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => String(value || "").trim())
      );
      const { data } = await axios.get(getApiUrl("hba-orders"), { params });
      setRows(data?.rows || []);
      setSummary(data?.summary || {});
      setSalesPeople(data?.salesPeople || []);
    } catch (loadError: any) {
      console.error("Failed to load HBA orders:", loadError);
      setError(loadError?.response?.data?.error || "Failed to load HBA orders");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const openOrder = async (id: number) => {
    try {
      setDetailLoading(true);
      const { data } = await axios.get(getApiUrl(`hba-orders/${id}`));
      setSelectedOrder(data);
      setDraftStatus(data.status || "new");
      setDraftNotes(data.internalNotes || "");
    } catch (detailError: any) {
      toast.error(detailError?.response?.data?.error || "Failed to load HBA order");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDrawer = () => {
    setSelectedOrder(null);
    setDraftNotes("");
    setDraftStatus("new");
  };

  const saveOrder = async () => {
    if (!selectedOrder) return;
    try {
      setSaving(true);
      const { data } = await axios.patch(getApiUrl(`hba-orders/${selectedOrder.id}`), {
        status: draftStatus,
        internalNotes: draftNotes,
      });
      setSelectedOrder(data);
      await loadOrders();
      toast.success("HBA order updated.");
    } catch (saveError: any) {
      toast.error(saveError?.response?.data?.error || "Failed to update HBA order");
    } finally {
      setSaving(false);
    }
  };

  const resendEmail = async (type: "internal" | "customer") => {
    if (!selectedOrder) return;
    try {
      setSaving(true);
      const endpoint =
        type === "internal"
          ? `hba-orders/${selectedOrder.id}/resend-internal-email`
          : `hba-orders/${selectedOrder.id}/resend-customer-email`;
      const { data } = await axios.post(getApiUrl(endpoint));
      if (data?.success) {
        toast.success(type === "internal" ? "Internal email resent." : "Customer email resent.");
      } else {
        toast.error("Email could not be sent. Check the saved status.");
      }
      await openOrder(selectedOrder.id);
      await loadOrders();
    } catch (emailError: any) {
      toast.error(emailError?.response?.data?.error || "Failed to resend email");
    } finally {
      setSaving(false);
    }
  };

  const summaryCards = useMemo(
    () => [
      ["Total Orders", summary.totalOrders || 0],
      ["New", summary.new || 0],
      ["In Review", summary.in_review || 0],
      ["Invoiced", summary.invoiced || 0],
      ["Paid", summary.paid || 0],
      ["Failed Emails", summary.failedEmails || 0],
    ],
    [summary]
  );

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            HBA Orders
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review public HBA order requests, workflow status, and email delivery.
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={loadOrders} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {summaryCards.map(([label, value]) => (
          <Grid item xs={6} md={2} key={label}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  {value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={1.5}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Search"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              >
                <MenuItem value="all">All</MenuItem>
                {statusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Salesperson</InputLabel>
              <Select
                label="Salesperson"
                value={filters.salesPerson}
                onChange={(event) => setFilters((current) => ({ ...current, salesPerson: event.target.value }))}
              >
                <MenuItem value="all">All</MenuItem>
                {salesPeople.map((person) => (
                  <MenuItem key={person} value={person}>
                    {person}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Email Status</InputLabel>
              <Select
                label="Email Status"
                value={filters.emailStatus}
                onChange={(event) => setFilters((current) => ({ ...current, emailStatus: event.target.value }))}
              >
                <MenuItem value="all">All</MenuItem>
                {emailStatuses.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={1.5}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="From"
              InputLabelProps={{ shrink: true }}
              value={filters.dateFrom}
              onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
            />
          </Grid>
          <Grid item xs={6} md={1.5}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="To"
              InputLabelProps={{ shrink: true }}
              value={filters.dateTo}
              onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
            />
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Order #</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Customer / Company</TableCell>
              <TableCell>Sales Person</TableCell>
              <TableCell align="right">SKUs</TableCell>
              <TableCell align="right">Units</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Emails</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  No HBA orders found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((order) => (
                <TableRow
                  hover
                  key={order.id}
                  onClick={() => openOrder(order.id)}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell>{order.orderNumber}</TableCell>
                  <TableCell>{formatDate(order.createdAt)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>{order.customerName}</Typography>
                    <Typography variant="caption" color="text.secondary">{order.companyName}</Typography>
                  </TableCell>
                  <TableCell>{order.salesPerson}</TableCell>
                  <TableCell align="right">{order.totalSkus}</TableCell>
                  <TableCell align="right">{order.totalUnits}</TableCell>
                  <TableCell align="right">{formatMoney(order.totalPrice)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={statusLabel(order.status)} />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Chip size="small" label={`Internal: ${order.notificationStatus}`} />
                      <Chip size="small" label={`Customer: ${order.customerNotificationStatus}`} />
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Drawer anchor="right" open={Boolean(selectedOrder)} onClose={closeDrawer}>
        <Box sx={{ width: { xs: "100vw", sm: 720 }, p: 3 }}>
          {detailLoading || !selectedOrder ? (
            <Box display="flex" justifyContent="center" py={8}>
              <CircularProgress />
            </Box>
          ) : (
            <Stack spacing={2}>
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  {selectedOrder.orderNumber}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Created {formatDate(selectedOrder.createdAt)}
                </Typography>
              </Box>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={statusLabel(selectedOrder.status)} />
                <Chip label={formatMoney(selectedOrder.totalPrice)} color="success" />
                <Chip label={`${selectedOrder.totalUnits} units`} />
              </Stack>

              <Divider />

              <Grid container spacing={1.5}>
                {[
                  ["Name", selectedOrder.customerName],
                  ["Company", selectedOrder.companyName],
                  ["Email", selectedOrder.email],
                  ["Phone", selectedOrder.phone],
                  ["Sales Person", selectedOrder.salesPerson],
                  ["Address", `${selectedOrder.addressLine1 || ""} ${selectedOrder.addressLine2 || ""}, ${selectedOrder.city || ""}, ${selectedOrder.state || ""} ${selectedOrder.zipCode || ""}`],
                ].map(([label, value]) => (
                  <Grid item xs={12} md={6} key={label}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="body2">{value || "-"}</Typography>
                  </Grid>
                ))}
                {selectedOrder.notes && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Customer Notes</Typography>
                    <Typography variant="body2">{selectedOrder.notes}</Typography>
                  </Grid>
                )}
              </Grid>

              <Divider />

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>SKU</TableCell>
                      <TableCell>Brand / Item</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Unit</TableCell>
                      <TableCell align="right">Subtotal</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selectedOrder.items || []).map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.sku}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700}>{item.brand}</Typography>
                          <Typography variant="caption">{item.itemName}</Typography>
                        </TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{formatMoney(item.unitPrice)}</TableCell>
                        <TableCell align="right">{formatMoney(item.subtotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Divider />

              <Grid container spacing={1.5}>
                <Grid item xs={12} md={5}>
                  <FormControl fullWidth size="small" disabled={!canEdit}>
                    <InputLabel>Status</InputLabel>
                    <Select
                      label="Status"
                      value={draftStatus}
                      onChange={(event) => setDraftStatus(event.target.value)}
                    >
                      {statusOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    label="Internal Notes"
                    value={draftNotes}
                    disabled={!canEdit}
                    onChange={(event) => setDraftNotes(event.target.value)}
                  />
                </Grid>
              </Grid>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={saveOrder}
                  disabled={!canEdit || saving}
                >
                  Save
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<EmailIcon />}
                  onClick={() => resendEmail("internal")}
                  disabled={!canEdit || saving}
                >
                  Resend Internal
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<EmailIcon />}
                  onClick={() => resendEmail("customer")}
                  disabled={!canEdit || saving}
                >
                  Resend Customer
                </Button>
              </Stack>

              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={700}>Email Status</Typography>
                <Typography variant="body2">Internal: {selectedOrder.notificationStatus}</Typography>
                <Typography variant="body2">Customer: {selectedOrder.customerNotificationStatus}</Typography>
                {selectedOrder.notificationError && (
                  <Typography variant="body2" color="error">Internal error: {selectedOrder.notificationError}</Typography>
                )}
                {selectedOrder.customerNotificationError && (
                  <Typography variant="body2" color="error">Customer error: {selectedOrder.customerNotificationError}</Typography>
                )}
              </Paper>
            </Stack>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}

export default HbaOrders;

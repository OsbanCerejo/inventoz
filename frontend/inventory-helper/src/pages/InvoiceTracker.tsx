import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  Add as AddIcon,
  RestoreFromTrash as RestoreIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  FormControlLabel,
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
import { getApiUrl } from "../config/api";
import { useAuth } from "../context/AuthContext";

type InvoiceItem = {
  id?: number;
  sku: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  lineTotal?: number;
};

type UserMini = {
  id: number;
  name?: string;
  username?: string;
};

type Invoice = {
  id: number;
  vendorName: string;
  invoiceNumber: string;
  orderDate: string;
  shipmentStatus: string;
  itemCheckStatus: string;
  inboundStatus: string;
  paymentStatus: string;
  paymentDueBy?: string | null;
  paymentDate?: string | null;
  receivedDate?: string | null;
  miscellaneousAmount?: number;
  shippingAmount?: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
  totalAmount: number;
  itemCount: number;
  items: InvoiceItem[];
  creator?: UserMini | null;
  updater?: UserMini | null;
};

const SHIPMENT_STATUS_OPTIONS = [
  { value: "order_placed", label: "Order Placed" },
  { value: "shipped", label: "Shipped" },
  { value: "received", label: "Received" },
];

const ITEM_CHECK_STATUS_OPTIONS = [
  { value: "not_checked", label: "Not Checked" },
  { value: "working_on_it", label: "Working on it" },
  { value: "verified", label: "Verified" },
  { value: "missing_items", label: "Missing Items" },
];

const INBOUND_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "done", label: "Done" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Unpaid" },
  { value: "credit", label: "Credit" },
];

const emptyForm = {
  id: null as number | null,
  updatedAt: "",
  vendorName: "",
  invoiceNumber: "",
  orderDate: new Date().toISOString().slice(0, 10),
  shipmentStatus: "order_placed",
  itemCheckStatus: "not_checked",
  inboundStatus: "pending",
  paymentStatus: "unpaid",
  paymentDueBy: "",
  paymentDate: "",
  receivedDate: "",
  miscellaneousAmount: 0,
  shippingAmount: 0,
  notes: "",
  items: [] as InvoiceItem[],
};

function InvoiceTracker() {
  const { token, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [shipmentStatusFilter, setShipmentStatusFilter] = useState("all");
  const [itemCheckStatusFilter, setItemCheckStatusFilter] = useState("all");
  const [inboundStatusFilter, setInboundStatusFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [skuLookupLoading, setSkuLookupLoading] = useState<Record<number, boolean>>({});

  const canCreate = hasPermission("invoiceTracker", "create");
  const canEdit = hasPermission("invoiceTracker", "edit");
  const canDelete = hasPermission("invoiceTracker", "delete");
  const isReadOnly = dialogMode === "view";

  const invoiceTotal = useMemo(
    () =>
      form.items.reduce((sum, item) => {
        const lineTotal = Number(item.unitPrice || 0) * Number(item.quantity || 0);
        return sum + lineTotal;
      }, 0),
    [form.items]
  );

  const invoiceGrandTotal = useMemo(
    () => invoiceTotal + Number(form.miscellaneousAmount || 0) + Number(form.shippingAmount || 0),
    [invoiceTotal, form.miscellaneousAmount, form.shippingAmount]
  );

  const metrics = useMemo(() => {
    const totalAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0);
    const dueInvoices = invoices.filter((invoice) => invoice.paymentStatus === "credit").length;
    const receivedInvoices = invoices.filter((invoice) => invoice.shipmentStatus === "received").length;
    const pendingInbound = invoices.filter((invoice) => invoice.inboundStatus === "pending").length;

    return {
      totalInvoices: invoices.length,
      totalAmount,
      receivedInvoices,
      pendingInbound,
      creditInvoices: dueInvoices,
    };
  }, [invoices]);

  const loadInvoices = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await axios.get<Invoice[]>(getApiUrl("invoice-tracker"), {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          search: search || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          shipmentStatus: shipmentStatusFilter !== "all" ? shipmentStatusFilter : undefined,
          itemCheckStatus: itemCheckStatusFilter !== "all" ? itemCheckStatusFilter : undefined,
          inboundStatus: inboundStatusFilter !== "all" ? inboundStatusFilter : undefined,
          paymentStatus: paymentStatusFilter !== "all" ? paymentStatusFilter : undefined,
          archived: showArchived ? "only" : "active",
        },
      });
      const sorted = [...(response.data || [])].sort((a, b) => {
        const dateDiff = new Date(`${b.orderDate}T00:00:00`).getTime() - new Date(`${a.orderDate}T00:00:00`).getTime();
        if (dateDiff !== 0) return dateDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setInvoices(sorted);
    } catch (error) {
      console.error("Failed to load invoices:", error);
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  const loadInvoiceDetail = async (invoiceId: number) => {
    if (!token) return null;
    try {
      const response = await axios.get<Invoice>(getApiUrl(`invoice-tracker/${invoiceId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      console.error("Failed to load invoice detail:", error);
      toast.error("Failed to load invoice details");
      return null;
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [token, dateFrom, dateTo, shipmentStatusFilter, itemCheckStatusFilter, inboundStatusFilter, paymentStatusFilter, showArchived]);

  const openCreateDialog = () => {
    setDialogMode("create");
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openInvoiceDialog = async (invoiceId: number) => {
    const detail = await loadInvoiceDetail(invoiceId);
    if (!detail) return;

    setSelectedInvoiceId(invoiceId);
    setDialogMode(canEdit ? "edit" : "view");
    setForm({
      id: detail.id,
      updatedAt: detail.updatedAt,
      vendorName: detail.vendorName,
      invoiceNumber: detail.invoiceNumber,
      orderDate: detail.orderDate,
      shipmentStatus: detail.shipmentStatus,
      itemCheckStatus: detail.itemCheckStatus,
      inboundStatus: detail.inboundStatus,
      paymentStatus: detail.paymentStatus,
      paymentDueBy: detail.paymentDueBy || "",
      paymentDate: detail.paymentDate || "",
      receivedDate: detail.receivedDate || "",
      miscellaneousAmount: Number(detail.miscellaneousAmount || 0),
      shippingAmount: Number(detail.shippingAmount || 0),
      notes: detail.notes || "",
      items:
        detail.items.length > 0
          ? detail.items.map((item) => ({
              id: item.id,
              sku: item.sku,
              itemName: item.itemName,
              unitPrice: Number(item.unitPrice || 0),
              quantity: Number(item.quantity || 0),
            }))
          : [{ sku: "", itemName: "", unitPrice: 0, quantity: 1 }],
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setDialogMode("create");
    setForm(emptyForm);
  };

  const lookupSku = async (index: number, skuValue: string) => {
    const sku = skuValue.trim();
    if (!sku || !token) return;

    try {
      setSkuLookupLoading((prev) => ({ ...prev, [index]: true }));
      const response = await axios.get(getApiUrl("invoice-tracker/lookup-product"), {
        headers: { Authorization: `Bearer ${token}` },
        params: { sku },
      });
      setForm((prev) => ({
        ...prev,
        items: prev.items.map((item, rowIndex) =>
          rowIndex === index
            ? {
                ...item,
                sku: response.data?.sku || sku,
                itemName: response.data?.itemName || "",
              }
            : item
        ),
      }));
    } catch (error: any) {
      setForm((prev) => ({
        ...prev,
        items: prev.items.map((item, rowIndex) =>
          rowIndex === index ? { ...item, itemName: "" } : item
        ),
      }));
      toast.error(error?.response?.data?.error || `SKU not found: ${sku}`);
    } finally {
      setSkuLookupLoading((prev) => ({ ...prev, [index]: false }));
    }
  };

  const addItemRow = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { sku: "", itemName: "", unitPrice: 0, quantity: 1 }],
    }));
  };

  const removeItemRow = (index: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const updateItemRow = (index: number, key: keyof InvoiceItem, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, rowIndex) =>
        rowIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const saveInvoice = async () => {
    if (!token) return;
    if (!form.vendorName.trim() || !form.invoiceNumber.trim() || !form.orderDate) {
      toast.error("Vendor Name, Invoice Number, and Order Date are required");
      return;
    }
    const enteredItems = form.items.filter(
      (item) =>
        item.sku.trim() ||
        item.itemName.trim() ||
        Number(item.unitPrice || 0) > 0 ||
        Number(item.quantity || 0) > 0
    );
    if (enteredItems.some((item) => !item.sku.trim() || !item.itemName.trim())) {
      toast.error("Every invoice line needs a valid SKU and resolved item name");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        expectedUpdatedAt: form.id ? form.updatedAt : undefined,
        vendorName: form.vendorName.trim(),
        invoiceNumber: form.invoiceNumber.trim(),
        orderDate: form.orderDate,
        shipmentStatus: form.shipmentStatus,
        itemCheckStatus: form.itemCheckStatus,
        inboundStatus: form.inboundStatus,
        paymentStatus: form.paymentStatus,
        paymentDueBy: form.paymentStatus === "credit" ? form.paymentDueBy : null,
        paymentDate: form.paymentStatus === "paid" ? form.paymentDate : null,
        receivedDate: form.shipmentStatus === "received" ? form.receivedDate : null,
        miscellaneousAmount: Number(form.miscellaneousAmount || 0),
        shippingAmount: Number(form.shippingAmount || 0),
        notes: form.notes.trim(),
        items: enteredItems.map((item) => ({
          sku: item.sku.trim(),
          unitPrice: Number(item.unitPrice || 0),
          quantity: Number(item.quantity || 0),
        })),
      };

      if (form.id) {
        await axios.put(getApiUrl(`invoice-tracker/${form.id}`), payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Invoice updated");
      } else {
        await axios.post(getApiUrl("invoice-tracker"), payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Invoice created");
      }

      closeDialog();
      await loadInvoices();
    } catch (error: any) {
      console.error("Failed to save invoice:", error);
      if (error?.response?.status === 409) {
        toast.error(error?.response?.data?.error || "Invoice changed by another user. Refresh and try again.");
      } else {
        toast.error(error?.response?.data?.error || "Failed to save invoice");
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteInvoice = async (invoiceId: number) => {
    if (!token) return;
    const target = invoices.find((invoice) => invoice.id === invoiceId);
    if (!target) return;
    if (!window.confirm("Archive this invoice?")) return;

    try {
      await axios.delete(getApiUrl(`invoice-tracker/${invoiceId}`), {
        headers: { Authorization: `Bearer ${token}` },
        data: { expectedUpdatedAt: target.updatedAt },
      });
      toast.success("Invoice archived");
      if (selectedInvoiceId === invoiceId) {
        setSelectedInvoiceId(null);
      }
      await loadInvoices();
    } catch (error: any) {
      console.error("Failed to delete invoice:", error);
      if (error?.response?.status === 409) {
        toast.error(error?.response?.data?.error || "Invoice changed by another user. Refresh and try again.");
      } else {
        toast.error(error?.response?.data?.error || "Failed to archive invoice");
      }
    }
  };

  const restoreInvoice = async (invoiceId: number) => {
    if (!token) return;
    const target = invoices.find((invoice) => invoice.id === invoiceId);
    if (!target) return;
    if (!window.confirm("Restore this archived invoice?")) return;

    try {
      await axios.patch(
        getApiUrl(`invoice-tracker/${invoiceId}/restore`),
        { expectedUpdatedAt: target.updatedAt },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Invoice restored");
      if (selectedInvoiceId === invoiceId) {
        setSelectedInvoiceId(null);
      }
      await loadInvoices();
    } catch (error: any) {
      console.error("Failed to restore invoice:", error);
      if (error?.response?.status === 409) {
        toast.error(error?.response?.data?.error || "Invoice changed by another user. Refresh and try again.");
      } else {
        toast.error(error?.response?.data?.error || "Failed to restore invoice");
      }
    }
  };

  const getShipmentChipColor = (value: string) => {
    if (value === "received") return "success";
    if (value === "shipped") return "info";
    return "default";
  };

  const getItemCheckChipColor = (value: string) => {
    if (value === "verified") return "success";
    if (value === "missing_items") return "error";
    return "warning";
  };

  const getInboundChipColor = (value: string) => (value === "done" ? "success" : "warning");
  const getPaymentChipColor = (value: string) => {
    if (value === "paid") return "success";
    if (value === "credit") return "info";
    return "default";
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Invoice Tracker
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track vendor invoices, item verification, and inbound progress in one place.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshIcon />} variant="outlined" onClick={loadInvoices}>
            Refresh
          </Button>
          {canCreate && (
            <Button startIcon={<AddIcon />} variant="contained" onClick={openCreateDialog}>
              New Invoice
            </Button>
          )}
        </Stack>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", lg: "center" }}
            >
              <TextField
                fullWidth
                label="Search Invoices"
                placeholder="Vendor, invoice #, SKU, or item name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ minWidth: { lg: "auto" } }}>
                <Button variant="contained" sx={{ minWidth: 120, height: "56px" }} onClick={loadInvoices}>
                  Apply
                </Button>
                <Button
                  variant="outlined"
                  sx={{ minWidth: 120, height: "56px" }}
                  onClick={() => {
                    setSearch("");
                    setDateFrom("");
                    setDateTo("");
                    setShipmentStatusFilter("all");
                    setItemCheckStatusFilter("all");
                    setInboundStatusFilter("all");
                    setPaymentStatusFilter("all");
                    setShowArchived(false);
                  }}
                >
                  Clear
                </Button>
              </Stack>
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                    Order Date Range
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <TextField
                      fullWidth
                      type="date"
                      label="From"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      fullWidth
                      type="date"
                      label="To"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Stack>
                </Paper>
              </Grid>

              <Grid item xs={12} md={8}>
                <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", md: "center" }}
                    spacing={1}
                    sx={{ mb: 1.5 }}
                  >
                    <Typography variant="subtitle2" fontWeight={700}>
                      Status Filters
                    </Typography>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={showArchived}
                          onChange={(e) => setShowArchived(e.target.checked)}
                        />
                      }
                      label="Archived"
                      sx={{ mr: 0 }}
                    />
                  </Stack>
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6} lg={3}>
                      <FormControl fullWidth>
                        <InputLabel>Payment</InputLabel>
                        <Select
                          value={paymentStatusFilter}
                          label="Payment"
                          onChange={(e) => setPaymentStatusFilter(String(e.target.value))}
                        >
                          <MenuItem value="all">All</MenuItem>
                          {PAYMENT_STATUS_OPTIONS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} lg={3}>
                      <FormControl fullWidth>
                        <InputLabel>Shipment</InputLabel>
                        <Select
                          value={shipmentStatusFilter}
                          label="Shipment"
                          onChange={(e) => setShipmentStatusFilter(String(e.target.value))}
                        >
                          <MenuItem value="all">All</MenuItem>
                          {SHIPMENT_STATUS_OPTIONS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} lg={3}>
                      <FormControl fullWidth>
                        <InputLabel>Items Check</InputLabel>
                        <Select
                          value={itemCheckStatusFilter}
                          label="Items Check"
                          onChange={(e) => setItemCheckStatusFilter(String(e.target.value))}
                        >
                          <MenuItem value="all">All</MenuItem>
                          {ITEM_CHECK_STATUS_OPTIONS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} lg={3}>
                      <FormControl fullWidth>
                        <InputLabel>Inbound</InputLabel>
                        <Select
                          value={inboundStatusFilter}
                          label="Inbound"
                          onChange={(e) => setInboundStatusFilter(String(e.target.value))}
                        >
                          <MenuItem value="all">All</MenuItem>
                          {INBOUND_STATUS_OPTIONS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "1fr 1fr",
            lg: "repeat(5, minmax(0, 1fr))",
          },
          gap: 2,
          mb: 2,
        }}
      >
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">Total Invoices</Typography>
          <Typography variant="h5" fontWeight={700}>{metrics.totalInvoices}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">Invoice Amount</Typography>
          <Typography variant="h5" fontWeight={700}>${metrics.totalAmount.toFixed(2)}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">Received</Typography>
          <Typography variant="h5" fontWeight={700}>{metrics.receivedInvoices}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">Pending Inbound</Typography>
          <Typography variant="h5" fontWeight={700}>{metrics.pendingInbound}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">Credit Invoices</Typography>
          <Typography variant="h5" fontWeight={700} color={metrics.creditInvoices > 0 ? "error.main" : "text.primary"}>
            {metrics.creditInvoices}
          </Typography>
        </Paper>
      </Box>

      <Card>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" py={5}>
              <CircularProgress />
            </Box>
          ) : invoices.length === 0 ? (
            <Alert severity="info">No invoices found.</Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Vendor</TableCell>
                    <TableCell>Invoice #</TableCell>
                    <TableCell>Order Date</TableCell>
                    <TableCell>Payment</TableCell>
                    <TableCell>Shipment</TableCell>
                    <TableCell>Items Check</TableCell>
                    <TableCell>Inbound</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() => openInvoiceDialog(invoice.id)}
                    >
                      <TableCell>{invoice.vendorName}</TableCell>
                      <TableCell>{invoice.invoiceNumber}</TableCell>
                      <TableCell>{new Date(`${invoice.orderDate}T00:00:00`).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={getPaymentChipColor(invoice.paymentStatus) as any}
                          label={
                            PAYMENT_STATUS_OPTIONS.find((option) => option.value === invoice.paymentStatus)?.label ||
                            invoice.paymentStatus
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={getShipmentChipColor(invoice.shipmentStatus) as any}
                          label={
                            SHIPMENT_STATUS_OPTIONS.find((option) => option.value === invoice.shipmentStatus)?.label ||
                            invoice.shipmentStatus
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={getItemCheckChipColor(invoice.itemCheckStatus) as any}
                          label={
                            ITEM_CHECK_STATUS_OPTIONS.find((option) => option.value === invoice.itemCheckStatus)?.label ||
                            invoice.itemCheckStatus
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={getInboundChipColor(invoice.inboundStatus) as any}
                          label={
                            INBOUND_STATUS_OPTIONS.find((option) => option.value === invoice.inboundStatus)?.label ||
                            invoice.inboundStatus
                          }
                        />
                      </TableCell>
                      <TableCell>${Number(invoice.totalAmount || 0).toFixed(2)}</TableCell>
                      <TableCell align="right">
                        {canDelete && (
                          <>
                            {invoice.isArchived ? (
                              <IconButton
                                color="primary"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  restoreInvoice(invoice.id);
                                }}
                              >
                                <RestoreIcon />
                              </IconButton>
                            ) : (
                              <IconButton
                                color="error"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  deleteInvoice(invoice.id);
                                }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            )}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="lg">
        <DialogTitle>
          {dialogMode === "create"
            ? "Create Invoice"
            : dialogMode === "edit"
              ? "Edit Invoice"
              : "Invoice Details"}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, backgroundColor: "#fcfcfd" }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                  Invoice Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Vendor Name *"
                      value={form.vendorName}
                      onChange={(e) => setForm((prev) => ({ ...prev, vendorName: e.target.value }))}
                      disabled={isReadOnly}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Invoice Number *"
                      value={form.invoiceNumber}
                      onChange={(e) => setForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                      disabled={isReadOnly}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Order Date *"
                      value={form.orderDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, orderDate: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                      disabled={isReadOnly}
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, backgroundColor: "#fafafc" }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                  Status Tracking
                </Typography>
                <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth disabled={isReadOnly}>
                <InputLabel>Payment Status</InputLabel>
                <Select
                  value={form.paymentStatus}
                        label="Payment Status"
                        onChange={(e) => setForm((prev) => ({ ...prev, paymentStatus: String(e.target.value) }))}
                      >
                        {PAYMENT_STATUS_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
                  {form.paymentStatus === "credit" && (
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        type="date"
                        label="Payment Due By *"
                        value={form.paymentDueBy}
                        onChange={(e) => setForm((prev) => ({ ...prev, paymentDueBy: e.target.value }))}
                        InputLabelProps={{ shrink: true }}
                        disabled={isReadOnly}
                      />
                    </Grid>
                  )}
                  {form.paymentStatus === "paid" && (
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        type="date"
                        label="Payment Date *"
                        value={form.paymentDate}
                        onChange={(e) => setForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                        InputLabelProps={{ shrink: true }}
                        disabled={isReadOnly}
                      />
                    </Grid>
                  )}
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth disabled={isReadOnly}>
                      <InputLabel>Shipment Status</InputLabel>
                      <Select
                        value={form.shipmentStatus}
                        label="Shipment Status"
                        onChange={(e) => setForm((prev) => ({ ...prev, shipmentStatus: String(e.target.value) }))}
                      >
                        {SHIPMENT_STATUS_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  {form.shipmentStatus === "received" && (
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        type="date"
                        label="Received Date *"
                        value={form.receivedDate}
                        onChange={(e) => setForm((prev) => ({ ...prev, receivedDate: e.target.value }))}
                        InputLabelProps={{ shrink: true }}
                        disabled={isReadOnly}
                      />
                    </Grid>
                  )}
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth disabled={isReadOnly}>
                      <InputLabel>Items Check Status</InputLabel>
                      <Select
                        value={form.itemCheckStatus}
                        label="Items Check Status"
                        onChange={(e) => setForm((prev) => ({ ...prev, itemCheckStatus: String(e.target.value) }))}
                      >
                        {ITEM_CHECK_STATUS_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth disabled={isReadOnly}>
                      <InputLabel>Inbound Status</InputLabel>
                      <Select
                        value={form.inboundStatus}
                        label="Inbound Status"
                        onChange={(e) => setForm((prev) => ({ ...prev, inboundStatus: String(e.target.value) }))}
                      >
                        {INBOUND_STATUS_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                disabled={isReadOnly}
              />
            </Grid>

            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, backgroundColor: "#fcfcfd" }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                  Additional Costs
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Miscellaneous"
                      inputProps={{ min: 0, step: "0.01" }}
                      value={form.miscellaneousAmount}
                      onChange={(e) => setForm((prev) => ({ ...prev, miscellaneousAmount: Number(e.target.value) || 0 }))}
                      disabled={isReadOnly}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Shipping"
                      inputProps={{ min: 0, step: "0.01" }}
                      value={form.shippingAmount}
                      onChange={(e) => setForm((prev) => ({ ...prev, shippingAmount: Number(e.target.value) || 0 }))}
                      disabled={isReadOnly}
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                Invoice Items
              </Typography>
              <Stack spacing={1.5}>
                {form.items.map((item, index) => {
                  const lineTotal = Number(item.unitPrice || 0) * Number(item.quantity || 0);
                  return (
                    <Paper key={`${item.id || "new"}-${index}`} variant="outlined" sx={{ p: 1.5 }}>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "1fr",
                            lg: "1.4fr 2fr 1.1fr 0.9fr 0.9fr auto",
                          },
                          gap: 1.5,
                          alignItems: "start",
                        }}
                      >
                        <Box>
                          <TextField
                            fullWidth
                            size="small"
                            label="SKU *"
                            value={item.sku}
                            onChange={(e) => updateItemRow(index, "sku", e.target.value)}
                            onBlur={() => lookupSku(index, item.sku)}
                            disabled={isReadOnly}
                            helperText={skuLookupLoading[index] ? "Looking up SKU..." : " "}
                          />
                        </Box>
                        <Box>
                          <TextField
                            fullWidth
                            size="small"
                            label="Item Name"
                            value={item.itemName}
                            disabled
                          />
                        </Box>
                        <Box>
                          <TextField
                            fullWidth
                            size="small"
                            label="Price"
                            type="number"
                            inputProps={{ min: 0, step: "0.01" }}
                            value={item.unitPrice}
                            onChange={(e) => updateItemRow(index, "unitPrice", Number(e.target.value) || 0)}
                            disabled={isReadOnly}
                          />
                        </Box>
                        <Box>
                          <TextField
                            fullWidth
                            size="small"
                            label="Quantity"
                            type="number"
                            inputProps={{ min: 1, step: 1 }}
                            value={item.quantity}
                            onChange={(e) => updateItemRow(index, "quantity", Number(e.target.value) || 1)}
                            disabled={isReadOnly}
                          />
                        </Box>
                        <Box>
                          <TextField
                            fullWidth
                            size="small"
                            label="Line Total"
                            value={`$${lineTotal.toFixed(2)}`}
                            disabled
                          />
                        </Box>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: { xs: "flex-start", lg: "center" },
                            justifyContent: "center",
                            pt: { xs: 0, lg: "4px" },
                          }}
                        >
                          {!isReadOnly && (
                            <IconButton
                              color="error"
                              onClick={() => removeItemRow(index)}
                              disabled={form.items.length === 1}
                            >
                              <DeleteIcon />
                            </IconButton>
                          )}
                        </Box>
                      </Box>
                    </Paper>
                  );
                })}
                {!isReadOnly && (
                  <Box>
                    <Button startIcon={<AddIcon />} variant="outlined" onClick={addItemRow}>
                      Add Item Row
                    </Button>
                  </Box>
                )}
              </Stack>
            </Grid>

            <Grid item xs={12}>
              <Paper
                variant="outlined"
                sx={{
                  px: 2,
                  py: 1.5,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: "#f8fafc",
                }}
              >
                <Typography variant="subtitle1" fontWeight={700}>
                  Total Invoice Amount
                </Typography>
                <Box sx={{ textAlign: "right" }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Items ${invoiceTotal.toFixed(2)} + Misc ${Number(form.miscellaneousAmount || 0).toFixed(2)} + Shipping ${Number(form.shippingAmount || 0).toFixed(2)}
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    ${invoiceGrandTotal.toFixed(2)}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>{isReadOnly ? "Close" : "Cancel"}</Button>
          {!isReadOnly && (
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={saveInvoice}
              disabled={saving}
            >
              {saving ? "Saving..." : form.id ? "Save Changes" : "Create Invoice"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default InvoiceTracker;

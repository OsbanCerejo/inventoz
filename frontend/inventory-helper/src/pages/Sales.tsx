
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import BlockIcon from "@mui/icons-material/Block";
import SaveIcon from "@mui/icons-material/Save";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import RefreshIcon from "@mui/icons-material/Refresh";
import dayjs, { Dayjs } from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import axios from "axios";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { getApiUrl } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { invalidateProductsCache } from "../utils/productCache";

interface ProductSeed {
  sku?: string;
  brand?: string;
  itemName?: string;
  sizeOz?: number | string;
}

interface ProductOption {
  sku: string;
  alternativeSku?: string | null;
  itemName: string;
  quantity: number;
  upc?: string | number | null;
}

type SaleStatus = "draft" | "finalized" | "voided";
type SaleCategory = "customer_sale" | "marketplace" | "wfs" | "wholesale" | "other";
type PaymentStatus = "unpaid" | "partial" | "paid";
type ShipmentStatus = "pending" | "shipped" | "delivered";
type PackingStatus = "not_packed" | "packing" | "packed";

interface SaleItemRecord {
  id?: number;
  sku: string;
  itemName: string;
  quantity: number;
  unitSoldPrice: number | null;
  lineTotal: number | null;
}

interface SaleRecord {
  id: number;
  receiptNumber: string;
  saleDate: string;
  saleCategory: SaleCategory;
  customerName?: string | null;
  marketplaceName?: string | null;
  marketplaceOther?: string | null;
  wholesaleName?: string | null;
  wholesaleOther?: string | null;
  otherCategoryLabel?: string | null;
  paymentStatus: PaymentStatus;
  shipmentStatus: ShipmentStatus;
  packingStatus: PackingStatus;
  status: SaleStatus;
  notes?: string | null;
  voidReason?: string | null;
  finalizedAt?: string | null;
  voidedAt?: string | null;
  updatedAt?: string;
  createdAt?: string;
  categoryLabel: string;
  pricedSubtotal: number;
  totalUnits: number;
  itemCount: number;
  creatorDisplay?: string | null;
  updaterDisplay?: string | null;
  finalizerDisplay?: string | null;
  voiderDisplay?: string | null;
  invoiceAttachmentAvailable?: boolean;
  invoiceAttachmentOriginalName?: string | null;
  invoiceAttachmentMimeType?: string | null;
  invoiceAttachmentUploadedAt?: string | null;
  invoiceAttachmentUploaderDisplay?: string | null;
  items: SaleItemRecord[];
}

interface SaleItemFormRow {
  clientId: string;
  id?: number;
  sku: string;
  itemName: string;
  quantity: string;
  unitSoldPrice: string;
  lookupText: string;
}

interface SaleFormState {
  id: number | null;
  receiptNumber: string;
  saleDate: Dayjs | null;
  saleCategory: SaleCategory;
  customerName: string;
  marketplaceName: string;
  marketplaceOther: string;
  wholesaleName: string;
  wholesaleOther: string;
  otherCategoryLabel: string;
  paymentStatus: PaymentStatus;
  shipmentStatus: ShipmentStatus;
  packingStatus: PackingStatus;
  notes: string;
  status: SaleStatus;
  finalizedAt: string | null;
  voidedAt: string | null;
  voidReason: string;
  updatedAt: string | null;
  invoiceAttachmentAvailable: boolean;
  invoiceAttachmentOriginalName: string | null;
  invoiceAttachmentMimeType: string | null;
  invoiceAttachmentUploadedAt: string | null;
  invoiceAttachmentUploaderDisplay: string | null;
  items: SaleItemFormRow[];
}

const SALE_CATEGORY_OPTIONS = [
  { value: "customer_sale", label: "Customer Sale" },
  { value: "marketplace", label: "Marketplace" },
  { value: "wfs", label: "WFS" },
  { value: "wholesale", label: "Wholesale" },
  { value: "other", label: "Other" },
] as const;

const MARKETPLACE_OPTIONS = ["Amazon", "Walmart", "TEMU", "eBay", "TikTok", "Whatnot", "Other"];
const WHOLESALE_OPTIONS = ["HBA", "Other"];
const PAYMENT_STATUS_OPTIONS = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
] as const;
const SHIPMENT_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
] as const;
const PACKING_STATUS_OPTIONS = [
  { value: "not_packed", label: "Not Packed" },
  { value: "packing", label: "Packing" },
  { value: "packed", label: "Packed" },
] as const;

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
};

const buildSeedItemName = (product?: ProductSeed | null) => {
  if (!product) return "";
  const parts = [product.brand, product.itemName].filter(Boolean) as string[];
  const sizeOz = Number(product.sizeOz || 0);
  if (Number.isFinite(sizeOz) && sizeOz > 0) {
    parts.push(`${sizeOz} oz`);
  }
  return parts.join(" ").trim();
};

function Sales() {
  const { token, hasPermission } = useAuth();
  const location = useLocation();
  const rowIdRef = useRef(0);
  const searchTimeoutRef = useRef<number | null>(null);
  const prefillHandledRef = useRef(false);

  const nextRowId = useCallback(() => {
    rowIdRef.current += 1;
    return `sale-row-${rowIdRef.current}`;
  }, []);

  const createBlankItemRow = useCallback(
    (seed?: ProductSeed | null): SaleItemFormRow => ({
      clientId: nextRowId(),
      sku: seed?.sku || "",
      itemName: buildSeedItemName(seed),
      quantity: seed?.sku ? "1" : "",
      unitSoldPrice: "",
      lookupText: seed?.sku || "",
    }),
    [nextRowId]
  );

  const createDefaultForm = useCallback(
    (seed?: ProductSeed | null): SaleFormState => ({
      id: null,
      receiptNumber: "Will be generated on save",
      saleDate: dayjs(),
      saleCategory: "customer_sale",
      customerName: "",
      marketplaceName: "Amazon",
      marketplaceOther: "",
      wholesaleName: "HBA",
      wholesaleOther: "",
      otherCategoryLabel: "",
      paymentStatus: "unpaid",
      shipmentStatus: "pending",
      packingStatus: "not_packed",
      notes: "",
      status: "draft",
      finalizedAt: null,
      voidedAt: null,
      voidReason: "",
      updatedAt: null,
      invoiceAttachmentAvailable: false,
      invoiceAttachmentOriginalName: null,
      invoiceAttachmentMimeType: null,
      invoiceAttachmentUploadedAt: null,
      invoiceAttachmentUploaderDisplay: null,
      items: [createBlankItemRow(seed)],
    }),
    [createBlankItemRow]
  );

  const normalizeSaleToForm = useCallback(
    (sale: SaleRecord): SaleFormState => ({
      id: sale.id,
      receiptNumber: sale.receiptNumber,
      saleDate: sale.saleDate ? dayjs(sale.saleDate) : dayjs(),
      saleCategory: sale.saleCategory,
      customerName: sale.customerName || "",
      marketplaceName: sale.marketplaceName || "Amazon",
      marketplaceOther: sale.marketplaceOther || "",
      wholesaleName: sale.wholesaleName || "HBA",
      wholesaleOther: sale.wholesaleOther || "",
      otherCategoryLabel: sale.otherCategoryLabel || "",
      paymentStatus: sale.paymentStatus,
      shipmentStatus: sale.shipmentStatus,
      packingStatus: sale.packingStatus,
      notes: sale.notes || "",
      status: sale.status,
      finalizedAt: sale.finalizedAt || null,
      voidedAt: sale.voidedAt || null,
      voidReason: sale.voidReason || "",
      updatedAt: sale.updatedAt || null,
      invoiceAttachmentAvailable: Boolean(sale.invoiceAttachmentAvailable),
      invoiceAttachmentOriginalName: sale.invoiceAttachmentOriginalName || null,
      invoiceAttachmentMimeType: sale.invoiceAttachmentMimeType || null,
      invoiceAttachmentUploadedAt: sale.invoiceAttachmentUploadedAt || null,
      invoiceAttachmentUploaderDisplay: sale.invoiceAttachmentUploaderDisplay || null,
      items:
        sale.items.length > 0
          ? sale.items.map((item) => ({
              clientId: nextRowId(),
              id: item.id,
              sku: item.sku,
              itemName: item.itemName,
              quantity: String(item.quantity),
              unitSoldPrice: item.unitSoldPrice === null ? "" : String(item.unitSoldPrice),
              lookupText: item.sku,
            }))
          : [createBlankItemRow()],
    }),
    [createBlankItemRow, nextRowId]
  );

  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [form, setForm] = useState<SaleFormState>(() => createDefaultForm());
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReasonDraft, setVoidReasonDraft] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [removingAttachment, setRemovingAttachment] = useState(false);
  const [filters, setFilters] = useState({ search: "", status: "", category: "" });
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [activeLookupRowId, setActiveLookupRowId] = useState<string | null>(null);

  const canCreate = hasPermission("sales", "create");
  const canEdit = hasPermission("sales", "edit");
  const canDelete = hasPermission("sales", "delete");
  const canSaveCurrent = form.id ? canEdit : canCreate;
  const attachmentInputId = "sales-invoice-attachment-input";

  const loadSales = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await axios.get(getApiUrl("sales"), {
        params: {
          search: filters.search || undefined,
          status: filters.status || undefined,
          category: filters.category || undefined,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      setSales(response.data || []);
    } catch (error: any) {
      console.error("Failed to load sales tracker records:", error);
      toast.error(error?.response?.data?.error || "Failed to load sales tracker records.");
    } finally {
      setLoading(false);
    }
  }, [filters.category, filters.search, filters.status, token]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  useEffect(() => {
    const stateProduct = (location.state as { productObject?: ProductSeed } | null)?.productObject;
    if (!stateProduct?.sku || prefillHandledRef.current || !canCreate) {
      return;
    }
    prefillHandledRef.current = true;
    setSelectedSaleId(null);
    setForm(createDefaultForm(stateProduct));
    setDialogOpen(true);
  }, [canCreate, createDefaultForm, location.state]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleOpenCreate = () => {
    setSelectedSaleId(null);
    setForm(createDefaultForm());
    setDialogOpen(true);
    setProductOptions([]);
    setActiveLookupRowId(null);
  };

  const handleOpenSale = async (saleId: number) => {
    if (!token) return;
    try {
      const response = await axios.get(getApiUrl(`sales/${saleId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedSaleId(saleId);
      setForm(normalizeSaleToForm(response.data));
      setDialogOpen(true);
      setProductOptions([]);
      setActiveLookupRowId(null);
    } catch (error: any) {
      console.error("Failed to load sales record:", error);
      toast.error(error?.response?.data?.error || "Failed to load sales record.");
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setVoidDialogOpen(false);
    setSelectedSaleId(null);
    setForm(createDefaultForm());
    setVoidReasonDraft("");
    setProductOptions([]);
    setActiveLookupRowId(null);
  };

  const updateForm = <K extends keyof SaleFormState>(key: K, value: SaleFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateLineItem = (clientId: string, patch: Partial<SaleItemFormRow>) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.clientId === clientId ? { ...item, ...patch } : item)),
    }));
  };

  const addLineItem = () => {
    setForm((current) => ({
      ...current,
      items: [...current.items, createBlankItemRow()],
    }));
  };

  const removeLineItem = (clientId: string) => {
    setForm((current) => {
      const remaining = current.items.filter((item) => item.clientId !== clientId);
      return {
        ...current,
        items: remaining.length > 0 ? remaining : [createBlankItemRow()],
      };
    });
  };

  const searchProducts = useCallback(
    (rowId: string, query: string) => {
      if (!token) return;
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        setProductOptions([]);
        setActiveLookupRowId(rowId);
        return;
      }
      searchTimeoutRef.current = window.setTimeout(async () => {
        setProductSearchLoading(true);
        setActiveLookupRowId(rowId);
        try {
          const response = await axios.get(getApiUrl("sales/product-search"), {
            params: { query: trimmed },
            headers: { Authorization: `Bearer ${token}` },
          });
          setProductOptions(response.data || []);
        } catch (error) {
          console.error("Failed to search products for sales:", error);
          setProductOptions([]);
        } finally {
          setProductSearchLoading(false);
        }
      }, 250);
    },
    [token]
  );

  const lookupProduct = async (clientId: string, rawSku: string) => {
    if (!token) return;
    const sku = rawSku.trim();
    if (!sku) {
      updateLineItem(clientId, { itemName: "", sku: "", lookupText: "" });
      return;
    }
    try {
      const response = await axios.get(getApiUrl("sales/lookup-product"), {
        params: { sku },
        headers: { Authorization: `Bearer ${token}` },
      });
      updateLineItem(clientId, {
        sku: response.data.sku,
        itemName: response.data.itemName,
        lookupText: response.data.sku,
      });
    } catch (error: any) {
      updateLineItem(clientId, { itemName: "", sku, lookupText: sku });
      if (error?.response?.status === 404) {
        toast.error(`SKU not found: ${sku}`);
      }
    }
  };

  const buildPayload = () => ({
    saleDate: form.saleDate ? form.saleDate.format("YYYY-MM-DD") : "",
    saleCategory: form.saleCategory,
    customerName: form.customerName,
    marketplaceName: form.marketplaceName,
    marketplaceOther: form.marketplaceOther,
    wholesaleName: form.wholesaleName,
    wholesaleOther: form.wholesaleOther,
    otherCategoryLabel: form.otherCategoryLabel,
    paymentStatus: form.paymentStatus,
    shipmentStatus: form.shipmentStatus,
    packingStatus: form.packingStatus,
    notes: form.notes,
    expectedUpdatedAt: form.updatedAt,
    items: form.items.map((item) => ({
      sku: item.sku.trim(),
      itemName: item.itemName,
      quantity: item.quantity,
      unitSoldPrice: item.unitSoldPrice,
    })),
  });

  const persistSale = async (finalizeAfterSave = false) => {
    if (!token) return;
    const busySetter = finalizeAfterSave ? setFinalizing : setSaving;
    busySetter(true);
    try {
      const payload = buildPayload();
      let response;
      if (form.id) {
        response = await axios.put(getApiUrl(`sales/${form.id}`), payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        response = await axios.post(getApiUrl("sales"), payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      let sale: SaleRecord = response.data;
      if (finalizeAfterSave) {
        const finalized = await axios.post(
          getApiUrl(`sales/${sale.id}/finalize`),
          { expectedUpdatedAt: sale.updatedAt },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        sale = finalized.data;
        invalidateProductsCache();
      }

      setForm(normalizeSaleToForm(sale));
      setSelectedSaleId(sale.id);
      await loadSales();
      toast.success(finalizeAfterSave ? "Sale finalized successfully." : "Sale saved successfully.");
    } catch (error: any) {
      console.error("Failed to save sale:", error);
      toast.error(error?.response?.data?.error || "Failed to save sale.");
    } finally {
      busySetter(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!token || !form.id) return;
    if (!window.confirm("Delete this draft sale?")) return;
    setDeleting(true);
    try {
      await axios.delete(getApiUrl(`sales/${form.id}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadSales();
      toast.success("Draft sale deleted.");
      closeDialog();
    } catch (error: any) {
      console.error("Failed to delete sale draft:", error);
      toast.error(error?.response?.data?.error || "Failed to delete draft sale.");
    } finally {
      setDeleting(false);
    }
  };

  const handleVoidSale = async () => {
    if (!token || !form.id) return;
    setVoiding(true);
    try {
      const response = await axios.post(
        getApiUrl(`sales/${form.id}/void`),
        {
          voidReason: voidReasonDraft,
          expectedUpdatedAt: form.updatedAt,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      invalidateProductsCache();
      setForm(normalizeSaleToForm(response.data));
      await loadSales();
      setVoidDialogOpen(false);
      setVoidReasonDraft("");
      toast.success("Sale voided and stock restored.");
    } catch (error: any) {
      console.error("Failed to void sale:", error);
      toast.error(error?.response?.data?.error || "Failed to void sale.");
    } finally {
      setVoiding(false);
    }
  };

  const handleOpenAttachment = async () => {
    if (!token || !form.id || !form.invoiceAttachmentAvailable) return;
    try {
      const response = await axios.get(getApiUrl(`sales/${form.id}/invoice-attachment`), {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const mimeType =
        response.headers["content-type"] || form.invoiceAttachmentMimeType || "application/octet-stream";
      const file = new Blob([response.data], { type: mimeType });
      const objectUrl = window.URL.createObjectURL(file);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60000);
    } catch (error: any) {
      console.error("Failed to open invoice attachment:", error);
      toast.error(error?.response?.data?.error || "Failed to open invoice attachment.");
    }
  };

  const handleUploadAttachment = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !token || !form.id) return;

    const formData = new FormData();
    formData.append("file", file);
    setUploadingAttachment(true);
    try {
      const response = await axios.post(getApiUrl(`sales/${form.id}/invoice-attachment`), formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setForm(normalizeSaleToForm(response.data));
      await loadSales();
      toast.success("Invoice attachment uploaded.");
    } catch (error: any) {
      console.error("Failed to upload invoice attachment:", error);
      toast.error(error?.response?.data?.error || "Failed to upload invoice attachment.");
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleRemoveAttachment = async () => {
    if (!token || !form.id || !form.invoiceAttachmentAvailable) return;
    setRemovingAttachment(true);
    try {
      const response = await axios.delete(getApiUrl(`sales/${form.id}/invoice-attachment`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setForm(normalizeSaleToForm(response.data));
      await loadSales();
      toast.success("Invoice attachment removed.");
    } catch (error: any) {
      console.error("Failed to remove invoice attachment:", error);
      toast.error(error?.response?.data?.error || "Failed to remove invoice attachment.");
    } finally {
      setRemovingAttachment(false);
    }
  };

  const salesSummary = useMemo(() => {
    const draft = sales.filter((sale) => sale.status === "draft").length;
    const finalized = sales.filter((sale) => sale.status === "finalized").length;
    const voided = sales.filter((sale) => sale.status === "voided").length;
    const units = sales.reduce((sum, sale) => sum + Number(sale.totalUnits || 0), 0);
    return { draft, finalized, voided, total: sales.length, units };
  }, [sales]);

  const lineItemsEditable = form.status === "draft";
  const saleEditable = form.status !== "voided";
  const subtotal = useMemo(() => {
    return form.items.reduce((sum, item) => {
      const quantity = Number(item.quantity || 0);
      const price = Number(item.unitSoldPrice || 0);
      if (!quantity || !item.unitSoldPrice) return sum;
      return sum + quantity * price;
    }, 0);
  }, [form.items]);
  const totalUnits = useMemo(
    () => form.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [form.items]
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Sales Tracker
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Create sales receipts, deduct stock only on finalize, and restore stock with void when needed.
            </Typography>
          </Box>
          {canCreate && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
              New Sale
            </Button>
          )}
        </Stack>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">Total Records</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{salesSummary.total}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">Draft</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{salesSummary.draft}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">Finalized</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{salesSummary.finalized}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">Units Logged</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{salesSummary.units}</Typography>
            </Paper>
          </Grid>
        </Grid>

        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                label="Search receipt or buyer/channel"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                label="Status"
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="finalized">Finalized</MenuItem>
                <MenuItem value="voided">Voided</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                label="Category"
                value={filters.category}
                onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
              >
                <MenuItem value="">All</MenuItem>
                {SALE_CATEGORY_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={1}>
              <Button fullWidth variant="outlined" startIcon={<RefreshIcon />} onClick={loadSales}>
                Refresh
              </Button>
            </Grid>
          </Grid>
        </Paper>

        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Receipt</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Tracking</TableCell>
                  <TableCell>Units</TableCell>
                  <TableCell>Subtotal</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ py: 3 }}>
                        <CircularProgress size={20} />
                        <Typography variant="body2">Loading sales records...</Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : sales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                        No sales records found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  sales.map((sale) => (
                    <TableRow key={sale.id} hover>
                      <TableCell>{sale.receiptNumber}</TableCell>
                      <TableCell>{sale.saleDate}</TableCell>
                      <TableCell>{sale.categoryLabel}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={sale.status}
                          color={sale.status === "finalized" ? "success" : sale.status === "voided" ? "default" : "warning"}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap">
                          <Chip size="small" variant="outlined" label={`Pay: ${sale.paymentStatus}`} />
                          <Chip size="small" variant="outlined" label={`Ship: ${sale.shipmentStatus}`} />
                          <Chip size="small" variant="outlined" label={`Pack: ${sale.packingStatus}`} />
                        </Stack>
                      </TableCell>
                      <TableCell>{sale.totalUnits}</TableCell>
                      <TableCell>{formatCurrency(sale.pricedSubtotal)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Open sale">
                          <IconButton onClick={() => handleOpenSale(sale.id)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="lg" fullWidth>
          <DialogTitle>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between">
              <Box>
                <Typography variant="h6">
                  {form.id ? `Sales Receipt ${form.receiptNumber}` : "Create Sales Receipt"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Draft sales are editable. Finalizing deducts stock. Voiding restores the deducted quantities.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={form.status} color={form.status === "finalized" ? "success" : form.status === "voided" ? "default" : "warning"} />
              </Stack>
            </Stack>
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Receipt Number" value={form.receiptNumber} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <DatePicker
                  label="Sale Date"
                  value={form.saleDate}
                  onChange={(value) => updateForm("saleDate", value)}
                  disabled={!saleEditable}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  fullWidth
                  label="Category"
                  value={form.saleCategory}
                  disabled={!saleEditable}
                  onChange={(event) => updateForm("saleCategory", event.target.value as SaleCategory)}
                >
                  {SALE_CATEGORY_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  fullWidth
                  label="Payment Status"
                  value={form.paymentStatus}
                  disabled={!saleEditable}
                  onChange={(event) => updateForm("paymentStatus", event.target.value as PaymentStatus)}
                >
                  {PAYMENT_STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  fullWidth
                  label="Shipment Status"
                  value={form.shipmentStatus}
                  disabled={!saleEditable}
                  onChange={(event) => updateForm("shipmentStatus", event.target.value as ShipmentStatus)}
                >
                  {SHIPMENT_STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  fullWidth
                  label="Packing Status"
                  value={form.packingStatus}
                  disabled={!saleEditable}
                  onChange={(event) => updateForm("packingStatus", event.target.value as PackingStatus)}
                >
                  {PACKING_STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            {form.saleCategory === "customer_sale" && (
              <TextField
                fullWidth
                sx={{ mb: 2 }}
                label="Customer Name"
                value={form.customerName}
                disabled={!saleEditable}
                onChange={(event) => updateForm("customerName", event.target.value)}
              />
            )}

            {form.saleCategory === "marketplace" && (
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={6}>
                  <TextField
                    select
                    fullWidth
                    label="Marketplace"
                    value={form.marketplaceName}
                    disabled={!saleEditable}
                    onChange={(event) => updateForm("marketplaceName", event.target.value)}
                  >
                    {MARKETPLACE_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                {form.marketplaceName === "Other" && (
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Marketplace Name"
                      value={form.marketplaceOther}
                      disabled={!saleEditable}
                      onChange={(event) => updateForm("marketplaceOther", event.target.value)}
                    />
                  </Grid>
                )}
              </Grid>
            )}

            {form.saleCategory === "wholesale" && (
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={6}>
                  <TextField
                    select
                    fullWidth
                    label="Wholesale Channel"
                    value={form.wholesaleName}
                    disabled={!saleEditable}
                    onChange={(event) => updateForm("wholesaleName", event.target.value)}
                  >
                    {WHOLESALE_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                {form.wholesaleName === "Other" && (
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Wholesale Name"
                      value={form.wholesaleOther}
                      disabled={!saleEditable}
                      onChange={(event) => updateForm("wholesaleOther", event.target.value)}
                    />
                  </Grid>
                )}
              </Grid>
            )}

            {form.saleCategory === "other" && (
              <TextField
                fullWidth
                sx={{ mb: 2 }}
                label="Specify Category"
                value={form.otherCategoryLabel}
                disabled={!saleEditable}
                onChange={(event) => updateForm("otherCategoryLabel", event.target.value)}
              />
            )}

            {form.status === "finalized" && (
              <Alert severity="info" sx={{ mb: 2 }}>
                This sale is finalized. We can still update the tracking statuses and notes, but line items stay locked so stock stays accurate.
              </Alert>
            )}
            {form.status === "voided" && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                This sale has been voided. Stock was restored and the record is now read-only.
              </Alert>
            )}

            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6">Sale Items</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Sold price is optional. Finalizing will deduct quantities even if sold price is blank.
                  </Typography>
                </Box>
                {lineItemsEditable && (
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={addLineItem}>
                    Add Item Row
                  </Button>
                )}
              </Stack>

              <Stack spacing={2}>
                {form.items.map((item) => (
                  <Grid container spacing={2} key={item.clientId} alignItems="center">
                    <Grid item xs={12} md={4}>
                      <Autocomplete
                        freeSolo
                        options={activeLookupRowId === item.clientId ? productOptions : []}
                        loading={activeLookupRowId === item.clientId && productSearchLoading}
                        getOptionLabel={(option) =>
                          typeof option === "string" ? option : `${option.sku} - ${option.itemName}`
                        }
                        value={null}
                        inputValue={item.lookupText}
                        disabled={!lineItemsEditable}
                        onInputChange={(_, value, reason) => {
                          if (reason === "reset") return;
                          updateLineItem(item.clientId, { lookupText: value, sku: value });
                          searchProducts(item.clientId, value);
                        }}
                        onChange={(_, value) => {
                          if (value && typeof value !== "string") {
                            updateLineItem(item.clientId, {
                              sku: value.sku,
                              itemName: value.itemName,
                              lookupText: value.sku,
                            });
                          }
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="SKU"
                            onBlur={() => lookupProduct(item.clientId, item.lookupText || item.sku)}
                            helperText={item.itemName || "Type SKU, alternate SKU, UPC, or name"}
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {activeLookupRowId === item.clientId && productSearchLoading ? (
                                    <CircularProgress color="inherit" size={18} />
                                  ) : null}
                                  {params.InputProps.endAdornment}
                                </>
                              ),
                            }}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField fullWidth label="Item Name" value={item.itemName} InputProps={{ readOnly: true }} />
                    </Grid>
                    <Grid item xs={12} md={1.5}>
                      <TextField
                        fullWidth
                        label="Qty"
                        value={item.quantity}
                        disabled={!lineItemsEditable}
                        onChange={(event) => updateLineItem(item.clientId, { quantity: event.target.value.replace(/[^0-9]/g, "") })}
                      />
                    </Grid>
                    <Grid item xs={12} md={1.5}>
                      <TextField
                        fullWidth
                        label="Sold Price"
                        value={item.unitSoldPrice}
                        disabled={!lineItemsEditable}
                        onChange={(event) => updateLineItem(item.clientId, { unitSoldPrice: event.target.value.replace(/[^0-9.]/g, "") })}
                      />
                    </Grid>
                    <Grid item xs={12} md={1.5}>
                      <TextField
                        fullWidth
                        label="Line Total"
                        value={
                          item.quantity && item.unitSoldPrice
                            ? formatCurrency(Number(item.quantity) * Number(item.unitSoldPrice))
                            : "-"
                        }
                        InputProps={{ readOnly: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={0.5}>
                      <Tooltip title="Delete row">
                        <span>
                          <IconButton disabled={!lineItemsEditable} onClick={() => removeLineItem(item.clientId)}>
                            <DeleteIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Grid>
                  </Grid>
                ))}
              </Stack>
            </Paper>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">Items</Typography>
                  <Typography variant="h6">{form.items.filter((item) => item.sku.trim()).length}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">Units</Typography>
                  <Typography variant="h6">{totalUnits}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">Priced Subtotal</Typography>
                  <Typography variant="h6">{formatCurrency(subtotal)}</Typography>
                </Paper>
              </Grid>
            </Grid>

            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Notes"
              value={form.notes}
              disabled={!saleEditable}
              onChange={(event) => updateForm("notes", event.target.value)}
            />

            <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
              >
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Invoice Attachment
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Optionally attach a PDF or image of the invoice to this sale.
                  </Typography>
                  {!form.id && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Save the sale first, then upload the invoice file.
                    </Typography>
                  )}
                  {form.invoiceAttachmentAvailable && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {form.invoiceAttachmentOriginalName || "Attached file"}
                    </Typography>
                  )}
                  {form.invoiceAttachmentUploadedAt && (
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                      Uploaded {dayjs(form.invoiceAttachmentUploadedAt).format("MM/DD/YYYY h:mm A")}
                      {form.invoiceAttachmentUploaderDisplay ? ` by ${form.invoiceAttachmentUploaderDisplay}` : ""}
                    </Typography>
                  )}
                </Box>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <input
                    id={attachmentInputId}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                    style={{ display: "none" }}
                    onChange={handleUploadAttachment}
                    disabled={!form.id || !saleEditable || !canEdit || uploadingAttachment}
                  />
                  {saleEditable && canEdit && (
                    <Button
                      variant="outlined"
                      component="label"
                      htmlFor={attachmentInputId}
                      disabled={!form.id || uploadingAttachment}
                    >
                      {uploadingAttachment
                        ? "Uploading..."
                        : form.invoiceAttachmentAvailable
                        ? "Replace Attachment"
                        : "Upload Attachment"}
                    </Button>
                  )}
                  {form.invoiceAttachmentAvailable && (
                    <Button variant="outlined" onClick={handleOpenAttachment}>
                      Open File
                    </Button>
                  )}
                  {saleEditable && canEdit && form.invoiceAttachmentAvailable && (
                    <Button
                      color="error"
                      variant="outlined"
                      onClick={handleRemoveAttachment}
                      disabled={removingAttachment}
                    >
                      {removingAttachment ? "Removing..." : "Remove File"}
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>

            {form.finalizedAt && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Finalized at {dayjs(form.finalizedAt).format("MM/DD/YYYY h:mm A")}
              </Typography>
            )}
            {form.voidedAt && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Voided at {dayjs(form.voidedAt).format("MM/DD/YYYY h:mm A")}
              </Typography>
            )}
            {form.voidReason && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Void reason: {form.voidReason}
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={closeDialog}>Close</Button>
            {form.status === "draft" && form.id && canDelete && (
              <Button color="error" startIcon={<DeleteIcon />} onClick={handleDeleteDraft} disabled={deleting || saving || finalizing}>
                Delete Draft
              </Button>
            )}
            {form.status === "finalized" && canEdit && (
              <Button color="warning" startIcon={<BlockIcon />} onClick={() => setVoidDialogOpen(true)}>
                Void Sale
              </Button>
            )}
            {saleEditable && canSaveCurrent && (
              <Button variant="outlined" startIcon={<SaveIcon />} onClick={() => persistSale(false)} disabled={saving || finalizing}>
                {saving ? "Saving..." : form.id ? "Save Changes" : "Save Draft"}
              </Button>
            )}
            {form.status === "draft" && canEdit && (
              <Button variant="contained" startIcon={<DoneAllIcon />} onClick={() => persistSale(true)} disabled={saving || finalizing}>
                {finalizing ? "Finalizing..." : "Finalize Sale"}
              </Button>
            )}
          </DialogActions>
        </Dialog>

        <Dialog open={voidDialogOpen} onClose={() => setVoidDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Void Sale</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Voiding will restore the sold quantities back into inventory. You can leave a short note explaining why.
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Void Reason"
              value={voidReasonDraft}
              onChange={(event) => setVoidReasonDraft(event.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setVoidDialogOpen(false)}>Cancel</Button>
            <Button color="warning" variant="contained" onClick={handleVoidSale} disabled={voiding}>
              {voiding ? "Voiding..." : "Void and Restore Stock"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}

export default Sales;

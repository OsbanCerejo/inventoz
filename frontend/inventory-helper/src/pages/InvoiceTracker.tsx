import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  Add as AddIcon,
  Close as CloseIcon,
  RestoreFromTrash as RestoreIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Inventory2 as InventoryIcon,
  Email as EmailIcon,
  Upload as UploadIcon,
} from "@mui/icons-material";
import {
  Autocomplete,
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
  vendorId?: number | null;
  vendorName: string;
  invoiceNumber: string;
  orderDate: string;
  shipmentStatus: string;
  trackingInfo?: string | null;
  itemCheckStatus: string;
  inboundStatus: string;
  paymentStatus: string;
  paymentDueBy?: string | null;
  paymentDate?: string | null;
  paymentProofImageAvailable?: boolean;
  paymentProofOriginalName?: string | null;
  paymentProofUploadedAt?: string | null;
  paymentProofUploaderDisplay?: string | null;
  receivedDate?: string | null;
  miscellaneousAmount?: number;
  shippingAmount?: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
  inboundCompletedAt?: string | null;
  inboundCompletedBy?: number | null;
  inboundCompleterDisplay?: string | null;
  totalAmount: number;
  itemCount: number;
  items: InvoiceItem[];
  inboundRows?: InboundRow[];
  inboundSummary?: InboundSummary;
  creator?: UserMini | null;
  updater?: UserMini | null;
};

type VendorOption = {
  id: number;
  name: string;
  normalizedName?: string;
};

type InboundRow = {
  id: number;
  sku: string;
  itemName: string;
  unitPrice: number;
  expectedQty: number;
  actualQty: number | null;
  deltaQty: number | null;
  resolutionStatus: "pending" | "resolved" | "inbounded";
  resolutionType?: "match" | "mismatch" | null;
  mismatchReason?: string | null;
  inboundedQty?: number | null;
  inboundCompositeSku?: string | null;
  resolvedAt?: string | null;
  inboundedAt?: string | null;
};

type InboundSummary = {
  totalRows: number;
  pendingRows: number;
  resolvedRows: number;
  inboundedRows: number;
  mismatchRows: number;
  totalExpectedQty: number;
  totalResolvedQty: number;
  totalInboundedQty: number;
};

type InboundReviewResponse = {
  invoice: Invoice;
  rows: InboundRow[];
  summary: InboundSummary;
  message?: string;
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
  { value: "partial", label: "Partial" },
  { value: "done", label: "Done" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Unpaid" },
  { value: "credit", label: "Credit" },
];

const MISMATCH_REASON_OPTIONS = [
  { value: "short_shipped", label: "Short Shipped" },
  { value: "damaged", label: "Damaged" },
  { value: "backordered", label: "Backordered" },
  { value: "not_in_carton", label: "Not In Carton" },
  { value: "counting_error", label: "Counting Error" },
  { value: "overage", label: "Overage" },
];

const emptyForm = {
  id: null as number | null,
  updatedAt: "",
  isArchived: false,
  vendorId: null as number | null,
  vendorName: "",
  invoiceNumber: "",
  orderDate: new Date().toISOString().slice(0, 10),
  shipmentStatus: "order_placed",
  trackingInfo: "",
  itemCheckStatus: "not_checked",
  inboundStatus: "pending",
  paymentStatus: "unpaid",
  paymentDueBy: "",
  paymentDate: "",
  paymentProofImageAvailable: false,
  paymentProofOriginalName: "",
  paymentProofUploadedAt: "",
  paymentProofUploaderDisplay: "",
  receivedDate: "",
  miscellaneousAmount: 0,
  shippingAmount: 0,
  notes: "",
  inboundCompletedAt: "",
  inboundCompletedBy: null,
  inboundCompleterDisplay: "",
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
  const [savedFormSnapshot, setSavedFormSnapshot] = useState("");
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);
  const [vendorInputValue, setVendorInputValue] = useState("");
  const [addVendorDialogOpen, setAddVendorDialogOpen] = useState(false);
  const [newVendorName, setNewVendorName] = useState("");
  const [creatingVendor, setCreatingVendor] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [uploadingPaymentProof, setUploadingPaymentProof] = useState(false);
  const [removingPaymentProof, setRemovingPaymentProof] = useState(false);
  const [paymentProofPreviewUrl, setPaymentProofPreviewUrl] = useState("");
  const [paymentProofDialogOpen, setPaymentProofDialogOpen] = useState(false);
  const [skuLookupLoading, setSkuLookupLoading] = useState<Record<number, boolean>>({});
  const [inboundDialogOpen, setInboundDialogOpen] = useState(false);
  const [startInboundConfirmOpen, setStartInboundConfirmOpen] = useState(false);
  const [inboundLoading, setInboundLoading] = useState(false);
  const [inboundSubmitting, setInboundSubmitting] = useState(false);
  const [inboundRows, setInboundRows] = useState<InboundRow[]>([]);
  const [inboundSummary, setInboundSummary] = useState<InboundSummary | null>(null);
  const [selectedInboundRowIds, setSelectedInboundRowIds] = useState<number[]>([]);

  const canCreate = hasPermission("invoiceTracker", "create");
  const canEdit = hasPermission("invoiceTracker", "edit");
  const canDelete = hasPermission("invoiceTracker", "delete");
  const isReadOnly = dialogMode === "view";
  const isPaymentOnlyEdit = dialogMode === "edit" && form.inboundStatus !== "pending";
  const disableNonPaymentEdits = isReadOnly || isPaymentOnlyEdit;

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

  const buildFormSnapshot = (target: typeof emptyForm) =>
    JSON.stringify({
      id: target.id,
      vendorId: target.vendorId,
      vendorName: target.vendorName,
      invoiceNumber: target.invoiceNumber,
      orderDate: target.orderDate,
      shipmentStatus: target.shipmentStatus,
      trackingInfo: target.trackingInfo,
      itemCheckStatus: target.itemCheckStatus,
      inboundStatus: target.inboundStatus,
      paymentStatus: target.paymentStatus,
      paymentDueBy: target.paymentDueBy,
      paymentDate: target.paymentDate,
      paymentProofImageAvailable: target.paymentProofImageAvailable,
      paymentProofOriginalName: target.paymentProofOriginalName,
      paymentProofUploadedAt: target.paymentProofUploadedAt,
      paymentProofUploaderDisplay: target.paymentProofUploaderDisplay,
      receivedDate: target.receivedDate,
      miscellaneousAmount: Number(target.miscellaneousAmount || 0),
      shippingAmount: Number(target.shippingAmount || 0),
      notes: target.notes,
      items: target.items.map((item) => ({
        sku: item.sku,
        itemName: item.itemName,
        unitPrice: Number(item.unitPrice || 0),
        quantity: Number(item.quantity || 0),
      })),
    });

  const hasUnsavedChanges = useMemo(
    () => buildFormSnapshot(form) !== savedFormSnapshot,
    [form, savedFormSnapshot]
  );

  const metrics = useMemo(() => {
    const totalAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0);
    const dueInvoices = invoices.filter((invoice) => invoice.paymentStatus === "credit").length;
    const receivedInvoices = invoices.filter((invoice) => invoice.shipmentStatus === "received").length;
    const pendingInbound = invoices.filter((invoice) => invoice.inboundStatus !== "done").length;

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

  const loadVendorOptions = async () => {
    if (!token) return;
    try {
      const response = await axios.get<VendorOption[]>(getApiUrl("invoice-tracker/vendors"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setVendorOptions(
        [...(response.data || [])]
          .filter((row) => row?.id && String(row?.name || "").trim())
          .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      );
    } catch (error) {
      console.error("Failed to load vendor options:", error);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [token, dateFrom, dateTo, shipmentStatusFilter, itemCheckStatusFilter, inboundStatusFilter, paymentStatusFilter, showArchived]);

  useEffect(() => {
    loadVendorOptions();
  }, [token]);

  useEffect(() => {
    return () => {
      if (paymentProofPreviewUrl) {
        window.URL.revokeObjectURL(paymentProofPreviewUrl);
      }
    };
  }, []);

  useEffect(() => {
    const loadPaymentProofPreview = async () => {
      if (!token || !dialogOpen || !form.id || !form.paymentProofImageAvailable) {
        setPaymentProofPreviewUrl((prev) => {
          if (prev) {
            window.URL.revokeObjectURL(prev);
          }
          return "";
        });
        return;
      }

      try {
        const response = await axios.get(getApiUrl(`invoice-tracker/${form.id}/payment-proof`), {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        });
        const nextUrl = window.URL.createObjectURL(response.data);
        setPaymentProofPreviewUrl((prev) => {
          if (prev) {
            window.URL.revokeObjectURL(prev);
          }
          return nextUrl;
        });
      } catch (error) {
        console.error("Failed to load payment proof preview:", error);
        setPaymentProofPreviewUrl((prev) => {
          if (prev) {
            window.URL.revokeObjectURL(prev);
          }
          return "";
        });
      }
    };

    loadPaymentProofPreview();
  }, [dialogOpen, form.id, form.paymentProofImageAvailable, token]);

  const normalizeInvoiceToForm = (detail: Invoice) => ({
    id: detail.id,
    updatedAt: detail.updatedAt,
    isArchived: !!detail.isArchived,
    vendorId: detail.vendorId || null,
    vendorName: detail.vendorName,
    invoiceNumber: detail.invoiceNumber,
    orderDate: detail.orderDate,
    shipmentStatus: detail.shipmentStatus,
    trackingInfo: detail.trackingInfo || "",
    itemCheckStatus: detail.itemCheckStatus,
    inboundStatus: detail.inboundStatus,
    paymentStatus: detail.paymentStatus,
    paymentDueBy: detail.paymentDueBy || "",
    paymentDate: detail.paymentDate || "",
    paymentProofImageAvailable: !!detail.paymentProofImageAvailable,
    paymentProofOriginalName: detail.paymentProofOriginalName || "",
    paymentProofUploadedAt: detail.paymentProofUploadedAt || "",
    paymentProofUploaderDisplay: detail.paymentProofUploaderDisplay || "",
    receivedDate: detail.receivedDate || "",
    inboundCompletedAt: detail.inboundCompletedAt || "",
    inboundCompletedBy: detail.inboundCompletedBy || null,
    inboundCompleterDisplay: detail.inboundCompleterDisplay || "",
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
        : [],
  });

  const openCreateDialog = () => {
    setDialogMode("create");
    setForm(emptyForm);
    setVendorInputValue("");
    setNewVendorName("");
    setSavedFormSnapshot(buildFormSnapshot(emptyForm));
    setDialogOpen(true);
  };

  const openInvoiceDialog = async (invoiceId: number) => {
    const detail = await loadInvoiceDetail(invoiceId);
    if (!detail) return;

    setSelectedInvoiceId(invoiceId);
    setDialogMode(canEdit ? "edit" : "view");
    const normalizedForm = normalizeInvoiceToForm(detail);
    setForm(normalizedForm);
    setVendorInputValue(detail.vendorName || "");
    setNewVendorName("");
    setSavedFormSnapshot(buildFormSnapshot(normalizedForm));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setDialogMode("create");
    setForm(emptyForm);
    setVendorInputValue("");
    setNewVendorName("");
    setAddVendorDialogOpen(false);
    setSavedFormSnapshot(buildFormSnapshot(emptyForm));
    if (paymentProofPreviewUrl) {
      window.URL.revokeObjectURL(paymentProofPreviewUrl);
    }
    setPaymentProofPreviewUrl("");
    setPaymentProofDialogOpen(false);
    setInboundDialogOpen(false);
    setInboundRows([]);
    setInboundSummary(null);
    setSelectedInboundRowIds([]);
  };

  const applyInboundReviewPayload = (payload: InboundReviewResponse) => {
    setInboundRows(payload.rows || []);
    setInboundSummary(payload.summary || null);
    setSelectedInboundRowIds((prev) =>
      prev.filter((rowId) => (payload.rows || []).some((row) => row.id === rowId && row.resolutionStatus === "resolved"))
    );
    if (payload.invoice) {
      setForm((prev) => ({
        ...prev,
        id: payload.invoice.id,
        updatedAt: payload.invoice.updatedAt,
        inboundStatus: payload.invoice.inboundStatus,
        inboundCompletedAt: payload.invoice.inboundCompletedAt || "",
        inboundCompletedBy: payload.invoice.inboundCompletedBy || null,
        inboundCompleterDisplay: payload.invoice.inboundCompleterDisplay || "",
      }));
    }
  };

  const openInboundDialog = async () => {
    if (!token || !form.id) return;
    try {
      setInboundLoading(true);
      const response = await axios.get<InboundReviewResponse>(getApiUrl(`invoice-tracker/${form.id}/inbound-review`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      applyInboundReviewPayload(response.data);
      setInboundDialogOpen(true);
    } catch (error: any) {
      console.error("Failed to load inbound review:", error);
      toast.error(error?.response?.data?.error || "Failed to load invoice inbound review");
    } finally {
      setInboundLoading(false);
    }
  };

  const handleInboundButtonClick = () => {
    if (form.inboundStatus === "pending") {
      setStartInboundConfirmOpen(true);
      return;
    }
    openInboundDialog();
  };

  const sendPaymentReminder = async () => {
    if (!token || !form.id || !canSendPaymentReminder) return;
    try {
      setSendingReminder(true);
      const response = await axios.post(
        getApiUrl(`invoice-tracker/${form.id}/send-payment-reminder`),
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(response.data?.message || "Reminder email sent");
    } catch (error: any) {
      console.error("Failed to send payment reminder:", error);
      toast.error(error?.response?.data?.error || "Failed to send reminder email");
    } finally {
      setSendingReminder(false);
    }
  };

  const handleUploadPaymentProof = async (file?: File | null) => {
    if (!token || !form.id || !file) return;
    if (hasUnsavedChanges) {
      toast.error("Save invoice changes before uploading payment proof.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploadingPaymentProof(true);
      const response = await axios.post<Invoice>(
        getApiUrl(`invoice-tracker/${form.id}/payment-proof`),
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      const normalizedForm = normalizeInvoiceToForm(response.data);
      setForm(normalizedForm);
      setSavedFormSnapshot(buildFormSnapshot(normalizedForm));
      toast.success("Payment proof uploaded.");
    } catch (error: any) {
      console.error("Failed to upload payment proof:", error);
      toast.error(error?.response?.data?.error || "Failed to upload payment proof");
    } finally {
      setUploadingPaymentProof(false);
    }
  };

  const handleDeletePaymentProof = async () => {
    if (!token || !form.id || !form.paymentProofImageAvailable) return;
    if (hasUnsavedChanges) {
      toast.error("Save invoice changes before deleting payment proof.");
      return;
    }

    try {
      setRemovingPaymentProof(true);
      const response = await axios.delete<Invoice>(getApiUrl(`invoice-tracker/${form.id}/payment-proof`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const normalizedForm = normalizeInvoiceToForm(response.data);
      setForm(normalizedForm);
      setSavedFormSnapshot(buildFormSnapshot(normalizedForm));
      if (paymentProofPreviewUrl) {
        window.URL.revokeObjectURL(paymentProofPreviewUrl);
      }
      setPaymentProofPreviewUrl("");
      toast.success("Payment proof removed.");
    } catch (error: any) {
      console.error("Failed to delete payment proof:", error);
      toast.error(error?.response?.data?.error || "Failed to delete payment proof");
    } finally {
      setRemovingPaymentProof(false);
    }
  };

  const updateInboundRowDraft = (rowId: number, updates: Partial<InboundRow>) => {
    setInboundRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const nextActualQty =
          updates.actualQty !== undefined ? Number(updates.actualQty) : Number(row.actualQty ?? row.expectedQty);
        const nextDelta = Number.isFinite(nextActualQty) ? nextActualQty - Number(row.expectedQty || 0) : row.deltaQty;
        return {
          ...row,
          ...updates,
          actualQty: Number.isFinite(nextActualQty) ? nextActualQty : row.actualQty,
          deltaQty: nextDelta,
        };
      })
    );
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

  const selectedVendorOption = useMemo(
    () => vendorOptions.find((option) => option.id === form.vendorId) || null,
    [vendorOptions, form.vendorId]
  );

  const openAddVendorDialog = () => {
    setNewVendorName(vendorInputValue.trim() || form.vendorName.trim());
    setAddVendorDialogOpen(true);
  };

  const handleCreateVendor = async () => {
    if (!token) return;
    const name = newVendorName.trim();
    if (!name) {
      toast.error("Vendor name is required");
      return;
    }

    try {
      setCreatingVendor(true);
      const response = await axios.post<VendorOption>(
        getApiUrl("invoice-tracker/vendors"),
        { name },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const createdVendor = response.data;
      setVendorOptions((prev) =>
        [...prev.filter((option) => option.id !== createdVendor.id), createdVendor].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setForm((prev) => ({
        ...prev,
        vendorId: createdVendor.id,
        vendorName: createdVendor.name,
      }));
      setVendorInputValue(createdVendor.name);
      setAddVendorDialogOpen(false);
      setNewVendorName("");
      toast.success("Vendor added");
    } catch (error: any) {
      console.error("Failed to create vendor:", error);
      toast.error(error?.response?.data?.error || "Failed to add vendor");
    } finally {
      setCreatingVendor(false);
    }
  };

  const saveInvoice = async () => {
    if (!token) return;
    if ((!form.vendorId && !form.vendorName.trim()) || !form.invoiceNumber.trim() || !form.orderDate) {
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

    const runSave = async () => {
      const payload = {
        expectedUpdatedAt: form.id ? form.updatedAt : undefined,
        vendorId: form.vendorId,
        vendorName: form.vendorName.trim(),
        invoiceNumber: form.invoiceNumber.trim(),
        orderDate: form.orderDate,
        shipmentStatus: form.shipmentStatus,
        trackingInfo: form.trackingInfo.trim() || null,
        itemCheckStatus: form.itemCheckStatus,
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

      await loadVendorOptions();
      setSavedFormSnapshot(buildFormSnapshot(form));
      closeDialog();
      await loadInvoices();
    };

    try {
      setSaving(true);
      await runSave();
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

  const getInboundChipColor = (value: string) => {
    if (value === "done") return "success";
    if (value === "partial") return "info";
    return "warning";
  };
  const getPaymentChipColor = (value: string) => {
    if (value === "paid") return "success";
    if (value === "credit") return "info";
    return "default";
  };

  const getPaymentReminderDayOffset = (paymentStatus: string, paymentDueBy?: string | null) => {
    if (paymentStatus !== "credit" || !paymentDueBy) return null;
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dueDate = new Date(`${paymentDueBy}T00:00:00`);
    if (Number.isNaN(dueDate.getTime())) return null;
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    return Math.round((dueDate.getTime() - startOfToday.getTime()) / millisecondsPerDay);
  };

  const getPaymentReminderLabel = (paymentStatus: string, paymentDueBy?: string | null) => {
    const dayOffset = getPaymentReminderDayOffset(paymentStatus, paymentDueBy);
    if (dayOffset === null) return null;
    if (dayOffset > 1) return `Due in ${dayOffset}d`;
    if (dayOffset === 1) return "Due Tomorrow";
    if (dayOffset === 0) return "Due Today";
    return `Overdue ${Math.abs(dayOffset)}d`;
  };

  const getPaymentReminderChipColor = (paymentStatus: string, paymentDueBy?: string | null) => {
    const dayOffset = getPaymentReminderDayOffset(paymentStatus, paymentDueBy);
    if (dayOffset === null) return "default";
    if (dayOffset < 0) return "error";
    if (dayOffset <= 3) return "warning";
    return "default";
  };

  const canStartInbound =
    !!form.id &&
    form.shipmentStatus === "received" &&
    form.itemCheckStatus === "verified" &&
    !!form.receivedDate &&
    form.items.length > 0 &&
    !hasUnsavedChanges &&
    !form.isArchived;

  const wouldBeInboundEligibleAfterSave =
    form.shipmentStatus === "received" &&
    form.itemCheckStatus === "verified" &&
    !!form.receivedDate &&
    form.items.length > 0 &&
    !form.isArchived;

  const canSendPaymentReminder =
    !!form.id &&
    !form.isArchived &&
    form.paymentStatus === "credit" &&
    !!form.paymentDueBy;

  const canSelectInboundRow = (row: InboundRow) => row.resolutionStatus === "resolved";

  const resolveInboundRow = async (row: InboundRow) => {
    if (!token || !form.id) return;
    const actualQty = Number(row.actualQty ?? row.expectedQty);
    if (Number.isNaN(actualQty) || actualQty < 0) {
      toast.error("Actual quantity must be 0 or greater");
      return;
    }

    const mismatchReason =
      actualQty === Number(row.expectedQty)
        ? null
        : row.mismatchReason || (actualQty > Number(row.expectedQty) ? "overage" : "");

    if (actualQty !== Number(row.expectedQty) && !mismatchReason) {
      toast.error("Choose a mismatch reason before resolving this row");
      return;
    }

    try {
      setInboundSubmitting(true);
      const response = await axios.post<InboundReviewResponse>(
        getApiUrl(`invoice-tracker/${form.id}/inbound-rows/resolve`),
        {
          rowId: row.id,
          actualQty,
          mismatchReason,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      applyInboundReviewPayload(response.data);
      toast.success(`Row ${row.sku} resolved`);
    } catch (error: any) {
      console.error("Failed to resolve inbound row:", error);
      toast.error(error?.response?.data?.error || "Failed to resolve row");
    } finally {
      setInboundSubmitting(false);
    }
  };

  const resolveAllInboundRows = async () => {
    if (!token || !form.id) return;
    try {
      setInboundSubmitting(true);
      const response = await axios.post<InboundReviewResponse>(
        getApiUrl(`invoice-tracker/${form.id}/inbound-rows/resolve-all`),
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      applyInboundReviewPayload(response.data);
      toast.success("All remaining rows marked as resolved");
    } catch (error: any) {
      console.error("Failed to resolve all inbound rows:", error);
      toast.error(error?.response?.data?.error || "Failed to resolve rows");
    } finally {
      setInboundSubmitting(false);
    }
  };

  const inboundSelectedRows = async (rowIds: number[]) => {
    if (!token || !form.id || rowIds.length === 0) return;
    try {
      setInboundSubmitting(true);
      const response = await axios.post<InboundReviewResponse>(
        getApiUrl(`invoice-tracker/${form.id}/inbound-submit`),
        { rowIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      applyInboundReviewPayload(response.data);
      toast.success(response.data.message || "Inbound completed");
      await loadInvoices();
    } catch (error: any) {
      console.error("Failed to inbound selected rows:", error);
      toast.error(error?.response?.data?.error || "Failed to inbound selected rows");
    } finally {
      setInboundSubmitting(false);
    }
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
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          <Chip
                            size="small"
                            color={getPaymentChipColor(invoice.paymentStatus) as any}
                            label={
                              PAYMENT_STATUS_OPTIONS.find((option) => option.value === invoice.paymentStatus)?.label ||
                              invoice.paymentStatus
                            }
                          />
                          {getPaymentReminderLabel(invoice.paymentStatus, invoice.paymentDueBy) && (
                            <Chip
                              size="small"
                              variant="outlined"
                              color={getPaymentReminderChipColor(invoice.paymentStatus, invoice.paymentDueBy) as any}
                              label={getPaymentReminderLabel(invoice.paymentStatus, invoice.paymentDueBy)}
                            />
                          )}
                        </Stack>
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
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box component="span">
            {dialogMode === "create"
              ? "Create Invoice"
              : dialogMode === "edit"
                ? "Edit Invoice"
                : "Invoice Details"}
          </Box>
          <IconButton onClick={closeDialog} size="small" disabled={saving}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, backgroundColor: "#fcfcfd" }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                  Invoice Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <Autocomplete
                        options={vendorOptions}
                        getOptionLabel={(option) => option.name}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        value={selectedVendorOption}
                        inputValue={vendorInputValue}
                        onChange={(_, value) => {
                          setForm((prev) => ({
                            ...prev,
                            vendorId: value?.id || null,
                            vendorName: value?.name || "",
                          }));
                          setVendorInputValue(value?.name || "");
                        }}
                        onInputChange={(_, value, reason) => {
                          setVendorInputValue(value);
                          if (reason === "clear") {
                            setForm((prev) => ({ ...prev, vendorId: null, vendorName: "" }));
                            return;
                          }
                          if (value !== (selectedVendorOption?.name || "")) {
                            setForm((prev) => ({ ...prev, vendorId: null, vendorName: value }));
                          }
                        }}
                        disabled={disableNonPaymentEdits}
                        sx={{ flex: 1 }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            fullWidth
                            label="Vendor Name *"
                            helperText="Select a vendor or add a new one"
                          />
                        )}
                      />
                      {!disableNonPaymentEdits && (
                        <Button variant="outlined" onClick={openAddVendorDialog} sx={{ minWidth: 110 }}>
                          Add Vendor
                        </Button>
                      )}
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Invoice Number *"
                      value={form.invoiceNumber}
                      onChange={(e) => setForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                      disabled={disableNonPaymentEdits}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Order Date *"
                      value={form.orderDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, orderDate: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                      disabled={disableNonPaymentEdits}
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
                {getPaymentReminderLabel(form.paymentStatus, form.paymentDueBy) && (
                  <Box sx={{ mb: 2 }}>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={getPaymentReminderChipColor(form.paymentStatus, form.paymentDueBy) as any}
                      label={getPaymentReminderLabel(form.paymentStatus, form.paymentDueBy)}
                    />
                  </Box>
                )}
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
                  {(form.paymentStatus === "paid" || form.paymentProofImageAvailable) && (
                    <Grid item xs={12}>
                      <Paper variant="outlined" sx={{ p: 2, backgroundColor: "#fcfcfd" }}>
                        <Stack spacing={1.5}>
                          <Box>
                            <Typography variant="subtitle2" fontWeight={700}>
                              Payment Proof
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Upload a screenshot or image as proof of payment.
                            </Typography>
                          </Box>

                              {form.paymentProofImageAvailable ? (
                            <Stack spacing={1.5}>
                              {paymentProofPreviewUrl ? (
                                <Box
                                  component="button"
                                  type="button"
                                  onClick={() => setPaymentProofDialogOpen(true)}
                                  sx={{
                                    p: 0,
                                    border: "none",
                                    background: "transparent",
                                    cursor: "zoom-in",
                                    textAlign: "left",
                                    width: "fit-content",
                                  }}
                                >
                                  <Box
                                    component="img"
                                    src={paymentProofPreviewUrl}
                                    alt="Payment proof"
                                    sx={{
                                      width: "100%",
                                      maxWidth: 420,
                                      borderRadius: 1,
                                      border: "1px solid #e5e7eb",
                                      objectFit: "contain",
                                      backgroundColor: "#fff",
                                      display: "block",
                                    }}
                                  />
                                </Box>
                              ) : (
                                <Box display="flex" alignItems="center" gap={1}>
                                  <CircularProgress size={18} />
                                  <Typography variant="body2" color="text.secondary">
                                    Loading payment proof preview...
                                  </Typography>
                                </Box>
                              )}
                              <Typography variant="body2" color="text.secondary">
                                {form.paymentProofOriginalName || "Payment proof image"}
                                {form.paymentProofUploadedAt
                                  ? ` · Uploaded ${new Date(form.paymentProofUploadedAt).toLocaleString()}`
                                  : ""}
                                {form.paymentProofUploaderDisplay
                                  ? ` · By ${form.paymentProofUploaderDisplay}`
                                  : ""}
                              </Typography>
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No payment proof uploaded yet.
                            </Typography>
                          )}

                          {!isReadOnly && form.id && (
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                              <Button
                                component="label"
                                variant="outlined"
                                startIcon={<UploadIcon />}
                                disabled={uploadingPaymentProof || removingPaymentProof || hasUnsavedChanges || saving}
                              >
                                {uploadingPaymentProof
                                  ? "Uploading..."
                                  : form.paymentProofImageAvailable
                                    ? "Replace Image"
                                    : "Upload Image"}
                                <input
                                  type="file"
                                  hidden
                                  accept="image/png,image/jpeg,image/jpg,image/webp"
                                  onChange={(event) => {
                                    const file = event.target.files?.[0] || null;
                                    handleUploadPaymentProof(file);
                                    event.currentTarget.value = "";
                                  }}
                                />
                              </Button>
                              {form.paymentProofImageAvailable && (
                                <Button
                                  color="error"
                                  variant="outlined"
                                  onClick={handleDeletePaymentProof}
                                  disabled={uploadingPaymentProof || removingPaymentProof || hasUnsavedChanges || saving}
                                >
                                  {removingPaymentProof ? "Removing..." : "Remove Image"}
                                </Button>
                              )}
                            </Stack>
                          )}

                          {!isReadOnly && hasUnsavedChanges && (
                            <Typography variant="caption" color="text.secondary">
                              Save invoice changes first before uploading or removing payment proof.
                            </Typography>
                          )}
                          {form.paymentProofImageAvailable && paymentProofPreviewUrl && (
                            <Typography variant="caption" color="text.secondary">
                              Click the preview to open the full-size image.
                            </Typography>
                          )}
                        </Stack>
                      </Paper>
                    </Grid>
                  )}
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth disabled={disableNonPaymentEdits}>
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
                        disabled={disableNonPaymentEdits}
                      />
                    </Grid>
                  )}
                  {(form.shipmentStatus === "shipped" || Boolean(form.trackingInfo)) && (
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Tracking Info"
                        placeholder="Tracking number or shipping link"
                        value={form.trackingInfo}
                        onChange={(e) => setForm((prev) => ({ ...prev, trackingInfo: e.target.value }))}
                        disabled={disableNonPaymentEdits}
                        helperText="Optional. Add tracking number or shipping link."
                      />
                    </Grid>
                  )}
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth disabled={disableNonPaymentEdits}>
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
                        disabled
                      >
                        {INBOUND_STATUS_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  {isReadOnly && Boolean(form.trackingInfo) && (
                    <Grid item xs={12}>
                      <Paper variant="outlined" sx={{ px: 1.5, py: 1.25, backgroundColor: "#ffffff" }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Tracking Info
                        </Typography>
                        <Typography sx={{ wordBreak: "break-word" }} fontWeight={500}>
                          {form.trackingInfo}
                        </Typography>
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, backgroundColor: "#f8fafc" }}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", md: "center" }}
                >
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Invoice Inbound
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {form.inboundStatus === "done"
                        ? `Fully inbounded${form.inboundCompletedAt ? ` on ${new Date(form.inboundCompletedAt).toLocaleString()}` : ""}${form.inboundCompleterDisplay ? ` by ${form.inboundCompleterDisplay}` : ""}.`
                        : form.inboundStatus === "partial"
                          ? "Partially inbounded. You can reopen the inbound review and continue with the remaining rows."
                          : "Not inbounded yet. Start inbound only after Shipment is Received with a date, and Items Check is Verified."}
                    </Typography>
                  </Box>
                    <Button
                      variant="contained"
                      color="secondary"
                      startIcon={<InventoryIcon />}
                      onClick={handleInboundButtonClick}
                      disabled={!canStartInbound || inboundLoading}
                    >
                      {inboundLoading
                        ? "Loading..."
                        : !canStartInbound && wouldBeInboundEligibleAfterSave && hasUnsavedChanges
                          ? "Save to Enable"
                          : form.inboundStatus === "done"
                            ? "View Inbound"
                          : form.inboundStatus === "pending"
                            ? "Start Inbound"
                            : "Continue Inbound"}
                    </Button>
                </Stack>
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
                disabled={disableNonPaymentEdits}
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
                      disabled={disableNonPaymentEdits}
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
                      disabled={disableNonPaymentEdits}
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
                sx={{ mb: 1 }}
              >
                <Typography variant="subtitle1" fontWeight={700}>
                  Invoice Items
                </Typography>
                {form.inboundStatus !== "pending" && (
                  <Typography variant="body2" color="text.secondary">
                    Inbound has already started for this invoice. Only payment status fields can be edited now. If something else needs to be received, create a new invoice.
                  </Typography>
                )}
              </Stack>
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
                            disabled={disableNonPaymentEdits}
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
                            label="Quantity"
                            type="number"
                            inputProps={{ min: 1, step: 1 }}
                            value={item.quantity}
                            onChange={(e) => updateItemRow(index, "quantity", Number(e.target.value) || 1)}
                            disabled={disableNonPaymentEdits}
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
                            disabled={disableNonPaymentEdits}
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
                          {!disableNonPaymentEdits && (
                              <IconButton
                                color="error"
                                onClick={() => removeItemRow(index)}
                              >
                                <DeleteIcon />
                              </IconButton>
                          )}
                        </Box>
                      </Box>
                    </Paper>
                  );
                })}
                {!disableNonPaymentEdits && (
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
          {canSendPaymentReminder && (
            <Button
              variant="outlined"
              startIcon={<EmailIcon />}
              onClick={sendPaymentReminder}
              disabled={sendingReminder || hasUnsavedChanges || saving}
            >
              {sendingReminder ? "Sending..." : "Send Reminder Email"}
            </Button>
          )}
          {!isReadOnly && hasUnsavedChanges && (
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

      <Dialog
        open={addVendorDialogOpen}
        onClose={() => {
          if (!creatingVendor) setAddVendorDialogOpen(false);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Add Vendor</DialogTitle>
        <DialogContent dividers>
          <TextField
            fullWidth
            label="Vendor Name"
            value={newVendorName}
            onChange={(e) => setNewVendorName(e.target.value)}
            disabled={creatingVendor}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddVendorDialogOpen(false)} disabled={creatingVendor}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreateVendor} disabled={creatingVendor}>
            {creatingVendor ? "Saving..." : "Save Vendor"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={paymentProofDialogOpen}
        onClose={() => setPaymentProofDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box component="span">Payment Proof Preview</Box>
          <IconButton onClick={() => setPaymentProofDialogOpen(false)} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {paymentProofPreviewUrl ? (
              <Box
                component="img"
                src={paymentProofPreviewUrl}
                alt="Payment proof full size"
                sx={{
                  width: "100%",
                  maxHeight: "75vh",
                  objectFit: "contain",
                  borderRadius: 1,
                  backgroundColor: "#fff",
                }}
              />
            ) : (
              <Box display="flex" alignItems="center" gap={1}>
                <CircularProgress size={20} />
                <Typography color="text.secondary">Loading payment proof...</Typography>
              </Box>
            )}
            <Typography variant="body2" color="text.secondary">
              {form.paymentProofOriginalName || "Payment proof image"}
              {form.paymentProofUploadedAt
                ? ` · Uploaded ${new Date(form.paymentProofUploadedAt).toLocaleString()}`
                : ""}
              {form.paymentProofUploaderDisplay ? ` · By ${form.paymentProofUploaderDisplay}` : ""}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentProofDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={inboundDialogOpen}
        onClose={() => {
          if (!inboundSubmitting) setInboundDialogOpen(false);
        }}
        fullWidth
        maxWidth="xl"
      >
        <DialogTitle>
          Invoice Inbound Review
          {form.invoiceNumber ? ` - ${form.invoiceNumber}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2, backgroundColor: "#fcfcfd" }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Vendor
                  </Typography>
                  <Typography fontWeight={600}>{form.vendorName || "N/A"}</Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Received Date
                  </Typography>
                  <Typography fontWeight={600}>
                    {form.receivedDate ? new Date(`${form.receivedDate}T00:00:00`).toLocaleDateString() : "N/A"}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Inbound Status
                  </Typography>
                  <Chip
                    size="small"
                    color={getInboundChipColor(form.inboundStatus) as any}
                    label={INBOUND_STATUS_OPTIONS.find((option) => option.value === form.inboundStatus)?.label || form.inboundStatus}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Completed By
                  </Typography>
                  <Typography fontWeight={600}>{form.inboundCompleterDisplay || "-"}</Typography>
                </Grid>
              </Grid>
            </Paper>

            <Grid container spacing={2}>
              <Grid item xs={6} md={2}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Rows</Typography>
                  <Typography variant="h5" fontWeight={700}>{inboundSummary?.totalRows || 0}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={2}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Pending</Typography>
                  <Typography variant="h5" fontWeight={700}>{inboundSummary?.pendingRows || 0}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={2}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Verified</Typography>
                  <Typography variant="h5" fontWeight={700}>{inboundSummary?.resolvedRows || 0}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={2}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Inbounded</Typography>
                  <Typography variant="h5" fontWeight={700}>{inboundSummary?.inboundedRows || 0}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={2}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Mismatch Rows</Typography>
                  <Typography variant="h5" fontWeight={700}>{inboundSummary?.mismatchRows || 0}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={2}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Qty To Inbound</Typography>
                  <Typography variant="h5" fontWeight={700}>{inboundSummary?.totalResolvedQty || 0}</Typography>
                </Paper>
              </Grid>
            </Grid>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between">
              <Alert severity="info" sx={{ flex: 1 }}>
                Verify each SKU + price row first. Then inbound rows individually or in bulk. A row can only be inbounded once.
              </Alert>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button variant="outlined" onClick={resolveAllInboundRows} disabled={inboundSubmitting || !inboundRows.some((row) => row.resolutionStatus !== "inbounded")}>
                  Verify All
                </Button>
                <Button
                  variant="contained"
                  onClick={() => inboundSelectedRows(selectedInboundRowIds)}
                  disabled={inboundSubmitting || selectedInboundRowIds.length === 0}
                >
                  Inbound Selected ({selectedInboundRowIds.length})
                </Button>
              </Stack>
            </Stack>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={
                          inboundRows.length > 0 &&
                          inboundRows.filter(canSelectInboundRow).length > 0 &&
                          inboundRows.filter(canSelectInboundRow).every((row) => selectedInboundRowIds.includes(row.id))
                        }
                        indeterminate={
                          selectedInboundRowIds.length > 0 &&
                          selectedInboundRowIds.length <
                            inboundRows.filter(canSelectInboundRow).length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedInboundRowIds(inboundRows.filter(canSelectInboundRow).map((row) => row.id));
                          } else {
                            setSelectedInboundRowIds([]);
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell>Item Name</TableCell>
                    <TableCell>Unit Price</TableCell>
                    <TableCell>Expected Qty</TableCell>
                    <TableCell>Actual Qty</TableCell>
                    <TableCell>Delta</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {inboundRows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedInboundRowIds.includes(row.id)}
                          disabled={!canSelectInboundRow(row)}
                          onChange={(e) => {
                            setSelectedInboundRowIds((prev) =>
                              e.target.checked ? [...prev, row.id] : prev.filter((id) => id !== row.id)
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell>{row.sku}</TableCell>
                      <TableCell>{row.itemName}</TableCell>
                      <TableCell>${Number(row.unitPrice || 0).toFixed(2)}</TableCell>
                      <TableCell>{row.expectedQty}</TableCell>
                      <TableCell sx={{ minWidth: 130 }}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          inputProps={{ min: 0, step: 1 }}
                          value={row.actualQty ?? row.expectedQty}
                          disabled={row.resolutionStatus === "inbounded"}
                          onChange={(e) => updateInboundRowDraft(row.id, { actualQty: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell>{(Number(row.actualQty ?? row.expectedQty) - Number(row.expectedQty || 0)).toString()}</TableCell>
                      <TableCell sx={{ minWidth: 170 }}>
                        <FormControl fullWidth size="small" disabled={row.resolutionStatus === "inbounded"}>
                          <Select
                            displayEmpty
                            value={
                              Number(row.actualQty ?? row.expectedQty) === Number(row.expectedQty)
                                ? ""
                                : row.mismatchReason || (Number(row.actualQty ?? row.expectedQty) > Number(row.expectedQty) ? "overage" : "")
                            }
                            onChange={(e) => updateInboundRowDraft(row.id, { mismatchReason: String(e.target.value) })}
                          >
                            <MenuItem value="">No mismatch</MenuItem>
                            {MISMATCH_REASON_OPTIONS.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={
                            row.resolutionStatus === "inbounded"
                              ? "success"
                              : row.resolutionStatus === "resolved"
                                ? "info"
                                : "default"
                          }
                          label={
                            row.resolutionStatus === "pending"
                              ? "Pending"
                              : row.resolutionStatus === "resolved"
                                ? "Verified"
                                : "Inbounded"
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {row.resolutionStatus !== "inbounded" && (
                            <Button size="small" variant="outlined" onClick={() => resolveInboundRow(row)} disabled={inboundSubmitting}>
                              Verify
                            </Button>
                          )}
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => inboundSelectedRows([row.id])}
                            disabled={inboundSubmitting || row.resolutionStatus !== "resolved"}
                          >
                            Inbound Row
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {inboundRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10}>
                        <Typography color="text.secondary">No inbound rows available for this invoice yet.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInboundDialogOpen(false)} disabled={inboundSubmitting}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={startInboundConfirmOpen}
        onClose={() => {
          if (!inboundLoading) setStartInboundConfirmOpen(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Start Inbound?</DialogTitle>
        <DialogContent dividers>
          <Typography>
            Once you start the inbounding process, you cannot edit the invoice. Are you sure you want to proceed?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStartInboundConfirmOpen(false)} disabled={inboundLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={async () => {
              setStartInboundConfirmOpen(false);
              await openInboundDialog();
            }}
            disabled={inboundLoading}
          >
            Proceed
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default InvoiceTracker;

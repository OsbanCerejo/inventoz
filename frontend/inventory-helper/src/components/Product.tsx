import {
  Box,
  Button,
  Chip,
  Paper,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  MenuItem,
  IconButton,
  Tooltip,
} from "@mui/material";
import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import PrintIcon from "@mui/icons-material/Print";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { toast } from "react-toastify";
import PrintableLabel from "./PrintableLabel";
import { useReactToPrint } from "react-to-print";
import { useAuth } from "../context/AuthContext";
import { getApiUrl } from "../config/api";
import { invalidateProductsCache } from "../utils/productCache";

const HBA_CONDITION_OPTIONS = ["Unboxed", "Sealed", "Damaged", "Old Batch"];

// ── Shared panel styles ──────────────────────────────────────────────────────

const panelSx = {
  border: "1px solid #e2e8f0",
  borderRadius: 2,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column" as const,
};

const panelHeaderSx = {
  px: 2.5,
  py: 2,
  borderBottom: "1px solid #f1f5f9",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const panelTitleSx = {
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.07em",
  color: "#374151",
};

// ── KV row helper ────────────────────────────────────────────────────────────

function KVRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Box
      display="flex"
      alignItems="baseline"
      py={1}
      gap={1}
      sx={{ borderBottom: "1px solid #f8fafc", "&:last-child": { borderBottom: "none" } }}
    >
      <Typography
        sx={{ fontSize: 14, color: "#475569", fontWeight: 600, flexShrink: 0, width: 165 }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: 15, color: "#0f172a", fontWeight: 600 }}>
        {value || "—"}
      </Typography>
    </Box>
  );
}

// ── Toggle row helper ────────────────────────────────────────────────────────

function ToggleRow({
  label,
  checked,
  onChange,
  onEdit,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  onEdit?: () => void;
  disabled?: boolean;
}) {
  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      py={0.625}
      sx={{ borderBottom: "1px solid #f8fafc", "&:last-child": { borderBottom: "none" } }}
    >
      <Box display="flex" alignItems="center" gap={0.5}>
        <Typography sx={{ fontSize: 14, color: "#374151", fontWeight: 600 }}>{label}</Typography>
        {checked && onEdit && (
          <Tooltip title="Edit settings">
            <IconButton
              size="small"
              onClick={onEdit}
              sx={{ p: 0.25, color: "#2563eb", opacity: 0.75, "&:hover": { opacity: 1 } }}
            >
              <EditIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Switch
        size="small"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        sx={{
          "& .MuiSwitch-switchBase.Mui-checked": { color: "#2563eb" },
          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#2563eb" },
        }}
      />
    </Box>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

function Product() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasPermission, hasMenuAccess } = useAuth();

  // ── Core product data
  const [productObject, setProductObject]: any = useState({});
  const [productDetails, setProductDetails]: any = useState({});
  const [productListings, setProductListings]: any = useState({});
  const labelRef = useRef<HTMLDivElement>(null);

  // ── Permissions
  const isAdmin = user?.role === "admin";
  const canViewInboundHistory = isAdmin || hasPermission("inbound", "view");
  const canEditProducts = isAdmin || hasPermission("products", "edit") || hasPermission("products", "dataEntry");
  const canAddProduct =
    (isAdmin || hasPermission("addProduct", "create")) && hasMenuAccess("addProduct");
  const canViewHbaListing =
    isAdmin ||
    hasPermission("hbaListing", "view") ||
    hasPermission("hbaListing", "edit");
  const canEditHbaListing = isAdmin || hasPermission("hbaListing", "edit");
  const canViewTrackQty =
    isAdmin ||
    hasPermission("trackQuantity", "view") ||
    hasPermission("trackQuantity", "edit");
  const canEditTrackQty = isAdmin || hasPermission("trackQuantity", "edit");

  // ── Vendor pricing & inbound
  const [vendorPrices, setVendorPrices] = useState<any[]>([]);
  const [averagePrice, setAveragePrice] = useState<number | null>(null);
  const [inboundHistory, setInboundHistory] = useState<any[]>([]);
  const [fragranceNotes, setFragranceNotes] = useState<{ top: {id:number;name:string}[]; middle: {id:number;name:string}[]; base: {id:number;name:string}[] } | null>(null);

  // ── Sales summary
  const [salesSummary, setSalesSummary] = useState<{
    months: string[];
    tiktok: number[];
    whatnot: number[];
    ebay: number[];
    walmart: number[];
    avgPrice: { tiktok: number | null; whatnot: number | null; ebay: number | null };
  } | null>(null);

  // ── eBay expand/collapse
  const [ebayExpanded, setEbayExpanded] = useState(false);

  // ── eBay dialogs
  const [restockDialogOpen, setRestockDialogOpen] = useState(false);
  const [restockQuantity, setRestockQuantity] = useState<number>(0);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [updatePrice, setUpdatePrice] = useState<number>(0);

  // ── Track Quantity
  const [trackQuantityEnabled, setTrackQuantityEnabled] = useState(false);
  const [minimumQuantity, setMinimumQuantity] = useState("");
  const [trackQtyDialogOpen, setTrackQtyDialogOpen] = useState(false);
  const [savingTrackQty, setSavingTrackQty] = useState(false);
  const trackQtyOpenedFresh = useRef(false);

  // ── Refill Checklist
  const [refillChecklistEnabled, setRefillChecklistEnabled] = useState(false);

  // ── HBA
  const [savingHba, setSavingHba] = useState(false);
  const [hbaEnabled, setHbaEnabled] = useState(false);
  const [hbaQuantity, setHbaQuantity] = useState("");
  const [hbaPrice, setHbaPrice] = useState("");
  const [hbaMoq, setHbaMoq] = useState("1");
  const [hbaStepCount, setHbaStepCount] = useState("1");
  const [hbaCondition, setHbaCondition] = useState("");
  const [hbaNewArrival, setHbaNewArrival] = useState(false);
  const [hbaDialogOpen, setHbaDialogOpen] = useState(false);
  const hbaOpenedFresh = useRef(false);

  // ── Fetch product data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setProductObject({});
        setProductDetails({});
        setProductListings({});

        const { data: product } = await axios.get(
          getApiUrl(`products/byId/${id}?nocache=${Date.now()}`)
        );
        setProductObject(product);

        const { data: details } = await axios.get(
          getApiUrl(`productDetails/bySku?nocache=${Date.now()}`),
          { params: { sku: product.sku } }
        );
        setProductDetails(details);

        try {
          const { data: listings } = await axios.get(
            getApiUrl(`listings/bySku?nocache=${Date.now()}`),
            { params: { sku: product.sku } }
          );
          setProductListings(listings);
        } catch (listingsError: any) {
          if (listingsError?.response?.status !== 404) {
            console.error("Error fetching product listings:", listingsError);
          }
          setProductListings({});
        }
      } catch (error) {
        console.error("Error fetching product data:", error);
      }
    };

    if (location.state?.updatedProduct) {
      setProductObject(location.state.updatedProduct);
      setProductDetails(location.state.updatedDetails || {});
      setProductListings(location.state.updatedListings || {});
    } else {
      fetchData();
    }
  }, [id, location.state]);

  // ── Hydrate HBA + Track Quantity state from productObject
  useEffect(() => {
    setHbaEnabled(Boolean(productObject.hbaEnabled));
    setHbaQuantity(productObject.hbaQuantity == null ? "" : String(productObject.hbaQuantity));
    setHbaPrice(productObject.hbaPrice == null ? "" : String(productObject.hbaPrice));
    setHbaMoq(productObject.hbaMoq == null ? "1" : String(productObject.hbaMoq));
    setHbaStepCount(productObject.hbaStepCount == null ? "1" : String(productObject.hbaStepCount));
    setHbaCondition(productObject.hbaCondition == null ? "" : String(productObject.hbaCondition));
    setHbaNewArrival(Boolean(productObject.hbaNewArrival));

    setTrackQuantityEnabled(Boolean(productObject.trackQuantity));
    setMinimumQuantity(
      productObject.minimumQuantity == null ? "" : String(productObject.minimumQuantity)
    );
    setRefillChecklistEnabled(Boolean(productObject.refillChecklist));
  }, [productObject]);

  // ── Fetch fragrance notes
  useEffect(() => {
    const sku = productObject.sku;
    if (!sku || productObject.category !== 'Fragrance') { setFragranceNotes(null); return; }
    axios.get(getApiUrl(`fragrance-notes/product/${sku}`))
      .then(({ data }) => setFragranceNotes(data))
      .catch(() => setFragranceNotes(null));
  }, [productObject.sku, productObject.category]);

  // ── Fetch vendor prices + inbound history
  useEffect(() => {
    const sku = productObject.sku;
    if (!sku || !user) return;

    if (canViewInboundHistory) {
      axios
        .get(getApiUrl(`inbound/bySku/${sku}`))
        .then(({ data }) => setInboundHistory(data || []))
        .catch((err) => console.error("Error fetching inbound history:", err));
    } else {
      setInboundHistory([]);
    }

    if (isAdmin) {
      axios
        .get(getApiUrl(`product-vendor-prices/${sku}`))
        .then(({ data: pricingData }) => {
          setVendorPrices(pricingData.vendorPrices || []);
          const avg = pricingData.averagePrice;
          setAveragePrice(avg != null ? Number(avg) : null);
        })
        .catch((err) => console.error("Error fetching vendor prices:", err));

      axios
        .get(getApiUrl(`products/salesSummary/${sku}`))
        .then(({ data }) => setSalesSummary(data))
        .catch((err) => console.error("Error fetching sales summary:", err));
    }
  }, [productObject.sku, user, canViewInboundHistory, isAdmin]);

  // ── Handlers
  const handleEditOnClick = useCallback(() => {
    navigate("/editProduct", {
      state: { productObject, productDetails, productListings },
    });
  }, [navigate, productObject, productDetails, productListings]);

  const handleDeleteClick = useCallback(async () => {
    const passwordToDelete = prompt("Enter Password to delete");
    if (passwordToDelete === "1080") {
      try {
        await axios.delete(getApiUrl(`products/delete/${productObject.sku}`));
        invalidateProductsCache();
        toast.success("Deleted Successfully!", { position: "top-right" });
        navigate("/", { state: { clearFilters: true } });
      } catch (error) {
        console.error("Error deleting the product:", error);
        toast.error("Failed to delete the product.", { position: "top-right" });
      }
    } else {
      toast.error("Incorrect password. Please Try Again.", { position: "top-right" });
    }
  }, [navigate, productObject, user]);

  const handlePrintClick = useReactToPrint({
    content: () => labelRef.current,
    documentTitle: `Label-${productObject.sku}`,
  });

  const handleAddSimilar = () => {
    navigate("/addProduct", {
      state: {
        productObject: { ...productObject, sku: "", quantity: "", location: "" },
        productDetails,
      },
    });
  };

  const handleOutOfStockClick = useCallback(async () => {
    try {
      await axios.post(getApiUrl(`ebayAPI/updateQuantity`), {
        sku: productObject.sku,
        quantity: 0,
      });
      toast.success("Product marked as out of stock on eBay!", { position: "top-right" });
    } catch (error) {
      toast.error("Failed to mark product as out of stock", { position: "top-right" });
    }
  }, [productObject.sku]);

  const handleRestockClick = useCallback(async () => {
    try {
      await axios.post(getApiUrl(`ebayAPI/updateQuantity`), {
        sku: productObject.sku,
        quantity: restockQuantity,
      });
      toast.success("Product quantity updated on eBay!", { position: "top-right" });
    } catch (error) {
      toast.error("Failed to update product quantity on eBay", { position: "top-right" });
    }
  }, [productObject.sku, restockQuantity]);

  const handlePriceUpdateClick = useCallback(async () => {
    try {
      await axios.post(getApiUrl(`ebayAPI/updatePrice`), {
        sku: productObject.sku,
        price: updatePrice,
      });
      toast.success("Product price updated on eBay!", { position: "top-right" });
    } catch (error) {
      toast.error("Failed to update product price on eBay", { position: "top-right" });
    }
  }, [productObject.sku, updatePrice]);

  const handleSaveHba = useCallback(async () => {
    if (!productObject?.sku) return;

    if (hbaEnabled) {
      const parsedQty = Number(hbaQuantity);
      const parsedPrice = Number(hbaPrice);
      const parsedMoq = Number(hbaMoq);
      const parsedStep = Number(hbaStepCount);

      if (!Number.isFinite(parsedQty) || parsedQty < 0) {
        toast.error("Enter a valid HBA quantity.", { position: "top-right" }); return;
      }
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        toast.error("Enter a valid HBA price.", { position: "top-right" }); return;
      }
      if (!Number.isFinite(parsedMoq) || parsedMoq < 1) {
        toast.error("Enter a valid HBA MOQ.", { position: "top-right" }); return;
      }
      if (!Number.isFinite(parsedStep) || parsedStep < 1) {
        toast.error("Enter a valid HBA step count.", { position: "top-right" }); return;
      }
    }

    setSavingHba(true);
    try {
      const payload = {
        ...productObject,
        hbaEnabled,
        hbaQuantity: hbaEnabled ? hbaQuantity : "",
        hbaPrice: hbaEnabled ? hbaPrice : "",
        hbaMoq: hbaEnabled ? hbaMoq : 1,
        hbaStepCount: hbaEnabled ? hbaStepCount : 1,
        hbaCondition,
        hbaNewArrival,
      };
      const { data: updatedProduct } = await axios.put(getApiUrl("products"), payload);
      setProductObject(updatedProduct);
      invalidateProductsCache();
      toast.success("HBA settings saved.", { position: "top-right" });
      setHbaDialogOpen(false);
      hbaOpenedFresh.current = false;
    } catch (error) {
      console.error("Error saving HBA settings:", error);
      toast.error("Failed to save HBA settings.", { position: "top-right" });
    } finally {
      setSavingHba(false);
    }
  }, [hbaCondition, hbaEnabled, hbaMoq, hbaNewArrival, hbaPrice, hbaQuantity, hbaStepCount, productObject]);

  const handleSaveTrackQty = useCallback(async () => {
    if (!productObject?.sku) return;
    setSavingTrackQty(true);
    try {
      const payload = {
        ...productObject,
        trackQuantity: trackQuantityEnabled,
        minimumQuantity: trackQuantityEnabled ? (minimumQuantity === "" ? null : Number(minimumQuantity)) : null,
      };
      const { data: updatedProduct } = await axios.put(getApiUrl("products"), payload);
      setProductObject(updatedProduct);
      invalidateProductsCache();
      toast.success("Track Quantity settings saved.", { position: "top-right" });
      setTrackQtyDialogOpen(false);
      trackQtyOpenedFresh.current = false;
    } catch (error) {
      console.error("Error saving track quantity:", error);
      toast.error("Failed to save Track Quantity settings.", { position: "top-right" });
    } finally {
      setSavingTrackQty(false);
    }
  }, [productObject, trackQuantityEnabled, minimumQuantity]);

  const handleRefillChecklistToggle = useCallback(async (val: boolean) => {
    if (!productObject?.sku) return;
    setRefillChecklistEnabled(val);
    try {
      const { data: updatedProduct } = await axios.put(getApiUrl("products"), {
        ...productObject,
        refillChecklist: val,
      });
      setProductObject(updatedProduct);
      invalidateProductsCache();
      toast.success(`Refill Checklist ${val ? "enabled" : "disabled"}.`, { position: "top-right" });
    } catch (error) {
      console.error("Error saving refill checklist:", error);
      setRefillChecklistEnabled(!val);
      toast.error("Failed to update Refill Checklist.", { position: "top-right" });
    }
  }, [productObject]);

  // ── Toggle handlers (open modal on enable, handle cancel revert)
  const handleTrackQtyToggle = (val: boolean) => {
    setTrackQuantityEnabled(val);
    if (val) {
      trackQtyOpenedFresh.current = true;
      setTrackQtyDialogOpen(true);
    }
  };

  const handleTrackQtyDialogClose = (cancelled: boolean) => {
    setTrackQtyDialogOpen(false);
    if (cancelled && trackQtyOpenedFresh.current) {
      setTrackQuantityEnabled(false);
    }
    trackQtyOpenedFresh.current = false;
  };

  const handleHbaToggle = async (val: boolean) => {
    setHbaEnabled(val);
    if (val) {
      hbaOpenedFresh.current = true;
      setHbaDialogOpen(true);
    } else {
      // Toggling off — save immediately so the HBA catalog reflects the change
      setSavingHba(true);
      try {
        const payload = { ...productObject, hbaEnabled: false };
        const { data: updatedProduct } = await axios.put(getApiUrl("products"), payload);
        setProductObject(updatedProduct);
        invalidateProductsCache();
        toast.success("HBA listing disabled.", { position: "top-right" });
      } catch (error) {
        console.error("Error disabling HBA listing:", error);
        setHbaEnabled(true); // revert toggle on failure
        toast.error("Failed to disable HBA listing.", { position: "top-right" });
      } finally {
        setSavingHba(false);
      }
    }
  };

  const handleHbaDialogClose = (cancelled: boolean) => {
    setHbaDialogOpen(false);
    if (cancelled && hbaOpenedFresh.current) {
      setHbaEnabled(false);
    }
    hbaOpenedFresh.current = false;
  };

  // ── Warehouse locations array
  const warehouseLocationChips: string[] = productObject.warehouseLocations
    ? productObject.warehouseLocations.split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", p: "24px 32px 48px" }}>

      {/* ── ACTION BAR ── */}
      <Paper
        variant="outlined"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          px: 2.5,
          py: 1.5,
          mb: 2,
          borderRadius: 2,
        }}
      >
        <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">

          {/* Product group */}
          <Box display="flex" alignItems="center" gap={1}>
            <Typography sx={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", mr: 0.5 }}>
              Product
            </Typography>
            {canEditProducts && (
              <Button
                variant="contained"
                size="small"
                startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                onClick={handleEditOnClick}
                sx={{ background: "#16a34a", "&:hover": { background: "#15803d" }, textTransform: "none", fontWeight: 600, fontSize: 14 }}
              >
                Edit
              </Button>
            )}
            {canAddProduct && (
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                onClick={handleAddSimilar}
                sx={{ background: "#7c3aed", "&:hover": { background: "#6d28d9" }, textTransform: "none", fontWeight: 600, fontSize: 14 }}
              >
                Add Similar
              </Button>
            )}
            <Button
              variant="contained"
              size="small"
              startIcon={<PrintIcon sx={{ fontSize: 14 }} />}
              onClick={handlePrintClick}
              sx={{ background: "#0891b2", "&:hover": { background: "#0e7490" }, textTransform: "none", fontWeight: 600, fontSize: 14 }}
            >
              Print Label
            </Button>
          </Box>

          {/* eBay group */}
          {isAdmin && (
            <>
              <Box sx={{ width: "1px", height: 28, background: "#e2e8f0", flexShrink: 0 }} />
              <Box display="flex" alignItems="center" gap={1}>
                <Button
                  variant="outlined"
                  size="small"
                  endIcon={ebayExpanded ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
                  onClick={() => setEbayExpanded((v) => !v)}
                  sx={{ textTransform: "none", fontWeight: 600, fontSize: 13, color: "#475569", borderColor: "#e2e8f0", "&:hover": { borderColor: "#cbd5e1", background: "#f8fafc" } }}
                >
                  eBay
                </Button>
                {ebayExpanded && (
                  <Box display="flex" gap={1}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleOutOfStockClick}
                      sx={{ background: "#f59e0b", "&:hover": { background: "#d97706" }, textTransform: "none", fontWeight: 600, fontSize: 14 }}
                    >
                      Out of Stock
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => setRestockDialogOpen(true)}
                      sx={{ background: "#0ea5e9", "&:hover": { background: "#0284c7" }, textTransform: "none", fontWeight: 600, fontSize: 14 }}
                    >
                      Restock
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setPriceDialogOpen(true)}
                      sx={{ textTransform: "none", fontWeight: 600, fontSize: 13, color: "#475569", borderColor: "#e2e8f0" }}
                    >
                      Update Price
                    </Button>
                  </Box>
                )}
              </Box>
            </>
          )}
        </Box>

        {/* Delete */}
        {isAdmin && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<DeleteIcon sx={{ fontSize: 14 }} />}
            onClick={handleDeleteClick}
            sx={{ textTransform: "none", fontWeight: 600, fontSize: 13, color: "#dc2626", borderColor: "#fca5a5", "&:hover": { background: "#fff1f2", borderColor: "#f87171" } }}
          >
            Delete
          </Button>
        )}
      </Paper>

      {/* ── TOP ROW: 3 panels ── */}
      <Box sx={{ display: "grid", gridTemplateColumns: (isAdmin || canViewInboundHistory) ? "1fr 1fr 1fr" : "1fr 1fr", gap: 2, alignItems: "stretch", minHeight: isAdmin ? undefined : "75vh" }}>

        {/* Product Details */}
        <Box sx={panelSx}>
          <Box sx={panelHeaderSx}>
            <Typography sx={panelTitleSx}>Product Details</Typography>
          </Box>
          <Box sx={{ p: 2.5, flex: 1 }}>
            <KVRow label="SKU" value={productObject.sku} />
            <KVRow label="Brand" value={productObject.brand} />
            <KVRow label="Item Name" value={productObject.itemName} />
            <KVRow label="Category" value={productObject.category} />
            <KVRow label="Type" value={productObject.type} />
            <KVRow label="Strength" value={productObject.strength} />
            <KVRow label="Size" value={productObject.sizeOz || productObject.sizeMl ? `${productObject.sizeOz} oz / ${productObject.sizeMl} ml` : undefined} />
            <KVRow label="Shade / Variant" value={productObject.shade} />
            <KVRow label="Condition" value={productObject.condition} />
            <KVRow label="UPC" value={productObject.upc} />
            {productObject.retailPrice != null && (
              <KVRow label="Retail Price" value={
                <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#16a34a" }}>
                  ${Number(productObject.retailPrice).toFixed(2)}
                </Typography>
              } />
            )}
            {productDetails.dupeOf && (
              <KVRow label="Dupe / Clone Of" value={
                <Typography sx={{ fontSize: 14, color: "#7c3aed", fontWeight: 600 }}>{productDetails.dupeOf}</Typography>
              } />
            )}
            {productDetails.description && (
              <KVRow label="Description" value={
                <Typography sx={{ fontSize: 12, color: "#64748b" }}>{productDetails.description}</Typography>
              } />
            )}
            {/* Badges */}
            {(productDetails.tester || productDetails.discontinued) && (
              <Box display="flex" gap={1} mt={1} flexWrap="wrap">
                {productDetails.tester && (
                  <Chip label="Tester" size="small" sx={{ background: "#fee2e2", color: "#b91c1c", fontWeight: 700, fontSize: 11 }} />
                )}
                {productDetails.discontinued && (
                  <Chip label="Discontinued" size="small" sx={{ background: "#f3e8ff", color: "#7e22ce", fontWeight: 700, fontSize: 11 }} />
                )}
              </Box>
            )}
          </Box>
        </Box>

        {/* Warehouse */}
        <Box sx={panelSx}>
          <Box sx={panelHeaderSx}>
            <Typography sx={panelTitleSx}>Warehouse</Typography>
          </Box>
          <Box sx={{ p: 2.5, flex: 1 }}>
            <KVRow label="Location" value={productObject.location} />
            <KVRow
              label="Qty Available"
              value={
                <Typography sx={{ fontSize: 17, fontWeight: 800, color: "#16a34a" }}>
                  {productObject.quantity ?? "—"}
                </Typography>
              }
            />

            {/* Track Quantity toggle */}
            {canViewTrackQty && (
              <ToggleRow
                label="Track Qty"
                checked={trackQuantityEnabled}
                onChange={canEditTrackQty ? handleTrackQtyToggle : () => {}}
                onEdit={() => { hbaOpenedFresh.current = false; setTrackQtyDialogOpen(true); }}
                disabled={!canEditTrackQty}
              />
            )}

            {/* HBA Listing toggle */}
            {canViewHbaListing && (
              <ToggleRow
                label="HBA Listing"
                checked={hbaEnabled}
                onChange={canEditHbaListing ? handleHbaToggle : () => {}}
                onEdit={() => { hbaOpenedFresh.current = false; setHbaDialogOpen(true); }}
                disabled={!canEditHbaListing}
              />
            )}

            {/* Refill Checklist toggle */}
            {isAdmin && (
              <ToggleRow
                label="Refill Checklist"
                checked={refillChecklistEnabled}
                onChange={handleRefillChecklistToggle}
              />
            )}

            {/* Warehouse Locations */}
            {warehouseLocationChips.length > 0 && (
              <Box mt={1.5}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em", mb: 1 }}>
                  Warehouse Locations
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={0.75}>
                  {warehouseLocationChips.map((loc) => (
                    <Chip
                      key={loc}
                      label={loc}
                      size="small"
                      sx={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 1, fontWeight: 600, fontSize: 12 }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Product Image + Fragrance Notes */}
            <Box mt={1.5} display="flex" gap={2} alignItems="flex-start">
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em", mb: 1 }}>
                  Product Image
                </Typography>
                <Box
                  sx={{
                    width: 160, height: 160,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {productObject.image ? (
                    <img
                      src={productObject.image}
                      alt={productObject.itemName}
                      style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <Typography sx={{ fontSize: 12, color: "#94a3b8", textAlign: "center", px: 2 }}>
                      No image
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Fragrance Notes */}
              {fragranceNotes && (fragranceNotes.top.length > 0 || fragranceNotes.middle.length > 0 || fragranceNotes.base.length > 0) && (
                <Box flex={1}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em", mb: 1 }}>
                    Fragrance Notes
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={1}>
                    {([
                      { key: 'top',    label: 'Top',    color: '#92400e', bg: '#fef3c7', border: '#fde68a', dot: '#f59e0b' },
                      { key: 'middle', label: 'Middle', color: '#065f46', bg: '#d1fae5', border: '#a7f3d0', dot: '#10b981' },
                      { key: 'base',   label: 'Base',   color: '#4c1d95', bg: '#ede9fe', border: '#ddd6fe', dot: '#6366f1' },
                    ] as const).map(({ key, label, color, bg, border, dot }) =>
                      fragranceNotes[key].length > 0 && (
                        <Box key={key}>
                          <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                            <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{label}</Typography>
                          </Box>
                          <Box display="flex" flexWrap="wrap" gap={0.5}>
                            {fragranceNotes[key].map(n => (
                              <Chip
                                key={n.name}
                                label={n.name}
                                size="small"
                                sx={{ background: bg, border: `1px solid ${border}`, color, fontSize: 11, height: 22 }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {/* Vendor Pricing + Inbound History — stacked in col 3 */}
        {(isAdmin || canViewInboundHistory) && (
          <Box sx={panelSx}>
            {/* Vendor Pricing section */}
            {isAdmin && (
              <>
                <Box sx={panelHeaderSx}>
                  <Typography sx={panelTitleSx}>Vendor Pricing</Typography>
                  {averagePrice !== null && (
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#16a34a" }}>
                      Avg ${averagePrice.toFixed(2)}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ maxHeight: 220, overflowY: "auto" }}>
                  {vendorPrices.length === 0 ? (
                    <Box sx={{ p: 2.5 }}>
                      <Typography sx={{ fontSize: 13, color: "#94a3b8" }}>No vendor prices recorded.</Typography>
                    </Box>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                      <thead>
                        <tr>
                          {["Vendor", "Invoice", "Price", "Qty"].map((h, i) => (
                            <th key={h} style={{ textAlign: i >= 2 ? "right" : "left", padding: "8px 14px", color: "#374151", fontWeight: 700, fontSize: 13, borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {vendorPrices.map((vp: any) => (
                          <tr key={vp.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                            <td style={{ padding: "9px 14px", color: "#111827", fontWeight: 500 }}>{vp.vendorName || vp.vendor || "Unknown"}</td>
                            <td style={{ padding: "9px 14px", color: "#6b7280" }}>{vp.vendorInvoiceNumber || ""}</td>
                            <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, color: "#111827" }}>${parseFloat(vp.price).toFixed(2)}</td>
                            <td style={{ padding: "9px 14px", textAlign: "right", color: "#111827", fontWeight: 500 }}>{vp.quantity ?? 1}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Box>
              </>
            )}

            {/* Divider between sections */}
            {isAdmin && canViewInboundHistory && (
              <Box sx={{ borderTop: "2px solid #e2e8f0" }} />
            )}

            {/* Inbound History section */}
            {canViewInboundHistory && (
              <>
                <Box sx={{ ...panelHeaderSx, borderTop: isAdmin ? "none" : undefined }}>
                  <Typography sx={panelTitleSx}>Inbound History</Typography>
                  <Typography sx={{ fontSize: 13, color: "#374151" }}>{inboundHistory.length} records</Typography>
                </Box>
                <Box sx={{ maxHeight: 220, overflowY: "auto" }}>
                  {inboundHistory.length === 0 ? (
                    <Box sx={{ p: 2.5 }}>
                      <Typography sx={{ fontSize: 13, color: "#94a3b8" }}>No inbound records found.</Typography>
                    </Box>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                      <thead>
                        <tr>
                          {["Date", "Vendor", "Invoice", "Qty"].map((h, i) => (
                            <th key={h} style={{ textAlign: i === 3 ? "right" : "left", padding: "8px 14px", color: "#374151", fontWeight: 700, fontSize: 13, borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {inboundHistory.map((record: any) => {
                          const name = record.vendorName || record.vendor || "Unknown vendor";
                          const invoice = record.vendorInvoiceNumber || "";
                          return (
                            <tr key={record.compositeSku} style={{ borderBottom: "1px solid #f8fafc" }}>
                              <td style={{ padding: "9px 14px", color: "#6b7280", fontWeight: 500 }}>
                                {record.date ? new Date(record.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                              </td>
                              <td style={{ padding: "9px 14px", color: "#111827", fontWeight: 500 }}>{name}</td>
                              <td style={{ padding: "9px 14px", color: "#6b7280" }}>{invoice}</td>
                              <td style={{ padding: "7px 12px", textAlign: "right", fontWeight: 600, color: "#16a34a" }}>+{record.quantity}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </Box>
              </>
            )}
          </Box>
        )}
      </Box>

      {/* ── BOTTOM ROW: Sales Trend + Avg Price ── */}
      {isAdmin && <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mt: 2 }}>

        {/* Sales Trend */}
        <Box sx={panelSx}>
            <Box sx={panelHeaderSx}>
              <Typography sx={panelTitleSx}>Sales Trend — Last 6 Months</Typography>
              <Box display="flex" gap={1.5}>
                {[{ color: "#0369a1", label: "TikTok" }, { color: "#be185d", label: "Whatnot" }, { color: "#92400e", label: "eBay" }, { color: "#f59e0b", label: "Walmart" }].map(({ color, label }) => (
                  <Box key={label} display="flex" alignItems="center" gap={0.5}>
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                    <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            <Box sx={{ p: 2 }}>
              {!salesSummary ? (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 140 }}>
                  <Typography sx={{ fontSize: 12, color: "#94a3b8" }}>Loading...</Typography>
                </Box>
              ) : (() => {
                const platforms = [
                  { key: "tiktok",  color: "#0284c7", label: "TikTok" },
                  { key: "whatnot", color: "#db2777", label: "Whatnot" },
                  { key: "ebay",    color: "#b45309", label: "eBay" },
                  { key: "walmart", color: "#0ea5e9", label: "Walmart" },
                ] as const;
                const allVals = [...salesSummary.tiktok, ...salesSummary.whatnot, ...salesSummary.ebay, ...(salesSummary.walmart ?? [])];
                const maxVal = Math.max(...allVals, 1);
                const BAR_HEIGHT = 100;
                const totals = salesSummary.months.map((_, i) =>
                  salesSummary.tiktok[i] + salesSummary.whatnot[i] + salesSummary.ebay[i] + (salesSummary.walmart?.[i] ?? 0)
                );
                const grandTotal = totals.reduce((a, b) => a + b, 0);

                return (
                  <>
                    {/* Bar chart */}
                    <Box sx={{ display: "flex", alignItems: "flex-end", gap: "6px", height: BAR_HEIGHT + 20, mb: 0.5 }}>
                      {salesSummary.months.map((_, mi) => (
                        <Box key={mi} sx={{ flex: 1, display: "flex", gap: "2px", alignItems: "flex-end" }}>
                          {platforms.map((p) => {
                            const val = (salesSummary[p.key] ?? [])[mi] ?? 0;
                            const h = val > 0 ? Math.max(3, Math.round((val / maxVal) * BAR_HEIGHT)) : 0;
                            return (
                              <Box
                                key={p.key}
                                title={`${p.label}: ${val}`}
                                sx={{ flex: 1, height: h, background: p.color, borderRadius: "2px 2px 0 0", opacity: 0.85 }}
                              />
                            );
                          })}
                        </Box>
                      ))}
                    </Box>
                    {/* Month labels */}
                    <Box sx={{ display: "flex", gap: "6px", borderTop: "2px solid #e2e8f0", pt: 0.5, mb: 1.5 }}>
                      {salesSummary.months.map((m) => (
                        <Box key={m} sx={{ flex: 1, textAlign: "center" }}>
                          <Typography sx={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>{m}</Typography>
                        </Box>
                      ))}
                    </Box>
                    {/* Totals row */}
                    <Box sx={{ display: "flex", gap: 1 }}>
                      {platforms.map((p) => {
                        const total = (salesSummary[p.key] ?? []).reduce((a: number, b: number) => a + b, 0);
                        return (
                          <Box key={p.key} sx={{ flex: 1, background: "#f8fafc", borderRadius: 1.5, p: 1, textAlign: "center" }}>
                            <Typography sx={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>{p.label}</Typography>
                            <Typography sx={{ fontSize: 18, fontWeight: 800, color: p.color }}>{total}</Typography>
                          </Box>
                        );
                      })}
                      <Box sx={{ flex: 1, background: "#f0fdf4", borderRadius: 1.5, p: 1, textAlign: "center" }}>
                        <Typography sx={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Total</Typography>
                        <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#15803d" }}>{grandTotal}</Typography>
                      </Box>
                    </Box>
                  </>
                );
              })()}
            </Box>
          </Box>

        {/* Avg Price Sold + Profit */}
        <Box sx={panelSx}>
            <Box sx={panelHeaderSx}>
              <Typography sx={panelTitleSx}>Avg Price Sold</Typography>
              <Typography sx={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>All-time per platform</Typography>
            </Box>
            <Box sx={{ p: 2, display: "flex", gap: 1.5, flex: 1, alignItems: "stretch" }}>
              {!salesSummary ? (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
                  <Typography sx={{ fontSize: 13, color: "#94a3b8" }}>Loading...</Typography>
                </Box>
              ) : (
                [
                  { label: "TikTok",  color: "#0284c7", bg: "#f0f9ff", borderColor: "#bae6fd", val: salesSummary.avgPrice.tiktok,  feeRate: 0.09,  platformKey: "tiktok"  as const },
                  { label: "Whatnot", color: "#db2777", bg: "#fdf2f8", borderColor: "#fbcfe8", val: salesSummary.avgPrice.whatnot, feeRate: 0.11,  platformKey: "whatnot" as const },
                ].map(({ label, color, bg, borderColor, val, feeRate, platformKey }) => {
                  const totalUnits = salesSummary[platformKey].reduce((a: number, b: number) => a + b, 0);
                  const fee = val != null ? val * feeRate : null;
                  const profitPerUnit = val != null && averagePrice != null ? val - averagePrice - (fee ?? 0) : null;
                  const margin = profitPerUnit != null && val != null && val > 0 ? (profitPerUnit / val) * 100 : null;
                  const totalRevenue = val != null && totalUnits > 0 ? val * totalUnits : null;
                  const totalProfit = profitPerUnit != null && totalUnits > 0 ? profitPerUnit * totalUnits : null;
                  const profitColor = profitPerUnit == null ? "#94a3b8" : profitPerUnit >= 0 ? "#16a34a" : "#dc2626";
                  return (
                    <Box key={label} sx={{ flex: 1, background: bg, border: `1px solid ${borderColor}`, borderRadius: 2, p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                      <Typography sx={{ fontSize: 11, color, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>{label}</Typography>

                      <Box sx={{ textAlign: "center" }}>
                        <Typography sx={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Avg Price</Typography>
                        <Typography sx={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1.2 }}>
                          {val != null ? `$${val.toFixed(2)}` : "—"}
                        </Typography>
                      </Box>

                      <Box sx={{ borderTop: `1px solid ${borderColor}`, pt: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Est. Profit/unit</Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 800, color: profitColor }}>
                            {profitPerUnit != null ? `${profitPerUnit >= 0 ? "+" : ""}$${profitPerUnit.toFixed(2)}` : "—"}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Margin</Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 800, color: profitColor }}>
                            {margin != null ? `${margin.toFixed(1)}%` : "—"}
                          </Typography>
                        </Box>
                        {averagePrice == null && (
                          <Typography sx={{ fontSize: 10, color: "#94a3b8", textAlign: "center", mt: 0.5 }}>No cost data</Typography>
                        )}
                      </Box>

                      <Box sx={{ borderTop: `1px solid ${borderColor}`, pt: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
                        <Typography sx={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", mb: 0.25 }}>6-Month Totals</Typography>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Revenue</Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                            {totalRevenue != null ? `$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Total Profit</Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 800, color: totalProfit == null ? "#94a3b8" : totalProfit >= 0 ? "#16a34a" : "#dc2626" }}>
                            {totalProfit != null ? `${totalProfit >= 0 ? "+" : ""}$${totalProfit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Units Sold</Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{totalUnits}</Typography>
                        </Box>
                      </Box>
                    </Box>
                  );
                })
              )}
            </Box>
          </Box>
      </Box>}

      {/* ── Hidden print label ── */}
      <div style={{ display: "none" }}>
        <PrintableLabel ref={labelRef} product={productObject} productDetails={productDetails} />
      </div>

      {/* ── TRACK QUANTITY DIALOG ── */}
      <Dialog open={trackQtyDialogOpen} onClose={() => handleTrackQtyDialogClose(true)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 15 }}>Track Quantity Settings</DialogTitle>
        <DialogContent>
          <TextField
            label="Minimum Quantity"
            type="number"
            fullWidth
            size="small"
            margin="dense"
            value={minimumQuantity}
            onChange={(e) => setMinimumQuantity(e.target.value)}
            inputProps={{ min: 0 }}
            helperText="Alert when stock falls below this number"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => handleTrackQtyDialogClose(true)} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveTrackQty}
            disabled={savingTrackQty}
            sx={{ textTransform: "none", background: "#2563eb", "&:hover": { background: "#1d4ed8" } }}
          >
            {savingTrackQty ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── HBA LISTING DIALOG ── */}
      <Dialog open={hbaDialogOpen} onClose={() => handleHbaDialogClose(true)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 15 }}>HBA Listing Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mt: 0.5 }}>
            <TextField
              label="HBA Quantity"
              type="number"
              size="small"
              value={hbaQuantity}
              onChange={(e) => setHbaQuantity(e.target.value)}
              disabled={!canEditHbaListing}
              inputProps={{ min: 0 }}
            />
            <TextField
              label="HBA Price ($)"
              type="number"
              size="small"
              value={hbaPrice}
              onChange={(e) => setHbaPrice(e.target.value)}
              disabled={!canEditHbaListing}
              inputProps={{ min: 0, step: "0.01" }}
            />
            <TextField
              label="MOQ"
              type="number"
              size="small"
              value={hbaMoq}
              onChange={(e) => setHbaMoq(e.target.value)}
              disabled={!canEditHbaListing}
              inputProps={{ min: 1, step: 1 }}
              helperText="Min order quantity"
            />
            <TextField
              label="Step Count"
              type="number"
              size="small"
              value={hbaStepCount}
              onChange={(e) => setHbaStepCount(e.target.value)}
              disabled={!canEditHbaListing}
              inputProps={{ min: 1, step: 1 }}
              helperText="Order increment"
            />
          </Box>
          <TextField
            select
            label="HBA Condition"
            size="small"
            fullWidth
            value={hbaCondition}
            onChange={(e) => setHbaCondition(e.target.value)}
            disabled={!canEditHbaListing}
            helperText={`SKU condition: ${productObject.condition || "N/A"}`}
            sx={{ mt: 1.5 }}
          >
            <MenuItem value="">Use SKU condition</MenuItem>
            {HBA_CONDITION_OPTIONS.map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Switch
                checked={hbaNewArrival}
                onChange={(e) => setHbaNewArrival(e.target.checked)}
                disabled={!canEditHbaListing}
                size="small"
                sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: "#2563eb" }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#2563eb" } }}
              />
            }
            label={<Typography sx={{ fontSize: 13 }}>New Arrival</Typography>}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => handleHbaDialogClose(true)} sx={{ textTransform: "none" }}>Cancel</Button>
          {canEditHbaListing && (
            <Button
              variant="contained"
              onClick={handleSaveHba}
              disabled={savingHba}
              sx={{ textTransform: "none", background: "#2563eb", "&:hover": { background: "#1d4ed8" } }}
            >
              {savingHba ? "Saving..." : "Save HBA"}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ── RESTOCK DIALOG ── */}
      {isAdmin && (
        <Dialog open={restockDialogOpen} onClose={() => setRestockDialogOpen(false)}>
          <DialogTitle>Restock Product</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus margin="dense" label="Quantity" type="number" fullWidth
              value={restockQuantity}
              onChange={(e) => setRestockQuantity(Number(e.target.value))}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRestockDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => { handleRestockClick(); setRestockDialogOpen(false); }}>Restock</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* ── UPDATE PRICE DIALOG ── */}
      {isAdmin && (
        <Dialog open={priceDialogOpen} onClose={() => setPriceDialogOpen(false)}>
          <DialogTitle>Update Product Price</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus margin="dense" label="Price" type="number" fullWidth
              value={updatePrice}
              onChange={(e) => setUpdatePrice(Number(e.target.value))}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPriceDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => { handlePriceUpdateClick(); setPriceDialogOpen(false); }}>Update</Button>
          </DialogActions>
        </Dialog>
      )}

    </Box>
  );
}

export default Product;

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
} from "@mui/icons-material";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
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
import { styled } from "@mui/material/styles";
import { getApiUrl } from "../config/api";
import { useAuth } from "../context/AuthContext";

type UploadSummary = {
  id: number;
  vendorName: string;
  originalName: string;
  productCount: number;
  createdAt: string;
  catalogVersion: number;
};

type SearchOffer = {
  id: number;
  vendorName: string;
  upc?: string | null;
  brand?: string | null;
  productName: string;
  price: number;
  availableQty?: number | null;
  identityKey: string;
};

type CartItem = {
  id: number;
  vendorName: string;
  identityKey: string;
  upc?: string | null;
  brand?: string | null;
  productName: string;
  price: number;
  availableQty?: number | null;
  quantity: number;
};

type DashboardResponse = {
  uploads: UploadSummary[];
  cartItems: CartItem[];
  cartHasItems: boolean;
  cartFrozen: boolean;
  cartMessage?: string | null;
  activeCatalogVersion: number;
  cartCatalogVersion?: number | null;
};

const VisuallyHiddenInput = styled("input")({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  overflow: "hidden",
  position: "absolute",
  bottom: 0,
  left: 0,
  whiteSpace: "nowrap",
  width: 1,
});

const PriceList = () => {
  const { token, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingCart, setSavingCart] = useState(false);
  const [clearingCart, setClearingCart] = useState(false);
  const [uploads, setUploads] = useState<UploadSummary[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartFrozen, setCartFrozen] = useState(false);
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchOffer[]>([]);
  const [searching, setSearching] = useState(false);
  const [rowQuantities, setRowQuantities] = useState<Record<number, string>>({});
  const [cartQuantities, setCartQuantities] = useState<Record<number, string>>({});

  const canCreate = hasPermission("pricelist", "create");
  const canEdit = hasPermission("pricelist", "edit");

  const loadDashboard = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await axios.get<DashboardResponse>(getApiUrl("api/price-list/dashboard"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUploads(response.data.uploads || []);
      setCartItems(response.data.cartItems || []);
      setCartFrozen(Boolean(response.data.cartFrozen));
      setCartMessage(response.data.cartMessage || null);
      setCartQuantities(
        (response.data.cartItems || []).reduce<Record<number, string>>((acc, item) => {
          acc[item.id] = String(item.quantity || 1);
          return acc;
        }, {})
      );
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to load price list data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setSearching(true);
        const response = await axios.get<SearchOffer[]>(getApiUrl("api/price-list/search"), {
          params: { query: trimmed },
          headers: { Authorization: `Bearer ${token}` },
        });
        setSearchResults(response.data || []);
      } catch (error: any) {
        toast.error(error.response?.data?.error || "Failed to search price lists.");
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchQuery, token]);

  const cartGroups = useMemo(() => {
    return cartItems.reduce<Record<string, CartItem[]>>((acc, item) => {
      if (!acc[item.vendorName]) {
        acc[item.vendorName] = [];
      }
      acc[item.vendorName].push(item);
      return acc;
    }, {});
  }, [cartItems]);

  const cartSummary = useMemo(() => {
    const vendorCount = Object.keys(cartGroups).length;
    const lineCount = cartItems.length;
    const totalUnits = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalValue = cartItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0),
      0
    );

    const vendorTotals = Object.entries(cartGroups).map(([vendor, items]) => ({
      vendor,
      lines: items.length,
      units: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      total: items.reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0),
        0
      ),
    }));

    return {
      vendorCount,
      lineCount,
      totalUnits,
      totalValue,
      vendorTotals,
    };
  }, [cartGroups, cartItems]);

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Choose a pricelist file first.");
      return;
    }
    if (!vendorName.trim()) {
      toast.error("Enter the vendor name for this upload.");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("vendorName", vendorName.trim());

      const response = await axios.post<DashboardResponse & { message: string }>(
        getApiUrl("api/price-list/upload"),
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      toast.success(response.data.message || "Pricelist uploaded.");
      setUploads(response.data.uploads || []);
      setCartItems(response.data.cartItems || []);
      setCartFrozen(Boolean(response.data.cartFrozen));
      setCartMessage(response.data.cartMessage || null);
      setCartQuantities(
        (response.data.cartItems || []).reduce<Record<number, string>>((acc, item) => {
          acc[item.id] = String(item.quantity || 1);
          return acc;
        }, {})
      );
      setVendorName("");
      setSelectedFile(null);
      setSearchQuery("");
      setSearchResults([]);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to upload pricelist.");
    } finally {
      setUploading(false);
    }
  };

  const handleAddToCart = async (offer: SearchOffer) => {
    try {
      const rawQuantity = Number(rowQuantities[offer.id] || 1);
      const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? Math.floor(rawQuantity) : 1;
      const response = await axios.post<DashboardResponse & { warning?: string | null; message?: string }>(
        getApiUrl("api/price-list/cart/items"),
        { offerId: offer.id, quantity },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setCartItems(response.data.cartItems || []);
      setCartFrozen(Boolean(response.data.cartFrozen));
      setCartMessage(response.data.cartMessage || null);
      setCartQuantities(
        (response.data.cartItems || []).reduce<Record<number, string>>((acc, item) => {
          acc[item.id] = String(item.quantity || 1);
          return acc;
        }, {})
      );
      setRowQuantities((prev) => {
        const next = { ...prev };
        delete next[offer.id];
        return next;
      });
      if (response.data.warning) {
        toast.warning(response.data.warning);
      } else {
        toast.success(response.data.message || "Added to cart.");
      }
    } catch (error: any) {
      const message = error.response?.data?.error || "Failed to add item to cart.";
      toast.error(message);
      if (error.response?.data?.staleCart) {
        setCartFrozen(true);
        setCartMessage(message);
      }
    }
  };

  const handleCartQuantityUpdate = async (item: CartItem) => {
    try {
      const rawQuantity = Number(cartQuantities[item.id] || item.quantity || 1);
      const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? Math.floor(rawQuantity) : 1;
      const response = await axios.patch<DashboardResponse & { warning?: string | null }>(
        getApiUrl(`api/price-list/cart/items/${item.id}`),
        { quantity },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setCartItems(response.data.cartItems || []);
      setCartFrozen(Boolean(response.data.cartFrozen));
      setCartMessage(response.data.cartMessage || null);
      setCartQuantities(
        (response.data.cartItems || []).reduce<Record<number, string>>((acc, row) => {
          acc[row.id] = String(row.quantity || 1);
          return acc;
        }, {})
      );
      if (response.data.warning) {
        toast.warning(response.data.warning);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update cart quantity.");
    }
  };

  const handleDeleteCartItem = async (itemId: number) => {
    try {
      const response = await axios.delete<DashboardResponse & { message?: string }>(
        getApiUrl(`api/price-list/cart/items/${itemId}`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setCartItems(response.data.cartItems || []);
      setCartFrozen(Boolean(response.data.cartFrozen));
      setCartMessage(response.data.cartMessage || null);
      setCartQuantities(
        (response.data.cartItems || []).reduce<Record<number, string>>((acc, row) => {
          acc[row.id] = String(row.quantity || 1);
          return acc;
        }, {})
      );
      toast.success(response.data.message || "Cart item removed.");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to delete cart item.");
    }
  };

  const handleClearCart = async () => {
    try {
      setClearingCart(true);
      const response = await axios.delete<DashboardResponse & { message?: string }>(
        getApiUrl("api/price-list/cart/clear"),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setCartItems(response.data.cartItems || []);
      setCartFrozen(Boolean(response.data.cartFrozen));
      setCartMessage(response.data.cartMessage || null);
      setCartQuantities({});
      toast.success(response.data.message || "Cart cleared.");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to clear cart.");
    } finally {
      setClearingCart(false);
    }
  };

  const handleSaveCart = async () => {
    try {
      setSavingCart(true);
      const response = await axios.get(getApiUrl("api/price-list/cart/export"), {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/zip" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `pricelist-cart-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success("Vendor order files downloaded.");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to export cart.");
    } finally {
      setSavingCart(false);
    }
  };

  return (
    <Box sx={{ mt: 3, mb: 4, px: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            PriceList
          </Typography>
          <Typography color="text.secondary">
            Upload the latest vendor pricelists, search across active offers, and build shared vendor buckets for ordering.
          </Typography>
        </Box>

        {cartMessage && (
          <Alert severity={cartFrozen ? "warning" : "info"}>
            {cartMessage}
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                  Upload Pricelist
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Vendor Name"
                    value={vendorName}
                    onChange={(event) => setVendorName(event.target.value)}
                    disabled={!canCreate || uploading}
                  />
                  <Button component="label" variant="outlined" startIcon={<UploadIcon />} disabled={!canCreate || uploading}>
                    {selectedFile ? selectedFile.name : "Choose File"}
                    <VisuallyHiddenInput
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                    />
                  </Button>
                  <Button variant="contained" onClick={handleUpload} disabled={!canCreate || uploading}>
                    {uploading ? "Uploading..." : "Upload Latest Pricelist"}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                  Active Vendor Pricelists
                </Typography>
                {loading ? (
                  <Box display="flex" justifyContent="center" py={3}>
                    <CircularProgress />
                  </Box>
                ) : uploads.length < 1 ? (
                  <Typography color="text.secondary">No active vendor pricelists uploaded yet.</Typography>
                ) : (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Vendor</TableCell>
                          <TableCell>File</TableCell>
                          <TableCell>Offers</TableCell>
                          <TableCell>Uploaded</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {uploads.map((upload) => (
                          <TableRow key={upload.id}>
                            <TableCell>{upload.vendorName}</TableCell>
                            <TableCell>{upload.originalName}</TableCell>
                            <TableCell>{upload.productCount}</TableCell>
                            <TableCell>{new Date(upload.createdAt).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
              Search Active Offers
            </Typography>
            <Autocomplete
              freeSolo
              options={searchResults}
              getOptionLabel={(option) =>
                typeof option === "string"
                  ? option
                  : `${option.productName} - ${option.vendorName}${option.upc ? ` (${option.upc})` : ""}`
              }
              filterOptions={(options) => options}
              loading={searching}
              inputValue={searchQuery}
              onInputChange={(_, value) => setSearchQuery(value)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search by UPC, brand, or product name"
                  helperText="Every search behaves like a substring/token search across the active vendor lists."
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={`${option.id}-${option.vendorName}`}>
                  <Stack sx={{ width: "100%" }}>
                    <Typography fontWeight={600}>{option.productName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {option.vendorName} | ${Number(option.price || 0).toFixed(2)}
                      {option.availableQty !== null && option.availableQty !== undefined ? ` | Avail ${option.availableQty}` : " | Avail -"}
                    </Typography>
                  </Stack>
                </Box>
              )}
            />

            <Box sx={{ mt: 2 }}>
              {searchQuery.trim() && !searching && searchResults.length < 1 ? (
                <Alert severity="info">No active offers matched that search.</Alert>
              ) : null}
            </Box>

            {searchResults.length > 0 && (
              <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Vendor</TableCell>
                      <TableCell>Brand</TableCell>
                      <TableCell>Item</TableCell>
                      <TableCell>UPC</TableCell>
                      <TableCell>Price</TableCell>
                      <TableCell>Available</TableCell>
                      <TableCell>Qty</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {searchResults.map((offer) => (
                      <TableRow key={`${offer.id}-${offer.vendorName}`}>
                        <TableCell>{offer.vendorName}</TableCell>
                        <TableCell>{offer.brand || "-"}</TableCell>
                        <TableCell>{offer.productName}</TableCell>
                        <TableCell>{offer.upc || "-"}</TableCell>
                        <TableCell>${Number(offer.price || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          {offer.availableQty === null || offer.availableQty === undefined ? "-" : offer.availableQty}
                        </TableCell>
                        <TableCell sx={{ width: 110 }}>
                          <TextField
                            size="small"
                            type="number"
                            inputProps={{ min: 1, step: 1 }}
                            value={rowQuantities[offer.id] ?? ""}
                            onChange={(event) =>
                              setRowQuantities((prev) => ({ ...prev, [offer.id]: event.target.value }))
                            }
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<AddIcon />}
                            disabled={!canEdit || cartFrozen}
                            onClick={() => handleAddToCart(offer)}
                          >
                            Add
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              spacing={2}
              sx={{ mb: 2 }}
            >
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  Shared Team Cart
                </Typography>
                <Typography color="text.secondary">
                  Items are grouped by vendor and stay shared until the team clears the cart.
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleClearCart}
                  disabled={!canEdit || clearingCart || cartItems.length < 1}
                >
                  {clearingCart ? "Clearing..." : "Clear Cart"}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={handleSaveCart}
                  disabled={savingCart || cartItems.length < 1}
                >
                  {savingCart ? "Preparing..." : "Save Cart"}
                </Button>
              </Stack>
            </Stack>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6} md={3}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Vendors
                  </Typography>
                  <Typography variant="h5" fontWeight={700}>
                    {cartSummary.vendorCount}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Lines
                  </Typography>
                  <Typography variant="h5" fontWeight={700}>
                    {cartSummary.lineCount}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Units
                  </Typography>
                  <Typography variant="h5" fontWeight={700}>
                    {cartSummary.totalUnits}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Cart Total
                  </Typography>
                  <Typography variant="h5" fontWeight={700}>
                    ${cartSummary.totalValue.toFixed(2)}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {cartSummary.vendorTotals.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2, mb: 2, backgroundColor: "#fafafa" }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                  Vendor Totals
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {cartSummary.vendorTotals.map((entry) => (
                    <Chip
                      key={entry.vendor}
                      variant="outlined"
                      label={`${entry.vendor}: ${entry.lines} lines | ${entry.units} units | $${entry.total.toFixed(2)}`}
                    />
                  ))}
                </Stack>
              </Paper>
            )}

            {cartItems.length < 1 ? (
              <Alert severity="info">The shared cart is empty right now.</Alert>
            ) : (
              <Stack spacing={2}>
                {Object.entries(cartGroups).map(([vendor, items]) => (
                  <Paper key={vendor} variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {vendor}
                      </Typography>
                      <Chip label={`${items.length} line${items.length === 1 ? "" : "s"}`} size="small" />
                    </Stack>
                    <Divider sx={{ mb: 1.5 }} />
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Brand</TableCell>
                            <TableCell>Item</TableCell>
                            <TableCell>UPC</TableCell>
                            <TableCell>Price</TableCell>
                            <TableCell>Available</TableCell>
                            <TableCell>Qty</TableCell>
                            <TableCell align="right">Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.brand || "-"}</TableCell>
                              <TableCell>{item.productName}</TableCell>
                              <TableCell>{item.upc || "-"}</TableCell>
                              <TableCell>${Number(item.price || 0).toFixed(2)}</TableCell>
                              <TableCell>
                                {item.availableQty === null || item.availableQty === undefined ? "-" : item.availableQty}
                              </TableCell>
                              <TableCell sx={{ width: 110 }}>
                                <TextField
                                  size="small"
                                  type="number"
                                  inputProps={{ min: 1, step: 1 }}
                                  value={cartQuantities[item.id] || String(item.quantity || 1)}
                                  onChange={(event) =>
                                    setCartQuantities((prev) => ({ ...prev, [item.id]: event.target.value }))
                                  }
                                  onBlur={() => handleCartQuantityUpdate(item)}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <IconButton color="error" disabled={!canEdit} onClick={() => handleDeleteCartItem(item.id)}>
                                  <DeleteIcon />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};

export default PriceList;

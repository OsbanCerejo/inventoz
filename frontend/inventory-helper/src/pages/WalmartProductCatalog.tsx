import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
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

const getListingStatusColor = (status?: string | null) => {
  const value = String(status || "").trim().toLowerCase();
  if (!value) return "default";
  if (value.includes("retire") || value.includes("unpublish") || value.includes("error") || value.includes("inactive")) {
    return "error";
  }
  if (value.includes("stage") || value.includes("review") || value.includes("progress")) return "warning";
  if (value.includes("publish") || value.includes("active")) return "success";
  return "default";
};

const formatMoney = (amount: any, currency?: string | null) => {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return "—";
  if (!currency || currency === "USD") return `$${numeric.toFixed(2)}`;
  return `${currency} ${numeric.toFixed(2)}`;
};

function WalmartProductCatalog() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [listingStatusOptions, setListingStatusOptions] = useState<string[]>([]);
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: "",
    mappingStatus: "",
    listingStatus: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    mappingStatus: "",
    listingStatus: "",
  });
  const [priceDialog, setPriceDialog] = useState<{
    open: boolean;
    row: any | null;
    price: string;
    currency: string;
  }>({ open: false, row: null, price: "", currency: "USD" });
  const [inventoryDialog, setInventoryDialog] = useState<{
    open: boolean;
    row: any | null;
    quantity: string;
    shipNode: string;
  }>({ open: false, row: null, quantity: "", shipNode: "" });

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(getApiUrl("walmart-products"), {
        params: { ...appliedFilters, page: page + 1, pageSize },
      });
      setRows(data?.rows || []);
      setTotalCount(Number(data?.count || 0));
      setListingStatusOptions(Array.isArray(data?.listingStatusOptions) ? data.listingStatusOptions : []);
    } catch (error: any) {
      console.error("Failed to load Walmart product catalog:", error);
      toast.error(error?.response?.data?.error || "Failed to load Walmart product catalog.");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page, pageSize]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const summary = useMemo(() => {
    const mapped = rows.filter((row) => row.mappingStatus === "mapped").length;
    const unmapped = rows.filter((row) => row.mappingStatus !== "mapped").length;
    return { total: totalCount, mapped, unmapped };
  }, [rows, totalCount]);

  const openPriceDialog = (row: any) => {
    setPriceDialog({
      open: true,
      row,
      price: row?.currentPrice === null || row?.currentPrice === undefined ? "" : String(row.currentPrice),
      currency: row?.currency || "USD",
    });
  };

  const openInventoryDialog = (row: any) => {
    setInventoryDialog({
      open: true,
      row,
      quantity: row?.availableQuantity === null || row?.availableQuantity === undefined ? "" : String(row.availableQuantity),
      shipNode: row?.shipNode && row.shipNode !== "MULTI_NODE" ? String(row.shipNode) : "",
    });
  };

  const handleSavePrice = async () => {
    if (!priceDialog.row?.walmartSku) return;
    setSavingAction(`price-${priceDialog.row.walmartSku}`);
    try {
      await axios.put(getApiUrl(`walmart-products/${encodeURIComponent(priceDialog.row.walmartSku)}/price`), {
        price: priceDialog.price,
        currency: priceDialog.currency || "USD",
      });
      toast.success("Walmart price updated.");
      setPriceDialog({ open: false, row: null, price: "", currency: "USD" });
      await loadCatalog();
    } catch (error: any) {
      console.error("Failed to update Walmart price:", error);
      toast.error(error?.response?.data?.error || "Failed to update Walmart price.");
    } finally {
      setSavingAction(null);
    }
  };

  const handleSaveInventory = async () => {
    if (!inventoryDialog.row?.walmartSku) return;
    setSavingAction(`inventory-${inventoryDialog.row.walmartSku}`);
    try {
      await axios.put(getApiUrl(`walmart-products/${encodeURIComponent(inventoryDialog.row.walmartSku)}/inventory`), {
        quantity: inventoryDialog.quantity,
        shipNode: inventoryDialog.shipNode || undefined,
      });
      toast.success("Walmart inventory updated.");
      setInventoryDialog({ open: false, row: null, quantity: "", shipNode: "" });
      await loadCatalog();
    } catch (error: any) {
      console.error("Failed to update Walmart inventory:", error);
      toast.error(error?.response?.data?.error || "Failed to update Walmart inventory.");
    } finally {
      setSavingAction(null);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Walmart Product Catalog
          </Typography>
          <Typography color="text.secondary">
            Review synced Walmart SKUs, mapping status, listing state, price, and available quantity in one place.
          </Typography>
        </Box>

        <Paper sx={{ p: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search SKU / Name"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel id="walmart-mapping-status-label">Mapping Status</InputLabel>
                <Select
                  labelId="walmart-mapping-status-label"
                  label="Mapping Status"
                  value={filters.mappingStatus}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, mappingStatus: String(event.target.value) }))
                  }
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="mapped">Mapped</MenuItem>
                  <MenuItem value="unmapped">Unmapped</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel id="walmart-listing-status-label">Listing Status</InputLabel>
                <Select
                  labelId="walmart-listing-status-label"
                  label="Listing Status"
                  value={filters.listingStatus}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, listingStatus: String(event.target.value) }))
                  }
                >
                  <MenuItem value="">All</MenuItem>
                  {listingStatusOptions.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Stack direction="row" spacing={1} sx={{ height: "100%" }} alignItems="center">
                <Chip
                  clickable
                  color="primary"
                  label="Apply"
                  onClick={() => {
                    const nextFilters = { ...filters };
                    const sameFilters = JSON.stringify(nextFilters) === JSON.stringify(appliedFilters);
                    setAppliedFilters(nextFilters);
                    if (page === 0 && sameFilters) {
                      loadCatalog();
                    } else {
                      setPage(0);
                    }
                  }}
                />
                <Chip
                  clickable
                  variant="outlined"
                  label="Clear"
                  onClick={() => {
                    setPage(0);
                    const cleared = { search: "", mappingStatus: "", listingStatus: "" };
                    setFilters(cleared);
                    setAppliedFilters(cleared);
                  }}
                />
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="overline">Catalog Rows</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {summary.total}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="overline">Mapped On Page</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {summary.mapped}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="overline">Unmapped On Page</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {summary.unmapped}
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
                  <TableCell>Walmart SKU</TableCell>
                  <TableCell>Local SKU</TableCell>
                  <TableCell>Product Name</TableCell>
                  <TableCell>Listing Status</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>Inventory</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.walmartSku || "—"}</TableCell>
                    <TableCell>{row.localSku || "—"}</TableCell>
                    <TableCell>{row.productName || "—"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.listingStatus || "—"}
                        color={getListingStatusColor(row.listingStatus)}
                      />
                    </TableCell>
                    <TableCell>{formatMoney(row.currentPrice, row.currency)}</TableCell>
                    <TableCell>{row.availableQuantity ?? "—"}</TableCell>
                    <TableCell>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button size="small" variant="outlined" onClick={() => openPriceDialog(row)}>
                          Edit Price
                        </Button>
                        <Button size="small" variant="outlined" onClick={() => openInventoryDialog(row)}>
                          Edit Inventory
                        </Button>
                      </Stack>
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

      <Dialog open={priceDialog.open} onClose={() => setPriceDialog({ open: false, row: null, price: "", currency: "USD" })} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Walmart Price</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Updating exact Walmart SKU: <strong>{priceDialog.row?.walmartSku || "—"}</strong>
            </Typography>
            <TextField
              label="Price"
              type="number"
              inputProps={{ min: 0, step: "0.01" }}
              value={priceDialog.price}
              onChange={(event) => setPriceDialog((current) => ({ ...current, price: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Currency"
              value={priceDialog.currency}
              onChange={(event) => setPriceDialog((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPriceDialog({ open: false, row: null, price: "", currency: "USD" })}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSavePrice}
            disabled={savingAction === `price-${priceDialog.row?.walmartSku}`}
          >
            {savingAction === `price-${priceDialog.row?.walmartSku}` ? "Saving..." : "Save Price"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={inventoryDialog.open} onClose={() => setInventoryDialog({ open: false, row: null, quantity: "", shipNode: "" })} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Walmart Inventory</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Updating exact Walmart SKU: <strong>{inventoryDialog.row?.walmartSku || "—"}</strong>
            </Typography>
            <TextField
              label="Ship Node"
              value={inventoryDialog.shipNode}
              onChange={(event) => setInventoryDialog((current) => ({ ...current, shipNode: event.target.value }))}
              helperText={
                inventoryDialog.row?.shipNode === "MULTI_NODE"
                  ? "This SKU has multiple ship nodes. Enter the exact ship node you want Walmart to update."
                  : "Leave blank to use Walmart's default node if your account allows it."
              }
              fullWidth
            />
            <TextField
              label="Quantity"
              type="number"
              inputProps={{ min: 0, step: 1 }}
              value={inventoryDialog.quantity}
              onChange={(event) => setInventoryDialog((current) => ({ ...current, quantity: event.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInventoryDialog({ open: false, row: null, quantity: "", shipNode: "" })}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveInventory}
            disabled={savingAction === `inventory-${inventoryDialog.row?.walmartSku}`}
          >
            {savingAction === `inventory-${inventoryDialog.row?.walmartSku}` ? "Saving..." : "Save Inventory"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default WalmartProductCatalog;

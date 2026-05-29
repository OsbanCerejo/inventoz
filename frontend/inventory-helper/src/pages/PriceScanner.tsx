import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import ScienceIcon from "@mui/icons-material/Science";
import { getApiUrl } from "../config/api";

type PriceScanProduct = {
  sku: string;
  alternativeSku?: string | null;
  upc?: string | number | null;
  brand: string;
  itemName: string;
  quantity?: number | null;
  location?: string | null;
  sizeOz?: string | number | null;
  sizeMl?: string | number | null;
  strength?: string | null;
  shade?: string | null;
  category?: string | null;
  condition?: string | null;
  image?: string | null;
  expectedPrice: number | null;
  tester: boolean;
  discontinued: boolean;
  sizeType?: string | null;
};

type PriceScanResponse = {
  barcode: string;
  count: number;
  matches: PriceScanProduct[];
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatMoney = (value: number | null | undefined) =>
  value === null || value === undefined ? "N/A" : currency.format(Number(value));

const hasImage = (image?: string | null) => {
  const normalized = String(image || "").trim().toLowerCase();
  return normalized.length > 0 && normalized !== "null" && normalized !== "n/a";
};

const formatSize = (product: PriceScanProduct) => {
  const sizeOz = String(product.sizeOz ?? "").trim();
  const sizeMl = String(product.sizeMl ?? "").trim();
  if (sizeOz && sizeMl) return `${sizeOz} oz / ${sizeMl} ml`;
  if (sizeOz) return `${sizeOz} oz`;
  if (sizeMl) return `${sizeMl} ml`;
  return "No size";
};

function PriceScanner() {
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<PriceScanResponse | null>(null);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedProduct = useMemo(() => {
    if (!scanResult?.matches.length) return null;
    return scanResult.matches.find((product) => product.sku === selectedSku) || scanResult.matches[0];
  }, [scanResult, selectedSku]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (scanResult?.matches.length === 1) {
      setSelectedSku(scanResult.matches[0].sku);
    }
  }, [scanResult]);

  const resetForNextScan = () => {
    setBarcode("");
    window.setTimeout(() => inputRef.current?.focus(), 80);
  };

  const handleScan = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = barcode.trim();
    if (!value) return;

    setLoading(true);
    setError(null);
    setScanResult(null);
    setSelectedSku(null);

    try {
      const response = await axios.get<PriceScanResponse>(
        getApiUrl(`products/price-scanner/${encodeURIComponent(value)}`)
      );
      setScanResult(response.data);
      resetForNextScan();
    } catch (scanError: any) {
      console.error("Failed to scan price:", scanError);
      setError(scanError?.response?.data?.error || "Failed to scan product price");
      window.setTimeout(() => inputRef.current?.focus(), 80);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ px: 3, py: 3 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        gap={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Price Scanner
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Scan an item barcode to calculate the expected selling price.
          </Typography>
        </Box>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box component="form" onSubmit={handleScan}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs>
              <TextField
                fullWidth
                inputRef={inputRef}
                label="Scan Barcode"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                disabled={loading}
                autoFocus
              />
            </Grid>
            <Grid item>
              <Button
                type="submit"
                variant="contained"
                startIcon={loading ? undefined : <QrCodeScannerIcon />}
                disabled={loading || !barcode.trim()}
                sx={{ height: 56, minWidth: 132 }}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : "Scan"}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {scanResult && scanResult.count === 0 && (
        <Paper
          variant="outlined"
          sx={{
            p: 4,
            minHeight: 220,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <Box>
            <SearchOffIcon sx={{ fontSize: 64, color: "text.secondary", mb: 1 }} />
            <Typography variant="h5" fontWeight={700}>
              No Data Found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {scanResult.barcode}
            </Typography>
          </Box>
        </Paper>
      )}

      {scanResult && scanResult.count > 1 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
            Multiple Matches
          </Typography>
          <Grid container spacing={1.5}>
            {scanResult.matches.map((product) => (
              <Grid item xs={12} sm={6} lg={4} key={product.sku}>
                <Button
                  fullWidth
                  variant={selectedSku === product.sku ? "contained" : "outlined"}
                  onClick={() => setSelectedSku(product.sku)}
                  sx={{
                    minHeight: 132,
                    justifyContent: "flex-start",
                    textAlign: "left",
                    p: 1.25,
                  }}
                >
                  <Box sx={{ display: "flex", gap: 1.25, width: "100%", minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 72,
                        height: 72,
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: selectedSku === product.sku ? "primary.light" : "divider",
                        bgcolor: "#f8fafc",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      {hasImage(product.image) ? (
                        <img
                          src={String(product.image)}
                          alt={`${product.brand} ${product.itemName}`}
                          style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          No image
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} sx={{ color: "inherit", lineHeight: 1.2 }}>
                        {product.brand} {product.itemName}
                      </Typography>
                      <Typography variant="caption" sx={{ display: "block", color: "inherit", opacity: 0.8 }}>
                        SKU: {product.sku}
                      </Typography>
                      <Typography variant="caption" sx={{ display: "block", color: "inherit", opacity: 0.8 }}>
                        {formatSize(product)}
                      </Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ mt: 0.5, color: "inherit" }}>
                        {formatMoney(product.expectedPrice)}
                      </Typography>
                    </Box>
                  </Box>
                </Button>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {selectedProduct && (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Box
                sx={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {hasImage(selectedProduct.image) ? (
                  <img
                    src={String(selectedProduct.image)}
                    alt={`${selectedProduct.brand} ${selectedProduct.itemName}`}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <Typography color="text.secondary">No image</Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} md={8}>
              <Stack spacing={2}>
                <Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                    <Chip label={selectedProduct.sku} />
                    {selectedProduct.tester && <Chip icon={<ScienceIcon />} color="error" label="Tester" />}
                    {selectedProduct.discontinued && <Chip color="warning" label="Discontinued" />}
                    {selectedProduct.condition && <Chip label={selectedProduct.condition} />}
                  </Stack>
                  <Typography variant="h5" fontWeight={700}>
                    {selectedProduct.brand} {selectedProduct.itemName}
                    {selectedProduct.strength ? ` ${selectedProduct.strength}` : ""}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {formatSize(selectedProduct)}
                    {selectedProduct.shade ? ` | ${selectedProduct.shade}` : ""}
                  </Typography>
                </Box>

                <Paper
                  variant="outlined"
                  sx={{ p: 2, bgcolor: selectedProduct.expectedPrice === null ? "#fff8e1" : "#f1f8e9" }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Expected Selling Price
                  </Typography>
                  <Typography variant="h2" fontWeight={800} sx={{ lineHeight: 1 }}>
                    {formatMoney(selectedProduct.expectedPrice)}
                  </Typography>
                  {selectedProduct.expectedPrice === null && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      No cost found for this SKU.
                    </Typography>
                  )}
                </Paper>

                <Grid container spacing={1.5}>
                  <Grid item xs={12} md={4}>
                    <Paper variant="outlined" sx={{ p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Quantity
                      </Typography>
                      <Typography variant="h6">{selectedProduct.quantity ?? "N/A"}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper variant="outlined" sx={{ p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Location
                      </Typography>
                      <Typography variant="h6">{selectedProduct.location || "N/A"}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper variant="outlined" sx={{ p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Size
                      </Typography>
                      <Typography variant="h6">{formatSize(selectedProduct)}</Typography>
                    </Paper>
                  </Grid>
                </Grid>

                <Typography variant="body2" color="text.secondary">
                  UPC: {selectedProduct.upc || "N/A"}
                </Typography>
              </Stack>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
}

export default PriceScanner;

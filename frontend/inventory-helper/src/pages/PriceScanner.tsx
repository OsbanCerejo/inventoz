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
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import ScienceIcon from "@mui/icons-material/Science";
import SearchIcon from "@mui/icons-material/Search";
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
  retailPrice: number | null;
  tester: boolean;
  discontinued: boolean;
  sizeType?: string | null;
  dupeOf?: string | null;
};

type PriceScanResponse = {
  barcode: string;
  count: number;
  matches: PriceScanProduct[];
};

type FragranceNotes = {
  top: { id: number; name: string }[];
  middle: { id: number; name: string }[];
  base: { id: number; name: string }[];
};

type NoteOption = NoteEntry;

type NoteEntry = { id: number; name: string };

type SearchProduct = {
  sku: string;
  brand: string;
  itemName: string;
  quantity: number | null;
  location: string | null;
  sizeOz: string | number | null;
  sizeMl: string | number | null;
  strength: string | null;
  shade: string | null;
  image: string | null;
  retailPrice: number | null;
  tester: boolean;
  discontinued: boolean;
  dupeOf: string | null;
  fragranceNotes?: { top: NoteEntry[]; middle: NoteEntry[]; base: NoteEntry[] };
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

const formatSize = (product: { sizeOz?: any; sizeMl?: any }) => {
  const sizeOz = String(product.sizeOz ?? "").trim();
  const sizeMl = String(product.sizeMl ?? "").trim();
  if (sizeOz && sizeMl) return `${sizeOz} oz / ${sizeMl} ml`;
  if (sizeOz) return `${sizeOz} oz`;
  if (sizeMl) return `${sizeMl} ml`;
  return "No size";
};

// ── Shared result row for search tabs ─────────────────────────────────────────
function SearchResultRow({ product }: { product: SearchProduct }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, display: "flex", gap: 2, alignItems: "flex-start" }}>
      <Box sx={{
        width: 64, height: 64, borderRadius: 1, border: "1px solid", borderColor: "divider",
        bgcolor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", flexShrink: 0,
      }}>
        {hasImage(product.image)
          ? <img src={String(product.image)} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          : <Typography variant="caption" color="text.secondary">No img</Typography>}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
          <Chip label={product.sku} size="small" />
          {product.tester && <Chip icon={<ScienceIcon />} color="error" label="Tester" size="small" />}
          {product.discontinued && <Chip color="warning" label="Discontinued" size="small" />}
        </Stack>
        <Typography fontWeight={700}>
          {product.brand} {product.itemName}{product.strength ? ` ${product.strength}` : ""}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {formatSize(product)}{product.shade ? ` | ${product.shade}` : ""}
        </Typography>
        {product.dupeOf && (
          <Typography variant="body2" sx={{ mt: 0.5, fontStyle: "italic", color: "text.secondary" }}>
            Smells like: {product.dupeOf}
          </Typography>
        )}
        {product.fragranceNotes && (["top", "middle", "base"] as const).some(t => product.fragranceNotes![t].length > 0) && (
          <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {(["top", "middle", "base"] as const).map(tier => {
              const colors = {
                top:    { bg: "#ede9fe", text: "#4c1d95", border: "#6d28d944" },
                middle: { bg: "#e0f2fe", text: "#0c4a6e", border: "#0369a144" },
                base:   { bg: "#fef3c7", text: "#78350f", border: "#92400e44" },
              }[tier];
              return product.fragranceNotes![tier].map(n => (
                <Box key={`${tier}-${n.id}`} sx={{ px: 1.25, py: 0.25, borderRadius: 99, bgcolor: colors.bg, color: colors.text, fontSize: 12, fontWeight: 600, border: "1px solid", borderColor: colors.border, lineHeight: 1.6 }}>
                  {n.name}
                </Box>
              ));
            })}
          </Box>
        )}
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Typography variant="h6" fontWeight={800} color="primary">Qty: {product.quantity ?? "—"}</Typography>
        {product.retailPrice != null && (
          <Typography variant="body2" color="text.secondary">Retail: {formatMoney(product.retailPrice)}</Typography>
        )}
        {product.location && (
          <Typography variant="caption" color="text.secondary" display="block">{product.location}</Typography>
        )}
      </Box>
    </Paper>
  );
}

// ── Notes search tab ───────────────────────────────────────────────────────────
function NotesSearchTab() {
  const [noteInput, setNoteInput] = useState("");
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<NoteOption[]>([]);
  const [results, setResults] = useState<SearchProduct[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(() => {
      axios.get<NoteOption[]>(getApiUrl(`fragrance-notes?q=${encodeURIComponent(q)}`))
        .then(res => setSuggestions(res.data.filter(n => !selectedNotes.includes(n.name))))
        .catch(() => {});
    }, 200);
  };

  const addNote = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || selectedNotes.includes(trimmed)) return;
    setSelectedNotes(prev => [...prev, trimmed]);
    setNoteInput("");
    setSuggestions([]);
  };

  const removeNote = (name: string) => setSelectedNotes(prev => prev.filter(n => n !== name));

  const handleSearch = async () => {
    if (!selectedNotes.length) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await axios.get<SearchProduct[]>(
        getApiUrl(`products/search/by-notes?notes=${encodeURIComponent(selectedNotes.join(","))}`)
      );
      setResults(res.data);
    } catch {
      setError("Failed to search by fragrance notes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Add notes to find products that have <strong>all</strong> of them (in any tier).
      </Typography>

      {selectedNotes.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
          {selectedNotes.map(n => (
            <Chip key={n} label={n} onDelete={() => removeNote(n)} color="primary" variant="outlined" />
          ))}
        </Box>
      )}

      <Box sx={{ position: "relative", mb: 2 }}>
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            fullWidth
            label="Add a fragrance note"
            placeholder="e.g. Vanilla, Coconut…"
            value={noteInput}
            onChange={e => { setNoteInput(e.target.value); fetchSuggestions(e.target.value); }}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addNote(noteInput); } }}
          />
          <Button variant="outlined" onClick={() => addNote(noteInput)} disabled={!noteInput.trim()} sx={{ whiteSpace: "nowrap", height: 56 }}>
            + Add
          </Button>
          <Button
            variant="contained"
            startIcon={loading ? undefined : <SearchIcon />}
            onClick={handleSearch}
            disabled={loading || !selectedNotes.length}
            sx={{ height: 56, minWidth: 120 }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : "Search"}
          </Button>
        </Box>

        {suggestions.length > 0 && (
          <Paper elevation={4} sx={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, mt: 0.5, maxHeight: 200, overflowY: "auto", borderRadius: 1 }}>
            {suggestions.map(s => (
              <Box key={s.id} onClick={() => addNote(s.name)} sx={{ px: 2, py: 1, fontSize: 14, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}>
                {s.name}
              </Box>
            ))}
          </Paper>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {results !== null && results.length === 0 && (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <SearchOffIcon sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
          <Typography color="text.secondary">No products found with those notes.</Typography>
        </Box>
      )}

      {results && results.length > 0 && (
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            {results.length} product{results.length !== 1 ? "s" : ""} found · sorted by quantity
          </Typography>
          {results.map(p => <SearchResultRow key={p.sku} product={p} />)}
        </Stack>
      )}
    </Box>
  );
}

// ── Dupe search tab ────────────────────────────────────────────────────────────
function DupeSearchTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchProduct[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await axios.get<SearchProduct[]>(getApiUrl(`products/search/by-dupe?q=${encodeURIComponent(q)}`));
      setResults(res.data);
    } catch {
      setError("Failed to search");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Search for perfumes by what they smell like or are a dupe of.
      </Typography>

      <Box component="form" onSubmit={handleSearch} sx={{ display: "flex", gap: 1, mb: 2 }}>
        <TextField
          fullWidth
          label="Smells like / Dupe of"
          placeholder="e.g. Armani Code, Chanel No.5…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          disabled={loading}
        />
        <Button type="submit" variant="contained" startIcon={loading ? undefined : <SearchIcon />} disabled={loading || !query.trim()} sx={{ height: 56, minWidth: 120 }}>
          {loading ? <CircularProgress size={20} color="inherit" /> : "Search"}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {results !== null && results.length === 0 && (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <SearchOffIcon sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
          <Typography color="text.secondary">No products found matching that description.</Typography>
        </Box>
      )}

      {results && results.length > 0 && (
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            {results.length} product{results.length !== 1 ? "s" : ""} found · sorted by quantity
          </Typography>
          {results.map(p => <SearchResultRow key={p.sku} product={p} />)}
        </Stack>
      )}
    </Box>
  );
}

// ── Barcode scanner tab ────────────────────────────────────────────────────────
function ScannerTab() {
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<PriceScanResponse | null>(null);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [fragranceNotes, setFragranceNotes] = useState<FragranceNotes | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedProduct = useMemo(() => {
    if (!scanResult?.matches.length) return null;
    return scanResult.matches.find((p) => p.sku === selectedSku) || scanResult.matches[0];
  }, [scanResult, selectedSku]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (scanResult?.matches.length === 1) setSelectedSku(scanResult.matches[0].sku);
  }, [scanResult]);

  useEffect(() => {
    if (!selectedProduct) { setFragranceNotes(null); return; }
    setFragranceNotes(null);
    axios.get<FragranceNotes>(getApiUrl(`fragrance-notes/product/${encodeURIComponent(selectedProduct.sku)}`))
      .then(res => {
        const n = res.data;
        if (n.top.length || n.middle.length || n.base.length) setFragranceNotes(n);
      })
      .catch(() => {});
  }, [selectedProduct?.sku]);

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
      const response = await axios.get<PriceScanResponse>(getApiUrl(`products/price-scanner/${encodeURIComponent(value)}`));
      setScanResult(response.data);
      resetForNextScan();
    } catch (scanError: any) {
      setError(scanError?.response?.data?.error || "Failed to scan product price");
      window.setTimeout(() => inputRef.current?.focus(), 80);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box component="form" onSubmit={handleScan}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs>
              <TextField fullWidth inputRef={inputRef} label="Scan Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} disabled={loading} autoFocus />
            </Grid>
            <Grid item>
              <Button type="submit" variant="contained" startIcon={loading ? undefined : <QrCodeScannerIcon />} disabled={loading || !barcode.trim()} sx={{ height: 56, minWidth: 132 }}>
                {loading ? <CircularProgress size={22} color="inherit" /> : "Scan"}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {scanResult && scanResult.count === 0 && (
        <Paper variant="outlined" sx={{ p: 4, minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <Box>
            <SearchOffIcon sx={{ fontSize: 64, color: "text.secondary", mb: 1 }} />
            <Typography variant="h5" fontWeight={700}>No Data Found</Typography>
            <Typography variant="body2" color="text.secondary">{scanResult.barcode}</Typography>
          </Box>
        </Paper>
      )}

      {scanResult && scanResult.count > 1 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>Multiple Matches</Typography>
          <Grid container spacing={1.5}>
            {scanResult.matches.map((product) => (
              <Grid item xs={12} sm={6} lg={4} key={product.sku}>
                <Button fullWidth variant={selectedSku === product.sku ? "contained" : "outlined"} onClick={() => setSelectedSku(product.sku)} sx={{ minHeight: 132, justifyContent: "flex-start", textAlign: "left", p: 1.25 }}>
                  <Box sx={{ display: "flex", gap: 1.25, width: "100%", minWidth: 0 }}>
                    <Box sx={{ width: 72, height: 72, borderRadius: 1, border: "1px solid", borderColor: selectedSku === product.sku ? "primary.light" : "divider", bgcolor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                      {hasImage(product.image)
                        ? <img src={String(product.image)} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        : <Typography variant="caption" color="text.secondary">No image</Typography>}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} sx={{ color: "inherit", lineHeight: 1.2 }}>{product.brand} {product.itemName}</Typography>
                      <Typography variant="caption" sx={{ display: "block", color: "inherit", opacity: 0.8 }}>SKU: {product.sku}</Typography>
                      <Typography variant="caption" sx={{ display: "block", color: "inherit", opacity: 0.8 }}>{formatSize(product)}</Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ mt: 0.5, color: "inherit" }}>{formatMoney(product.expectedPrice)}</Typography>
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
              <Box sx={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 1, border: "1px solid", borderColor: "divider", bgcolor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {hasImage(selectedProduct.image)
                  ? <img src={String(selectedProduct.image)} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  : <Typography color="text.secondary">No image</Typography>}
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
                    {formatSize(selectedProduct)}{selectedProduct.shade ? ` | ${selectedProduct.shade}` : ""}
                  </Typography>
                </Box>

                <Paper variant="outlined" sx={{ p: 2, bgcolor: selectedProduct.expectedPrice === null ? "#fff8e1" : "#f1f8e9" }}>
                  <Typography variant="caption" color="text.secondary">Expected Selling Price</Typography>
                  <Typography variant="h2" fontWeight={800} sx={{ lineHeight: 1 }}>{formatMoney(selectedProduct.expectedPrice)}</Typography>
                  {selectedProduct.expectedPrice === null && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No cost found for this SKU.</Typography>
                  )}
                </Paper>

                <Grid container spacing={1.5}>
                  <Grid item xs={12} md={4}>
                    <Paper variant="outlined" sx={{ p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">Quantity</Typography>
                      <Typography variant="h6">{selectedProduct.quantity ?? "N/A"}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper variant="outlined" sx={{ p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">Location</Typography>
                      <Typography variant="h6">{selectedProduct.location || "N/A"}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper variant="outlined" sx={{ p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">Retail Price</Typography>
                      <Typography variant="h6">{formatMoney(selectedProduct.retailPrice)}</Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {selectedProduct.dupeOf && (
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "#fafaf9" }}>
                    <Typography variant="caption" color="text.secondary">Smells Like / Dupe Of</Typography>
                    <Typography variant="body1" fontWeight={600} sx={{ mt: 0.25 }}>{selectedProduct.dupeOf}</Typography>
                  </Paper>
                )}

                <Typography variant="body2" color="text.secondary">UPC: {selectedProduct.upc || "N/A"}</Typography>
              </Stack>
            </Grid>
          </Grid>

          {fragranceNotes && (
            <Box sx={{ mt: 3, pt: 3, borderTop: "1px solid", borderColor: "divider" }}>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.12em", fontWeight: 700 }}>
                Fragrance Notes
              </Typography>
              <Stack spacing={2} sx={{ mt: 1.5 }}>
                {(["top", "middle", "base"] as const).map((tier) => {
                  const colors = {
                    top:    { label: "#6d28d9", bg: "#ede9fe", text: "#4c1d95" },
                    middle: { label: "#0369a1", bg: "#e0f2fe", text: "#0c4a6e" },
                    base:   { label: "#92400e", bg: "#fef3c7", text: "#78350f" },
                  }[tier];
                  return fragranceNotes[tier].length > 0 && (
                    <Box key={tier}>
                      <Typography variant="caption" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: colors.label, mb: 0.75, display: "block" }}>
                        {tier}
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {fragranceNotes[tier].map(n => (
                          <Box key={n.id} sx={{ px: 2, py: 0.75, borderRadius: 99, bgcolor: colors.bg, color: colors.text, fontWeight: 700, fontSize: 18, lineHeight: 1.4, border: "1.5px solid", borderColor: colors.label + "44" }}>
                            {n.name}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          )}
        </Paper>
      )}
    </>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────
function PriceScanner() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ px: 3, py: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} gap={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Price Scanner</Typography>
          <Typography variant="body2" color="text.secondary">
            Scan barcodes, or search by fragrance notes and dupe/clone references.
          </Typography>
        </Box>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
        <Tab label="Barcode Scanner" />
        <Tab label="Search by Notes" />
        <Tab label="Search by Dupe / Clone" />
      </Tabs>

      {tab === 0 && <ScannerTab />}
      {tab === 1 && <NotesSearchTab />}
      {tab === 2 && <DupeSearchTab />}
    </Box>
  );
}

export default PriceScanner;

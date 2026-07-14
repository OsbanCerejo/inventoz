import { useState } from "react";
import axios from "axios";
import {
  Box,
  Container,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Checkbox,
  Tooltip,
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import RefreshIcon from "@mui/icons-material/Refresh";
import { getApiUrl } from "../config/api";
import { useAuth } from "../context/AuthContext";

interface ChecklistProduct {
  sku: string;
  brand: string;
  itemName: string;
  strength: string | null;
  sizeOz: number | null;
  sizeMl: number | null;
  condition: string | null;
  location: string | null;
  warehouseLocations: string | null;
  quantity: number | null;
  image: string | null;
}

function formatSize(sizeOz: number | null, sizeMl: number | null): string {
  const parts: string[] = [];
  if (sizeOz) parts.push(`${sizeOz}oz`);
  if (sizeMl) parts.push(`${sizeMl}ml`);
  return parts.join(" / ");
}

function formatFullName(p: ChecklistProduct): string {
  const parts = [p.brand, p.itemName, p.strength, formatSize(p.sizeOz, p.sizeMl), p.condition].filter(Boolean);
  return parts.join(" · ");
}

function qtyColor(qty: number | null): string {
  if (qty === null || qty === 0) return "#c62828";
  if (qty <= 3) return "#e65100";
  if (qty <= 8) return "#f57f17";
  return "#2e7d32";
}

function qtyBg(qty: number | null): string {
  if (qty === null || qty === 0) return "#ffebee";
  if (qty <= 3) return "#fff3e0";
  if (qty <= 8) return "#fffde7";
  return "#e8f5e9";
}

export default function InventoryChecklist() {
  const { token } = useAuth();
  const [products, setProducts] = useState<ChecklistProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [refill, setRefill] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});

  const fetchChecklist = async () => {
    setLoading(true);
    setError(null);
    setRefill({});
    setDone({});
    try {
      const res = await axios.get(getApiUrl("products/checklist"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts(res.data);
      setGenerated(true);
      setGeneratedAt(new Date());
    } catch {
      setError("Failed to load checklist. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const toggleRefill = (sku: string) => setRefill(prev => ({ ...prev, [sku]: !prev[sku] }));
  const toggleDone = (sku: string) => setDone(prev => ({ ...prev, [sku]: !prev[sku] }));

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#fafafa" }}>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-page { padding: 0 !important; margin: 0 !important; }
          body { background: white !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      `}</style>

      <Container maxWidth="lg" sx={{ py: 3 }} className="print-page">
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }} className="no-print">
          <Box>
            <Typography variant="h5" fontWeight={600}>Inventory checklist</Typography>
            <Typography variant="body2" color="text.secondary">
              Products with refill checklist enabled
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            {generated && (
              <Tooltip title="Regenerate">
                <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={fetchChecklist} disabled={loading}>
                  Regenerate
                </Button>
              </Tooltip>
            )}
            {generated && (
              <Button variant="outlined" size="small" startIcon={<PrintIcon />} onClick={handlePrint}>
                Print
              </Button>
            )}
            {!generated && (
              <Button variant="contained" size="small" onClick={fetchChecklist} disabled={loading}>
                Generate checklist
              </Button>
            )}
          </Box>
        </Box>

        {/* Print header (only visible when printing) */}
        <Box sx={{ display: "none" }} className="print-header">
          <style>{`@media print { .print-header { display: flex !important; justify-content: space-between; align-items: baseline; margin-bottom: 16px; border-bottom: 1px solid #ccc; padding-bottom: 8px; } }`}</style>
          <Typography variant="h6" fontWeight={600}>Inventory checklist</Typography>
          <Typography variant="caption" color="text.secondary">
            {generatedAt?.toLocaleString()}
          </Typography>
        </Box>

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!generated && !loading && (
          <Box sx={{ textAlign: "center", py: 10, color: "text.secondary" }}>
            <Typography variant="body1">Click "Generate checklist" to load all tracked products.</Typography>
          </Box>
        )}

        {generated && !loading && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }} className="no-print">
              {products.length} products · Generated {generatedAt?.toLocaleString()}
            </Typography>

            {products.length === 0 && (
              <Box sx={{ textAlign: "center", py: 10, color: "text.secondary" }}>
                <Typography variant="body1">No products have the Refill Checklist toggle enabled.</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>Enable it on a product's page or edit form to add it here.</Typography>
              </Box>
            )}

            {products.length > 0 && <Box sx={{ bgcolor: "white", border: "1px solid #e0e0e0", borderRadius: 2, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f5f5f5", borderBottom: "1px solid #e0e0e0" }}>
                    <th style={{ width: 60, padding: "8px 12px", textAlign: "left", fontWeight: 500, color: "#888", fontSize: 11 }}></th>
                    <th style={{ width: 100, padding: "8px 8px", textAlign: "left", fontWeight: 500, color: "#888", fontSize: 11 }}>SKU</th>
                    <th style={{ padding: "8px 8px", textAlign: "left", fontWeight: 500, color: "#888", fontSize: 11 }}>Product</th>
                    <th style={{ width: 140, padding: "8px 8px", textAlign: "left", fontWeight: 500, color: "#888", fontSize: 11 }}>Location</th>
                    <th style={{ width: 60, padding: "8px 8px", textAlign: "center", fontWeight: 500, color: "#888", fontSize: 11 }}>Qty</th>
                    <th style={{ width: 80, padding: "8px 8px", textAlign: "center", fontWeight: 500, color: "#c62828", fontSize: 11 }}>Need refill</th>
                    <th style={{ width: 60, padding: "8px 8px", textAlign: "center", fontWeight: 500, color: "#2e7d32", fontSize: 11 }}>Done</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr
                      key={p.sku}
                      style={{
                        borderBottom: i < products.length - 1 ? "1px solid #f0f0f0" : "none",
                        background: done[p.sku] ? "#f9fbe7" : "white",
                      }}
                    >
                      {/* Image */}
                      <td style={{ padding: "8px 12px", verticalAlign: "middle" }}>
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.itemName}
                            style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, border: "1px solid #e0e0e0" }}
                          />
                        ) : (
                          <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: "#f5f5f5", border: "1px solid #e0e0e0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Typography sx={{ fontSize: 10, color: "#bbb" }}>No img</Typography>
                          </Box>
                        )}
                      </td>

                      {/* SKU */}
                      <td style={{ padding: "8px 8px", verticalAlign: "middle" }}>
                        <Box sx={{
                          display: "inline-block",
                          fontSize: 11,
                          fontFamily: "monospace",
                          fontWeight: 600,
                          color: "#1565c0",
                          bgcolor: "#e3f2fd",
                          border: "1px solid #90caf9",
                          borderRadius: "4px",
                          px: 0.75,
                          py: 0.25,
                          whiteSpace: "nowrap",
                        }}>
                          {p.sku}
                        </Box>
                      </td>

                      {/* Full name */}
                      <td style={{ padding: "8px 8px", verticalAlign: "middle" }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.4 }}>
                          {formatFullName(p)}
                        </Typography>
                      </td>

                      {/* Location */}
                      <td style={{ padding: "8px 8px", verticalAlign: "middle" }}>
                        {p.location && (
                          <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{p.location}</Typography>
                        )}
                        {p.warehouseLocations && (
                          <Typography sx={{ fontSize: 11, color: "text.secondary", mt: 0.25 }}>{p.warehouseLocations}</Typography>
                        )}
                        {!p.location && !p.warehouseLocations && (
                          <Typography sx={{ fontSize: 11, color: "#bbb" }}>—</Typography>
                        )}
                      </td>

                      {/* Qty */}
                      <td style={{ padding: "8px 8px", verticalAlign: "middle", textAlign: "center" }}>
                        <Box sx={{
                          display: "inline-block",
                          minWidth: 32,
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          fontSize: 13,
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                          color: qtyColor(p.quantity),
                          bgcolor: qtyBg(p.quantity),
                          border: `1px solid ${qtyColor(p.quantity)}44`,
                          textAlign: "center",
                        }}>
                          {p.quantity ?? 0}
                        </Box>
                      </td>

                      {/* Need refill */}
                      <td style={{ padding: "8px 8px", verticalAlign: "middle", textAlign: "center" }}>
                        <span className="no-print">
                          <Checkbox
                            checked={!!refill[p.sku]}
                            onChange={() => toggleRefill(p.sku)}
                            size="small"
                            sx={{ color: "#ef9a9a", "&.Mui-checked": { color: "#c62828" } }}
                          />
                        </span>
                        <Box className="print-only" sx={{ display: "none", width: 18, height: 18, border: "1.5px solid #c62828", borderRadius: "3px", mx: "auto" }} />
                      </td>

                      {/* Done */}
                      <td style={{ padding: "8px 8px", verticalAlign: "middle", textAlign: "center" }}>
                        <span className="no-print">
                          <Checkbox
                            checked={!!done[p.sku]}
                            onChange={() => toggleDone(p.sku)}
                            size="small"
                            sx={{ color: "#a5d6a7", "&.Mui-checked": { color: "#2e7d32" } }}
                          />
                        </span>
                        <Box className="print-only" sx={{ display: "none", width: 18, height: 18, border: "1.5px solid #2e7d32", borderRadius: "3px", mx: "auto" }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>}

            {products.length > 0 && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, textAlign: "right" }}>
              Generated {generatedAt?.toLocaleString()} · Inventoz
            </Typography>}
          </>
        )}
      </Container>
    </Box>
  );
}

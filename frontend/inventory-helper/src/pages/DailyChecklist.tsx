import { useEffect, useState } from "react";
import axios from "axios";
import {
  Box,
  Container,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Checkbox,
  TextField,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import SendIcon from "@mui/icons-material/Send";
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

interface ItemState {
  needsRefill: boolean;
  done: boolean;
  notes: string;
}

function storageKey(userId: number | string) {
  return `daily_checklist_submitted_at_${userId}`;
}

function checksKey(userId: number | string): string {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `daily_checklist_checks_${userId}_${today}`;
}

function saveChecks(userId: number | string, states: Record<string, ItemState>) {
  try {
    localStorage.setItem(checksKey(userId), JSON.stringify(states));
  } catch {}
}

function loadChecks(userId: number | string): Record<string, ItemState> | null {
  try {
    const raw = localStorage.getItem(checksKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function get9amToday(): Date {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
}

function getEffectiveReset(): Date {
  const reset = get9amToday();
  const now = new Date();
  return reset > now ? new Date(reset.getTime() - 86400000) : reset;
}

function isLocallySubmitted(userId: number | string): boolean {
  const raw = localStorage.getItem(storageKey(userId));
  if (!raw) return false;
  return new Date(raw) >= getEffectiveReset();
}

function formatSize(sizeOz: number | null, sizeMl: number | null): string {
  const parts: string[] = [];
  if (sizeOz) parts.push(`${sizeOz}oz`);
  if (sizeMl) parts.push(`${sizeMl}ml`);
  return parts.join(" / ");
}

function formatFullName(p: ChecklistProduct): string {
  return [p.brand, p.itemName, p.strength, formatSize(p.sizeOz, p.sizeMl), p.condition]
    .filter(Boolean)
    .join(" · ");
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

export default function DailyChecklist() {
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const userId = user?.id ?? user?.username ?? "";

  const [products, setProducts] = useState<ChecklistProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    // Admins always see the checklist; non-admins check server status
    if (isAdmin) {
      fetchProducts();
      return;
    }
    // Fast local check first, then verify with server
    if (isLocallySubmitted(userId)) {
      setSubmitted(true);
      setLoading(false);
      return;
    }
    checkStatusThenFetch();
  }, []);

  const checkStatusThenFetch = async () => {
    try {
      const res = await axios.get(getApiUrl("api/checklist/status"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.submitted) {
        localStorage.setItem(storageKey(userId), new Date().toISOString());
        setSubmitted(true);
        setLoading(false);
      } else {
        fetchProducts();
      }
    } catch {
      // If status check fails, just load the checklist
      fetchProducts();
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(getApiUrl("products/checklist"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts(res.data);
      const saved = loadChecks(userId);
      const initial: Record<string, ItemState> = {};
      res.data.forEach((p: ChecklistProduct) => {
        initial[p.sku] = saved?.[p.sku] ?? { needsRefill: false, done: false, notes: "" };
      });
      setItemStates(initial);
    } catch {
      setError("Failed to load checklist. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleRefill = (sku: string) => {
    setItemStates(prev => {
      const next = { ...prev, [sku]: { ...prev[sku], needsRefill: !prev[sku].needsRefill } };
      saveChecks(userId, next);
      return next;
    });
  };

  const toggleDone = (sku: string) => {
    setItemStates(prev => {
      const next = { ...prev, [sku]: { ...prev[sku], done: !prev[sku].done } };
      saveChecks(userId, next);
      return next;
    });
  };

  const setNotes = (sku: string, notes: string) => {
    setItemStates(prev => {
      const next = { ...prev, [sku]: { ...prev[sku], notes } };
      saveChecks(userId, next);
      return next;
    });
  };

  const handleConfirmSubmit = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    setSubmitError(null);
    const now = new Date();
    try {
      const items = products.map(p => ({
        sku: p.sku,
        fullName: formatFullName(p),
        quantity: p.quantity,
        needsRefill: itemStates[p.sku]?.needsRefill ?? false,
        done: itemStates[p.sku]?.done ?? false,
        notes: itemStates[p.sku]?.notes ?? "",
      }));
      await axios.post(
        getApiUrl("api/checklist/submit"),
        { items, submittedAt: now.toISOString() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      localStorage.setItem(storageKey(userId), now.toISOString());
      if (!isAdmin) setSubmitted(true);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        // Already submitted on the server — sync local state
        localStorage.setItem(storageKey(userId), new Date().toISOString());
        if (!isAdmin) setSubmitted(true);
      } else {
        setSubmitError("Failed to submit. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const SubmitButton = (
    <Button
      variant="contained"
      startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
      onClick={() => setConfirmOpen(true)}
      disabled={submitting}
      sx={{ bgcolor: "#1565c0", "&:hover": { bgcolor: "#0d47a1" } }}
    >
      {submitting ? "Submitting…" : "Submit checklist"}
    </Button>
  );

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (submitted && !isAdmin) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 2 }}>
        <CheckCircleOutlineIcon sx={{ fontSize: 64, color: "#2e7d32" }} />
        <Typography variant="h5" fontWeight={600} color="#2e7d32">Checklist submitted</Typography>
        <Typography variant="body2" color="text.secondary">
          Your daily checklist has been sent to the admins. See you tomorrow!
        </Typography>
        <Typography variant="caption" color="text.secondary">Resets at 9:00 AM</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#fafafa" }}>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
          <Box>
            <Typography variant="h5" fontWeight={600}>Daily checklist</Typography>
            <Typography variant="body2" color="text.secondary">
              {products.length} products · check each item and submit when done
            </Typography>
          </Box>
          {SubmitButton}
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}

        {products.length === 0 && (
          <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
            <Typography variant="body1">No products are configured for the refill checklist.</Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>An admin can enable the "Refill Checklist" toggle on a product to add it here.</Typography>
          </Box>
        )}

        {products.length > 0 && <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f5f5f5", borderBottom: "1px solid #e0e0e0" }}>
                <th style={{ width: 52, padding: "8px 12px" }}></th>
                <th style={{ width: 100, padding: "8px 8px", textAlign: "left", fontWeight: 500, color: "#888", fontSize: 11 }}>SKU</th>
                <th style={{ padding: "8px 8px", textAlign: "left", fontWeight: 500, color: "#888", fontSize: 11 }}>Product</th>
                <th style={{ width: 130, padding: "8px 8px", textAlign: "left", fontWeight: 500, color: "#888", fontSize: 11 }}>Location</th>
                <th style={{ width: 55, padding: "8px 8px", textAlign: "center", fontWeight: 500, color: "#888", fontSize: 11 }}>Qty</th>
                <th style={{ width: 80, padding: "8px 8px", textAlign: "center", fontWeight: 500, color: "#c62828", fontSize: 11 }}>Need refill</th>
                <th style={{ width: 60, padding: "8px 8px", textAlign: "center", fontWeight: 500, color: "#2e7d32", fontSize: 11 }}>Done</th>
                <th style={{ width: 180, padding: "8px 8px", textAlign: "left", fontWeight: 500, color: "#888", fontSize: 11 }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => {
                const state = itemStates[p.sku] ?? { needsRefill: false, done: false, notes: "" };
                return (
                  <tr
                    key={p.sku}
                    style={{
                      borderBottom: i < products.length - 1 ? "1px solid #f0f0f0" : "none",
                      background: state.done ? "#f9fbe7" : state.needsRefill ? "#fff8f8" : "white",
                      transition: "background 0.15s",
                    }}
                  >
                    <td style={{ padding: "8px 12px", verticalAlign: "middle" }}>
                      {p.image ? (
                        <img src={p.image} alt={p.itemName} style={{ width: 38, height: 38, objectFit: "cover", borderRadius: 6, border: "1px solid #e0e0e0" }} />
                      ) : (
                        <Box sx={{ width: 38, height: 38, borderRadius: 1.5, bgcolor: "#f5f5f5", border: "1px solid #e0e0e0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Typography sx={{ fontSize: 9, color: "#ccc" }}>No img</Typography>
                        </Box>
                      )}
                    </td>
                    <td style={{ padding: "8px 8px", verticalAlign: "middle" }}>
                      <Box sx={{ display: "inline-block", fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: "#1565c0", bgcolor: "#e3f2fd", border: "1px solid #90caf9", borderRadius: "4px", px: 0.75, py: 0.25, whiteSpace: "nowrap" }}>
                        {p.sku}
                      </Box>
                    </td>
                    <td style={{ padding: "8px 8px", verticalAlign: "middle" }}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.4 }}>{formatFullName(p)}</Typography>
                    </td>
                    <td style={{ padding: "8px 8px", verticalAlign: "middle" }}>
                      {p.location && <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{p.location}</Typography>}
                      {p.warehouseLocations && <Typography sx={{ fontSize: 11, color: "text.secondary", mt: 0.25 }}>{p.warehouseLocations}</Typography>}
                      {!p.location && !p.warehouseLocations && <Typography sx={{ fontSize: 11, color: "#bbb" }}>—</Typography>}
                    </td>
                    <td style={{ padding: "8px 8px", verticalAlign: "middle", textAlign: "center" }}>
                      <Box sx={{ display: "inline-block", minWidth: 30, px: 1, py: 0.25, borderRadius: 1, fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: qtyColor(p.quantity), bgcolor: qtyBg(p.quantity), border: `1px solid ${qtyColor(p.quantity)}44`, textAlign: "center" }}>
                        {p.quantity ?? 0}
                      </Box>
                    </td>
                    <td style={{ padding: "8px 8px", verticalAlign: "middle", textAlign: "center" }}>
                      <Checkbox checked={state.needsRefill} onChange={() => toggleRefill(p.sku)} size="small" sx={{ color: "#ef9a9a", "&.Mui-checked": { color: "#c62828" } }} />
                    </td>
                    <td style={{ padding: "8px 8px", verticalAlign: "middle", textAlign: "center" }}>
                      <Checkbox checked={state.done} onChange={() => toggleDone(p.sku)} size="small" sx={{ color: "#a5d6a7", "&.Mui-checked": { color: "#2e7d32" } }} />
                    </td>
                    <td style={{ padding: "6px 8px", verticalAlign: "middle" }}>
                      <TextField
                        value={state.notes}
                        onChange={e => setNotes(p.sku, e.target.value)}
                        placeholder="Add a note…"
                        size="small"
                        variant="outlined"
                        fullWidth
                        inputProps={{ style: { fontSize: 12, padding: "4px 8px" } }}
                        sx={{ "& .MuiOutlinedInput-root": { fontSize: 12 } }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Paper>}

        {products.length > 0 && <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
          {SubmitButton}
        </Box>}
      </Container>

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Submit daily checklist?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will send your checklist to the admins. You won't be able to submit again until tomorrow at 9:00 AM.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmSubmit} variant="contained" sx={{ bgcolor: "#1565c0" }}>
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, Grid, IconButton, InputAdornment, InputLabel,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import DownloadIcon from "@mui/icons-material/Download";
import SettingsIcon from "@mui/icons-material/Settings";
import axios from "axios";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { getApiUrl } from "../config/api";
import { useAuth } from "../context/AuthContext";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Category { id: number; name: string; isDefault: boolean; }

interface Expense {
  id: number; name: string; type: "recurring" | "one_time" | "amortized";
  categoryId: number | null; categoryName: string | null;
  platformTag: string | null; baseAmount: number; effectiveAmount: number;
  isOverridden: boolean; amortizationMonths: number | null;
  monthsElapsed: number | null; startMonth: string; notes: string | null;
}

interface PlatformRow {
  platform: string; unitsSold: number; avgSellingPrice: number;
  feePercentage: number; feePerUnit: number;
  platformSpecificExpenses: number; platformSpecificPerUnit: number;
  sharedOverheadPerUnit: number; totalCogsPerUnit: number;
  profitPerUnit: number | null; revenue: number;
}

interface Summary {
  month: string; daysInMonth: number;
  totalSharedExpenses: number; costPerDay: number;
  totalUnits: number; sharedOverheadPerUnit: number;
  expenses: Expense[]; platformBreakdown: PlatformRow[];
}

interface PlatformEntry {
  platform: string; unitsSold: string; avgSellingPrice: string; feePercentage: string;
}

const DEFAULT_PLATFORMS = ["TikTok", "Whatnot", "eBay", "Walmart"];
const EXPENSE_TYPES = [
  { value: "recurring", label: "Recurring (monthly)" },
  { value: "one_time", label: "One-Time" },
  { value: "amortized", label: "Amortized" },
];
const TYPE_COLORS: Record<string, "primary" | "secondary" | "warning"> = {
  recurring: "primary", one_time: "secondary", amortized: "warning",
};

const fmt = (v: number | null | undefined) =>
  v == null ? "-" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
const fmtN = (v: number, decimals = 2) => v.toFixed(decimals);

// ── Component ─────────────────────────────────────────────────────────────────
export default function OperationsCost() {
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin";

  const currentMonth = dayjs().format("YYYY-MM");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Platform editing state (saved separately)
  const [platformEntries, setPlatformEntries] = useState<PlatformEntry[]>([]);
  const [savingPlatform, setSavingPlatform] = useState(false);

  // Expense dialog
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    name: "", categoryId: "", type: "recurring" as "recurring" | "one_time" | "amortized",
    amount: "", platformTag: "", amortizationMonths: "", startMonth: currentMonth, notes: "",
  });
  const [savingExpense, setSavingExpense] = useState(false);

  // Override dialog
  const [overrideDialog, setOverrideDialog] = useState(false);
  const [overrideExpense, setOverrideExpense] = useState<Expense | null>(null);
  const [overrideAmount, setOverrideAmount] = useState("");
  const [overrideNotes, setOverrideNotes] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  // Category dialog
  const [catDialog, setCatDialog] = useState(false);
  const [catName, setCatName] = useState("");
  const [savingCat, setSavingCat] = useState(false);

  // Month options — last 24 months + next 3
  const monthOptions = useMemo(() => {
    const opts = [];
    const base = dayjs();
    for (let i = -3; i <= 24; i++) {
      const m = base.subtract(i, "month").format("YYYY-MM");
      opts.push(m);
    }
    return [...new Set(opts)].sort().reverse();
  }, []);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const loadCategories = useCallback(async () => {
    try {
      const { data } = await axios.get(getApiUrl("operations-cost/categories"), { headers });
      setCategories(data);
    } catch { /* silent */ }
  }, [headers]);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    setError(null);
    try {
      const { data } = await axios.get<Summary>(getApiUrl(`operations-cost/summary/${selectedMonth}`), { headers });
      setSummary(data);
      // Sync platform entries from saved data
      const { data: pd } = await axios.get(getApiUrl(`operations-cost/platform-data/${selectedMonth}`), { headers });
      if (pd.length > 0) {
        setPlatformEntries(pd.map((r: any) => ({
          platform: r.platform,
          unitsSold: String(r.unitsSold),
          avgSellingPrice: r.avgSellingPrice != null ? String(r.avgSellingPrice) : "",
          feePercentage: r.feePercentage != null ? String(r.feePercentage) : "",
        })));
      } else {
        setPlatformEntries(DEFAULT_PLATFORMS.map((p) => ({ platform: p, unitsSold: "", avgSellingPrice: "", feePercentage: "" })));
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load summary");
    } finally {
      setLoadingSummary(false);
    }
  }, [selectedMonth, headers]);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  if (!isAdmin) {
    return <Box sx={{ p: 4 }}><Alert severity="error">Admin access only.</Alert></Box>;
  }

  // ── Platform save ──────────────────────────────────────────────────────────
  const handleSavePlatform = async () => {
    setSavingPlatform(true);
    try {
      const payload = platformEntries
        .filter((e) => e.platform.trim())
        .map((e) => ({
          platform: e.platform.trim(),
          unitsSold: Number(e.unitsSold) || 0,
          avgSellingPrice: e.avgSellingPrice ? Number(e.avgSellingPrice) : null,
          feePercentage: e.feePercentage ? Number(e.feePercentage) : null,
        }));
      await axios.put(getApiUrl(`operations-cost/platform-data/${selectedMonth}`), payload, { headers });
      toast.success("Platform data saved.");
      await loadSummary();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save platform data");
    } finally {
      setSavingPlatform(false);
    }
  };

  const addPlatformRow = () =>
    setPlatformEntries((prev) => [...prev, { platform: "", unitsSold: "", avgSellingPrice: "", feePercentage: "" }]);

  const removePlatformRow = (i: number) =>
    setPlatformEntries((prev) => prev.filter((_, idx) => idx !== i));

  const updatePlatformRow = (i: number, field: keyof PlatformEntry, val: string) =>
    setPlatformEntries((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  // ── Expense dialog ─────────────────────────────────────────────────────────
  const openAddExpense = () => {
    setEditingExpense(null);
    setExpenseForm({ name: "", categoryId: "", type: "recurring", amount: "", platformTag: "", amortizationMonths: "", startMonth: selectedMonth, notes: "" });
    setExpenseDialog(true);
  };

  const openEditExpense = (exp: Expense) => {
    setEditingExpense(exp);
    setExpenseForm({
      name: exp.name, categoryId: exp.categoryId ? String(exp.categoryId) : "",
      type: exp.type, amount: String(exp.baseAmount),
      platformTag: exp.platformTag || "", amortizationMonths: exp.amortizationMonths ? String(exp.amortizationMonths) : "",
      startMonth: exp.startMonth, notes: exp.notes || "",
    });
    setExpenseDialog(true);
  };

  const handleSaveExpense = async () => {
    if (!expenseForm.name.trim()) return toast.error("Name is required");
    setSavingExpense(true);
    try {
      const payload = {
        name: expenseForm.name.trim(),
        categoryId: expenseForm.categoryId ? Number(expenseForm.categoryId) : null,
        type: expenseForm.type,
        amount: Number(expenseForm.amount),
        platformTag: expenseForm.platformTag.trim() || null,
        amortizationMonths: expenseForm.type === "amortized" ? Number(expenseForm.amortizationMonths) : null,
        startMonth: expenseForm.startMonth,
        notes: expenseForm.notes.trim() || null,
      };
      if (editingExpense) {
        await axios.put(getApiUrl(`operations-cost/expenses/${editingExpense.id}`), payload, { headers });
      } else {
        await axios.post(getApiUrl("operations-cost/expenses"), payload, { headers });
      }
      toast.success(editingExpense ? "Expense updated." : "Expense added.");
      setExpenseDialog(false);
      await loadSummary();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save expense");
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await axios.delete(getApiUrl(`operations-cost/expenses/${id}`), { headers });
      toast.success("Expense deleted.");
      await loadSummary();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to delete");
    }
  };

  // ── Override dialog ────────────────────────────────────────────────────────
  const openOverride = (exp: Expense) => {
    setOverrideExpense(exp);
    setOverrideAmount(exp.isOverridden ? String(exp.effectiveAmount) : String(exp.baseAmount));
    setOverrideNotes("");
    setOverrideDialog(true);
  };

  const handleSaveOverride = async () => {
    if (!overrideExpense) return;
    setSavingOverride(true);
    try {
      await axios.put(getApiUrl(`operations-cost/expenses/${overrideExpense.id}/override/${selectedMonth}`),
        { overrideAmount: Number(overrideAmount), notes: overrideNotes }, { headers });
      toast.success("Override saved for this month.");
      setOverrideDialog(false);
      await loadSummary();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save override");
    } finally {
      setSavingOverride(false);
    }
  };

  const handleRemoveOverride = async () => {
    if (!overrideExpense) return;
    try {
      await axios.delete(getApiUrl(`operations-cost/expenses/${overrideExpense.id}/override/${selectedMonth}`), { headers });
      toast.success("Override removed.");
      setOverrideDialog(false);
      await loadSummary();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to remove override");
    }
  };

  // ── Category dialog ────────────────────────────────────────────────────────
  const handleSaveCat = async () => {
    if (!catName.trim()) return;
    setSavingCat(true);
    try {
      await axios.post(getApiUrl("operations-cost/categories"), { name: catName.trim() }, { headers });
      toast.success("Category added.");
      setCatDialog(false);
      setCatName("");
      await loadCategories();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to add category");
    } finally {
      setSavingCat(false);
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!summary) return;
    const rows: string[][] = [];
    rows.push([`Operations Cost — ${summary.month}`]);
    rows.push([]);
    rows.push(["SUMMARY"]);
    rows.push(["Total Shared Expenses", fmt(summary.totalSharedExpenses)]);
    rows.push(["Cost Per Day", fmt(summary.costPerDay)]);
    rows.push(["Total Units Sold", String(summary.totalUnits)]);
    rows.push(["Shared Overhead Per Unit", fmt(summary.sharedOverheadPerUnit)]);
    rows.push([]);
    rows.push(["EXPENSES", "Type", "Category", "Platform Tag", "Base Amount", "Effective Amount", "Overridden"]);
    for (const e of summary.expenses) {
      rows.push([e.name, e.type, e.categoryName || "", e.platformTag || "", fmt(e.baseAmount), fmt(e.effectiveAmount), e.isOverridden ? "Yes" : "No"]);
    }
    rows.push([]);
    rows.push(["PLATFORM COGS BREAKDOWN", "Units", "Avg Price", "Fee %", "Fee/Unit", "Shared/Unit", "Platform-Specific/Unit", "Total COGS/Unit", "Est. Profit/Unit", "Revenue"]);
    for (const p of summary.platformBreakdown) {
      rows.push([p.platform, String(p.unitsSold), fmt(p.avgSellingPrice), `${p.feePercentage}%`, fmt(p.feePerUnit), fmt(p.sharedOverheadPerUnit), fmt(p.platformSpecificPerUnit), fmt(p.totalCogsPerUnit), p.profitPerUnit != null ? fmt(p.profitPerUnit) : "-", fmt(p.revenue)]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `operations-cost-${summary.month}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (!summary) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = summary.expenses.map((e) => `
      <tr><td>${e.name}</td><td>${e.type}</td><td>${e.categoryName || "-"}</td><td>${e.platformTag || "-"}</td>
      <td>${fmt(e.baseAmount)}</td><td>${fmt(e.effectiveAmount)}</td><td>${e.isOverridden ? "✓" : ""}</td></tr>`).join("");
    const prows = summary.platformBreakdown.map((p) => `
      <tr><td>${p.platform}</td><td>${p.unitsSold}</td><td>${fmt(p.avgSellingPrice)}</td><td>${p.feePercentage}%</td>
      <td>${fmt(p.feePerUnit)}</td><td>${fmt(p.sharedOverheadPerUnit)}</td><td>${fmt(p.platformSpecificPerUnit)}</td>
      <td><strong>${fmt(p.totalCogsPerUnit)}</strong></td><td>${p.profitPerUnit != null ? fmt(p.profitPerUnit) : "-"}</td><td>${fmt(p.revenue)}</td></tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Operations Cost ${summary.month}</title>
    <style>body{font-family:sans-serif;padding:24px;color:#111}h1{font-size:20px}h2{font-size:15px;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f3f4f6;text-align:left;padding:6px 8px}td{padding:5px 8px;border-bottom:1px solid #e5e7eb}
    .summary{display:flex;gap:24px;flex-wrap:wrap;margin-bottom:16px}.card{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 20px;min-width:150px}
    .card .val{font-size:22px;font-weight:700}.card .lbl{font-size:11px;color:#6b7280}</style></head><body>
    <h1>Operations Cost — ${summary.month}</h1>
    <div class="summary">
      <div class="card"><div class="lbl">Total Expenses</div><div class="val">${fmt(summary.totalSharedExpenses)}</div></div>
      <div class="card"><div class="lbl">Cost Per Day</div><div class="val">${fmt(summary.costPerDay)}</div></div>
      <div class="card"><div class="lbl">Total Units</div><div class="val">${summary.totalUnits}</div></div>
      <div class="card"><div class="lbl">Overhead / Unit</div><div class="val">${fmt(summary.sharedOverheadPerUnit)}</div></div>
    </div>
    <h2>Expenses</h2>
    <table><thead><tr><th>Name</th><th>Type</th><th>Category</th><th>Platform</th><th>Base</th><th>Effective</th><th>Override</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <h2>Platform COGS Breakdown</h2>
    <table><thead><tr><th>Platform</th><th>Units</th><th>Avg Price</th><th>Fee %</th><th>Fee/Unit</th><th>Shared/Unit</th><th>Specific/Unit</th><th>Total COGS/Unit</th><th>Profit/Unit</th><th>Revenue</th></tr></thead>
    <tbody>${prows}</tbody></table>
    </body></html>`);
    win.document.close();
    win.print();
  };

  // ── Grouped expenses ───────────────────────────────────────────────────────
  const expensesByCategory = useMemo(() => {
    if (!summary) return {};
    return summary.expenses.reduce<Record<string, Expense[]>>((acc, e) => {
      const key = e.categoryName || "Uncategorized";
      if (!acc[key]) acc[key] = [];
      acc[key].push(e);
      return acc;
    }, {});
  }, [summary]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Operations Cost</Typography>
          <Typography variant="body2" color="text.secondary">Track expenses and calculate COGS per unit by platform.</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCSV} disabled={!summary}>CSV</Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportPDF} disabled={!summary}>PDF</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAddExpense}>Add Expense</Button>
        </Stack>
      </Stack>

      {/* Month picker */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField select label="Month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} sx={{ minWidth: 180 }}>
            {monthOptions.map((m) => <MenuItem key={m} value={m}>{dayjs(m + "-01").format("MMMM YYYY")}</MenuItem>)}
          </TextField>
          <Button variant="outlined" onClick={loadSummary} disabled={loadingSummary}>
            {loadingSummary ? <CircularProgress size={18} /> : "Refresh"}
          </Button>
          <Button variant="text" size="small" startIcon={<SettingsIcon />} onClick={() => setCatDialog(true)}>
            Manage Categories
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Summary cards */}
      {summary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: "Total Shared Expenses", value: fmt(summary.totalSharedExpenses), color: "#c62828" },
            { label: `Cost Per Day (${summary.daysInMonth} days)`, value: fmt(summary.costPerDay), color: "#1565c0" },
            { label: "Total Units Sold", value: String(summary.totalUnits), color: "#2e7d32" },
            { label: "Shared Overhead / Unit", value: fmt(summary.sharedOverheadPerUnit), color: "#6a1b9a" },
          ].map((card) => (
            <Grid item xs={6} md={3} key={card.label}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">{card.label}</Typography>
                <Typography variant="h5" fontWeight={700} sx={{ color: card.color }}>{card.value}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      <Grid container spacing={3} alignItems="flex-start">
        {/* Left: Expenses */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            {/* Panel header */}
            <Box sx={{ px: 2.5, py: 1.75, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.default" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>Expenses</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {dayjs(selectedMonth + "-01").format("MMMM YYYY")}
                    {summary && ` · ${summary.expenses.length} item${summary.expenses.length !== 1 ? "s" : ""}`}
                  </Typography>
                </Box>
                {summary && (
                  <Typography variant="h6" fontWeight={700} color="error.main">
                    {fmt(summary.totalSharedExpenses)}
                  </Typography>
                )}
              </Stack>
            </Box>

            <Box sx={{ px: 2.5, py: 2 }}>
              {loadingSummary ? (
                <Box sx={{ textAlign: "center", py: 5 }}><CircularProgress size={28} /></Box>
              ) : !summary || summary.expenses.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 5 }}>
                  <Typography variant="body2" color="text.secondary">No expenses yet.</Typography>
                  <Button size="small" startIcon={<AddIcon />} sx={{ mt: 1 }} onClick={openAddExpense}>Add your first expense</Button>
                </Box>
              ) : (
                <Stack spacing={2.5}>
                  {Object.entries(expensesByCategory).map(([cat, exps]) => (
                    <Box key={cat}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                        <Typography variant="caption" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: 0.8, color: "text.secondary" }}>
                          {cat}
                        </Typography>
                        <Typography variant="caption" fontWeight={600} color="text.secondary">
                          {fmt(exps.reduce((s, e) => s + e.effectiveAmount, 0))}
                        </Typography>
                      </Stack>
                      <Stack spacing={0}>
                        {exps.map((exp, idx) => (
                          <Box
                            key={exp.id}
                            sx={{
                              display: "flex", alignItems: "center", gap: 1,
                              px: 1.5, py: 1,
                              borderRadius: 1,
                              bgcolor: idx % 2 === 0 ? "action.hover" : "transparent",
                              "&:hover": { bgcolor: "action.selected" },
                              transition: "background 0.15s",
                            }}
                          >
                            {/* Name + chips */}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                                <Typography variant="body2" fontWeight={600} noWrap>{exp.name}</Typography>
                                <Chip size="small" label={exp.type.replace("_", " ")} color={TYPE_COLORS[exp.type]} variant="outlined"
                                  sx={{ fontSize: 9, height: 16, "& .MuiChip-label": { px: 0.75 } }} />
                                {exp.platformTag && (
                                  <Chip size="small" label={exp.platformTag}
                                    sx={{ fontSize: 9, height: 16, "& .MuiChip-label": { px: 0.75 } }} />
                                )}
                                {exp.isOverridden && (
                                  <Chip size="small" label="overridden" color="warning"
                                    sx={{ fontSize: 9, height: 16, "& .MuiChip-label": { px: 0.75 } }} />
                                )}
                              </Stack>
                              {exp.type === "amortized" && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                  {fmt(exp.baseAmount)} ÷ {Math.max(exp.monthsElapsed || 1, exp.amortizationMonths || 1)} months
                                </Typography>
                              )}
                            </Box>

                            {/* Amount */}
                            <Box sx={{ textAlign: "right", minWidth: 72 }}>
                              <Typography variant="body2" fontWeight={700}>{fmt(exp.effectiveAmount)}</Typography>
                              {exp.isOverridden && (
                                <Typography variant="caption" color="text.disabled" sx={{ textDecoration: "line-through" }}>{fmt(exp.baseAmount)}</Typography>
                              )}
                            </Box>

                            {/* Actions */}
                            <Stack direction="row" spacing={0}>
                              <Tooltip title="Override this month">
                                <IconButton size="small" onClick={() => openOverride(exp)} sx={{ opacity: 0.6, "&:hover": { opacity: 1 } }}>
                                  <EditIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit expense">
                                <IconButton size="small" onClick={() => openEditExpense(exp)} sx={{ opacity: 0.6, "&:hover": { opacity: 1 } }}>
                                  <SettingsIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton size="small" color="error" onClick={() => handleDeleteExpense(exp.id)} sx={{ opacity: 0.6, "&:hover": { opacity: 1 } }}>
                                  <DeleteIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Right: Platform data entry */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            {/* Panel header */}
            <Box sx={{ px: 2.5, py: 1.75, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.default" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>Platform Data</Typography>
                  <Typography variant="caption" color="text.secondary">Units sold &amp; fees by platform</Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button size="small" startIcon={<AddIcon />} onClick={addPlatformRow}>Add</Button>
                  <Button size="small" variant="contained" onClick={handleSavePlatform} disabled={savingPlatform}>
                    {savingPlatform ? <CircularProgress size={14} /> : "Save"}
                  </Button>
                </Stack>
              </Stack>
            </Box>

            <Box sx={{ px: 2.5, py: 2 }}>
              <Stack spacing={1.5}>
                {/* Column headers */}
                <Stack direction="row" spacing={1} sx={{ px: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ flex: "0 0 110px" }}>Platform</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ flex: "0 0 76px" }}>Units</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ flex: "0 0 100px" }}>Avg Price</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ flex: "0 0 84px" }}>Fee %</Typography>
                </Stack>

                {platformEntries.length === 0 ? (
                  <Box sx={{ textAlign: "center", py: 4 }}>
                    <Typography variant="body2" color="text.secondary">No platforms yet.</Typography>
                    <Button size="small" startIcon={<AddIcon />} sx={{ mt: 1 }} onClick={addPlatformRow}>Add platform</Button>
                  </Box>
                ) : (
                  platformEntries.map((row, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="center">
                      <TextField
                        size="small" value={row.platform} placeholder="Platform"
                        onChange={(e) => updatePlatformRow(i, "platform", e.target.value)}
                        sx={{ flex: "0 0 110px" }}
                      />
                      <TextField
                        size="small" value={row.unitsSold} placeholder="0"
                        onChange={(e) => updatePlatformRow(i, "unitsSold", e.target.value.replace(/\D/g, ""))}
                        sx={{ flex: "0 0 76px" }}
                      />
                      <TextField
                        size="small" value={row.avgSellingPrice} placeholder="0.00"
                        onChange={(e) => updatePlatformRow(i, "avgSellingPrice", e.target.value)}
                        InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                        sx={{ flex: "0 0 100px" }}
                      />
                      <TextField
                        size="small" value={row.feePercentage} placeholder="0"
                        onChange={(e) => updatePlatformRow(i, "feePercentage", e.target.value)}
                        InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                        sx={{ flex: "0 0 84px" }}
                      />
                      <IconButton size="small" color="error" onClick={() => removePlatformRow(i)}>
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Stack>
                  ))
                )}

                {/* Totals row */}
                {platformEntries.some((r) => Number(r.unitsSold) > 0) && (
                  <>
                    <Divider />
                    <Stack direction="row" spacing={1} sx={{ px: 0.5 }}>
                      <Typography variant="caption" fontWeight={700} sx={{ flex: "0 0 110px" }}>Total</Typography>
                      <Typography variant="caption" fontWeight={700} sx={{ flex: "0 0 76px" }}>
                        {platformEntries.reduce((s, r) => s + (Number(r.unitsSold) || 0), 0).toLocaleString()}
                      </Typography>
                    </Stack>
                  </>
                )}
              </Stack>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* COGS breakdown table */}
      {summary && summary.platformBreakdown.length > 0 && (
        <Paper sx={{ p: 2, mt: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>COGS Breakdown by Platform</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Platform</TableCell>
                  <TableCell align="right">Units</TableCell>
                  <TableCell align="right">Avg Price</TableCell>
                  <TableCell align="right">Fee %</TableCell>
                  <TableCell align="right">Fee / Unit</TableCell>
                  <TableCell align="right">Shared / Unit</TableCell>
                  <TableCell align="right">Specific / Unit</TableCell>
                  <TableCell align="right"><strong>Total COGS / Unit</strong></TableCell>
                  <TableCell align="right">Est. Profit / Unit</TableCell>
                  <TableCell align="right">Revenue</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summary.platformBreakdown.map((p) => (
                  <TableRow key={p.platform} hover>
                    <TableCell><Typography fontWeight={700}>{p.platform}</Typography></TableCell>
                    <TableCell align="right">{p.unitsSold.toLocaleString()}</TableCell>
                    <TableCell align="right">{fmt(p.avgSellingPrice)}</TableCell>
                    <TableCell align="right">{p.feePercentage}%</TableCell>
                    <TableCell align="right">{fmt(p.feePerUnit)}</TableCell>
                    <TableCell align="right">{fmt(p.sharedOverheadPerUnit)}</TableCell>
                    <TableCell align="right">{fmt(p.platformSpecificPerUnit)}</TableCell>
                    <TableCell align="right"><Typography fontWeight={700} color="error.main">{fmt(p.totalCogsPerUnit)}</Typography></TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={700} color={p.profitPerUnit != null && p.profitPerUnit > 0 ? "success.main" : "error.main"}>
                        {p.profitPerUnit != null ? fmt(p.profitPerUnit) : "-"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{fmt(p.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Divider sx={{ my: 1.5 }} />
          <Stack direction="row" spacing={3} sx={{ px: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Total Revenue: <strong>{fmt(summary.platformBreakdown.reduce((s, p) => s + p.revenue, 0))}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Units: <strong>{summary.totalUnits.toLocaleString()}</strong>
            </Typography>
          </Stack>
        </Paper>
      )}

      {/* Add/Edit Expense Dialog */}
      <Dialog open={expenseDialog} onClose={() => setExpenseDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" fullWidth value={expenseForm.name} onChange={(e) => setExpenseForm((f) => ({ ...f, name: e.target.value }))} />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select label="Category" value={expenseForm.categoryId} onChange={(e) => setExpenseForm((f) => ({ ...f, categoryId: e.target.value }))}>
                    <MenuItem value="">None</MenuItem>
                    {categories.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select label="Type" value={expenseForm.type} onChange={(e) => setExpenseForm((f) => ({ ...f, type: e.target.value as any }))}>
                    {EXPENSE_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField label="Amount ($)" fullWidth value={expenseForm.amount} onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
              </Grid>
              <Grid item xs={6}>
                <TextField label="Start Month" type="month" fullWidth value={expenseForm.startMonth}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, startMonth: e.target.value }))}
                  InputLabelProps={{ shrink: true }} />
              </Grid>
            </Grid>
            {expenseForm.type === "amortized" && (
              <TextField label="Amortize Over (months)" fullWidth value={expenseForm.amortizationMonths}
                onChange={(e) => setExpenseForm((f) => ({ ...f, amortizationMonths: e.target.value.replace(/\D/g, "") }))}
                helperText="Cost spreads over this many months, then continues reducing as more months pass" />
            )}
            <TextField label="Platform Tag (optional)" fullWidth value={expenseForm.platformTag}
              onChange={(e) => setExpenseForm((f) => ({ ...f, platformTag: e.target.value }))}
              helperText="Enter a platform name (e.g. TikTok) to assign this expense to that platform only" />
            <TextField label="Notes" fullWidth multiline minRows={2} value={expenseForm.notes}
              onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExpenseDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveExpense} disabled={savingExpense}>
            {savingExpense ? <CircularProgress size={18} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Override Dialog */}
      <Dialog open={overrideDialog} onClose={() => setOverrideDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Override Amount — {dayjs(selectedMonth + "-01").format("MMMM YYYY")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Set a different amount for <strong>{overrideExpense?.name}</strong> this month only. Base amount: {fmt(overrideExpense?.baseAmount ?? 0)}.
          </Typography>
          <TextField label="Amount for this month" fullWidth value={overrideAmount}
            onChange={(e) => setOverrideAmount(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} sx={{ mb: 2 }} />
          <TextField label="Note (optional)" fullWidth value={overrideNotes} onChange={(e) => setOverrideNotes(e.target.value)} />
        </DialogContent>
        <DialogActions>
          {overrideExpense?.isOverridden && (
            <Button color="error" onClick={handleRemoveOverride}>Remove Override</Button>
          )}
          <Button onClick={() => setOverrideDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveOverride} disabled={savingOverride}>
            {savingOverride ? <CircularProgress size={18} /> : "Save Override"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={catDialog} onClose={() => setCatDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Manage Categories</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mt: 1, mb: 2 }}>
            {categories.map((c) => (
              <Stack key={c.id} direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">{c.name}</Typography>
                {c.isDefault ? <Chip size="small" label="default" /> : (
                  <IconButton size="small" color="error" onClick={async () => {
                    try { await axios.delete(getApiUrl(`operations-cost/categories/${c.id}`), { headers }); await loadCategories(); }
                    catch (e: any) { toast.error(e?.response?.data?.error || "Failed to delete"); }
                  }}><DeleteIcon fontSize="small" /></IconButton>
                )}
              </Stack>
            ))}
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="New category" fullWidth value={catName} onChange={(e) => setCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveCat(); }} />
            <Button variant="contained" size="small" onClick={handleSaveCat} disabled={savingCat || !catName.trim()}>Add</Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCatDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

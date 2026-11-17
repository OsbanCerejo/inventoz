import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Alert, Box, Card, CardContent, Chip, CircularProgress,
  FormControl, Grid, InputLabel, MenuItem, Paper, Select,
  Stack, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tabs, TextField, Typography,
} from "@mui/material";
import { getApiUrl } from "../config/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ShowOption { showId: number; showName: string; }
interface Overview {
  shipmentsClosed: number; totalUnits: number; activeSorters: number;
  activeDays: number; totalScans: number; avgScanGapSeconds: number | null;
  avgHandlingMinutes: number | null; avgUnitsPerShipment: number; avgShipmentsPerDay: number;
}
interface LeaderboardRow {
  sorterId: string; sorterName: string; shipmentsClosed: number; totalUnits: number;
  activeDays: number; avgScanGapSeconds: number | null; avgHandlingMinutes: number | null;
  totalScans: number; scansPerShipment: number | null; firstClosedAt: string | null; lastClosedAt: string | null;
}
interface DailyRow {
  bucket: string; shipmentsClosed: number; totalUnits: number;
  activeSorters: number; avgScanGapSeconds: number | null; totalScans: number;
}
interface ItemTypeRow {
  itemCategory: string; shipmentCount: number; lineCount: number; totalUnits: number;
  avgScanGapSeconds: number | null; avgHandlingMinutes: number | null;
}
interface PaceRow { showId: number; showName: string; avgShipmentsPerHour: number; activeHours: number; totalShipments: number; }
interface SizeRow {
  lineCount: number; shipmentCount: number; totalUnits: number;
  avgHandlingMinutes: number | null; avgScanGapSeconds: number | null;
  minHandlingMinutes: number | null; maxHandlingMinutes: number | null;
}
interface HeatmapRow { dayIndex: number; hourOfDay: number; shipmentsClosed: number; totalUnits: number; }
interface ShipmentRow {
  showId: number; importId: number; shipmentId: string; closedAt: string | null;
  sorterId: string | null; sorterName: string; totalUnits: number; lineCount: number;
  categories: string; totalScans: number | null; avgScanGapSeconds: number | null;
  handlingMinutes: number | null; firstScanAt: string | null; lastScanAt: string | null;
}
interface SorterThroughputRow { sorterId: string; avgOrdersPerHour: number; activeHours: number; }
interface ShowDurationRow {
  showId: number; firstScanAt: string; lastMainScanAt: string;
  netDurationMinutes: number;
  breaks: { lastScanBefore: string; firstScanAfter: string; gapMinutes: number }[];
}
interface Throughput {
  overallAvgOrdersPerHour: number | null;
  avgShowDurationMinutes: number | null;
  sorterThroughput: SorterThroughputRow[];
  showDurations: ShowDurationRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API = (path: string) => getApiUrl(`tiktok/analytics/${path}`);
const fmt = (v: number | string | null | undefined) => Number(v || 0).toLocaleString("en-US");
const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
const fmtDateTime = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};
const fmtSeconds = (v: number | null | undefined) => {
  if (v == null) return "—";
  const s = Math.max(0, Math.round(Number(v)));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), sec = s % 60;
  if (m < 60) return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
  const h = Math.floor(m / 60), rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
};
const fmtMinutes = (v: number | null | undefined) => {
  if (v == null) return "—";
  const n = Number(v);
  if (n < 1) return `${Math.round(n * 60)}s`;
  if (n < 60) return `${n.toFixed(1)}m`;
  const h = Math.floor(n / 60), rm = Math.round(n % 60);
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
};
const categoryLabel = (v: string) =>
  ({ auction: "Auction", tiktok_flash_sale: "Flash Sale", random_giveaway: "Random Giveaway",
     buyers_giveaway: "Buyers Giveaway", raid_giveaway: "Raid Giveaway", coffee: "Coffee",
     sponsored_giveaway: "Sponsored Giveaway", others: "Others" } as Record<string, string>)[String(v || "").trim().toLowerCase()] || v || "Unknown";

const PALETTE = ["#1565c0","#2e7d32","#ef6c00","#6a1b9a","#00838f","#c62828","#ad1457","#5d4037","#0277bd","#7b1fa2"];
const DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ─── Sub-components ───────────────────────────────────────────────────────────

const KpiCard = ({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) => (
  <Card sx={{ borderRadius: 2, border: "1px solid #e3e8ef", height: "100%" }}>
    <CardContent>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h5" sx={{ mt: 0.5, color, fontWeight: 700 }}>{typeof value === "number" ? fmt(value) : value}</Typography>
      {sub && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>{sub}</Typography>}
    </CardContent>
  </Card>
);

const HBar = ({ items, labelKey, valueKey, color = "#1565c0", maxItems = 10, fmtVal }: {
  items: Record<string, any>[]; labelKey: string; valueKey: string;
  color?: string; maxItems?: number; fmtVal?: (v: number) => string;
}) => {
  const rows = items.slice(0, maxItems);
  const max = rows.reduce((m, r) => Math.max(m, Number(r[valueKey] || 0)), 0);
  if (!rows.length) return <Typography variant="body2" color="text.secondary">No data.</Typography>;
  return (
    <Stack spacing={1}>
      {rows.map((r, i) => {
        const val = Number(r[valueKey] || 0);
        const pct = max > 0 ? Math.max((val / max) * 100, 2) : 0;
        return (
          <Box key={i}>
            <Box display="flex" justifyContent="space-between" mb={0.3}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{r[labelKey] || "—"}</Typography>
              <Typography variant="body2" color="text.secondary">{fmtVal ? fmtVal(val) : fmt(val)}</Typography>
            </Box>
            <Box sx={{ height: 8, borderRadius: 999, bgcolor: "#edf1f7", overflow: "hidden" }}>
              <Box sx={{ width: `${pct}%`, height: "100%", borderRadius: 999, bgcolor: color }} />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TikTokSortingAnalytics() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);

  const [from, setFrom] = useState(fmtDate(thirtyDaysAgo));
  const [to, setTo] = useState(fmtDate(now));
  const [selectedSorterId, setSelectedSorterId] = useState("");
  const [selectedShowId, setSelectedShowId] = useState("");
  const [shows, setShows] = useState<ShowOption[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemTypeRow[]>([]);
  const [pace, setPace] = useState<PaceRow[]>([]);
  const [sizeRows, setSizeRows] = useState<SizeRow[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapRow[]>([]);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [throughput, setThroughput] = useState<Throughput | null>(null);

  const params = useMemo(() => ({
    from, to,
    ...(selectedSorterId ? { sorterId: selectedSorterId } : {}),
    ...(selectedShowId ? { showId: selectedShowId } : {}),
  }), [from, to, selectedSorterId, selectedShowId]);

  const headers = useMemo(() => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoading(true); setError(null);
      const dateParams = { from, to };
      const results = await Promise.allSettled([
        axios.get(API("sorting-overview"), { params, headers }),
        axios.get(API("sorting-leaderboard"), { params: { ...params, limit: 50 }, headers }),
        axios.get(API("sorting-daily"), { params, headers }),
        axios.get(API("sorting-item-types"), { params, headers }),
        axios.get(API("sorting-heatmap"), { params, headers }),
        axios.get(API("sorting-shipments"), { params: { ...params, limit: 500 }, headers }),
        axios.get(API("sorting-shows"), { params: dateParams, headers }),
        axios.get(API("sorting-throughput"), { params, headers }),
        axios.get(API("sorting-pace"), { params, headers }),
        axios.get(API("sorting-by-size"), { params, headers }),
      ]);
      const [ov, lb, dy, it, hm, sh, sw, tp, pc, sz] = results;
      if (ov.status === "fulfilled") setOverview(ov.value.data);
      if (lb.status === "fulfilled") setLeaderboard(lb.value.data || []);
      if (dy.status === "fulfilled") setDaily(dy.value.data || []);
      if (it.status === "fulfilled") setItemTypes(it.value.data || []);
      if (hm.status === "fulfilled") setHeatmap(hm.value.data || []);
      if (sh.status === "fulfilled") setShipments(sh.value.data || []);
      if (sw.status === "fulfilled") setShows(sw.value.data || []);
      if (tp.status === "fulfilled") setThroughput(tp.value.data || null);
      if (pc.status === "fulfilled") setPace(pc.value.data || []);
      if (sz.status === "fulfilled") setSizeRows(sz.value.data || []);
      const failed = [
        { n: "overview", r: ov }, { n: "leaderboard", r: lb }, { n: "daily", r: dy },
        { n: "item-types", r: it }, { n: "heatmap", r: hm }, { n: "shipments", r: sh },
      ].filter(x => x.r.status === "rejected").map(x => x.n);
      if (failed.length) setError(`Failed to load: ${failed.join(", ")}`);
      setLoading(false);
    };
    run();
  }, [params]);

  const sorterOptions = useMemo(() => leaderboard.filter(r => !!r.sorterId), [leaderboard]);
  const sorterColors = useMemo(() =>
    Array.from(new Set(leaderboard.map(r => r.sorterName))).reduce<Record<string, string>>((acc, name, i) => {
      acc[name] = PALETTE[i % PALETTE.length]; return acc;
    }, {}), [leaderboard]);

  const heatmapGrid = useMemo(() => {
    const grid = new Map<string, number>();
    heatmap.forEach(r => grid.set(`${r.dayIndex}-${r.hourOfDay}`, r.shipmentsClosed));
    return { grid, max: Math.max(1, ...Array.from(grid.values())) };
  }, [heatmap]);

  const kpis = [
    { label: "Shipments Closed", value: overview?.shipmentsClosed || 0, color: "#1565c0", sub: `${fmt(overview?.activeDays || 0)} active day(s)` },
    { label: "Items Sorted", value: overview?.totalUnits || 0, color: "#2e7d32", sub: `${Number(overview?.avgUnitsPerShipment || 0).toFixed(1)} avg per shipment` },
    { label: "Active Sorters", value: overview?.activeSorters || 0, color: "#6a1b9a", sub: `${Number(overview?.avgShipmentsPerDay || 0).toFixed(1)} shipments/day` },
    { label: "Total Scans", value: overview?.totalScans || 0, color: "#ef6c00", sub: "item scans recorded" },
    {
      label: "Avg Orders / Hour",
      value: throughput?.overallAvgOrdersPerHour != null ? `${throughput.overallAvgOrdersPerHour}` : "—",
      color: "#c62828",
      sub: "excl. outliers >10 min",
    },
    {
      label: "Avg Show Duration",
      value: throughput?.avgShowDurationMinutes != null ? fmtMinutes(throughput.avgShowDurationMinutes) : "—",
      color: "#00838f",
      sub: "net active time, excl. breaks",
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2.5}>
        {/* Header */}
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>TikTok Sorting Analytics</Typography>
          <Typography variant="body1" color="text.secondary">Speed, throughput, and item-type breakdowns for TikTok fulfilment sorting.</Typography>
        </Box>

        {/* Filters */}
        <Paper sx={{ p: 2, borderRadius: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4} md={3}>
              <TextField fullWidth label="From" type="date" value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <TextField fullWidth label="To" type="date" value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <FormControl fullWidth>
                <InputLabel>Sorter</InputLabel>
                <Select value={selectedSorterId} label="Sorter" onChange={e => setSelectedSorterId(String(e.target.value || ""))}>
                  <MenuItem value="">All Sorters</MenuItem>
                  {sorterOptions.map(s => <MenuItem key={s.sorterId} value={s.sorterId}>{s.sorterName}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <FormControl fullWidth>
                <InputLabel>Show</InputLabel>
                <Select value={selectedShowId} label="Show" onChange={e => setSelectedShowId(String(e.target.value || ""))}>
                  <MenuItem value="">All Shows</MenuItem>
                  {shows.map(s => <MenuItem key={s.showId} value={String(s.showId)}>{s.showName}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {error && <Alert severity="warning">{error}</Alert>}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
        ) : (
          <>
            {/* KPI Cards */}
            <Grid container spacing={2}>
              {kpis.map(k => (
                <Grid item xs={12} sm={6} md={4} lg={2} key={k.label}>
                  <KpiCard {...k} />
                </Grid>
              ))}
            </Grid>

            {/* Tabs */}
            <Paper sx={{ borderRadius: 2 }}>
              <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
                <Tab label="Overview" />
                <Tab label="Sorters" />
                <Tab label="Shipment Size" />
                <Tab label="Heatmap" />
                <Tab label="Shipments" />
              </Tabs>
            </Paper>

            {/* Tab 0 — Overview */}
            {activeTab === 0 && (
              <Grid container spacing={2}>
                {/* Daily trend bars */}
                <Grid item xs={12} lg={8}>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1.5 }}>Daily Shipments Closed</Typography>
                    {daily.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">No data for this range.</Typography>
                    ) : (
                      <Box sx={{ overflowX: "auto" }}>
                        {(() => {
                          const max = Math.max(1, ...daily.map(r => r.shipmentsClosed));
                          const BAR_W = Math.max(20, Math.min(48, Math.floor(560 / Math.max(daily.length, 1))));
                          return (
                            <Box sx={{ display: "flex", alignItems: "flex-end", gap: "3px", minHeight: 160, pb: 1 }}>
                              {daily.map(r => {
                                const h = Math.max(4, Math.round((r.shipmentsClosed / max) * 130));
                                return (
                                  <Box key={r.bucket} sx={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: BAR_W }}>
                                    <Typography variant="caption" sx={{ fontSize: 9, color: "#64748b", mb: 0.3 }}>{r.shipmentsClosed}</Typography>
                                    <Box
                                      title={`${r.bucket}: ${r.shipmentsClosed} shipments, ${fmt(r.totalUnits)} units`}
                                      sx={{ width: BAR_W - 4, height: h, bgcolor: "#1565c0", borderRadius: "3px 3px 0 0", opacity: 0.85 }}
                                    />
                                    <Typography variant="caption" sx={{ fontSize: 9, color: "#94a3b8", mt: 0.3, transform: "rotate(-45deg)", transformOrigin: "top left", whiteSpace: "nowrap", ml: 1 }}>
                                      {String(r.bucket).slice(5)}
                                    </Typography>
                                  </Box>
                                );
                              })}
                            </Box>
                          );
                        })()}
                      </Box>
                    )}
                  </Paper>
                </Grid>

                {/* Scan gap by day */}
                <Grid item xs={12} lg={4}>
                  <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                    <Typography variant="h6" sx={{ mb: 1.5 }}>Avg Scan Gap By Day</Typography>
                    <HBar
                      items={daily.filter(r => r.avgScanGapSeconds != null).map(r => ({ ...r, displayVal: r.avgScanGapSeconds ?? 0 }))}
                      labelKey="bucket"
                      valueKey="displayVal"
                      color="#00838f"
                      maxItems={10}
                      fmtVal={v => fmtSeconds(v)}
                    />
                  </Paper>
                </Grid>

                {/* Top days */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1.5 }}>Top Days By Items Sorted</Typography>
                    <HBar
                      items={[...daily].sort((a, b) => b.totalUnits - a.totalUnits)}
                      labelKey="bucket"
                      valueKey="totalUnits"
                      color="#2e7d32"
                      maxItems={10}
                      fmtVal={v => `${fmt(v)} items`}
                    />
                  </Paper>
                </Grid>

                {/* Sorter share */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1.5 }}>Sorter Share (Shipments)</Typography>
                    <HBar
                      items={leaderboard}
                      labelKey="sorterName"
                      valueKey="shipmentsClosed"
                      color="#6a1b9a"
                      maxItems={10}
                      fmtVal={v => `${fmt(v)} shipments`}
                    />
                  </Paper>
                </Grid>

                {/* Pace per show */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ mb: 0.5 }}>Pace By Show</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                      Avg shipments closed per active hour
                    </Typography>
                    {pace.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">No data.</Typography>
                    ) : (
                      <HBar
                        items={pace}
                        labelKey="showName"
                        valueKey="avgShipmentsPerHour"
                        color="#ef6c00"
                        maxItems={15}
                        fmtVal={v => `${v.toFixed(1)} / hr`}
                      />
                    )}
                  </Paper>
                </Grid>

                {/* Shipment size quick view */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ mb: 0.5 }}>Avg Handling By Shipment Size</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                      How long shipments take based on number of items
                    </Typography>
                    {sizeRows.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">No data.</Typography>
                    ) : (
                      <HBar
                        items={sizeRows.filter(r => r.avgHandlingMinutes != null).map(r => ({ ...r, label: `${r.lineCount} item${r.lineCount === 1 ? "" : "s"}` }))}
                        labelKey="label"
                        valueKey="avgHandlingMinutes"
                        color="#2e7d32"
                        maxItems={15}
                        fmtVal={v => fmtMinutes(v)}
                      />
                    )}
                  </Paper>
                </Grid>
              </Grid>
            )}

            {/* Tab 1 — Sorters */}
            {activeTab === 1 && (
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1.5 }}>Sorter Leaderboard</Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Sorter</TableCell>
                            <TableCell align="right">Shipments</TableCell>
                            <TableCell align="right">Items</TableCell>
                            <TableCell align="right">Scans</TableCell>
                            <TableCell align="right">Scans / Shipment</TableCell>
                            <TableCell align="right">Avg Scan Gap</TableCell>
                            <TableCell align="right">Avg Handling</TableCell>
                            <TableCell align="right">Last Active</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {leaderboard.length === 0 ? (
                            <TableRow><TableCell colSpan={8}><Typography variant="body2" color="text.secondary">No data.</Typography></TableCell></TableRow>
                          ) : leaderboard.map(r => (
                            <TableRow key={r.sorterId || r.sorterName}>
                              <TableCell>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: sorterColors[r.sorterName] || "#94a3b8", flexShrink: 0 }} />
                                  <Stack>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.sorterName}</Typography>
                                    <Typography variant="caption" color="text.secondary">{r.activeDays} active day(s)</Typography>
                                  </Stack>
                                </Stack>
                              </TableCell>
                              <TableCell align="right">{fmt(r.shipmentsClosed)}</TableCell>
                              <TableCell align="right">{fmt(r.totalUnits)}</TableCell>
                              <TableCell align="right">{fmt(r.totalScans)}</TableCell>
                              <TableCell align="right">{r.scansPerShipment != null ? r.scansPerShipment.toFixed(1) : "—"}</TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" sx={{ color: r.avgScanGapSeconds != null && r.avgScanGapSeconds < 30 ? "#2e7d32" : r.avgScanGapSeconds != null && r.avgScanGapSeconds > 60 ? "#c62828" : "text.primary", fontWeight: 600 }}>
                                  {fmtSeconds(r.avgScanGapSeconds)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{fmtMinutes(r.avgHandlingMinutes)}</TableCell>
                              <TableCell align="right">{fmtDateTime(r.lastClosedAt)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Grid>

                {/* Speed bars */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1.5 }}>Avg Scan Gap By Sorter <Typography component="span" variant="caption" color="text.secondary">(lower = faster)</Typography></Typography>
                    <HBar
                      items={[...leaderboard].filter(r => r.avgScanGapSeconds != null).sort((a, b) => (a.avgScanGapSeconds ?? 999) - (b.avgScanGapSeconds ?? 999)).map(r => ({ ...r, displayVal: r.avgScanGapSeconds ?? 0 }))}
                      labelKey="sorterName"
                      valueKey="displayVal"
                      color="#00838f"
                      maxItems={10}
                      fmtVal={v => fmtSeconds(v)}
                    />
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1.5 }}>Avg Handling Time By Sorter</Typography>
                    <HBar
                      items={[...leaderboard].filter(r => r.avgHandlingMinutes != null).sort((a, b) => (a.avgHandlingMinutes ?? 999) - (b.avgHandlingMinutes ?? 999)).map(r => ({ ...r, displayVal: r.avgHandlingMinutes ?? 0 }))}
                      labelKey="sorterName"
                      valueKey="displayVal"
                      color="#6a1b9a"
                      maxItems={10}
                      fmtVal={v => fmtMinutes(v)}
                    />
                  </Paper>
                </Grid>

                {/* Orders / hour per sorter */}
                {throughput && throughput.sorterThroughput.length > 0 && (
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, borderRadius: 2 }}>
                      <Typography variant="h6" sx={{ mb: 0.5 }}>Orders / Hour Per Sorter</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                        Avg shipments closed per active hour — outliers &gt;10 min excluded
                      </Typography>
                      <HBar
                        items={throughput.sorterThroughput
                          .map(t => ({
                            ...t,
                            sorterName: leaderboard.find(l => l.sorterId === t.sorterId)?.sorterName || t.sorterId,
                          }))
                          .sort((a, b) => b.avgOrdersPerHour - a.avgOrdersPerHour)}
                        labelKey="sorterName"
                        valueKey="avgOrdersPerHour"
                        color="#c62828"
                        maxItems={10}
                        fmtVal={v => `${v.toFixed(1)} / hr`}
                      />
                    </Paper>
                  </Grid>
                )}

                {/* Show durations */}
                {throughput && throughput.showDurations.length > 0 && (
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, borderRadius: 2 }}>
                      <Typography variant="h6" sx={{ mb: 0.5 }}>Show Duration Breakdown</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                        Net active sorting time per show — breaks &amp; stragglers excluded
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Show</TableCell>
                              <TableCell align="right">First Scan</TableCell>
                              <TableCell align="right">Last Main Scan</TableCell>
                              <TableCell align="right">Net Duration</TableCell>
                              <TableCell align="right">Breaks</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {throughput.showDurations.map(d => {
                              const showName = shows.find(s => s.showId === d.showId)?.showName || `Show ${d.showId}`;
                              return (
                                <TableRow key={d.showId}>
                                  <TableCell>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{showName}</Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="body2" color="text.secondary">
                                      {fmtDateTime(d.firstScanAt)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="body2" color="text.secondary">
                                      {fmtDateTime(d.lastMainScanAt)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: "#00838f" }}>
                                      {fmtMinutes(d.netDurationMinutes)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    {d.breaks.length === 0 ? (
                                      <Typography variant="body2" color="text.secondary">—</Typography>
                                    ) : (
                                      <Stack spacing={0.3}>
                                        {d.breaks.map((b, i) => (
                                          <Typography key={i} variant="caption" color="text.secondary">
                                            {fmtDateTime(b.lastScanBefore)} → {fmtDateTime(b.firstScanAfter)} ({b.gapMinutes}m)
                                          </Typography>
                                        ))}
                                      </Stack>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            )}

            {/* Tab 2 — Shipment Size */}
            {activeTab === 2 && (
              <Grid container spacing={2}>
                <Grid item xs={12} lg={8}>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ mb: 0.5 }}>Handling Time By Shipment Size</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                      Average time to sort a shipment based on how many items it contains
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Items in Shipment</TableCell>
                            <TableCell align="right">Shipments</TableCell>
                            <TableCell align="right">Avg Handling</TableCell>
                            <TableCell align="right">Min Handling</TableCell>
                            <TableCell align="right">Max Handling</TableCell>
                            <TableCell align="right">Avg Scan Gap</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sizeRows.length === 0 ? (
                            <TableRow><TableCell colSpan={6}><Typography variant="body2" color="text.secondary">No data.</Typography></TableCell></TableRow>
                          ) : sizeRows.map(r => (
                            <TableRow key={r.lineCount}>
                              <TableCell>
                                <Chip
                                  label={`${r.lineCount} item${r.lineCount === 1 ? "" : "s"}`}
                                  size="small"
                                  sx={{ fontWeight: 700 }}
                                />
                              </TableCell>
                              <TableCell align="right">{fmt(r.shipmentCount)}</TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" sx={{ fontWeight: 700, color: "#2e7d32" }}>
                                  {fmtMinutes(r.avgHandlingMinutes)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{fmtMinutes(r.minHandlingMinutes)}</TableCell>
                              <TableCell align="right">{fmtMinutes(r.maxHandlingMinutes)}</TableCell>
                              <TableCell align="right">{fmtSeconds(r.avgScanGapSeconds)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Grid>

                <Grid item xs={12} lg={4}>
                  <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                    <Typography variant="h6" sx={{ mb: 1.5 }}>Avg Handling By Size <Typography component="span" variant="caption" color="text.secondary">(chart)</Typography></Typography>
                    <HBar
                      items={sizeRows.filter(r => r.avgHandlingMinutes != null).map(r => ({ ...r, label: `${r.lineCount} item${r.lineCount === 1 ? "" : "s"}` }))}
                      labelKey="label"
                      valueKey="avgHandlingMinutes"
                      color="#2e7d32"
                      maxItems={20}
                      fmtVal={v => fmtMinutes(v)}
                    />
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1.5 }}>Shipment Count By Size</Typography>
                    <HBar
                      items={[...sizeRows].sort((a, b) => b.shipmentCount - a.shipmentCount).map(r => ({ ...r, label: `${r.lineCount} item${r.lineCount === 1 ? "" : "s"}` }))}
                      labelKey="label"
                      valueKey="shipmentCount"
                      color="#1565c0"
                      maxItems={15}
                      fmtVal={v => `${fmt(v)} shipments`}
                    />
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1.5 }}>Avg Scan Gap By Size <Typography component="span" variant="caption" color="text.secondary">(lower = faster)</Typography></Typography>
                    <HBar
                      items={sizeRows.filter(r => r.avgScanGapSeconds != null).map(r => ({ ...r, label: `${r.lineCount} item${r.lineCount === 1 ? "" : "s"}`, displayVal: r.avgScanGapSeconds ?? 0 }))}
                      labelKey="label"
                      valueKey="displayVal"
                      color="#00838f"
                      maxItems={15}
                      fmtVal={v => fmtSeconds(v)}
                    />
                  </Paper>
                </Grid>
              </Grid>
            )}

            {/* Tab 3 — Heatmap */}
            {activeTab === 3 && (
              <Paper sx={{ p: 2, borderRadius: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                  <Typography variant="h6">Day × Hour Heatmap (Shipments Closed)</Typography>
                  <Typography variant="caption" color="text.secondary">Intensity = shipments closed in that hour block</Typography>
                </Box>
                <Box sx={{ overflowX: "auto" }}>
                  <Box sx={{ display: "flex" }}>
                    <Box sx={{ width: 52 }} />
                    {Array.from({ length: 24 }, (_, h) => (
                      <Box key={h} sx={{ width: 36, textAlign: "center" }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{h}</Typography>
                      </Box>
                    ))}
                  </Box>
                  {DAY_LABELS.map((label, dayIndex) => (
                    <Box key={label} sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                      <Box sx={{ width: 52 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11 }}>{label}</Typography>
                      </Box>
                      {Array.from({ length: 24 }, (_, hour) => {
                        const val = heatmapGrid.grid.get(`${dayIndex}-${hour}`) || 0;
                        const intensity = val > 0 ? Math.max(0.15, val / heatmapGrid.max) : 0;
                        return (
                          <Box
                            key={hour}
                            title={`${label} ${hour}:00 — ${val} shipment(s)`}
                            sx={{
                              width: 30, height: 26, borderRadius: 1, mx: "3px",
                              bgcolor: val > 0 ? `rgba(21,101,192,${intensity})` : "#f3f6fb",
                              border: "1px solid #e4ebf3",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            <Typography variant="caption" sx={{ fontSize: 9, color: val > 0 ? "#0f172a" : "#94a3b8" }}>
                              {val > 0 ? val : ""}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  ))}
                </Box>
              </Paper>
            )}

            {/* Tab 4 — Shipments */}
            {activeTab === 4 && (
              <Paper sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="h6" sx={{ mb: 1.5 }}>Shipment Drilldown</Typography>
                <TableContainer sx={{ maxHeight: 600 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Closed At</TableCell>
                        <TableCell>Sorter</TableCell>
                        <TableCell>Shipment</TableCell>
                        <TableCell align="right">Items</TableCell>
                        <TableCell align="right">Scans</TableCell>
                        <TableCell align="right">Avg Scan Gap</TableCell>
                        <TableCell align="right">Handling Time</TableCell>
                        <TableCell>Categories</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {shipments.length === 0 ? (
                        <TableRow><TableCell colSpan={8}><Typography variant="body2" color="text.secondary">No shipments found.</Typography></TableCell></TableRow>
                      ) : shipments.map(r => (
                        <TableRow key={`${r.importId}-${r.shipmentId}`}>
                          <TableCell>{fmtDateTime(r.closedAt)}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: sorterColors[r.sorterName] || "#94a3b8", flexShrink: 0 }} />
                              <Typography variant="body2">{r.sorterName}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Stack>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.shipmentId}</Typography>
                              <Typography variant="caption" color="text.secondary">Import {r.importId}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell align="right">{fmt(r.totalUnits)}</TableCell>
                          <TableCell align="right">{r.totalScans != null ? fmt(r.totalScans) : "—"}</TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontWeight: 600, color: r.avgScanGapSeconds != null && r.avgScanGapSeconds < 30 ? "#2e7d32" : r.avgScanGapSeconds != null && r.avgScanGapSeconds > 90 ? "#c62828" : "text.primary" }}>
                              {fmtSeconds(r.avgScanGapSeconds)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{fmtMinutes(r.handlingMinutes)}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                              {r.categories.split(",").map(c => c.trim()).filter(Boolean).map(c => (
                                <Chip key={c} size="small" label={categoryLabel(c)} variant="outlined" />
                              ))}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}
          </>
        )}
      </Stack>
    </Box>
  );
}


import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Alert, Box, Card, CardContent, Chip, CircularProgress, FormControl, Grid, InputLabel, MenuItem, Paper, Select, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography } from "@mui/material";
import { getApiUrl } from "../config/api";

interface WhatnotShow { id: number; name: string; }
interface SortingOverview { shipmentsClosed: number; totalUnits: number; closeRelevantUnits: number; totalLines: number; activeSorters: number; activeDays: number; mismatchShipments: number; mixedGiveawayShipments: number; avgUnitsPerShipment: number; avgCloseRelevantUnitsPerShipment: number; avgShipmentsPerDay: number; avgShipmentsPerSorter: number; reviewRate: number; }
interface SortingLeaderboardRow { sorterId: string | null; sorterName: string; shipmentsClosed: number; totalUnits: number; closeRelevantUnits: number; totalLines: number; mismatchShipments: number; mixedGiveawayShipments: number; activeDays: number; avgUnitsPerShipment: number; avgCloseRelevantUnitsPerShipment: number; avgShipmentsPerDay: number; reviewRate: number; firstClosedAt: string | null; lastClosedAt: string | null; }
interface SortingDailyRow { bucket: string; shipmentsClosed: number; totalUnits: number; closeRelevantUnits: number; mismatchShipments: number; activeSorters: number; avgUnitsPerShipment: number; reviewRate: number; }
interface SortingShowRow { showId: number; showName: string; shipmentsClosed: number; totalUnits: number; closeRelevantUnits: number; activeSorters: number; mismatchShipments: number; mixedGiveawayShipments: number; avgUnitsPerShipment: number; reviewRate: number; }
interface SortingWeekdayRow { dayIndex: number; dayName: string; shipmentsClosed: number; totalUnits: number; closeRelevantUnits: number; mismatchShipments: number; }
interface SortingHeatmapRow { dayIndex: number; hourOfDay: number; shipmentsClosed: number; totalUnits: number; closeRelevantUnits: number; }
interface SortingCategoryRow { itemCategory: string; shipmentCount: number; totalUnits: number; closeRelevantUnits: number; mismatchRows: number; }
interface SortingSorterDailyRow { bucket: string; sorterId: string | null; sorterName: string; shipmentsClosed: number; totalUnits: number; closeRelevantUnits: number; }
interface SortingShipmentRow { showId: number; showName: string; importId: number; shipmentId: string; tracking: string | null; closedAt: string | null; sorterId: string | null; sorterName: string; totalExpectedUnits: number; closeRelevantUnits: number; lineCount: number; categoryTypeCount: number; categories: string; hasMismatch: boolean; hasRandomGiveaway: boolean; hasNonRandomGiveaway: boolean; auctionUnits: number; flashSaleUnits: number; raidGiveawayUnits: number; buyersGiveawayUnits: number; randomGiveawayUnits: number; coffeeUnits: number; sponsoredGiveawayUnits: number; otherUnits: number; buyer: string | null; orderId: string | null; orderNumericId: string | null; }

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);
const formatNumber = (value: number | string | null | undefined) => Number(value || 0).toLocaleString("en-US");
const formatPct = (value: number | string | null | undefined) => `${Number(value || 0).toFixed(2)}%`;
const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const categoryLabel = (value: string) => ({ auction: "Auction", whatnot_flash_sale: "Whatnot Flash Sale", raid_giveaway: "Raid Giveaway", buyers_giveaway: "Buyers Giveaway", random_giveaway: "Random Giveaway", coffee: "Coffee", sponsored_giveaway: "Sponsored Giveaway", others: "Others" } as Record<string, string>)[String(value || "").trim().toLowerCase()] || value || "Unknown";
const formatDateTime = (value: string | null | undefined) => { if (!value) return "N/A"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "N/A" : parsed.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); };

const MetricCard = ({ label, value, color, helper }: { label: string; value: string | number; color: string; helper?: string }) => (
  <Card sx={{ borderRadius: 2, border: "1px solid #e3e8ef", height: "100%" }}><CardContent><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h5" sx={{ mt: 0.6, color, fontWeight: 700 }}>{typeof value === "number" ? formatNumber(value) : value}</Typography>{helper ? <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{helper}</Typography> : null}</CardContent></Card>
);

const HorizontalBarList = ({ items, labelKey, valueKey, valueFormatter, color = "#1565c0", maxItems = 10 }: { items: Record<string, any>[]; labelKey: string; valueKey: string; valueFormatter?: (value: number) => string; color?: string; maxItems?: number; }) => {
  const rows = items.slice(0, maxItems); const maxValue = rows.reduce((max, row) => Math.max(max, Number(row[valueKey] || 0)), 0);
  if (rows.length === 0) return <Typography variant="body2" color="text.secondary">No data available for this range.</Typography>;
  return <Stack spacing={1.1}>{rows.map((row, index) => { const value = Number(row[valueKey] || 0); const widthPct = maxValue > 0 ? Math.max((value / maxValue) * 100, 2) : 0; return <Box key={`${row[labelKey]}-${index}`}><Box display="flex" justifyContent="space-between" mb={0.35}><Typography variant="body2" sx={{ fontWeight: 600 }}>{row[labelKey] || "N/A"}</Typography><Typography variant="body2" color="text.secondary">{valueFormatter ? valueFormatter(value) : formatNumber(value)}</Typography></Box><Box sx={{ height: 9, borderRadius: 999, bgcolor: "#edf1f7", overflow: "hidden" }}><Box sx={{ width: `${widthPct}%`, height: "100%", borderRadius: 999, bgcolor: color }} /></Box></Box>; })}</Stack>;
};

function SortingAnalytics() {
  const now = new Date(); const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const [fromDate, setFromDate] = useState(formatDateInput(thirtyDaysAgo));
  const [toDate, setToDate] = useState(formatDateInput(now));
  const [selectedShowId, setSelectedShowId] = useState("");
  const [selectedSorterId, setSelectedSorterId] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [shows, setShows] = useState<WhatnotShow[]>([]);
  const [overview, setOverview] = useState<SortingOverview | null>(null);
  const [leaderboard, setLeaderboard] = useState<SortingLeaderboardRow[]>([]);
  const [daily, setDaily] = useState<SortingDailyRow[]>([]);
  const [showRows, setShowRows] = useState<SortingShowRow[]>([]);
  const [weekday, setWeekday] = useState<SortingWeekdayRow[]>([]);
  const [heatmap, setHeatmap] = useState<SortingHeatmapRow[]>([]);
  const [categoryRows, setCategoryRows] = useState<SortingCategoryRow[]>([]);
  const [sorterDaily, setSorterDaily] = useState<SortingSorterDailyRow[]>([]);
  const [shipments, setShipments] = useState<SortingShipmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => ({ from: fromDate, to: toDate, showId: selectedShowId ? Number(selectedShowId) : undefined, sorterId: selectedSorterId || undefined }), [fromDate, toDate, selectedShowId, selectedSorterId]);
  const sorterOptions = useMemo(() => leaderboard.filter((row) => !!row.sorterId).map((row) => ({ sorterId: row.sorterId as string, sorterName: row.sorterName })), [leaderboard]);
  const selectedSorterSnapshot = useMemo(() => selectedSorterId ? leaderboard.find((row) => row.sorterId === selectedSorterId) || null : null, [leaderboard, selectedSorterId]);
  const categoryMixTotal = useMemo(() => categoryRows.reduce((sum, row) => sum + Number(row.totalUnits || 0), 0), [categoryRows]);
  const weekdayRows = useMemo(() => dayLabels.map((label, index) => { const row = weekday.find((entry) => Number(entry.dayIndex) === index); return { dayName: label, shipmentsClosed: Number(row?.shipmentsClosed || 0), totalUnits: Number(row?.totalUnits || 0) }; }), [weekday]);
  const heatmapGrid = useMemo(() => { const grid = new Map<string, number>(); heatmap.forEach((row) => grid.set(`${row.dayIndex}-${row.hourOfDay}`, Number(row.shipmentsClosed || 0))); return { grid, max: Math.max(1, ...Array.from(grid.values())) }; }, [heatmap]);
  const topDailyRows = useMemo(() => daily.slice().sort((a, b) => Number(b.shipmentsClosed || 0) - Number(a.shipmentsClosed || 0)).slice(0, 12), [daily]);
  useEffect(() => { const fetchShows = async () => { try { const response = await axios.get(getApiUrl("whatnot/shows")); setShows(response.data || []); } catch (showError) { console.error("Error loading shows for sorting analytics:", showError); } }; fetchShows(); }, []);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true); setError(null);
        const results = await Promise.allSettled([
          axios.get(getApiUrl("whatnot/analytics/fulfillment-sorting-overview"), { params }),
          axios.get(getApiUrl("whatnot/analytics/fulfillment-sorting-leaderboard"), { params: { ...params, limit: 50 } }),
          axios.get(getApiUrl("whatnot/analytics/fulfillment-sorting-daily"), { params }),
          axios.get(getApiUrl("whatnot/analytics/fulfillment-sorting-shows"), { params: { ...params, limit: 25 } }),
          axios.get(getApiUrl("whatnot/analytics/fulfillment-sorting-weekday"), { params }),
          axios.get(getApiUrl("whatnot/analytics/fulfillment-sorting-time-heatmap"), { params }),
          axios.get(getApiUrl("whatnot/analytics/fulfillment-sorting-categories"), { params }),
          axios.get(getApiUrl("whatnot/analytics/fulfillment-sorting-sorters-daily"), { params: { ...params, limit: 5 } }),
          axios.get(getApiUrl("whatnot/analytics/fulfillment-sorting-shipments"), { params: { ...params, limit: 100 } }),
        ]);
        const [overviewResult, leaderboardResult, dailyResult, showsResult, weekdayResult, heatmapResult, categoriesResult, sorterDailyResult, shipmentsResult] = results;
        if (overviewResult.status === "fulfilled") setOverview(overviewResult.value.data || null);
        if (leaderboardResult.status === "fulfilled") setLeaderboard(leaderboardResult.value.data || []);
        if (dailyResult.status === "fulfilled") setDaily(dailyResult.value.data || []);
        if (showsResult.status === "fulfilled") setShowRows(showsResult.value.data || []);
        if (weekdayResult.status === "fulfilled") setWeekday(weekdayResult.value.data || []);
        if (heatmapResult.status === "fulfilled") setHeatmap(heatmapResult.value.data || []);
        if (categoriesResult.status === "fulfilled") setCategoryRows(categoriesResult.value.data || []);
        if (sorterDailyResult.status === "fulfilled") setSorterDaily(sorterDailyResult.value.data || []);
        if (shipmentsResult.status === "fulfilled") setShipments(shipmentsResult.value.data || []);
        const failedPanels = [{ name: "sorting-overview", result: overviewResult }, { name: "sorting-leaderboard", result: leaderboardResult }, { name: "sorting-daily", result: dailyResult }, { name: "sorting-shows", result: showsResult }, { name: "sorting-weekday", result: weekdayResult }, { name: "sorting-time-heatmap", result: heatmapResult }, { name: "sorting-categories", result: categoriesResult }, { name: "sorting-sorters-daily", result: sorterDailyResult }, { name: "sorting-shipments", result: shipmentsResult }].filter((entry) => entry.result.status === "rejected");
        if (failedPanels.length > 0) setError(`Some sorting analytics panels failed to load: ${failedPanels.map((entry) => entry.name).join(", ")}.`);
      } catch (fetchError) {
        console.error("Error fetching sorting analytics:", fetchError); setError("Failed to load sorting analytics. Please refresh and try again.");
      } finally { setLoading(false); }
    };
    fetchAll();
  }, [params]);

  const overviewCards = [
    { label: "Shipments Closed", value: overview?.shipmentsClosed || 0, color: "#1565c0", helper: `${formatNumber(overview?.activeDays || 0)} active day(s)` },
    { label: "Total Units", value: overview?.totalUnits || 0, color: "#2e7d32", helper: `${formatNumber(overview?.closeRelevantUnits || 0)} close-relevant` },
    { label: "Active Sorters", value: overview?.activeSorters || 0, color: "#6a1b9a", helper: `${overview?.avgShipmentsPerSorter || 0} shipments/sorter` },
    { label: "Avg Units / Shipment", value: overview?.avgUnitsPerShipment || 0, color: "#ef6c00", helper: `${overview?.avgCloseRelevantUnitsPerShipment || 0} close-relevant` },
    { label: "Review / Mismatch Rate", value: formatPct(overview?.reviewRate || 0), color: "#c62828", helper: `${formatNumber(overview?.mismatchShipments || 0)} shipment(s) flagged` },
    { label: "Mixed With GVY", value: overview?.mixedGiveawayShipments || 0, color: "#00838f", helper: "Mixed shipments where GVY was auto-handled" },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>Sorting Analytics</Typography>
          <Typography variant="body1" color="text.secondary">Operational dashboard for Whatnot shipment sorting, closer efficiency, timing patterns, and category mix.</Typography>
        </Box>

        <Paper sx={{ p: 2, borderRadius: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}><TextField fullWidth label="From" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12} sm={6} md={3}><TextField fullWidth label="To" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12} sm={6} md={3}><FormControl fullWidth><InputLabel id="sorting-analytics-show-label">Show</InputLabel><Select labelId="sorting-analytics-show-label" value={selectedShowId} label="Show" onChange={(event) => setSelectedShowId(String(event.target.value || ""))}><MenuItem value="">All Shows</MenuItem>{shows.map((show) => <MenuItem key={show.id} value={String(show.id)}>{show.name}</MenuItem>)}</Select></FormControl></Grid>
            <Grid item xs={12} sm={6} md={3}><FormControl fullWidth><InputLabel id="sorting-analytics-sorter-label">Sorter</InputLabel><Select labelId="sorting-analytics-sorter-label" value={selectedSorterId} label="Sorter" onChange={(event) => setSelectedSorterId(String(event.target.value || ""))}><MenuItem value="">All Sorters</MenuItem>{sorterOptions.map((sorter) => <MenuItem key={sorter.sorterId} value={sorter.sorterId}>{sorter.sorterName}</MenuItem>)}</Select></FormControl></Grid>
          </Grid>
        </Paper>

        {error ? <Alert severity="warning">{error}</Alert> : null}
        {loading ? <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box> : <>
          <Grid container spacing={2}>{overviewCards.map((card) => <Grid item xs={12} sm={6} md={4} lg={2} key={card.label}><MetricCard {...card} /></Grid>)}</Grid>
          <Paper sx={{ borderRadius: 2 }}><Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} variant="scrollable" scrollButtons="auto"><Tab label="Overview" /><Tab label="Sorters" /><Tab label="Timing" /><Tab label="Categories" /><Tab label="Shipments" /></Tabs></Paper>

          {activeTab === 0 && <Grid container spacing={2}>
            <Grid item xs={12} md={6}><Paper sx={{ p: 2, borderRadius: 2 }}><Typography variant="h6" sx={{ mb: 1.2 }}>Top Days By Shipments</Typography><HorizontalBarList items={topDailyRows} labelKey="bucket" valueKey="shipmentsClosed" color="#1565c0" maxItems={12} valueFormatter={(value) => `${formatNumber(value)} shipments`} /></Paper></Grid>
            <Grid item xs={12} md={6}><Paper sx={{ p: 2, borderRadius: 2 }}><Typography variant="h6" sx={{ mb: 1.2 }}>Top Days By Units</Typography><HorizontalBarList items={daily.slice().sort((a, b) => Number(b.totalUnits || 0) - Number(a.totalUnits || 0))} labelKey="bucket" valueKey="totalUnits" color="#2e7d32" maxItems={12} valueFormatter={(value) => `${formatNumber(value)} units`} /></Paper></Grid>
            <Grid item xs={12} md={6}><Paper sx={{ p: 2, borderRadius: 2 }}><Typography variant="h6" sx={{ mb: 1.2 }}>Throughput By Show</Typography><HorizontalBarList items={showRows} labelKey="showName" valueKey="shipmentsClosed" color="#6a1b9a" maxItems={10} valueFormatter={(value) => `${formatNumber(value)} shipments`} /></Paper></Grid>
            <Grid item xs={12} md={6}><Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}><Typography variant="h6" sx={{ mb: 1.2 }}>Snapshot</Typography><Stack spacing={1.2}><Box sx={{ p: 1.4, borderRadius: 2, bgcolor: "#f7fbff", border: "1px solid #d7e7fb" }}><Typography variant="caption" color="text.secondary">Units Per Shipment</Typography><Typography variant="h6" sx={{ color: "#1565c0", fontWeight: 700 }}>{Number(overview?.avgUnitsPerShipment || 0).toFixed(2)}</Typography></Box><Box sx={{ p: 1.4, borderRadius: 2, bgcolor: "#f5fff7", border: "1px solid #d8efdc" }}><Typography variant="caption" color="text.secondary">Avg Shipments Per Active Day</Typography><Typography variant="h6" sx={{ color: "#2e7d32", fontWeight: 700 }}>{Number(overview?.avgShipmentsPerDay || 0).toFixed(2)}</Typography></Box><Box sx={{ p: 1.4, borderRadius: 2, bgcolor: "#fff7f2", border: "1px solid #f5ddca" }}><Typography variant="caption" color="text.secondary">Review / Mismatch Signal</Typography><Typography variant="h6" sx={{ color: "#ef6c00", fontWeight: 700 }}>{formatPct(overview?.reviewRate || 0)}</Typography></Box></Stack></Paper></Grid>
          </Grid>}
          {activeTab === 1 && <Grid container spacing={2}>
            <Grid item xs={12} lg={7}><Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}><Typography variant="h6" sx={{ mb: 1.5 }}>Sorter Leaderboard</Typography><TableContainer><Table size="small"><TableHead><TableRow><TableCell>Sorter</TableCell><TableCell align="right">Shipments</TableCell><TableCell align="right">Units</TableCell><TableCell align="right">Close-Relevant</TableCell><TableCell align="right">Avg Units</TableCell><TableCell align="right">Review %</TableCell><TableCell align="right">Last Activity</TableCell></TableRow></TableHead><TableBody>{leaderboard.length === 0 ? <TableRow><TableCell colSpan={7}><Typography variant="body2" color="text.secondary">No sorter activity found in this range.</Typography></TableCell></TableRow> : leaderboard.map((row) => <TableRow key={`${row.sorterId || "unknown"}-${row.sorterName}`}><TableCell><Stack spacing={0.25}><Typography variant="body2" sx={{ fontWeight: 600 }}>{row.sorterName}</Typography><Typography variant="caption" color="text.secondary">{row.activeDays} active day(s)</Typography></Stack></TableCell><TableCell align="right">{formatNumber(row.shipmentsClosed)}</TableCell><TableCell align="right">{formatNumber(row.totalUnits)}</TableCell><TableCell align="right">{formatNumber(row.closeRelevantUnits)}</TableCell><TableCell align="right">{row.avgUnitsPerShipment.toFixed(2)}</TableCell><TableCell align="right">{formatPct(row.reviewRate)}</TableCell><TableCell align="right">{formatDateTime(row.lastClosedAt)}</TableCell></TableRow>)}</TableBody></Table></TableContainer></Paper></Grid>
            <Grid item xs={12} lg={5}><Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}><Typography variant="h6" sx={{ mb: 1.5 }}>Shipments Closed By Sorter</Typography><HorizontalBarList items={leaderboard} labelKey="sorterName" valueKey="shipmentsClosed" color="#1565c0" maxItems={10} valueFormatter={(value) => `${formatNumber(value)} shipments`} /></Paper></Grid>
            <Grid item xs={12} md={6}><Paper sx={{ p: 2, borderRadius: 2 }}><Typography variant="h6" sx={{ mb: 1.5 }}>Units By Sorter</Typography><HorizontalBarList items={leaderboard} labelKey="sorterName" valueKey="totalUnits" color="#2e7d32" maxItems={10} valueFormatter={(value) => `${formatNumber(value)} units`} /></Paper></Grid>
            <Grid item xs={12} md={6}><Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}><Typography variant="h6" sx={{ mb: 1.5 }}>Selected Sorter Snapshot</Typography>{selectedSorterSnapshot ? <Stack spacing={1.2}><Box sx={{ p: 1.4, borderRadius: 2, bgcolor: "#f7fbff", border: "1px solid #d7e7fb" }}><Typography variant="caption" color="text.secondary">{selectedSorterSnapshot.sorterName}</Typography><Typography variant="h6" sx={{ color: "#1565c0", fontWeight: 700 }}>{formatNumber(selectedSorterSnapshot.shipmentsClosed)} shipments</Typography></Box><Typography variant="body2" color="text.secondary">{formatNumber(selectedSorterSnapshot.totalUnits)} total units, {formatNumber(selectedSorterSnapshot.closeRelevantUnits)} close-relevant units, review rate {formatPct(selectedSorterSnapshot.reviewRate)}.</Typography><Typography variant="body2" color="text.secondary">First close: {formatDateTime(selectedSorterSnapshot.firstClosedAt)}</Typography><Typography variant="body2" color="text.secondary">Last close: {formatDateTime(selectedSorterSnapshot.lastClosedAt)}</Typography></Stack> : <Typography variant="body2" color="text.secondary">Pick a sorter from the filter above to get an individual snapshot.</Typography>}</Paper></Grid>
            <Grid item xs={12}><Paper sx={{ p: 2, borderRadius: 2 }}><Typography variant="h6" sx={{ mb: 1.5 }}>Top Sorters Daily Output</Typography>{sorterDaily.length === 0 ? <Typography variant="body2" color="text.secondary">No daily sorter comparison available for this range.</Typography> : <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Sorter</TableCell><TableCell align="right">Shipments</TableCell><TableCell align="right">Units</TableCell><TableCell align="right">Close-Relevant</TableCell></TableRow></TableHead><TableBody>{sorterDaily.map((row, index) => <TableRow key={`${row.bucket}-${row.sorterName}-${index}`}><TableCell>{row.bucket}</TableCell><TableCell>{row.sorterName}</TableCell><TableCell align="right">{formatNumber(row.shipmentsClosed)}</TableCell><TableCell align="right">{formatNumber(row.totalUnits)}</TableCell><TableCell align="right">{formatNumber(row.closeRelevantUnits)}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}</Paper></Grid>
          </Grid>}

          {activeTab === 2 && <Grid container spacing={2}>
            <Grid item xs={12} md={5}><Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}><Typography variant="h6" sx={{ mb: 1.5 }}>Day-Of-Week Pattern</Typography><HorizontalBarList items={weekdayRows} labelKey="dayName" valueKey="shipmentsClosed" color="#ef6c00" maxItems={7} valueFormatter={(value) => `${formatNumber(value)} shipments`} /></Paper></Grid>
            <Grid item xs={12} md={7}><Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}><Typography variant="h6" sx={{ mb: 1.5 }}>Weekday Units Pattern</Typography><HorizontalBarList items={weekdayRows} labelKey="dayName" valueKey="totalUnits" color="#6a1b9a" maxItems={7} valueFormatter={(value) => `${formatNumber(value)} units`} /></Paper></Grid>
            <Grid item xs={12}><Paper sx={{ p: 2, borderRadius: 2 }}><Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}><Typography variant="h6">Day-Of-Week x Hour Heatmap</Typography><Typography variant="caption" color="text.secondary">Color intensity = shipments closed in that hour block</Typography></Box><Box sx={{ overflowX: "auto" }}><Grid container><Grid item sx={{ width: 74 }} />{Array.from({ length: 24 }, (_, hour) => <Grid key={`hour-header-${hour}`} item sx={{ width: 34, textAlign: "center" }}><Typography variant="caption" color="text.secondary">{hour}</Typography></Grid>)}</Grid>{dayLabels.map((label, dayIndex) => <Grid container key={`day-${label}`} alignItems="center"><Grid item sx={{ width: 74 }}><Typography variant="caption" sx={{ fontWeight: 700 }}>{label}</Typography></Grid>{Array.from({ length: 24 }, (_, hour) => { const value = heatmapGrid.grid.get(`${dayIndex}-${hour}`) || 0; const intensity = value > 0 ? Math.max(0.15, value / heatmapGrid.max) : 0; return <Grid key={`${label}-${hour}`} item sx={{ width: 34 }}><Box title={`${label} ${hour}:00 - ${formatNumber(value)} shipment(s)`} sx={{ width: 28, height: 24, borderRadius: 1, bgcolor: value > 0 ? `rgba(21, 101, 192, ${intensity})` : "#f3f6fb", border: "1px solid #e4ebf3", display: "flex", alignItems: "center", justifyContent: "center" }}><Typography variant="caption" sx={{ fontSize: 10, color: value > 0 ? "#0f172a" : "#94a3b8" }}>{value > 0 ? value : ""}</Typography></Box></Grid>; })}</Grid>)}</Box></Paper></Grid>
          </Grid>}

          {activeTab === 3 && <Grid container spacing={2}>
            <Grid item xs={12} md={5}><Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}><Typography variant="h6" sx={{ mb: 1.5 }}>Category Mix By Units</Typography><HorizontalBarList items={categoryRows.map((row) => ({ ...row, label: categoryLabel(row.itemCategory) }))} labelKey="label" valueKey="totalUnits" color="#00838f" maxItems={10} valueFormatter={(value) => `${formatNumber(value)} units`} /></Paper></Grid>
            <Grid item xs={12} md={7}><Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}><Typography variant="h6" sx={{ mb: 1.5 }}>Category Detail</Typography><TableContainer><Table size="small"><TableHead><TableRow><TableCell>Category</TableCell><TableCell align="right">Shipments</TableCell><TableCell align="right">Units</TableCell><TableCell align="right">Close-Relevant</TableCell><TableCell align="right">Share</TableCell></TableRow></TableHead><TableBody>{categoryRows.length === 0 ? <TableRow><TableCell colSpan={5}><Typography variant="body2" color="text.secondary">No category data available.</Typography></TableCell></TableRow> : categoryRows.map((row) => { const share = categoryMixTotal > 0 ? (Number(row.totalUnits || 0) / categoryMixTotal) * 100 : 0; return <TableRow key={row.itemCategory}><TableCell>{categoryLabel(row.itemCategory)}</TableCell><TableCell align="right">{formatNumber(row.shipmentCount)}</TableCell><TableCell align="right">{formatNumber(row.totalUnits)}</TableCell><TableCell align="right">{formatNumber(row.closeRelevantUnits)}</TableCell><TableCell align="right">{formatPct(share)}</TableCell></TableRow>; })}</TableBody></Table></TableContainer></Paper></Grid>
            <Grid item xs={12}><Paper sx={{ p: 2, borderRadius: 2 }}><Typography variant="h6" sx={{ mb: 1.5 }}>Show Breakdown</Typography><TableContainer><Table size="small"><TableHead><TableRow><TableCell>Show</TableCell><TableCell align="right">Shipments</TableCell><TableCell align="right">Units</TableCell><TableCell align="right">Close-Relevant</TableCell><TableCell align="right">Sorters</TableCell><TableCell align="right">Review %</TableCell></TableRow></TableHead><TableBody>{showRows.length === 0 ? <TableRow><TableCell colSpan={6}><Typography variant="body2" color="text.secondary">No show data found in this range.</Typography></TableCell></TableRow> : showRows.map((row) => <TableRow key={row.showId}><TableCell>{row.showName}</TableCell><TableCell align="right">{formatNumber(row.shipmentsClosed)}</TableCell><TableCell align="right">{formatNumber(row.totalUnits)}</TableCell><TableCell align="right">{formatNumber(row.closeRelevantUnits)}</TableCell><TableCell align="right">{formatNumber(row.activeSorters)}</TableCell><TableCell align="right">{formatPct(row.reviewRate)}</TableCell></TableRow>)}</TableBody></Table></TableContainer></Paper></Grid>
          </Grid>}

          {activeTab === 4 && <Paper sx={{ p: 2, borderRadius: 2 }}><Typography variant="h6" sx={{ mb: 1.5 }}>Shipment Drilldown</Typography><TableContainer sx={{ maxHeight: 620 }}><Table size="small" stickyHeader><TableHead><TableRow><TableCell>Closed At</TableCell><TableCell>Sorter</TableCell><TableCell>Show</TableCell><TableCell>Shipment</TableCell><TableCell>Tracking</TableCell><TableCell align="right">Units</TableCell><TableCell align="right">Close-Relevant</TableCell><TableCell>Categories</TableCell><TableCell>Flags</TableCell></TableRow></TableHead><TableBody>{shipments.length === 0 ? <TableRow><TableCell colSpan={9}><Typography variant="body2" color="text.secondary">No shipments found in this range.</Typography></TableCell></TableRow> : shipments.map((row) => <TableRow key={`${row.showId}-${row.importId}-${row.shipmentId}`}><TableCell>{formatDateTime(row.closedAt)}</TableCell><TableCell>{row.sorterName}</TableCell><TableCell>{row.showName}</TableCell><TableCell><Stack spacing={0.25}><Typography variant="body2" sx={{ fontWeight: 600 }}>{row.shipmentId}</Typography><Typography variant="caption" color="text.secondary">Import {row.importId}</Typography></Stack></TableCell><TableCell>{row.tracking || "N/A"}</TableCell><TableCell align="right">{formatNumber(row.totalExpectedUnits)}</TableCell><TableCell align="right">{formatNumber(row.closeRelevantUnits)}</TableCell><TableCell><Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">{row.categories.split(",").map((entry) => entry.trim()).filter(Boolean).map((entry) => <Chip key={`${row.shipmentId}-${entry}`} size="small" label={categoryLabel(entry)} variant="outlined" />)}</Stack></TableCell><TableCell><Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">{row.hasMismatch ? <Chip size="small" label="Review" color="warning" /> : null}{row.randomGiveawayUnits > 0 && row.hasNonRandomGiveaway ? <Chip size="small" label="Mixed GVY" color="info" variant="outlined" /> : null}{row.otherUnits > 0 ? <Chip size="small" label="OTH" variant="outlined" /> : null}</Stack></TableCell></TableRow>)}</TableBody></Table></TableContainer></Paper>}
        </>}
      </Stack>
    </Box>
  );
}

export default SortingAnalytics;

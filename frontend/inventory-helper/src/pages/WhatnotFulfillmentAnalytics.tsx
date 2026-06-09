
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Alert,
  Autocomplete,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  AttachMoney as AttachMoneyIcon,
  BarChart as BarChartIcon,
  CalendarToday as CalendarTodayIcon,
  CardGiftcard as CardGiftcardIcon,
  ErrorOutline as ErrorOutlineIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Inventory2 as Inventory2Icon,
  LocalOffer as LocalOfferIcon,
  LocalShipping as LocalShippingIcon,
  PieChart as PieChartIcon,
  Receipt as ReceiptIcon,
  Schedule as ScheduleIcon,
  Search as SearchIcon,
  ShowChart as ShowChartIcon,
  TrendingUp as TrendingUpIcon,
  WarningAmber as WarningAmberIcon,
} from "@mui/icons-material";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  PieChart,
  Pie,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getApiUrl } from "../config/api";

interface WhatnotShow {
  id: number;
  name: string;
}

interface FulfillmentOverviewData {
  unitsSold: number;
  revenue: number;
  avgSoldPrice: number;
  completedShipments: number;
  uniqueSkusSold: number;
  uniqueShows: number;
  pendingShipments: number;
  pendingRevenue: number;
  reviewShipments: number;
  reviewRevenue: number;
  randomGiveawayShipments: number;
  randomGiveawayUnits: number;
}

interface FulfillmentShowPerformance {
  showId: number;
  showName: string;
  unitsSold: number;
  revenue: number;
  completedShipments: number;
  uniqueSkusSold: number;
}

interface FulfillmentTopProduct {
  sku: string;
  brand: string;
  itemName: string;
  unitsSold: number;
  revenue: number;
  avgSoldPrice: number;
}

interface FulfillmentBrandMixRow {
  brand: string;
  unitsSold: number;
  revenue: number;
}

interface FulfillmentSalesMixRow {
  contextType: string;
  unitsSold: number;
  revenue: number;
}

interface FulfillmentProfitabilityOverview {
  unitsSold: number;
  revenue: number;
  knownCostUnits: number;
  knownCostRevenue: number;
  estimatedCost: number;
  grossMargin: number;
  grossMarginPct: number;
  whatnotFees: number;
  knownCostWhatnotFees: number;
  netMarginAfterFees: number;
  netMarginAfterFeesPct: number;
  unknownCostUnits: number;
  unknownCostRevenue: number;
  negativeMarginUnits: number;
  lowMarginUnits: number;
}

interface FulfillmentProfitabilityShowRow {
  showId: number;
  showName: string;
  unitsSold: number;
  revenue: number;
  knownCostUnits: number;
  knownCostRevenue: number;
  estimatedCost: number;
  grossMargin: number;
  grossMarginPct: number;
  whatnotFees: number;
  knownCostWhatnotFees: number;
  netMarginAfterFees: number;
  netMarginAfterFeesPct: number;
  unknownCostUnits: number;
  unknownCostRevenue: number;
}

interface FulfillmentReviewReasonRow {
  mismatchReason: string;
  rowCount: number;
  shipmentCount: number;
}

interface FulfillmentReviewAgingRow {
  ageBucket: string;
  shipmentCount: number;
}

interface FulfillmentReviewShipmentRow {
  showId: number;
  showName: string | null;
  importId: number;
  shipmentId: string;
  tracking: string | null;
  mismatchReason: string;
  expectedQty: number;
  scannedQty: number;
  affectedRevenue: number;
  ageDays: number;
}

interface FulfillmentInventoryExposureRow {
  sku: string;
  brand: string;
  itemName: string;
  currentQty: number;
  minimumQuantity: number | null;
  unitsSold: number;
  revenue: number;
  grossMargin: number | null;
  knownCostUnits: number;
  unknownCostUnits: number;
  avgDailySales: number;
  daysOfCover: number | null;
  riskBand: "critical" | "high" | "medium" | "stable" | "no_signal";
}

interface FulfillmentSkuSearchOption {
  sku: string;
  brand: string;
  itemName: string;
  strength: string | null;
  sizeOz: string | null;
  sizeMl: string | null;
  tester: boolean | null;
  unitsSold: number;
}

interface FulfillmentSkuDetailResponse {
  product: {
    sku: string;
    brand: string | null;
    itemName: string | null;
    strength: string | null;
    sizeOz: string | null;
    sizeMl: string | null;
    location: string | null;
    quantity: number | null;
    minimumQuantity: number | null;
    averagePrice: number | null;
    condition: string | null;
    tester: boolean | null;
  };
  summary: {
    unitsSold: number;
    revenue: number;
    avgSoldPrice: number;
    knownCostUnits: number;
    knownCostRevenue: number;
    estimatedCost: number;
    grossMargin: number;
    grossMarginPct: number;
    unknownCostUnits: number;
    unknownCostRevenue: number;
    uniqueShows: number;
    uniqueShipments: number;
    lowestSoldPrice: number;
    highestSoldPrice: number;
    firstSaleAt: string | null;
    lastSaleAt: string | null;
  };
  byShow: FulfillmentProfitabilityShowRow[];
  byDay: Array<{ bucket: string; unitsSold: number; revenue: number; avgSoldPrice: number }>;
  dayOfWeek: Array<{ dayIndex: number; dayName: string; unitsSold: number; revenue: number }>;
  hourOfDay: Array<{ hourOfDay: number; unitsSold: number; revenue: number }>;
  recentSales: Array<{
    id: number;
    createdAt: string;
    showName: string | null;
    shipmentId: string | null;
    tracking: string | null;
    soldPrice: number;
    auctionStickerNumber: string | null;
    userId: string | null;
  }>;
}

interface FulfillmentTrendRow {
  bucket: string;
  unitsSold: number;
  revenue: number;
  completedShipments: number;
}

interface FulfillmentBrandProfitabilityRow {
  brand: string;
  unitsSold: number;
  revenue: number;
  knownCostRevenue: number;
  estimatedCost: number;
  grossMargin: number;
  grossMarginPct: number;
  unknownCostUnits: number;
}

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);
const formatNumber = (value: number | string | null | undefined) => Number(value || 0).toLocaleString("en-US");
const formatCurrency = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const kFormatter = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v.toFixed(0)}`;
const hourLabel = (h: number) => h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;
const formatTick = (bucket: string, granularity: string) => {
  const d = new Date(bucket + "T12:00:00");
  if (granularity === "month") return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const truncate = (s: string, n: number) => s && s.length > n ? s.slice(0, n - 1) + "…" : s;

const BRAND_COLORS = ["#1e88e5", "#43a047", "#8e24aa", "#fb8c00", "#e53935", "#00897b", "#3949ab", "#6d4c41", "#d81b60", "#546e7a"];
const riskColorMap: Record<FulfillmentInventoryExposureRow["riskBand"], string> = {
  critical: "#d32f2f",
  high: "#ef6c00",
  medium: "#f9a825",
  stable: "#2e7d32",
  no_signal: "#607d8b",
};
const tabLabels = ["Overview", "Sales", "Profitability", "Operations", "Inventory", "Item Lookup"];

const HorizontalBarList = ({ items, labelKey, valueKey, maxItems = 10, barColor = "#1976d2", valueFormatter }: {
  items: Record<string, any>[];
  labelKey: string;
  valueKey: string;
  maxItems?: number;
  barColor?: string;
  valueFormatter?: (value: number) => string;
}) => {
  const rows = items.slice(0, maxItems);
  const maxValue = rows.reduce((max, row) => Math.max(max, Number(row[valueKey] || 0)), 0);

  if (rows.length === 0) {
    return <Typography variant="body2" color="text.secondary">No data available.</Typography>;
  }

  return (
    <Stack spacing={1.25}>
      {rows.map((row, idx) => {
        const value = Number(row[valueKey] || 0);
        const widthPct = maxValue > 0 ? Math.max((value / maxValue) * 100, 2) : 0;
        return (
          <Box key={`${row[labelKey]}-${idx}`}>
            <Box display="flex" justifyContent="space-between" mb={0.4}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{row[labelKey] || "N/A"}</Typography>
              <Typography variant="body2" color="text.secondary">{valueFormatter ? valueFormatter(value) : formatNumber(value)}</Typography>
            </Box>
            <Box sx={{ height: 9, borderRadius: 999, bgcolor: "#edf1f7", overflow: "hidden" }}>
              <Box sx={{ height: "100%", width: `${widthPct}%`, borderRadius: 999, bgcolor: barColor }} />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
};

function WhatnotFulfillmentAnalytics() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [fromDate, setFromDate] = useState(formatDateInput(thirtyDaysAgo));
  const [toDate, setToDate] = useState(formatDateInput(now));
  const [selectedShowId, setSelectedShowId] = useState<string>("");
  const [activeTab, setActiveTab] = useState(0);
  const [shows, setShows] = useState<WhatnotShow[]>([]);
  const [overview, setOverview] = useState<FulfillmentOverviewData | null>(null);
  const [showsPerformance, setShowsPerformance] = useState<FulfillmentShowPerformance[]>([]);
  const [topProducts, setTopProducts] = useState<FulfillmentTopProduct[]>([]);
  const [brandMix, setBrandMix] = useState<FulfillmentBrandMixRow[]>([]);
  // salesMix data is fetched and available but not currently rendered in the chart panel
  const [, setSalesMix] = useState<FulfillmentSalesMixRow[]>([]);
  const [profitabilityOverview, setProfitabilityOverview] = useState<FulfillmentProfitabilityOverview | null>(null);
  const [profitabilityShows, setProfitabilityShows] = useState<FulfillmentProfitabilityShowRow[]>([]);
  const [reviewReasons, setReviewReasons] = useState<FulfillmentReviewReasonRow[]>([]);
  const [reviewAging, setReviewAging] = useState<FulfillmentReviewAgingRow[]>([]);
  const [reviewShipments, setReviewShipments] = useState<FulfillmentReviewShipmentRow[]>([]);
  const [inventoryExposure, setInventoryExposure] = useState<FulfillmentInventoryExposureRow[]>([]);
  const [skuSearchInput, setSkuSearchInput] = useState("");
  const [skuOptions, setSkuOptions] = useState<FulfillmentSkuSearchOption[]>([]);
  const [selectedSku, setSelectedSku] = useState<FulfillmentSkuSearchOption | null>(null);
  const [skuDetail, setSkuDetail] = useState<FulfillmentSkuDetailResponse | null>(null);
  const [skuDetailLoading, setSkuDetailLoading] = useState(false);
  const [skuDetailError, setSkuDetailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trend, setTrend] = useState<FulfillmentTrendRow[]>([]);
  const [trendGranularity, setTrendGranularity] = useState<"day" | "week" | "month">("day");
  const [brandProfitability, setBrandProfitability] = useState<FulfillmentBrandProfitabilityRow[]>([]);

  const params = useMemo(
    () => ({ from: fromDate, to: toDate, showId: selectedShowId ? Number(selectedShowId) : undefined, limit: 25 }),
    [fromDate, toDate, selectedShowId]
  );

  useEffect(() => {
    const fetchShows = async () => {
      try {
        const response = await axios.get(getApiUrl("whatnot/shows"));
        setShows(response.data || []);
      } catch (showError) {
        console.error("Error loading shows for fulfillment analytics:", showError);
      }
    };

    fetchShows();
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError(null);

        const results = await Promise.allSettled([
          axios.get(getApiUrl("whatnot/analytics/fulfillment-overview"), { params }),
          axios.get(getApiUrl("whatnot/analytics/fulfillment-shows"), { params }),
          axios.get(getApiUrl("whatnot/analytics/fulfillment-products-top"), { params }),
          axios.get(getApiUrl("whatnot/analytics/fulfillment-brand-mix"), { params: { ...params, limit: 12 } }),
          axios.get(getApiUrl("whatnot/analytics/fulfillment-sales-mix"), { params }),
          axios.get(getApiUrl("whatnot/analytics/fulfillment-profitability-overview"), { params }),
          axios.get(getApiUrl("whatnot/analytics/fulfillment-profitability-shows"), { params: { ...params, limit: 10 } }),
          axios.get(getApiUrl("whatnot/analytics/fulfillment-review-queue"), { params: { showId: params.showId, limit: 12 } }),
          axios.get(getApiUrl("whatnot/analytics/fulfillment-inventory-exposure"), { params: { ...params, limit: 20 } }),
          axios.get(getApiUrl("whatnot/analytics/fulfillment-brand-profitability"), { params: { ...params, limit: 15 } }),
        ]);
        const [
          overviewResult,
          showsResult,
          topProductsResult,
          brandMixResult,
          salesMixResult,
          profitabilityOverviewResult,
          profitabilityShowsResult,
          reviewQueueResult,
          inventoryExposureResult,
          brandProfitabilityResult,
        ] = results;

        if (overviewResult.status === "fulfilled") setOverview(overviewResult.value.data);
        if (showsResult.status === "fulfilled") setShowsPerformance(showsResult.value.data || []);
        if (topProductsResult.status === "fulfilled") setTopProducts(topProductsResult.value.data || []);
        if (brandMixResult.status === "fulfilled") {
          const payload = brandMixResult.value.data || {};
          setBrandMix(payload.rows || []);
        }
        if (salesMixResult.status === "fulfilled") setSalesMix(salesMixResult.value.data || []);
        if (profitabilityOverviewResult.status === "fulfilled") setProfitabilityOverview(profitabilityOverviewResult.value.data || null);
        if (profitabilityShowsResult.status === "fulfilled") setProfitabilityShows(profitabilityShowsResult.value.data || []);
        if (reviewQueueResult.status === "fulfilled") {
          const payload = reviewQueueResult.value.data || {};
          setReviewReasons(payload.reasons || []);
          setReviewAging(payload.aging || []);
          setReviewShipments(payload.shipments || []);
        }
        if (inventoryExposureResult.status === "fulfilled") setInventoryExposure(inventoryExposureResult.value.data || []);
        if (brandProfitabilityResult.status === "fulfilled") setBrandProfitability(brandProfitabilityResult.value.data || []);

        const failedEndpoints = [
          { name: "fulfillment-overview", result: overviewResult },
          { name: "fulfillment-shows", result: showsResult },
          { name: "fulfillment-products-top", result: topProductsResult },
          { name: "fulfillment-brand-mix", result: brandMixResult },
          { name: "fulfillment-sales-mix", result: salesMixResult },
          { name: "fulfillment-profitability-overview", result: profitabilityOverviewResult },
          { name: "fulfillment-profitability-shows", result: profitabilityShowsResult },
          { name: "fulfillment-review-queue", result: reviewQueueResult },
          { name: "fulfillment-inventory-exposure", result: inventoryExposureResult },
          { name: "fulfillment-brand-profitability", result: brandProfitabilityResult },
        ].filter((entry) => entry.result.status === "rejected");

        if (failedEndpoints.length > 0) {
          setError(`Some fulfillment analytics panels failed to load: ${failedEndpoints.map((f) => f.name).join(", ")}.`);
        }
      } catch (fetchError) {
        console.error("Error fetching Whatnot fulfillment analytics:", fetchError);
        setError("Failed to load fulfillment analytics. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [params]);

  useEffect(() => {
    const fetchTrend = async () => {
      try {
        const response = await axios.get(getApiUrl("whatnot/analytics/fulfillment-trend"), {
          params: { from: params.from, to: params.to, showId: params.showId, granularity: trendGranularity },
        });
        setTrend(response.data || []);
      } catch (e) {
        console.error("Error fetching fulfillment trend:", e);
        setTrend([]);
      }
    };
    fetchTrend();
  }, [params, trendGranularity]);

  useEffect(() => {
    const query = skuSearchInput.trim();
    if (activeTab !== 5 || query.length < 2) {
      if (query.length < 2) {
        setSkuOptions([]);
      }
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await axios.get(getApiUrl("whatnot/analytics/fulfillment-sku-search"), {
          params: {
            from: fromDate,
            to: toDate,
            showId: selectedShowId ? Number(selectedShowId) : undefined,
            q: query,
            limit: 20,
          },
        });
        if (!cancelled) {
          setSkuOptions(response.data || []);
        }
      } catch (searchError) {
        console.error("Error searching fulfillment SKUs:", searchError);
        if (!cancelled) {
          setSkuOptions([]);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeTab, fromDate, toDate, selectedShowId, skuSearchInput]);

  useEffect(() => {
    setSkuDetail(null);
    setSkuDetailError(null);
  }, [fromDate, toDate, selectedShowId]);

  const loadSkuDetail = async (sku: string) => {
    const trimmedSku = sku.trim();
    if (!trimmedSku) {
      setSkuDetail(null);
      setSkuDetailError(null);
      return;
    }

    try {
      setSkuDetailLoading(true);
      setSkuDetailError(null);
      const response = await axios.get(getApiUrl("whatnot/analytics/fulfillment-sku-detail"), {
        params: {
          from: fromDate,
          to: toDate,
          showId: selectedShowId ? Number(selectedShowId) : undefined,
          sku: trimmedSku,
        },
      });
      setSkuDetail(response.data);
    } catch (detailError: any) {
      console.error("Error loading fulfillment SKU detail:", detailError);
      setSkuDetail(null);
      setSkuDetailError(
        detailError?.response?.data?.error || "Failed to load item details for this SKU."
      );
    } finally {
      setSkuDetailLoading(false);
    }
  };

  const trendWithAvgPrice = useMemo(() =>
    trend.map((row) => ({
      ...row,
      avgSoldPrice: row.unitsSold > 0 ? parseFloat((row.revenue / row.unitsSold).toFixed(2)) : 0,
    })), [trend]);

  const dayOfWeekTrend = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const agg = days.map((day) => ({ day, units: 0, revenue: 0 }));
    trend.forEach((row) => {
      const dow = new Date(row.bucket + "T12:00:00").getDay();
      agg[dow].units += row.unitsSold;
      agg[dow].revenue += row.revenue;
    });
    return agg;
  }, [trend]);

  const waterfallData = useMemo(() => {
    if (!profitabilityOverview) return [];
    const { knownCostRevenue, estimatedCost, knownCostWhatnotFees, netMarginAfterFees, grossMargin } = profitabilityOverview;
    return [
      { name: "Revenue", base: 0, val: Math.round(knownCostRevenue), fill: "#1976d2" },
      { name: "Vendor Cost", base: Math.round(grossMargin), val: Math.round(estimatedCost), fill: "#ef5350" },
      { name: "Gross Margin", base: 0, val: Math.round(grossMargin), fill: "#66bb6a" },
      { name: "Whatnot Fees", base: Math.round(netMarginAfterFees), val: Math.round(knownCostWhatnotFees), fill: "#ffa726" },
      { name: "Net Margin", base: 0, val: Math.round(netMarginAfterFees), fill: "#2e7d32" },
    ];
  }, [profitabilityOverview]);

  const riskBandDistribution = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, stable: 0, no_signal: 0 };
    inventoryExposure.forEach((row) => counts[row.riskBand]++);
    return (Object.entries(counts) as [FulfillmentInventoryExposureRow["riskBand"], number][])
      .filter(([, v]) => v > 0)
      .map(([band, count]) => ({
        name: band === "no_signal" ? "No Signal" : band.charAt(0).toUpperCase() + band.slice(1),
        value: count,
        fill: riskColorMap[band],
      }));
  }, [inventoryExposure]);

  const daysOfCoverBuckets = useMemo(() => {
    const buckets = [
      { label: "0–3d", count: 0, fill: "#d32f2f" },
      { label: "3–7d", count: 0, fill: "#ef6c00" },
      { label: "7–14d", count: 0, fill: "#f9a825" },
      { label: "14–30d", count: 0, fill: "#66bb6a" },
      { label: "30d+", count: 0, fill: "#2e7d32" },
      { label: "No Signal", count: 0, fill: "#607d8b" },
    ];
    inventoryExposure.forEach((row) => {
      if (row.daysOfCover === null) buckets[5].count++;
      else if (row.daysOfCover <= 3) buckets[0].count++;
      else if (row.daysOfCover <= 7) buckets[1].count++;
      else if (row.daysOfCover <= 14) buckets[2].count++;
      else if (row.daysOfCover <= 30) buckets[3].count++;
      else buckets[4].count++;
    });
    return buckets.filter((b) => b.count > 0);
  }, [inventoryExposure]);

  const showScatterData = useMemo(() =>
    showsPerformance
      .filter((s) => Number(s.unitsSold) > 0)
      .map((s) => ({
        showName: s.showName,
        revenue: Number(s.revenue),
        avgSoldPrice: parseFloat((Number(s.revenue) / Number(s.unitsSold)).toFixed(2)),
        unitsSold: Number(s.unitsSold),
      })), [showsPerformance]);

  const profitabilityScatterData = useMemo(() =>
    profitabilityShows
      .filter((s) => Number(s.knownCostRevenue) > 0)
      .map((s) => ({
        showName: s.showName,
        revenue: Number(s.revenue),
        marginPct: Number(s.netMarginAfterFeesPct),
        unitsSold: Number(s.unitsSold),
      })), [profitabilityShows]);

  const setDateRange = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setFromDate(formatDateInput(from));
    setToDate(formatDateInput(to));
  };

  const brandMixTotalRevenue = useMemo(() => brandMix.reduce((sum, row) => sum + Number(row.revenue || 0), 0), [brandMix]);
  const brandMixWithPct = useMemo(() => {
    if (brandMixTotalRevenue === 0) return [];
    return brandMix.map((row, idx) => ({
      ...row,
      color: BRAND_COLORS[idx % BRAND_COLORS.length],
      pct: (Number(row.revenue || 0) / brandMixTotalRevenue) * 100,
    }));
  }, [brandMix, brandMixTotalRevenue]);

  const overviewMetrics = [
    { label: "Revenue", value: formatCurrency(overview?.revenue || 0), color: "#0b6bcb", bg: "#f0f7ff", icon: <TrendingUpIcon fontSize="small" /> },
    { label: "Units Sold", value: overview?.unitsSold || 0, color: "#1f7a1f", bg: "#f0faf0", icon: <Inventory2Icon fontSize="small" /> },
    { label: "Random Giveaways", value: overview?.randomGiveawayUnits || 0, color: "#8e24aa", bg: "#faf0ff", icon: <CardGiftcardIcon fontSize="small" /> },
    { label: "Avg Sold Price", value: formatCurrency(overview?.avgSoldPrice || 0), color: "#6a1b9a", bg: "#f9f5ff", icon: <LocalOfferIcon fontSize="small" /> },
    { label: "Completed Shipments", value: overview?.completedShipments || 0, color: "#ef6c00", bg: "#fff8f0", icon: <LocalShippingIcon fontSize="small" /> },
    { label: "Pending Revenue", value: formatCurrency(overview?.pendingRevenue || 0), color: "#00838f", bg: "#f0fbfc", icon: <HourglassEmptyIcon fontSize="small" /> },
    { label: "Review Revenue", value: formatCurrency(overview?.reviewRevenue || 0), color: "#c62828", bg: "#fff5f5", icon: <ErrorOutlineIcon fontSize="small" /> },
  ];

  const renderOverviewTab = () => {
    const totalPipelineRevenue = (overview?.revenue || 0) + (overview?.pendingRevenue || 0) + (overview?.reviewRevenue || 0);
    const completedPct = totalPipelineRevenue > 0 ? ((overview?.revenue || 0) / totalPipelineRevenue) * 100 : 0;
    const pendingPct = totalPipelineRevenue > 0 ? ((overview?.pendingRevenue || 0) / totalPipelineRevenue) * 100 : 0;
    const reviewPct = totalPipelineRevenue > 0 ? ((overview?.reviewRevenue || 0) / totalPipelineRevenue) * 100 : 0;
    const trendInterval = trend.length > 30 ? Math.floor(trend.length / 10) : trend.length > 14 ? 2 : 0;
    return (
      <Grid container spacing={2}>
        {/* KPI cards */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            {overviewMetrics.map((metric) => (
              <Grid item xs={12} sm={6} md={4} lg={2} key={metric.label}>
                <Card sx={{ borderRadius: 2, border: "1px solid #e3e8ef", borderLeft: `4px solid ${metric.color}`, bgcolor: metric.bg }}>
                  <CardContent sx={{ pb: "12px !important" }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        {metric.label}
                      </Typography>
                      <Box sx={{ color: metric.color, opacity: 0.75, display: "flex" }}>{metric.icon}</Box>
                    </Stack>
                    <Typography variant="h5" sx={{ mt: 0.6, color: metric.color, fontWeight: 700 }}>
                      {typeof metric.value === "number" ? formatNumber(metric.value) : metric.value}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Chart A — Revenue & Units Trend */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, borderRadius: 2, borderLeft: "3px solid #1976d2" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }} flexWrap="wrap" gap={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ color: "#1976d2", display: "flex" }}><ShowChartIcon fontSize="small" /></Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Revenue & Units Trend</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75}>
                {(["day", "week", "month"] as const).map((g) => (
                  <Chip key={g} label={g.charAt(0).toUpperCase() + g.slice(1)} size="small"
                    variant={trendGranularity === g ? "filled" : "outlined"}
                    color={trendGranularity === g ? "primary" : "default"}
                    onClick={() => setTrendGranularity(g)}
                    sx={{ cursor: "pointer", fontWeight: 600 }} />
                ))}
              </Stack>
            </Stack>
            {trend.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No trend data for this range.</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={trendWithAvgPrice} margin={{ top: 5, right: 45, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                  <XAxis dataKey="bucket" tickFormatter={(v) => formatTick(v, trendGranularity)} interval={trendInterval} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tickFormatter={kFormatter} tick={{ fontSize: 11 }} width={55} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} width={40} />
                  <RechartsTooltip
                    formatter={((value: number, name: string) =>
                      name === "Units" ? [formatNumber(value), name] : [formatCurrency(value), name]
                    ) as any}
                    labelFormatter={(label) => formatTick(String(label), trendGranularity)}
                  />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" fill="#dbeafe" stroke="#1976d2" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="unitsSold" name="Units" stroke="#2e7d32" strokeWidth={2} dot={false} />
                  <Line yAxisId="left" type="monotone" dataKey="avgSoldPrice" name="Avg Price" stroke="#7b1fa2" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Chart B — Pipeline Breakdown + Chart C — Day of Week */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "3px solid #1565c0" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ color: "#1565c0", display: "flex" }}><LocalShippingIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Pipeline Revenue</Typography>
            </Stack>
            <Box sx={{ display: "flex", height: 28, borderRadius: 2, overflow: "hidden", mb: 1.5 }}>
              {completedPct > 0 && <Box sx={{ width: `${completedPct}%`, bgcolor: "#2e7d32", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {completedPct > 12 && <Typography variant="caption" sx={{ color: "#fff", fontWeight: 700, fontSize: 10 }}>{completedPct.toFixed(0)}%</Typography>}
              </Box>}
              {pendingPct > 0 && <Box sx={{ width: `${pendingPct}%`, bgcolor: "#ef6c00", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {pendingPct > 6 && <Typography variant="caption" sx={{ color: "#fff", fontWeight: 700, fontSize: 10 }}>{pendingPct.toFixed(0)}%</Typography>}
              </Box>}
              {reviewPct > 0 && <Box sx={{ width: `${reviewPct}%`, bgcolor: "#d32f2f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {reviewPct > 6 && <Typography variant="caption" sx={{ color: "#fff", fontWeight: 700, fontSize: 10 }}>{reviewPct.toFixed(0)}%</Typography>}
              </Box>}
            </Box>
            <Stack spacing={1}>
              {[
                { label: "Completed", value: overview?.revenue || 0, count: overview?.completedShipments || 0, color: "#2e7d32", bg: "#f5fff7", border: "#d8efdc" },
                { label: "Pending", value: overview?.pendingRevenue || 0, count: overview?.pendingShipments || 0, color: "#ef6c00", bg: "#fff8f0", border: "#f5ddca" },
                { label: "Under Review", value: overview?.reviewRevenue || 0, count: overview?.reviewShipments || 0, color: "#d32f2f", bg: "#fff5f5", border: "#f3d4d4" },
              ].map((s) => (
                <Box key={s.label} sx={{ p: 1.2, borderRadius: 1.5, bgcolor: s.bg, border: `1px solid ${s.border}` }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" sx={{ fontWeight: 600, color: s.color }}>{s.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatNumber(s.count)} shipments</Typography>
                  </Stack>
                  <Typography variant="h6" sx={{ color: s.color, fontWeight: 700 }}>{formatCurrency(s.value)}</Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "3px solid #ef6c00" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ color: "#ef6c00", display: "flex" }}><CalendarTodayIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Revenue by Day of Week</Typography>
            </Stack>
            {dayOfWeekTrend.every((d) => d.revenue === 0) ? (
              <Typography variant="body2" color="text.secondary">No trend data to compute day-of-week breakdown.</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={dayOfWeekTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={kFormatter} tick={{ fontSize: 11 }} width={50} />
                  <RechartsTooltip formatter={((v: number, name: string) => [name === "Revenue" ? formatCurrency(v) : formatNumber(v), name]) as any} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="#1976d2" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="units" name="Units" fill="#2e7d32" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Profitability Snapshot */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "3px solid #2e7d32" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ color: "#2e7d32", display: "flex" }}><ShowChartIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Profitability Snapshot</Typography>
            </Stack>
            {!profitabilityOverview ? (
              <Typography variant="body2" color="text.secondary">No profitability data available for this range.</Typography>
            ) : (
              <Stack spacing={1.2}>
                {[
                  { label: "Net Profit After Fees", value: formatCurrency(profitabilityOverview.netMarginAfterFees), sub: `${profitabilityOverview.netMarginAfterFeesPct}% on ${formatCurrency(profitabilityOverview.knownCostRevenue)} cost-known revenue`, color: "#2e7d32", bg: "#f5fff7", border: "#d8efdc" },
                  { label: "Whatnot Took So Far", value: formatCurrency(profitabilityOverview.whatnotFees), sub: "8% commission + processing fees", color: "#ef6c00", bg: "#fff7f2", border: "#f5ddca" },
                  { label: "Gross Margin Before Fees", value: formatCurrency(profitabilityOverview.grossMargin), sub: `${profitabilityOverview.grossMarginPct}% before Whatnot fees`, color: "#1565c0", bg: "#f7fbff", border: "#d7e7fb" },
                  { label: "Margin Risk Units", value: formatNumber(profitabilityOverview.negativeMarginUnits + profitabilityOverview.lowMarginUnits), sub: `${formatNumber(profitabilityOverview.negativeMarginUnits)} negative + ${formatNumber(profitabilityOverview.lowMarginUnits)} low-margin`, color: "#c62828", bg: "#fff5f5", border: "#f3d4d4" },
                ].map((item) => (
                  <Box key={item.label} sx={{ p: 1.5, borderRadius: 2, bgcolor: item.bg, border: `1px solid ${item.border}` }}>
                    <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                    <Typography variant="h6" sx={{ color: item.color, fontWeight: 700 }}>{item.value}</Typography>
                    <Typography variant="body2" color="text.secondary">{item.sub}</Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>

        {/* Unique SKUs / Shows info */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "3px solid #7b1fa2" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ color: "#7b1fa2", display: "flex" }}><Inventory2Icon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Period Highlights</Typography>
            </Stack>
            <Stack spacing={1.2}>
              {[
                { label: "Unique SKUs Sold", value: formatNumber(overview?.uniqueSkusSold || 0), sub: "Distinct products moved in this period", color: "#2e7d32", bg: "#f5fff7", border: "#d8efdc" },
                { label: "Shows in Period", value: formatNumber(overview?.uniqueShows || 0), sub: "Shows with at least one completed sale", color: "#1565c0", bg: "#f7fbff", border: "#d7e7fb" },
                { label: "Giveaway Shipments", value: formatNumber(overview?.randomGiveawayShipments || 0), sub: `${formatNumber(overview?.randomGiveawayUnits || 0)} random giveaway units`, color: "#7b1fa2", bg: "#faf5ff", border: "#e7d9fb" },
                { label: "Cost Coverage Gap", value: formatCurrency(profitabilityOverview?.unknownCostRevenue || 0), sub: `${formatNumber(profitabilityOverview?.unknownCostUnits || 0)} units with no vendor cost on file`, color: "#c62828", bg: "#fff5f5", border: "#f3d4d4" },
              ].map((item) => (
                <Box key={item.label} sx={{ p: 1.5, borderRadius: 2, bgcolor: item.bg, border: `1px solid ${item.border}` }}>
                  <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                  <Typography variant="h6" sx={{ color: item.color, fontWeight: 700 }}>{item.value}</Typography>
                  <Typography variant="body2" color="text.secondary">{item.sub}</Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    );
  };

  const renderSalesTab = () => {
    const showChartData = showsPerformance.slice(0, 12).map((s) => ({
      name: truncate(s.showName, 22),
      revenue: Number(s.revenue || 0),
      units: Number(s.unitsSold || 0),
    })).reverse();
    return (
      <Grid container spacing={2}>
        {/* Brand Revenue Mix donut */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "3px solid #1e88e5" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ color: "#1e88e5", display: "flex" }}><PieChartIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Brand Revenue Mix</Typography>
            </Stack>
            {brandMixWithPct.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No brand revenue data in this range.</Typography>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={brandMixWithPct.slice(0, 10)} dataKey="revenue" nameKey="brand" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {brandMixWithPct.slice(0, 10).map((row, idx) => (
                        <Cell key={idx} fill={row.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={((v: number, name: string) => [formatCurrency(v), name]) as any} />
                  </PieChart>
                </ResponsiveContainer>
                <Stack spacing={0.7}>
                  {brandMixWithPct.slice(0, 10).map((row) => (
                    <Box key={row.brand} display="flex" justifyContent="space-between" alignItems="center">
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: row.color }} />
                        <Typography variant="body2">{row.brand}</Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">{row.pct.toFixed(1)}%</Typography>
                    </Box>
                  ))}
                </Stack>
              </>
            )}
          </Paper>
        </Grid>

        {/* Chart D — Revenue by Show horizontal bar */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "3px solid #00838f" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ color: "#00838f", display: "flex" }}><BarChartIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Revenue by Show (Top 12)</Typography>
            </Stack>
            {showChartData.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No show revenue data in this range.</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, showChartData.length * 34)}>
                <BarChart data={showChartData} layout="vertical" margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" horizontal={false} />
                  <XAxis type="number" tickFormatter={kFormatter} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={145} tick={{ fontSize: 11 }} />
                  <RechartsTooltip formatter={((v: number, name: string) => [name === "Units" ? formatNumber(v) : formatCurrency(v), name]) as any} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="#00838f" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="units" name="Units" fill="#a5d8dd" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Chart E — Revenue vs ASP Scatter */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, borderRadius: 2, borderLeft: "3px solid #7b1fa2" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ color: "#7b1fa2", display: "flex" }}><AttachMoneyIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Revenue vs Avg Sold Price by Show</Typography>
            </Stack>
            {showScatterData.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No data for scatter plot.</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                  <XAxis type="number" dataKey="avgSoldPrice" name="Avg Price" tickFormatter={(v) => `$${v.toFixed(0)}`} label={{ value: "Avg Sold Price ($)", position: "insideBottom", offset: -12, fontSize: 11 }} tick={{ fontSize: 11 }} />
                  <YAxis type="number" dataKey="revenue" name="Revenue" tickFormatter={kFormatter} tick={{ fontSize: 11 }} width={50} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as typeof showScatterData[0];
                      return (
                        <Box sx={{ bgcolor: "#fff", border: "1px solid #e0e0e0", borderRadius: 1, p: 1, fontSize: 12 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>{d.showName}</Typography>
                          <Typography variant="caption" display="block">Revenue: {formatCurrency(d.revenue)}</Typography>
                          <Typography variant="caption" display="block">Avg Price: {formatCurrency(d.avgSoldPrice)}</Typography>
                          <Typography variant="caption" display="block">Units: {formatNumber(d.unitsSold)}</Typography>
                        </Box>
                      );
                    }}
                  />
                  <Scatter data={showScatterData} fill="#7b1fa2" fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Top SKUs */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "3px solid #0b6bcb" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ color: "#0b6bcb", display: "flex" }}><TrendingUpIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Top SKUs by Revenue</Typography>
            </Stack>
            {topProducts.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No fulfilled SKU revenue data in this range.</Typography>
            ) : (
              <Stack spacing={1}>
                {topProducts.slice(0, 8).map((product) => (
                  <Box key={product.sku} sx={{ py: 0.6, borderBottom: "1px solid #edf1f7" }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{product.brand} {product.itemName}</Typography>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">{product.sku}</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>{formatCurrency(product.revenue)}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">{formatNumber(product.unitsSold)} units | Avg {formatCurrency(product.avgSoldPrice)}</Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    );
  };

  const renderProfitabilityTab = () => {
    const profitShowChartData = profitabilityShows.slice(0, 10).map((s) => ({
      name: truncate(s.showName, 20),
      revenue: Number(s.revenue || 0),
      cost: Number(s.estimatedCost || 0),
      fees: Number(s.whatnotFees || 0),
      netMargin: Number(s.netMarginAfterFees || 0),
    })).reverse();
    return (
      <Grid container spacing={2}>
        {/* Chart F — Profit Waterfall */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, borderRadius: 2, borderLeft: "3px solid #2e7d32" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ color: "#2e7d32", display: "flex" }}><ShowChartIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Profit Waterfall</Typography>
            </Stack>
            {waterfallData.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No profitability data for waterfall.</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={waterfallData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={40} />
                  <YAxis tickFormatter={kFormatter} tick={{ fontSize: 11 }} width={55} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as typeof waterfallData[0];
                      if (!row) return null;
                      return (
                        <Box sx={{ bgcolor: "#fff", border: "1px solid #e0e0e0", borderRadius: 1, p: 1, fontSize: 12 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>{row.name}</Typography>
                          <Typography variant="caption" display="block" sx={{ color: row.fill }}>{formatCurrency(row.val)}</Typography>
                        </Box>
                      );
                    }}
                  />
                  <Bar dataKey="base" stackId="same" fill="transparent" />
                  <Bar dataKey="val" stackId="same" radius={[3, 3, 0, 0]}>
                    {waterfallData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Cost Coverage info */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "3px solid #a15c00" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ color: "#a15c00", display: "flex" }}><AttachMoneyIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Cost Coverage</Typography>
            </Stack>
            {!profitabilityOverview ? (
              <Typography variant="body2" color="text.secondary">No profitability coverage data available for this range.</Typography>
            ) : (
              <Stack spacing={1.2}>
                {[
                  { label: "Unknown Cost Revenue", value: formatCurrency(profitabilityOverview.unknownCostRevenue), sub: `${formatNumber(profitabilityOverview.unknownCostUnits)} units excluded from margin %`, color: "#a15c00", bg: "#fff8e8", border: "#f2ddb1" },
                  { label: "Cost-Known Revenue", value: formatCurrency(profitabilityOverview.knownCostRevenue), sub: `Margin on ${formatNumber(profitabilityOverview.knownCostUnits)} units`, color: "#1565c0", bg: "#f7fbff", border: "#d7e7fb" },
                  { label: "Estimated Vendor Cost", value: formatCurrency(profitabilityOverview.estimatedCost), sub: "Based on active vendor price records", color: "#2e7d32", bg: "#f5fff7", border: "#d8efdc" },
                  { label: "Negative Margin Units", value: formatNumber(profitabilityOverview.negativeMarginUnits), sub: `Sold below cost`, color: "#c62828", bg: "#fff5f5", border: "#f3d4d4" },
                ].map((item) => (
                  <Box key={item.label} sx={{ p: 1.5, borderRadius: 2, bgcolor: item.bg, border: `1px solid ${item.border}` }}>
                    <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                    <Typography variant="h6" sx={{ color: item.color, fontWeight: 700 }}>{item.value}</Typography>
                    <Typography variant="body2" color="text.secondary">{item.sub}</Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>

        {/* Chart G — Revenue / Cost / Margin stacked by show */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, borderRadius: 2, borderLeft: "3px solid #1565c0" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ color: "#1565c0", display: "flex" }}><BarChartIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Revenue / Cost / Net Margin by Show (Top 10)</Typography>
            </Stack>
            {profitShowChartData.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No show profitability data in this range.</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, profitShowChartData.length * 36)}>
                <BarChart data={profitShowChartData} layout="vertical" margin={{ top: 4, right: 80, left: 10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" horizontal={false} />
                  <XAxis type="number" tickFormatter={kFormatter} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={145} tick={{ fontSize: 11 }} />
                  <RechartsTooltip formatter={((v: number, name: string) => [formatCurrency(v), name]) as any} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="#1976d2" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="cost" name="Est. Cost" fill="#ef9a9a" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="fees" name="Whatnot Fees" fill="#ffb74d" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="netMargin" name="Net Margin" fill="#2e7d32" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Chart H — Margin % vs Revenue scatter */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, borderRadius: 2, borderLeft: "3px solid #7b1fa2" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ color: "#7b1fa2", display: "flex" }}><AttachMoneyIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Margin % vs Revenue by Show</Typography>
            </Stack>
            {profitabilityScatterData.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No data for scatter plot.</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                  <XAxis type="number" dataKey="revenue" name="Revenue" tickFormatter={kFormatter} label={{ value: "Revenue ($)", position: "insideBottom", offset: -12, fontSize: 11 }} tick={{ fontSize: 11 }} />
                  <YAxis type="number" dataKey="marginPct" name="Net Margin %" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} width={50} />
                  <ReferenceLine y={0} stroke="#d32f2f" strokeDasharray="4 3" />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as typeof profitabilityScatterData[0];
                      return (
                        <Box sx={{ bgcolor: "#fff", border: "1px solid #e0e0e0", borderRadius: 1, p: 1, fontSize: 12 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>{d.showName}</Typography>
                          <Typography variant="caption" display="block">Revenue: {formatCurrency(d.revenue)}</Typography>
                          <Typography variant="caption" display="block">Net Margin: {d.marginPct}%</Typography>
                          <Typography variant="caption" display="block">Units: {formatNumber(d.unitsSold)}</Typography>
                        </Box>
                      );
                    }}
                  />
                  <Scatter data={profitabilityScatterData} fill="#7b1fa2" fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Margin by Show list */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "3px solid #2e7d32" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ color: "#2e7d32", display: "flex" }}><ShowChartIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Margin by Show</Typography>
            </Stack>
            {profitabilityShows.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No show profitability data in this range.</Typography>
            ) : (
              <Stack spacing={1} sx={{ maxHeight: 340, overflow: "auto" }}>
                {profitabilityShows.map((show) => {
                  const pct = Number(show.netMarginAfterFeesPct || 0);
                  const color = pct < 0 ? "#d32f2f" : pct < 10 ? "#ef6c00" : "#2e7d32";
                  return (
                    <Box key={show.showId} sx={{ py: 0.6, borderBottom: "1px solid #edf1f7" }}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{show.showName}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color }}>{formatCurrency(show.netMarginAfterFees)}</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">{show.netMarginAfterFeesPct}% net | Whatnot {formatCurrency(show.whatnotFees)}</Typography>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    );
  };

  const renderOperationsTab = () => {
    const totalPipelineVal = (overview?.revenue || 0) + (overview?.reviewRevenue || 0) + (overview?.pendingRevenue || 0);
    const reviewRevenuePct = totalPipelineVal > 0 ? (overview?.reviewRevenue || 0) / totalPipelineVal : 0;
    const gaugeData = [
      { name: "Blocked", value: reviewRevenuePct * 100, fill: "#d32f2f" },
      { name: "Clear", value: (1 - reviewRevenuePct) * 100, fill: "#e8f5e9" },
    ];
    const brandProfChartData = brandProfitability.slice(0, 12).map((b) => ({
      name: truncate(b.brand, 20),
      revenue: Number(b.revenue || 0),
      grossMargin: Number(b.grossMargin || 0),
    })).reverse();
    return (
      <Grid container spacing={2}>
        {/* Chart I — Review Revenue Gauge */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "3px solid #d32f2f" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ color: "#d32f2f", display: "flex" }}><HourglassEmptyIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Revenue at Risk</Typography>
            </Stack>
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={gaugeData} dataKey="value" startAngle={180} endAngle={0} innerRadius={55} outerRadius={80} paddingAngle={2} cx="50%" cy="80%">
                    {gaugeData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </Box>
            <Typography variant="h4" align="center" sx={{ color: "#d32f2f", fontWeight: 700, mt: -2 }}>{(reviewRevenuePct * 100).toFixed(1)}%</Typography>
            <Typography variant="body2" align="center" color="text.secondary">of pipeline revenue blocked in review</Typography>
            <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: "#fff5f5", border: "1px solid #f3d4d4" }}>
              <Typography variant="caption" color="text.secondary">Blocked Revenue</Typography>
              <Typography variant="h6" sx={{ color: "#d32f2f", fontWeight: 700 }}>{formatCurrency(overview?.reviewRevenue || 0)}</Typography>
              <Typography variant="body2" color="text.secondary">{formatNumber(overview?.reviewShipments || 0)} shipments</Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Review Queue Aging + Reasons */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "3px solid #ef6c00" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ color: "#ef6c00", display: "flex" }}><ScheduleIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Queue Aging</Typography>
            </Stack>
            <HorizontalBarList items={reviewAging} labelKey="ageBucket" valueKey="shipmentCount" barColor="#ef6c00" maxItems={4} />
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "3px solid #c62828" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ color: "#c62828", display: "flex" }}><WarningAmberIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Top Review Reasons</Typography>
            </Stack>
            <HorizontalBarList items={reviewReasons} labelKey="mismatchReason" valueKey="shipmentCount" barColor="#c62828" maxItems={8} />
          </Paper>
        </Grid>

        {/* Chart J — Brand Profitability horizontal bar */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, borderRadius: 2, borderLeft: "3px solid #1565c0" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ color: "#1565c0", display: "flex" }}><BarChartIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Brand Revenue & Gross Margin (Top 12)</Typography>
            </Stack>
            {brandProfChartData.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No brand profitability data in this range.</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, brandProfChartData.length * 34)}>
                <BarChart data={brandProfChartData} layout="vertical" margin={{ top: 4, right: 80, left: 10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" horizontal={false} />
                  <XAxis type="number" tickFormatter={kFormatter} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={145} tick={{ fontSize: 11 }} />
                  <RechartsTooltip formatter={((v: number, name: string) => [formatCurrency(v), name]) as any} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="#1976d2" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="grossMargin" name="Gross Margin" fill="#2e7d32" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Review Queue Shipments list */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, borderRadius: 2, borderLeft: "3px solid #ef6c00" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ color: "#ef6c00", display: "flex" }}><LocalShippingIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Review Queue Shipments</Typography>
              {reviewShipments.length > 0 && (
                <Chip label={reviewShipments.length} size="small" color="warning" sx={{ fontWeight: 700 }} />
              )}
            </Stack>
            {reviewShipments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No shipments are currently pending review.</Typography>
            ) : (
              <Box sx={{ maxHeight: 420, overflow: "auto" }}>
                {reviewShipments.map((shipment) => {
                  const accentColor = shipment.ageDays > 14 ? "#d32f2f" : shipment.ageDays > 7 ? "#ef6c00" : "#f9a825";
                  return (
                    <Box
                      key={`${shipment.showId}-${shipment.importId}-${shipment.shipmentId}`}
                      sx={{ mb: 1, p: 1.5, borderRadius: 2, border: "1px solid #f0e0d0", borderLeft: `4px solid ${accentColor}`, bgcolor: "#fffaf7" }}
                    >
                      <Box display="flex" justifyContent="space-between" gap={2} flexWrap="wrap" alignItems="center">
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{shipment.showName || `Show ${shipment.showId}`} — Shipment {shipment.shipmentId}</Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip label={`${shipment.ageDays}d old`} size="small" sx={{ bgcolor: accentColor, color: "#fff", fontWeight: 700, fontSize: 11 }} />
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>{formatCurrency(shipment.affectedRevenue)}</Typography>
                        </Stack>
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        Tracking: {shipment.tracking || "N/A"} &nbsp;|&nbsp; Expected: {formatNumber(shipment.expectedQty)} &nbsp;|&nbsp; Scanned: {formatNumber(shipment.scannedQty)}
                      </Typography>
                      <Typography variant="caption" color="error.main" display="block" sx={{ fontWeight: 600, mt: 0.3 }}>{shipment.mismatchReason}</Typography>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    );
  };

  const renderInventoryTab = () => {
    const RISK_BAND_COLORS: Record<string, string> = { critical: "#d32f2f", high: "#ef6c00", medium: "#f9a825", low: "#2e7d32", no_signal: "#78909c" };
    const riskBands = ["critical", "high", "medium", "low", "no_signal"];
    return (
      <Grid container spacing={2}>
        {/* Chart K — Risk Band donut + Chart L — Days of Cover histogram */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "3px solid #d32f2f" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Box sx={{ color: "#d32f2f", display: "flex" }}><ErrorOutlineIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Risk Band Distribution</Typography>
            </Stack>
            {riskBandDistribution.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No inventory data.</Typography>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={riskBandDistribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={2}>
                      {riskBandDistribution.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill || "#90a4ae"} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as typeof riskBandDistribution[0];
                      return <Box sx={{ bgcolor: "#fff", border: "1px solid #e0e0e0", borderRadius: 1, p: 1, fontSize: 12 }}><Typography variant="caption" display="block">{d.name}: {d.value} SKUs</Typography></Box>;
                    }} />
                  </PieChart>
                </ResponsiveContainer>
                <Stack spacing={0.6}>
                  {riskBandDistribution.map((entry) => (
                    <Box key={entry.name} display="flex" justifyContent="space-between" alignItems="center">
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: entry.fill || "#90a4ae" }} />
                        <Typography variant="body2">{entry.name}</Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">{entry.value} SKUs</Typography>
                    </Box>
                  ))}
                </Stack>
              </>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "3px solid #ef6c00" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Box sx={{ color: "#ef6c00", display: "flex" }}><ScheduleIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Days of Cover Distribution</Typography>
            </Stack>
            {daysOfCoverBuckets.every((b) => b.count === 0) ? (
              <Typography variant="body2" color="text.secondary">No coverage data.</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={daysOfCoverBuckets} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={40} allowDecimals={false} />
                  <RechartsTooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as typeof daysOfCoverBuckets[0];
                    return <Box sx={{ bgcolor: "#fff", border: "1px solid #e0e0e0", borderRadius: 1, p: 1, fontSize: 12 }}><Typography variant="caption" display="block">{d.label}: {d.count} SKUs</Typography></Box>;
                  }} />
                  <Bar dataKey="count" name="SKUs" radius={[3, 3, 0, 0]}>
                    {daysOfCoverBuckets.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Chart M — Stock vs Velocity scatter (per risk band) */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, borderRadius: 2, borderLeft: "3px solid #3949ab" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Box sx={{ color: "#3949ab", display: "flex" }}><LocalOfferIcon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Stock vs Velocity by Risk Band</Typography>
            </Stack>
            {inventoryExposure.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No inventory data for scatter plot.</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                  <XAxis type="number" dataKey="avgDailySales" name="Avg Daily Sales" label={{ value: "Avg Daily Sales", position: "insideBottom", offset: -12, fontSize: 11 }} tick={{ fontSize: 11 }} />
                  <YAxis type="number" dataKey="currentQty" name="Stock Qty" tick={{ fontSize: 11 }} width={50} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as (typeof inventoryExposure)[0];
                      return (
                        <Box sx={{ bgcolor: "#fff", border: "1px solid #e0e0e0", borderRadius: 1, p: 1, fontSize: 12 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>{d.sku}</Typography>
                          <Typography variant="caption" display="block">Stock: {formatNumber(d.currentQty)}</Typography>
                          <Typography variant="caption" display="block">Avg Daily: {d.avgDailySales}</Typography>
                          <Typography variant="caption" display="block">Cover: {d.daysOfCover ?? "—"}d</Typography>
                        </Box>
                      );
                    }}
                  />
                  <Legend />
                  {riskBands.map((band) => {
                    const bandData = inventoryExposure.filter((r) => r.riskBand === band);
                    if (bandData.length === 0) return null;
                    return (
                      <Scatter
                        key={band}
                        name={band === "no_signal" ? "No Signal" : band.charAt(0).toUpperCase() + band.slice(1)}
                        data={bandData}
                        fill={RISK_BAND_COLORS[band]}
                        fillOpacity={0.75}
                      />
                    );
                  })}
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Inventory Exposure Table */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, borderRadius: 2, borderLeft: "3px solid #3949ab" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ color: "#3949ab", display: "flex" }}><Inventory2Icon fontSize="small" /></Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Inventory Exposure</Typography>
            </Stack>
            {inventoryExposure.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No sold SKU inventory exposure data found for this range.</Typography>
            ) : (
              <TableContainer sx={{ maxHeight: 340 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {["SKU", "Risk", "Qty", "Cover", "Margin"].map((col) => (
                        <TableCell key={col} sx={{ fontWeight: 700, bgcolor: "grey.50", fontSize: 12 }}>{col}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {inventoryExposure.map((row) => (
                      <TableRow
                        key={row.sku}
                        hover
                        sx={{
                          bgcolor:
                            row.riskBand === "critical" ? "#fff5f5" :
                            row.riskBand === "high" ? "#fff8f0" :
                            "inherit",
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{row.sku}</Typography>
                          <Typography variant="caption" color="text.secondary">{row.brand}</Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "inline-block", px: 1, py: 0.4, borderRadius: 999, bgcolor: riskColorMap[row.riskBand], color: "#fff", fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>
                            {row.riskBand === "no_signal" ? "No Signal" : row.riskBand}
                          </Box>
                        </TableCell>
                        <TableCell><Typography variant="body2">{formatNumber(row.currentQty)}</Typography></TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: row.daysOfCover !== null && row.daysOfCover <= 7 ? 700 : 400,
                              color:
                                row.daysOfCover !== null && row.daysOfCover <= 3 ? "#d32f2f" :
                                row.daysOfCover !== null && row.daysOfCover <= 7 ? "#ef6c00" :
                                "text.primary",
                            }}
                          >
                            {row.daysOfCover === null ? "—" : `${row.daysOfCover}d`}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{row.grossMargin === null ? "Unknown" : formatCurrency(row.grossMargin)}</Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>
    );
  };

  const renderItemLookupTab = () => (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Paper sx={{ p: 2, borderRadius: 2, borderLeft: "3px solid #546e7a" }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <Box sx={{ color: "#546e7a", display: "flex" }}><SearchIcon fontSize="small" /></Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Item Lookup</Typography>
          </Stack>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={9}>
              <Autocomplete
                options={skuOptions}
                filterOptions={(options) => options}
                value={selectedSku}
                inputValue={skuSearchInput}
                onInputChange={(_, value) => setSkuSearchInput(value)}
                onChange={(_, value) => {
                  setSelectedSku(value);
                  if (value?.sku) {
                    setSkuSearchInput(value.sku);
                    loadSkuDetail(value.sku);
                  }
                }}
                getOptionLabel={(option) =>
                  typeof option === "string"
                    ? option
                    : [
                        option.brand || "Unknown",
                        option.itemName || "",
                        option.strength || "",
                        option.sizeOz || option.sizeMl || "",
                        option.tester ? "Tester" : "",
                      ]
                        .filter(Boolean)
                        .join(" - ")
                }
                isOptionEqualToValue={(option, value) => option.sku === value.sku}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {[
                          option.brand || "Unknown",
                          option.itemName || "Unknown Item",
                          option.strength || "-",
                          option.sizeOz || option.sizeMl || "-",
                          option.tester ? "Tester" : "",
                        ].filter(Boolean).join(" | ")}
                      </Typography>
                    </Box>
                  </Box>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search SKU / Brand / Item"
                    placeholder="Type at least 2 characters"
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant="contained"
                fullWidth
                sx={{ height: 56 }}
                onClick={() => loadSkuDetail(selectedSku?.sku || skuSearchInput)}
              >
                Load Item
              </Button>
            </Grid>
          </Grid>
          {skuDetailError && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {skuDetailError}
            </Alert>
          )}
        </Paper>
      </Grid>

      {skuDetailLoading && (
        <Grid item xs={12}>
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        </Grid>
      )}

      {!skuDetailLoading && skuDetail && (
        <>
          <Grid item xs={12}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={8}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "3px solid #546e7a" }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{skuDetail.product.sku}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {skuDetail.product.brand || "Unknown"} {skuDetail.product.itemName || ""}
                  </Typography>
                  <Grid container spacing={1.5}>
                    {[
                      { label: "Strength", value: skuDetail.product.strength || "—" },
                      { label: "Size", value: skuDetail.product.sizeOz || skuDetail.product.sizeMl || "—" },
                      { label: "Condition", value: skuDetail.product.condition || "—" },
                      { label: "Tester", value: skuDetail.product.tester ? "Yes" : "No" },
                      { label: "Location", value: skuDetail.product.location || "—" },
                      { label: "On Hand", value: skuDetail.product.quantity ?? "—" },
                      { label: "Min Qty", value: skuDetail.product.minimumQuantity ?? "—" },
                    ].map(({ label, value }) => (
                      <Grid item xs={6} sm={4} key={label}>
                        <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: "#f8fafc", border: "1px solid #e8edf5" }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3, fontSize: 10 }}>{label}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.3 }}>{String(value)}</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "4px solid #2e7d32", bgcolor: "#f5fff7" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, fontSize: 10 }}>Known Cost Basis</Typography>
                  <Typography variant="h5" sx={{ color: "#2e7d32", fontWeight: 700, mt: 0.5 }}>
                    {skuDetail.product.averagePrice === null ? "Unknown" : formatCurrency(skuDetail.product.averagePrice)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Product weighted average vendor price
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12}>
            <Grid container spacing={2}>
              {[
                { label: "Pieces Sold", value: formatNumber(skuDetail.summary.unitsSold), color: "#0b6bcb" },
                { label: "Avg Sold Price", value: formatCurrency(skuDetail.summary.avgSoldPrice), color: "#6a1b9a" },
                { label: "Lowest Sold Price", value: formatCurrency(skuDetail.summary.lowestSoldPrice), color: "#00838f" },
                { label: "Highest Sold Price", value: formatCurrency(skuDetail.summary.highestSoldPrice), color: "#ef6c00" },
                { label: "Known Margin", value: formatCurrency(skuDetail.summary.grossMargin), color: "#2e7d32" },
                { label: "Unknown Cost Revenue", value: formatCurrency(skuDetail.summary.unknownCostRevenue), color: "#a15c00" },
                { label: "Shows", value: formatNumber(skuDetail.summary.uniqueShows), color: "#ef6c00" },
                { label: "Shipments", value: formatNumber(skuDetail.summary.uniqueShipments), color: "#00838f" },
              ].map((metric) => (
                <Grid item xs={12} sm={6} md={4} lg={2} key={metric.label}>
                  <Card sx={{ borderRadius: 2, border: "1px solid #e3e8ef" }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">{metric.label}</Typography>
                      <Typography variant="h5" sx={{ mt: 0.6, color: metric.color, fontWeight: 700 }}>{metric.value}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "3px solid #00838f" }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <Box sx={{ color: "#00838f", display: "flex" }}><BarChartIcon fontSize="small" /></Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Sales by Show</Typography>
              </Stack>
              <HorizontalBarList
                items={skuDetail.byShow}
                labelKey="showName"
                valueKey="revenue"
                barColor="#00838f"
                maxItems={10}
                valueFormatter={formatCurrency}
              />
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "3px solid #6a1b9a" }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <Box sx={{ color: "#6a1b9a", display: "flex" }}><LocalOfferIcon fontSize="small" /></Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Price Range</Typography>
              </Stack>
              <Stack spacing={1.3}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f7fbff", border: "1px solid #d7e7fb" }}>
                  <Typography variant="caption" color="text.secondary">Lowest Sold Price</Typography>
                  <Typography variant="h6" sx={{ color: "#1565c0", fontWeight: 700 }}>
                    {formatCurrency(skuDetail.summary.lowestSoldPrice)}
                  </Typography>
                </Box>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#fff7f2", border: "1px solid #f5ddca" }}>
                  <Typography variant="caption" color="text.secondary">Average Sold Price</Typography>
                  <Typography variant="h6" sx={{ color: "#6a1b9a", fontWeight: 700 }}>
                    {formatCurrency(skuDetail.summary.avgSoldPrice)}
                  </Typography>
                </Box>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f5fff7", border: "1px solid #d8efdc" }}>
                  <Typography variant="caption" color="text.secondary">Highest Sold Price</Typography>
                  <Typography variant="h6" sx={{ color: "#2e7d32", fontWeight: 700 }}>
                    {formatCurrency(skuDetail.summary.highestSoldPrice)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "3px solid #ef6c00" }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <Box sx={{ color: "#ef6c00", display: "flex" }}><CalendarTodayIcon fontSize="small" /></Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Day of Week</Typography>
              </Stack>
              <HorizontalBarList
                items={skuDetail.dayOfWeek}
                labelKey="dayName"
                valueKey="unitsSold"
                barColor="#ef6c00"
                maxItems={7}
              />
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, borderRadius: 2, height: "100%", borderLeft: "3px solid #1565c0" }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <Box sx={{ color: "#1565c0", display: "flex" }}><ShowChartIcon fontSize="small" /></Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Daily Sales Pattern</Typography>
              </Stack>
              <HorizontalBarList
                items={skuDetail.byDay}
                labelKey="bucket"
                valueKey="revenue"
                barColor="#1565c0"
                maxItems={12}
                valueFormatter={formatCurrency}
              />
            </Paper>
          </Grid>

          {/* Chart N — Hour of Day */}
          {skuDetail.hourOfDay && skuDetail.hourOfDay.length > 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 2, borderRadius: 2, borderLeft: "3px solid #6a1b9a" }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <Box sx={{ color: "#6a1b9a", display: "flex" }}><ScheduleIcon fontSize="small" /></Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Sales by Hour of Day</Typography>
                </Stack>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={skuDetail.hourOfDay.map((h) => ({ ...h, hourLabel: hourLabel(h.hourOfDay) }))} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                    <XAxis dataKey="hourLabel" tick={{ fontSize: 10 }} interval={1} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} width={35} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `$${v.toFixed(0)}`} tick={{ fontSize: 11 }} width={45} />
                    <RechartsTooltip formatter={((v: number, name: string) => [name === "Revenue" ? formatCurrency(v) : formatNumber(v), name]) as any} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="unitsSold" name="Units" fill="#6a1b9a" radius={[3, 3, 0, 0]} />
                    <Bar yAxisId="right" dataKey="revenue" name="Revenue" fill="#ce93d8" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          )}

          <Grid item xs={12}>
            <Paper sx={{ p: 2, borderRadius: 2, borderLeft: "3px solid #1976d2" }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <Box sx={{ color: "#1976d2", display: "flex" }}><ReceiptIcon fontSize="small" /></Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Recent Sale Activity</Typography>
                <Chip label={skuDetail.recentSales.length} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
              </Stack>
              <Box sx={{ maxHeight: 420, overflow: "auto" }}>
                {skuDetail.recentSales.map((sale) => (
                  <Box key={sale.id} sx={{ mb: 1, p: 1.5, borderRadius: 2, border: "1px solid #e3e8ef", borderLeft: "3px solid #1976d2", bgcolor: "#fafcff" }}>
                    <Box display="flex" justifyContent="space-between" gap={2} flexWrap="wrap" alignItems="center">
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {sale.showName || "Unknown Show"} — Shipment {sale.shipmentId || "N/A"}
                      </Typography>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography variant="body2" sx={{ fontWeight: 700, color: "#1976d2" }}>{formatCurrency(sale.soldPrice)}</Typography>
                        <Typography variant="caption" color="text.secondary">{new Date(sale.createdAt).toLocaleString()}</Typography>
                      </Stack>
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.4 }}>
                      Tracking: {sale.tracking || "N/A"} &nbsp;|&nbsp; Sticker: {sale.auctionStickerNumber || "N/A"} &nbsp;|&nbsp; User: {sale.userId || "N/A"}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>
        </>
      )}
    </Grid>
  );

  const renderActiveTab = () => {
    if (activeTab === 0) return renderOverviewTab();
    if (activeTab === 1) return renderSalesTab();
    if (activeTab === 2) return renderProfitabilityTab();
    if (activeTab === 3) return renderOperationsTab();
    if (activeTab === 4) return renderInventoryTab();
    return renderItemLookupTab();
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>Whatnot Fulfillment Analytics</Typography>
        <Typography variant="body1" color="text.secondary">A tabbed view of sales, profitability, review-queue, and inventory signals from the fulfillment workflow.</Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2, border: "1px solid #e3e8ef" }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel id="fulfillment-show-label">Show</InputLabel>
              <Select labelId="fulfillment-show-label" label="Show" value={selectedShowId} onChange={(e) => setSelectedShowId(String(e.target.value))}>
                <MenuItem value="">All Shows</MenuItem>
                {shows.map((show) => <MenuItem key={show.id} value={String(show.id)}>{show.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label="From"
              type="date"
              fullWidth
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label="To"
              type="date"
              fullWidth
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>Quick:</Typography>
              {[{ label: "7d", days: 7 }, { label: "30d", days: 30 }, { label: "90d", days: 90 }].map(({ label, days }) => (
                <Chip
                  key={label}
                  label={label}
                  size="small"
                  variant="outlined"
                  onClick={() => setDateRange(days)}
                  sx={{ cursor: "pointer", fontWeight: 600 }}
                />
              ))}
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>}

      {!loading && overview && (
        <>
          <Paper sx={{ mb: 2.5, borderRadius: 2, overflow: "hidden" }}>
            <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} variant="scrollable" scrollButtons="auto">
              {tabLabels.map((label, idx) => {
                const hasCritical = idx === 4 && inventoryExposure.some((r) => r.riskBand === "critical");
                const needsAttention =
                  (idx === 3 && reviewShipments.length > 0) ||
                  (idx === 4 && inventoryExposure.some((r) => r.riskBand === "critical" || r.riskBand === "high"));
                return (
                  <Tab
                    key={label}
                    label={
                      needsAttention ? (
                        <Badge color={hasCritical ? "error" : "warning"} variant="dot" sx={{ "& .MuiBadge-dot": { top: 2, right: -4 } }}>
                          {label}
                        </Badge>
                      ) : (
                        label
                      )
                    }
                  />
                );
              })}
            </Tabs>
          </Paper>
          {renderActiveTab()}
        </>
      )}
    </Box>
  );
}

export default WhatnotFulfillmentAnalytics;


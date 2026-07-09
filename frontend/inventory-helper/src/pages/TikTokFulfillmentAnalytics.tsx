
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
  DeliveryDining as DeliveryDiningIcon,
  ErrorOutline as ErrorOutlineIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Inventory2 as Inventory2Icon,
  LocalOffer as LocalOfferIcon,
  LocalShipping as LocalShippingIcon,
  Map as MapIcon,
  Payment as PaymentIcon,
  PieChart as PieChartIcon,
  Receipt as ReceiptIcon,
  Schedule as ScheduleIcon,
  Search as SearchIcon,
  ShowChart as ShowChartIcon,
  Speed as SpeedIcon,
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
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getApiUrl } from "../config/api";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface TikTokShow {
  id: number;
  name: string;
}

interface FulfillmentOverviewData {
  revenue: number;
  avgSoldPrice: number;
  completedShipments: number;
  uniqueSkusSold: number;
  uniqueShows: number;
  totalDiscounts: number;
  pendingShipments: number;
  pendingRevenue: number;
  reviewShipments: number;
  reviewRevenue: number;
  randomGiveawayShipments: number;
  randomGiveawayUnits: number;
}

interface FulfillmentTrendRow {
  bucket: string;
  unitsSold: number;
  revenue: number;
  completedShipments: number;
}

interface FulfillmentShowRow {
  showId: number;
  showName: string;
  unitsSold: number;
  revenue: number;
  avgSoldPrice: number;
  completedShipments: number;
}

interface FulfillmentTopProduct {
  sku: string;
  brand: string;
  itemName: string;
  unitsSold: number;
  revenue: number;
  avgSoldPrice: number;
  lowestSoldPrice: number;
  highestSoldPrice: number;
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
  totalUnitsSold: number;
  totalRevenue: number;
  knownCostRevenue: number;
  knownCostUnits: number;
  unknownCostRevenue: number;
  unknownCostUnits: number;
  estimatedCost: number;
  grossMargin: number;
  grossMarginPct: number;
  tiktokFees: number;
  netMarginAfterFees: number;
  netMarginAfterFeesPct: number;
  negativeMarginUnits: number;
  lowMarginUnits: number;
  knownCostWhatnotFees: number; // alias for compat
}

interface FulfillmentProfitabilityShowRow {
  showId: number;
  showName: string;
  unitsSold: number;
  revenue: number;
  knownCostRevenue: number;
  estimatedCost: number;
  grossMargin: number;
  whatnotFees: number;
  netMarginAfterFees: number;
  netMarginAfterFeesPct: number;
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

interface FulfillmentReviewAgingRow {
  ageBucket: string;
  shipmentCount: number;
  affectedRevenue: number;
}

interface FulfillmentReviewReasonRow {
  mismatchReason: string;
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
  avgDailySales: number;
  daysOfCover: number | null;
  grossMargin: number | null;
  unknownCostUnits: number;
  riskBand: "critical" | "high" | "medium" | "low" | "no_signal";
}

interface FulfillmentVelocityData {
  totalOrders: number;
  avgDaysPlacedToPaid: number | null;
  avgDaysPlacedToRts: number | null;
  avgDaysPlacedToShipped: number | null;
  avgDaysPlacedToDelivered: number | null;
  avgTransitDays: number | null;
  cancelledOrders: number;
  pctWithTracking: number;
  histogram: Array<{ bucket: string; shipmentCount: number }>;
}

interface FulfillmentShippingProviderRow {
  provider: string;
  shipmentCount: number;
  revenue: number;
}

interface FulfillmentDeliveryOptionRow {
  deliveryOption: string;
  shipmentCount: number;
  revenue: number;
}

interface FulfillmentPaymentMethodRow {
  paymentMethod: string;
  shipmentCount: number;
  revenue: number;
}

interface FulfillmentStateRow {
  state: string;
  orderCount: number;
  revenue: number;
  unitsSold: number;
}

interface FulfillmentCityRow {
  city: string;
  state: string;
  orderCount: number;
  revenue: number;
}

interface FulfillmentDiscountRow {
  showId: number;
  showName: string;
  orderCount: number;
  revenue: number;
  totalDiscounts: number;
  orderAmount: number;
  discountPct: number;
}

interface FulfillmentSkuSearchOption {
  sku: string;
  brand: string;
  itemName: string;
  strength: string | null;
  sizeOz: string | null;
  sizeMl: string | null;
  tester: boolean | null;
}

interface HourlyCombinedRow {
  hour: number;
  orders: number;
  revenue: number;
}

interface HourlyShowRow {
  hour: number;
  showId: number;
  showName: string;
  orders: number;
  revenue: number;
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
    lowestSoldPrice: number;
    highestSoldPrice: number;
    uniqueShows: number;
    uniqueShipments: number;
    grossMargin: number;
    unknownCostRevenue: number;
    totalDiscounts: number;
  };
  byShow: Array<{ showName: string; unitsSold: number; revenue: number }>;
  byDay: Array<{ bucket: string; unitsSold: number; revenue: number }>;
  hourOfDay: Array<{ hourOfDay: number; unitsSold: number; revenue: number }>;
  dayOfWeek: Array<{ dayName: string; dayNum: number; unitsSold: number; revenue: number }>;
  recentSales: Array<{
    id: number;
    createdAt: string;
    showName: string | null;
    shipmentId: string | null;
    tracking: string | null;
    soldPrice: number;
    auctionStickerNumber: string | null;
    userId: string | null;
    state: string | null;
    city: string | null;
    paymentMethod: string | null;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);
const formatNumber = (value: number | string | null | undefined) => Number(value || 0).toLocaleString("en-US");
const formatCurrency = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const kFormatter = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v.toFixed(0)}`;
const hourLabel = (h: number) => h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;
const formatTick = (bucket: string, granularity: string) => {
  const d = new Date(bucket + "T12:00:00");
  if (granularity === "month") return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const truncate = (s: string, n: number) => s && s.length > n ? s.slice(0, n - 1) + "…" : s;

const BRAND_COLORS = ["#e91e63", "#9c27b0", "#3f51b5", "#03a9f4", "#009688", "#8bc34a", "#ff9800", "#f44336", "#795548", "#607d8b"];
const PIE_COLORS = ["#e91e63", "#9c27b0", "#3f51b5", "#03a9f4", "#009688", "#8bc34a", "#ff9800", "#f44336", "#795548", "#607d8b"];

const riskColorMap: Record<FulfillmentInventoryExposureRow["riskBand"], string> = {
  critical: "#d32f2f",
  high:     "#ef6c00",
  medium:   "#f9a825",
  low:      "#2e7d32",
  no_signal:"#607d8b",
};

const TAB_LABELS = ["Overview", "Sales", "Profitability", "Operations", "Fulfillment Velocity", "Geography", "Inventory", "Item Lookup", "Hourly Sales"];

const SHOW_COLORS = ["#e91e63","#9c27b0","#3f51b5","#03a9f4","#009688","#8bc34a","#ff9800","#f44336"];

const isShowHour = (h: number) => h >= 18 || h <= 4;

// Fill all 24 hours so the chart has no gaps
const fillAllHours = (rows: HourlyCombinedRow[]): HourlyCombinedRow[] => {
  const map = new Map(rows.map(r => [r.hour, r]));
  return Array.from({ length: 24 }, (_, h) => map.get(h) ?? { hour: h, orders: 0, revenue: 0 });
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const KpiCard = ({ label, value, icon, color = "#e91e63", subtext }: {
  label: string; value: string; icon: React.ReactNode; color?: string; subtext?: string;
}) => (
  <Card variant="outlined" sx={{ height: "100%" }}>
    <CardContent>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between">
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color }}>{value}</Typography>
          {subtext && <Typography variant="caption" color="text.secondary">{subtext}</Typography>}
        </Box>
        <Box sx={{ color, opacity: 0.7, mt: 0.5 }}>{icon}</Box>
      </Box>
    </CardContent>
  </Card>
);

const SectionCard = ({ title, icon, children, minHeight }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; minHeight?: number;
}) => (
  <Card variant="outlined" sx={{ height: "100%" }}>
    <CardContent>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        {icon && <Box sx={{ color: "#e91e63", display: "flex" }}>{icon}</Box>}
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
      </Box>
      <Box sx={{ minHeight: minHeight ?? 0 }}>{children}</Box>
    </CardContent>
  </Card>
);

const HorizontalBarList = ({ items, labelKey, valueKey, maxItems = 10, barColor = "#e91e63", valueFormatter }: {
  items: Record<string, any>[];
  labelKey: string;
  valueKey: string;
  maxItems?: number;
  barColor?: string;
  valueFormatter?: (value: number) => string;
}) => {
  const rows = items.slice(0, maxItems);
  const maxValue = rows.reduce((max, row) => Math.max(max, Number(row[valueKey] || 0)), 0);
  if (rows.length === 0) return <Typography variant="body2" color="text.secondary">No data available.</Typography>;
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
            <Box sx={{ height: 9, borderRadius: 999, bgcolor: "#fce4ec", overflow: "hidden" }}>
              <Box sx={{ height: "100%", width: `${widthPct}%`, borderRadius: 999, bgcolor: barColor }} />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

function TikTokFulfillmentAnalytics() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [fromDate, setFromDate]         = useState(formatDateInput(thirtyDaysAgo));
  const [toDate, setToDate]             = useState(formatDateInput(now));
  const [selectedShowId, setSelectedShowId] = useState<string>("");
  const [activeTab, setActiveTab]       = useState(0);
  const [trendGranularity, setTrendGranularity] = useState<"day" | "week" | "month">("day");

  // Data state
  const [shows, setShows]               = useState<TikTokShow[]>([]);
  const [overview, setOverview]         = useState<FulfillmentOverviewData | null>(null);
  const [trend, setTrend]               = useState<FulfillmentTrendRow[]>([]);
  const [showsPerf, setShowsPerf]       = useState<FulfillmentShowRow[]>([]);
  const [topProducts, setTopProducts]   = useState<FulfillmentTopProduct[]>([]);
  const [brandMix, setBrandMix]         = useState<FulfillmentBrandMixRow[]>([]);
  const [, setSalesMix]                 = useState<FulfillmentSalesMixRow[]>([]);
  const [profitOverview, setProfitOverview] = useState<FulfillmentProfitabilityOverview | null>(null);
  const [profitShows, setProfitShows]   = useState<FulfillmentProfitabilityShowRow[]>([]);
  const [brandProfitability, setBrandProfitability] = useState<FulfillmentBrandProfitabilityRow[]>([]);
  const [reviewAging, setReviewAging]   = useState<FulfillmentReviewAgingRow[]>([]);
  const [reviewReasons, setReviewReasons] = useState<FulfillmentReviewReasonRow[]>([]);
  const [reviewShipments, setReviewShipments] = useState<FulfillmentReviewShipmentRow[]>([]);
  const [velocity, setVelocity]         = useState<FulfillmentVelocityData | null>(null);
  const [shippingProviders, setShippingProviders] = useState<FulfillmentShippingProviderRow[]>([]);
  const [deliveryOptions, setDeliveryOptions] = useState<FulfillmentDeliveryOptionRow[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<FulfillmentPaymentMethodRow[]>([]);
  const [byState, setByState]           = useState<FulfillmentStateRow[]>([]);
  const [byCity, setByCity]             = useState<FulfillmentCityRow[]>([]);
  const [discountImpact, setDiscountImpact] = useState<FulfillmentDiscountRow[]>([]);
  const [inventoryExposure, setInventoryExposure] = useState<FulfillmentInventoryExposureRow[]>([]);

  // Hourly sales
  const [hourlySelectedShows, setHourlySelectedShows] = useState<TikTokShow[]>([]);
  const [hourlyBreakdown, setHourlyBreakdown]         = useState<"combined" | "byShow">("combined");
  const [hourlyCombined, setHourlyCombined]           = useState<HourlyCombinedRow[]>([]);
  const [hourlyByShow, setHourlyByShow]               = useState<HourlyShowRow[]>([]);
  const [hourlyLoading, setHourlyLoading]             = useState(false);

  // SKU lookup
  const [skuSearchInput, setSkuSearchInput] = useState("");
  const [skuOptions, setSkuOptions]     = useState<FulfillmentSkuSearchOption[]>([]);
  const [selectedSku, setSelectedSku]   = useState<FulfillmentSkuSearchOption | null>(null);
  const [skuDetail, setSkuDetail]       = useState<FulfillmentSkuDetailResponse | null>(null);
  const [skuDetailLoading, setSkuDetailLoading] = useState(false);
  const [skuDetailError, setSkuDetailError] = useState<string | null>(null);

  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const params = useMemo(
    () => ({ from: fromDate, to: toDate, showId: selectedShowId ? Number(selectedShowId) : undefined, limit: 25 }),
    [fromDate, toDate, selectedShowId]
  );

  // Load shows once
  useEffect(() => {
    axios.get(getApiUrl("tiktok/analytics/fulfillment-shows"))
      .then(r => setShows(r.data || []))
      .catch(e => console.error("Failed to load TikTok shows:", e));
  }, []);

  // Load all main data
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      const results = await Promise.allSettled([
        axios.get(getApiUrl("tiktok/analytics/fulfillment-overview"), { params }),
        axios.get(getApiUrl("tiktok/analytics/fulfillment-by-show"), { params }),
        axios.get(getApiUrl("tiktok/analytics/fulfillment-top-products"), { params }),
        axios.get(getApiUrl("tiktok/analytics/fulfillment-brand-mix"), { params: { ...params, limit: 12 } }),
        axios.get(getApiUrl("tiktok/analytics/fulfillment-sales-mix"), { params }),
        axios.get(getApiUrl("tiktok/analytics/fulfillment-profitability-overview"), { params }),
        axios.get(getApiUrl("tiktok/analytics/fulfillment-profitability-shows"), { params: { ...params, limit: 10 } }),
        axios.get(getApiUrl("tiktok/analytics/fulfillment-brand-profitability"), { params: { ...params, limit: 15 } }),
        axios.get(getApiUrl("tiktok/analytics/fulfillment-review-queue"), { params: { showId: params.showId } }),
        axios.get(getApiUrl("tiktok/analytics/fulfillment-velocity"), { params }),
        axios.get(getApiUrl("tiktok/analytics/fulfillment-shipping-providers"), { params }),
        axios.get(getApiUrl("tiktok/analytics/fulfillment-delivery-options"), { params }),
        axios.get(getApiUrl("tiktok/analytics/fulfillment-payment-methods"), { params }),
        axios.get(getApiUrl("tiktok/analytics/fulfillment-by-state"), { params }),
        axios.get(getApiUrl("tiktok/analytics/fulfillment-by-city"), { params }),
        axios.get(getApiUrl("tiktok/analytics/fulfillment-discount-impact"), { params }),
        axios.get(getApiUrl("tiktok/analytics/fulfillment-inventory-exposure"), { params: { ...params, limit: 100 } }),
      ]);

      const [
        overviewR, showsR, topProductsR, brandMixR, salesMixR,
        profitOverviewR, profitShowsR, brandProfitR,
        reviewQueueR, velocityR, shippingR, deliveryR, paymentR,
        stateR, cityR, discountR, inventoryR,
      ] = results;

      if (overviewR.status      === "fulfilled") setOverview(overviewR.value.data);
      if (showsR.status         === "fulfilled") setShowsPerf(showsR.value.data || []);
      if (topProductsR.status   === "fulfilled") setTopProducts(topProductsR.value.data || []);
      if (brandMixR.status      === "fulfilled") setBrandMix(brandMixR.value.data || []);
      if (salesMixR.status      === "fulfilled") setSalesMix(salesMixR.value.data || []);
      if (profitOverviewR.status === "fulfilled") setProfitOverview(profitOverviewR.value.data || null);
      if (profitShowsR.status   === "fulfilled") setProfitShows(profitShowsR.value.data || []);
      if (brandProfitR.status   === "fulfilled") setBrandProfitability(brandProfitR.value.data || []);
      if (reviewQueueR.status   === "fulfilled") {
        const d = reviewQueueR.value.data || {};
        setReviewAging(d.aging || []);
        setReviewReasons(d.reasons || []);
        setReviewShipments(d.shipments || []);
      }
      if (velocityR.status      === "fulfilled") setVelocity(velocityR.value.data || null);
      if (shippingR.status      === "fulfilled") setShippingProviders(shippingR.value.data || []);
      if (deliveryR.status      === "fulfilled") setDeliveryOptions(deliveryR.value.data || []);
      if (paymentR.status       === "fulfilled") setPaymentMethods(paymentR.value.data || []);
      if (stateR.status         === "fulfilled") setByState(stateR.value.data || []);
      if (cityR.status          === "fulfilled") setByCity(cityR.value.data || []);
      if (discountR.status      === "fulfilled") setDiscountImpact(discountR.value.data || []);
      if (inventoryR.status     === "fulfilled") setInventoryExposure(inventoryR.value.data || []);

      const failed = [
        { name: "overview",             result: overviewR },
        { name: "by-show",              result: showsR },
        { name: "top-products",         result: topProductsR },
        { name: "brand-mix",            result: brandMixR },
        { name: "profitability-overview", result: profitOverviewR },
        { name: "review-queue",         result: reviewQueueR },
        { name: "velocity",             result: velocityR },
        { name: "shipping-providers",   result: shippingR },
        { name: "by-state",             result: stateR },
        { name: "inventory",            result: inventoryR },
      ].filter(e => e.result.status === "rejected");

      if (failed.length) setError(`Some panels failed to load: ${failed.map(f => f.name).join(", ")}.`);
      setLoading(false);
    };

    fetchAll();
  }, [params]);

  // Trend (separate — has own granularity param)
  useEffect(() => {
    axios.get(getApiUrl("tiktok/analytics/fulfillment-trend"), {
      params: { from: params.from, to: params.to, showId: params.showId, granularity: trendGranularity },
    })
      .then(r => setTrend(r.data || []))
      .catch(() => setTrend([]));
  }, [params, trendGranularity]);

  // SKU search debounce
  useEffect(() => {
    const query = skuSearchInput.trim();
    if (activeTab !== 7 || query.length < 2) { if (query.length < 2) setSkuOptions([]); return; }
    let cancelled = false;
    const tid = window.setTimeout(async () => {
      try {
        const r = await axios.get(getApiUrl("tiktok/analytics/fulfillment-sku-search"), {
          params: { from: fromDate, to: toDate, showId: selectedShowId ? Number(selectedShowId) : undefined, q: query, limit: 20 },
        });
        if (!cancelled) setSkuOptions(r.data || []);
      } catch { if (!cancelled) setSkuOptions([]); }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(tid); };
  }, [skuSearchInput, activeTab, fromDate, toDate, selectedShowId]);

  // SKU detail load
  useEffect(() => {
    if (!selectedSku) { setSkuDetail(null); return; }
    setSkuDetailLoading(true);
    setSkuDetailError(null);
    axios.get(getApiUrl("tiktok/analytics/fulfillment-sku-detail"), {
      params: { sku: selectedSku.sku, from: fromDate, to: toDate, showId: selectedShowId ? Number(selectedShowId) : undefined },
    })
      .then(r => { setSkuDetail(r.data); setSkuDetailLoading(false); })
      .catch(() => { setSkuDetailError("Failed to load SKU detail."); setSkuDetailLoading(false); });
  }, [selectedSku, fromDate, toDate, selectedShowId]);

  // Hourly data — only fetches when tab is active
  useEffect(() => {
    if (activeTab !== 8) return;
    setHourlyLoading(true);
    const showIds = hourlySelectedShows.map(s => s.id).join(",");
    const baseParams = showIds
      ? { showIds, breakdown: hourlyBreakdown }
      : { from: fromDate, to: toDate, breakdown: hourlyBreakdown };

    Promise.all([
      axios.get(getApiUrl("tiktok/analytics/fulfillment-hourly"), { params: { ...baseParams, breakdown: "combined" } }),
      axios.get(getApiUrl("tiktok/analytics/fulfillment-hourly"), { params: { ...baseParams, breakdown: "byShow" } }),
    ])
      .then(([combinedR, byShowR]) => {
        setHourlyCombined(combinedR.data || []);
        setHourlyByShow(byShowR.data || []);
      })
      .catch(() => { setHourlyCombined([]); setHourlyByShow([]); })
      .finally(() => setHourlyLoading(false));
  }, [activeTab, hourlySelectedShows, hourlyBreakdown, fromDate, toDate]);

  // ─── Derived/memoised data ──────────────────────────────────────────────────

  const waterfallData = useMemo(() => {
    if (!profitOverview) return [];
    const rev  = profitOverview.knownCostRevenue;
    const cost = profitOverview.estimatedCost;
    const fees = profitOverview.tiktokFees ?? profitOverview.knownCostWhatnotFees;
    const net  = profitOverview.netMarginAfterFees;
    return [
      { name: "Revenue",     base: 0,              val: rev,        fill: "#4caf50" },
      { name: "- COGS",      base: rev - cost,     val: cost,       fill: "#e53935" },
      { name: "- TikTok Fees",base: rev - cost - fees, val: fees,   fill: "#fb8c00" },
      { name: "Net Margin",  base: 0,              val: net,        fill: net >= 0 ? "#1976d2" : "#c62828" },
    ];
  }, [profitOverview]);

  const showScatterData = useMemo(() =>
    showsPerf.map(s => ({ showName: truncate(s.showName, 20), revenue: s.revenue, avgSoldPrice: s.avgSoldPrice, unitsSold: s.unitsSold })),
    [showsPerf]
  );

  const profitabilityScatterData = useMemo(() =>
    profitShows.map(s => ({ showName: truncate(s.showName, 20), revenue: s.knownCostRevenue, marginPct: s.netMarginAfterFeesPct, unitsSold: s.unitsSold })),
    [profitShows]
  );

  const riskBandDistribution = useMemo(() => {
    const bands: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, no_signal: 0 };
    inventoryExposure.forEach(r => { bands[r.riskBand] = (bands[r.riskBand] || 0) + 1; });
    return [
      { name: "Critical",   value: bands.critical,  fill: riskColorMap.critical  },
      { name: "High",       value: bands.high,       fill: riskColorMap.high      },
      { name: "Medium",     value: bands.medium,     fill: riskColorMap.medium    },
      { name: "Low",        value: bands.low,        fill: riskColorMap.low       },
      { name: "No Signal",  value: bands.no_signal,  fill: riskColorMap.no_signal },
    ].filter(b => b.value > 0);
  }, [inventoryExposure]);

  const daysOfCoverBuckets = useMemo(() => {
    const buckets = [
      { label: "0 days",   min: 0,   max: 0,    count: 0, fill: "#d32f2f" },
      { label: "1–7 days", min: 1,   max: 7,    count: 0, fill: "#ef6c00" },
      { label: "8–14",     min: 8,   max: 14,   count: 0, fill: "#f9a825" },
      { label: "15–30",    min: 15,  max: 30,   count: 0, fill: "#66bb6a" },
      { label: "31–60",    min: 31,  max: 60,   count: 0, fill: "#2e7d32" },
      { label: "60+",      min: 61,  max: Infinity, count: 0, fill: "#1565c0" },
    ];
    inventoryExposure.forEach(r => {
      const doc = r.daysOfCover ?? 0;
      const bucket = buckets.find(b => doc >= b.min && doc <= b.max);
      if (bucket) bucket.count += 1;
    });
    return buckets;
  }, [inventoryExposure]);

  const dayOfWeekData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const acc: Record<string, { unitsSold: number; revenue: number }> = {};
    days.forEach(d => { acc[d] = { unitsSold: 0, revenue: 0 }; });
    trend.forEach(row => {
      const d = new Date(row.bucket + "T12:00:00");
      const key = days[d.getDay()];
      if (acc[key]) { acc[key].unitsSold += row.unitsSold; acc[key].revenue += row.revenue; }
    });
    return days.map(d => ({ day: d, unitsSold: acc[d].unitsSold, revenue: acc[d].revenue }));
  }, [trend]);

  // ─── Tab renders ───────────────────────────────────────────────────────────

  const renderOverviewTab = () => {
    const ov = overview;
    return (
      <Stack spacing={3}>
        {/* KPI row */}
        <Grid container spacing={2}>
          {[
            { label: "Revenue", value: formatCurrency(ov?.revenue), icon: <AttachMoneyIcon />, subtext: `${formatNumber(ov?.completedShipments)} total items sold` },
            { label: "Avg Sold Price", value: formatCurrency(ov?.avgSoldPrice), icon: <LocalOfferIcon />, subtext: `${formatNumber(ov?.uniqueSkusSold)} unique SKUs` },
            { label: "Pending Shipments", value: formatNumber(ov?.pendingShipments), icon: <HourglassEmptyIcon />, color: "#f57c00", subtext: `${formatCurrency(ov?.pendingRevenue)} at risk` },
            { label: "Under Review", value: formatNumber(ov?.reviewShipments), icon: <ErrorOutlineIcon />, color: "#d32f2f", subtext: `${formatCurrency(ov?.reviewRevenue)} affected` },
            { label: "Total Discounts", value: formatCurrency(ov?.totalDiscounts), icon: <LocalOfferIcon />, color: "#7b1fa2", subtext: "discount given to buyers" },
            { label: "Random Giveaways", value: formatNumber(ov?.randomGiveawayShipments), icon: <ReceiptIcon />, color: "#00695c", subtext: `${formatNumber(ov?.randomGiveawayUnits)} units` },
          ].map((kpi, i) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={i}>
              <KpiCard {...kpi} color={kpi.color ?? "#e91e63"} />
            </Grid>
          ))}
        </Grid>

        {/* Trend chart */}
        <SectionCard title="Revenue & Units Trend" icon={<ShowChartIcon />} minHeight={280}>
          <Box display="flex" justifyContent="flex-end" mb={1}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select value={trendGranularity} onChange={e => setTrendGranularity(e.target.value as "day" | "week" | "month")}>
                <MenuItem value="day">Daily</MenuItem>
                <MenuItem value="week">Weekly</MenuItem>
                <MenuItem value="month">Monthly</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={trend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="bucket" tickFormatter={b => formatTick(b, trendGranularity)} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tickFormatter={kFormatter} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <RechartsTooltip formatter={((v: number, name: string) => [
                name === "Revenue" ? formatCurrency(v) : formatNumber(v), name,
              ]) as any} labelFormatter={l => formatTick(String(l), trendGranularity)} />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" fill="#fce4ec" stroke="#e91e63" strokeWidth={2} fillOpacity={0.5} />
              <Bar yAxisId="right" dataKey="unitsSold" name="Units Sold" fill="#9c27b0" opacity={0.7} />
            </ComposedChart>
          </ResponsiveContainer>
        </SectionCard>

        <Grid container spacing={2}>
          {/* Day of week */}
          <Grid item xs={12} md={6}>
            <SectionCard title="Sales by Day of Week" icon={<CalendarTodayIcon />} minHeight={220}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dayOfWeekData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tickFormatter={kFormatter} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <RechartsTooltip formatter={((v: number, name: string) => [
                    name === "Revenue" ? formatCurrency(v) : formatNumber(v), name,
                  ]) as any} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#e91e63" />
                  <Bar yAxisId="right" dataKey="unitsSold" name="Units" fill="#9c27b0" opacity={0.75} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          </Grid>

          {/* Top shows mini */}
          <Grid item xs={12} md={6}>
            <SectionCard title="Revenue by Show" icon={<BarChartIcon />} minHeight={220}>
              <HorizontalBarList items={showsPerf} labelKey="showName" valueKey="revenue" maxItems={8} barColor="#e91e63" valueFormatter={formatCurrency} />
            </SectionCard>
          </Grid>
        </Grid>
      </Stack>
    );
  };

  const renderSalesTab = () => (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        {/* Revenue by show — horizontal bar */}
        <Grid item xs={12} md={6}>
          <SectionCard title="Revenue by Show" icon={<BarChartIcon />} minHeight={320}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart layout="vertical" data={showsPerf.slice(0, 12)} margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={kFormatter} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="showName" tick={{ fontSize: 10 }} width={100}
                  tickFormatter={v => truncate(String(v), 18)} />
                <RechartsTooltip formatter={((v: number) => [formatCurrency(v), "Revenue"]) as any} />
                <Bar dataKey="revenue" name="Revenue" fill="#e91e63" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </Grid>

        {/* Revenue vs ASP scatter */}
        <Grid item xs={12} md={6}>
          <SectionCard title="Revenue vs Avg Sold Price by Show" icon={<ShowChartIcon />} minHeight={320}>
            <ResponsiveContainer width="100%" height={320}>
              <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="revenue" name="Revenue" tickFormatter={kFormatter} label={{ value: "Revenue", position: "insideBottom", offset: -10, fontSize: 11 }} tick={{ fontSize: 10 }} />
                <YAxis dataKey="avgSoldPrice" name="Avg Sold Price" tickFormatter={v => `$${v}`} tick={{ fontSize: 10 }} />
                <RechartsTooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <Paper sx={{ p: 1.5 }}>
                      <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>{d.showName}</Typography>
                      <Typography variant="caption" display="block">Revenue: {formatCurrency(d.revenue)}</Typography>
                      <Typography variant="caption" display="block">ASP: {formatCurrency(d.avgSoldPrice)}</Typography>
                      <Typography variant="caption" display="block">Units: {formatNumber(d.unitsSold)}</Typography>
                    </Paper>
                  );
                }} />
                <Scatter data={showScatterData} fill="#e91e63" />
              </ScatterChart>
            </ResponsiveContainer>
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {/* Brand revenue mix */}
        <Grid item xs={12} md={5}>
          <SectionCard title="Revenue by Brand" icon={<PieChartIcon />} minHeight={280}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={brandMix.slice(0, 10)} dataKey="revenue" nameKey="brand" cx="50%" cy="50%" outerRadius={100}
                  label={({ brand, percent }) => `${truncate(brand, 12)} ${(percent * 100).toFixed(0)}%`} labelLine>
                  {brandMix.slice(0, 10).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <RechartsTooltip formatter={((v: number, name: string) => [formatCurrency(v), name]) as any} />
              </PieChart>
            </ResponsiveContainer>
          </SectionCard>
        </Grid>

        {/* Top products table */}
        <Grid item xs={12} md={7}>
          <SectionCard title="Top Products by Revenue" icon={<TrendingUpIcon />} minHeight={280}>
            <TableContainer sx={{ maxHeight: 280 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Brand</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Units</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Revenue</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>ASP</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topProducts.slice(0, 15).map((p, i) => (
                    <TableRow key={i} hover>
                      <TableCell sx={{ fontSize: "0.75rem" }}>{p.sku}</TableCell>
                      <TableCell sx={{ fontSize: "0.75rem" }}>{truncate(p.brand || "", 16)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: "0.75rem" }}>{formatNumber(p.unitsSold)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: "0.75rem" }}>{formatCurrency(p.revenue)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: "0.75rem" }}>{formatCurrency(p.avgSoldPrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );

  const renderProfitabilityTab = () => {
    const po = profitOverview;

    return (
      <Stack spacing={3}>
        {/* Profitability KPIs */}
        <Grid container spacing={2}>
          {[
            { label: "Known-Cost Revenue", value: formatCurrency(po?.knownCostRevenue), icon: <AttachMoneyIcon />, subtext: `${formatNumber(po?.knownCostUnits)} units with cost data` },
            { label: "Est. COGS", value: formatCurrency(po?.estimatedCost), icon: <ReceiptIcon />, color: "#e53935" },
            { label: "Gross Margin", value: formatCurrency(po?.grossMargin), icon: <TrendingUpIcon />, color: "#388e3c", subtext: `${po?.grossMarginPct ?? 0}%` },
            { label: "TikTok Fees", value: formatCurrency(po?.tiktokFees), icon: <LocalShippingIcon />, color: "#f57c00" },
            { label: "Net Margin", value: formatCurrency(po?.netMarginAfterFees), icon: <ShowChartIcon />, color: (po?.netMarginAfterFees ?? 0) >= 0 ? "#1565c0" : "#c62828", subtext: `${po?.netMarginAfterFeesPct ?? 0}%` },
            { label: "Negative Margin Units", value: formatNumber(po?.negativeMarginUnits), icon: <WarningAmberIcon />, color: "#d32f2f" },
          ].map((kpi, i) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={i}>
              <KpiCard {...kpi} color={kpi.color ?? "#e91e63"} />
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2}>
          {/* Waterfall */}
          <Grid item xs={12} md={5}>
            <SectionCard title="Profit Waterfall (Known-Cost Units)" icon={<BarChartIcon />} minHeight={300}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={waterfallData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={kFormatter} tick={{ fontSize: 11 }} />
                  <RechartsTooltip formatter={((v: number, name: string) => name === "base" ? null : [formatCurrency(v), "Amount"]) as any} />
                  <Bar dataKey="base" stackId="same" fill="transparent" />
                  <Bar dataKey="val" stackId="same" name="Amount" radius={[4, 4, 0, 0]}>
                    {waterfallData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          </Grid>

          {/* Revenue/Cost/Margin by show */}
          <Grid item xs={12} md={7}>
            <SectionCard title="Revenue / Cost / Net Margin by Show" icon={<BarChartIcon />} minHeight={300}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={profitShows.slice(0, 10)} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="showName" tick={{ fontSize: 9 }} tickFormatter={v => truncate(String(v), 12)} />
                  <YAxis tickFormatter={kFormatter} tick={{ fontSize: 11 }} />
                  <RechartsTooltip formatter={((v: number, name: string) => [formatCurrency(v), name]) as any} />
                  <Legend />
                  <Bar dataKey="knownCostRevenue" name="Revenue" fill="#e91e63" />
                  <Bar dataKey="estimatedCost" name="COGS" fill="#e53935" />
                  <Bar dataKey="netMarginAfterFees" name="Net Margin" fill="#1976d2" />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          {/* Margin % vs Revenue scatter */}
          <Grid item xs={12} md={6}>
            <SectionCard title="Net Margin % vs Revenue by Show" icon={<ShowChartIcon />} minHeight={280}>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="revenue" name="Revenue" tickFormatter={kFormatter} label={{ value: "Revenue", position: "insideBottom", offset: -10, fontSize: 11 }} tick={{ fontSize: 10 }} />
                  <YAxis dataKey="marginPct" name="Net Margin %" tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                  <RechartsTooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <Paper sx={{ p: 1.5 }}>
                        <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>{d.showName}</Typography>
                        <Typography variant="caption" display="block">Revenue: {formatCurrency(d.revenue)}</Typography>
                        <Typography variant="caption" display="block">Net Margin: {d.marginPct}%</Typography>
                      </Paper>
                    );
                  }} />
                  <Scatter data={profitabilityScatterData} fill="#9c27b0" />
                </ScatterChart>
              </ResponsiveContainer>
            </SectionCard>
          </Grid>

          {/* Brand profitability */}
          <Grid item xs={12} md={6}>
            <SectionCard title="Brand Profitability" icon={<BarChartIcon />} minHeight={280}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={brandProfitability.slice(0, 10)} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="brand" tick={{ fontSize: 9 }} tickFormatter={v => truncate(String(v), 10)} />
                  <YAxis tickFormatter={kFormatter} tick={{ fontSize: 11 }} />
                  <RechartsTooltip formatter={((v: number, name: string) => [formatCurrency(v), name]) as any} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="#e91e63">
                    {brandProfitability.slice(0, 10).map((_, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
                  </Bar>
                  <Bar dataKey="grossMargin" name="Gross Margin" fill="#9c27b0" />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          </Grid>
        </Grid>

        {/* Discount impact */}
        <SectionCard title="Discount Impact by Show" icon={<LocalOfferIcon />} minHeight={260}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={discountImpact.slice(0, 12)} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="showName" tick={{ fontSize: 9 }} tickFormatter={v => truncate(String(v), 12)} />
              <YAxis yAxisId="left" tickFormatter={kFormatter} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
              <RechartsTooltip formatter={((v: number, name: string) => {
                if (name === "Discount %") return [`${v}%`, name];
                return [formatCurrency(v), name];
              }) as any} />
              <Legend />
              <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#e91e63" />
              <Bar yAxisId="left" dataKey="totalDiscounts" name="Total Discounts" fill="#7b1fa2" />
              <Bar yAxisId="right" dataKey="discountPct" name="Discount %" fill="#ffa726" />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </Stack>
    );
  };

  const renderOperationsTab = () => {
    const totalReview = reviewShipments.length;

    return (
      <Stack spacing={3}>
        {/* Review gauge-style KPI + aging */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <SectionCard title="Review Queue Overview" icon={<ErrorOutlineIcon />} minHeight={240}>
              <Stack spacing={1.5}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Shipments under review</Typography>
                  <Chip label={formatNumber(totalReview)} color="error" size="small" />
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Affected revenue</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {formatCurrency(reviewShipments.reduce((s, r) => s + r.affectedRevenue, 0))}
                  </Typography>
                </Box>
                {reviewAging.map((a, i) => (
                  <Box key={i} display="flex" justifyContent="space-between">
                    <Typography variant="body2">{a.ageBucket}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatNumber(a.shipmentCount)} shipments</Typography>
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          </Grid>

          <Grid item xs={12} md={4}>
            <SectionCard title="Review Queue Aging" icon={<ScheduleIcon />} minHeight={240}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={reviewAging}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="ageBucket" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Bar dataKey="shipmentCount" name="Shipments" fill="#e91e63">
                    {reviewAging.map((_, i) => <Cell key={i} fill={["#4caf50", "#ffc107", "#ff9800", "#f44336", "#b71c1c"][Math.min(i, 4)]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          </Grid>

          <Grid item xs={12} md={4}>
            <SectionCard title="Review Reasons" icon={<WarningAmberIcon />} minHeight={240}>
              <HorizontalBarList items={reviewReasons} labelKey="mismatchReason" valueKey="shipmentCount" maxItems={8} barColor="#e91e63" />
            </SectionCard>
          </Grid>
        </Grid>

        {/* Review shipments table */}
        <SectionCard title="Under-Review Shipments" icon={<HourglassEmptyIcon />}>
          <TableContainer sx={{ maxHeight: 360 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Show</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Shipment</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Tracking</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Reason</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Exp</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Scanned</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Revenue</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Age</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reviewShipments.map((r, i) => (
                  <TableRow key={i} hover sx={{ bgcolor: r.ageDays > 7 ? "#fff3e0" : undefined }}>
                    <TableCell sx={{ fontSize: "0.75rem" }}>{truncate(r.showName || "", 20)}</TableCell>
                    <TableCell sx={{ fontSize: "0.75rem" }}>{r.shipmentId}</TableCell>
                    <TableCell sx={{ fontSize: "0.75rem" }}>{r.tracking || "—"}</TableCell>
                    <TableCell sx={{ fontSize: "0.75rem" }}>{r.mismatchReason || "—"}</TableCell>
                    <TableCell align="right" sx={{ fontSize: "0.75rem" }}>{r.expectedQty}</TableCell>
                    <TableCell align="right" sx={{ fontSize: "0.75rem" }}>{r.scannedQty}</TableCell>
                    <TableCell align="right" sx={{ fontSize: "0.75rem" }}>{formatCurrency(r.affectedRevenue)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: "0.75rem" }}>
                      <Chip label={`${r.ageDays}d`} size="small" color={r.ageDays > 7 ? "error" : r.ageDays > 3 ? "warning" : "default"} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </SectionCard>
      </Stack>
    );
  };

  const renderVelocityTab = () => {
    const v = velocity;
    const lifecycleSteps = [
      { label: "Placed → Paid",       value: v?.avgDaysPlacedToPaid      ?? null, icon: <PaymentIcon /> },
      { label: "Placed → RTS",        value: v?.avgDaysPlacedToRts       ?? null, icon: <ScheduleIcon /> },
      { label: "Placed → Shipped",    value: v?.avgDaysPlacedToShipped   ?? null, icon: <LocalShippingIcon /> },
      { label: "Placed → Delivered",  value: v?.avgDaysPlacedToDelivered ?? null, icon: <DeliveryDiningIcon /> },
      { label: "Transit Time",        value: v?.avgTransitDays           ?? null, icon: <SpeedIcon /> },
    ];

    return (
      <Stack spacing={3}>
        {/* Lifecycle avg days KPI row */}
        <Grid container spacing={2}>
          {lifecycleSteps.map((step, i) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={i}>
              <KpiCard
                label={step.label}
                value={step.value !== null ? `${step.value} days` : "N/A"}
                icon={step.icon}
                color="#e91e63"
              />
            </Grid>
          ))}
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <KpiCard label="Cancelled Orders" value={formatNumber(v?.cancelledOrders)} icon={<ErrorOutlineIcon />} color="#d32f2f" />
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <KpiCard label="Orders w/ Tracking" value={`${v?.pctWithTracking ?? 0}%`} icon={<LocalShippingIcon />} color="#1565c0" />
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          {/* Time-to-ship histogram */}
          <Grid item xs={12} md={5}>
            <SectionCard title="Time to Ship Distribution" icon={<ScheduleIcon />} minHeight={280}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={v?.histogram ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Bar dataKey="shipmentCount" name="Shipments" fill="#e91e63" radius={[4, 4, 0, 0]}>
                    {(v?.histogram ?? []).map((_, i) => (
                      <Cell key={i} fill={["#4caf50", "#8bc34a", "#ffc107", "#ff9800", "#f44336", "#b71c1c"][Math.min(i, 5)]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          </Grid>

          {/* Shipping provider pie */}
          <Grid item xs={12} md={3.5}>
            <SectionCard title="Shipping Providers" icon={<LocalShippingIcon />} minHeight={280}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={shippingProviders} dataKey="shipmentCount" nameKey="provider" cx="50%" cy="50%" outerRadius={90}
                    label={({ provider, percent }) => `${truncate(provider, 10)} ${(percent * 100).toFixed(0)}%`}>
                    {shippingProviders.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip formatter={((v: number, name: string) => [formatNumber(v), name]) as any} />
                </PieChart>
              </ResponsiveContainer>
            </SectionCard>
          </Grid>

          {/* Delivery option pie */}
          <Grid item xs={12} md={3.5}>
            <SectionCard title="Delivery Options" icon={<DeliveryDiningIcon />} minHeight={280}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={deliveryOptions} dataKey="shipmentCount" nameKey="deliveryOption" cx="50%" cy="50%" outerRadius={90}
                    label={({ deliveryOption, percent }) => `${truncate(deliveryOption, 10)} ${(percent * 100).toFixed(0)}%`}>
                    {deliveryOptions.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip formatter={((v: number, name: string) => [formatNumber(v), name]) as any} />
                </PieChart>
              </ResponsiveContainer>
            </SectionCard>
          </Grid>
        </Grid>

        {/* Payment method bar */}
        <SectionCard title="Revenue by Payment Method" icon={<PaymentIcon />} minHeight={220}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart layout="vertical" data={paymentMethods} margin={{ left: 20, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tickFormatter={kFormatter} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="paymentMethod" tick={{ fontSize: 10 }} width={110} />
              <RechartsTooltip formatter={((v: number, name: string) => [
                name === "Revenue" ? formatCurrency(v) : formatNumber(v), name,
              ]) as any} />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill="#e91e63" radius={[0, 4, 4, 0]} />
              <Bar dataKey="shipmentCount" name="Orders" fill="#9c27b0" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </Stack>
    );
  };

  const renderGeographyTab = () => (
    <Stack spacing={3}>
      {/* Revenue by state */}
      <SectionCard title="Revenue by State (Top 20)" icon={<MapIcon />} minHeight={300}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart layout="vertical" data={byState} margin={{ left: 10, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tickFormatter={kFormatter} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="state" tick={{ fontSize: 10 }} width={40} />
            <RechartsTooltip formatter={((v: number, name: string) => [
              name === "Revenue" ? formatCurrency(v) : formatNumber(v), name,
            ]) as any} />
            <Legend />
            <Bar dataKey="revenue" name="Revenue" fill="#e91e63" radius={[0, 4, 4, 0]}>
              {byState.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Bar>
            <Bar dataKey="orderCount" name="Orders" fill="#9c27b0" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <Grid container spacing={2}>
        {/* State table */}
        <Grid item xs={12} md={6}>
          <SectionCard title="State Breakdown" icon={<MapIcon />}>
            <TableContainer sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>State</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Orders</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Units</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Revenue</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {byState.map((r, i) => (
                    <TableRow key={i} hover>
                      <TableCell sx={{ fontSize: "0.75rem", fontWeight: 600 }}>{r.state}</TableCell>
                      <TableCell align="right" sx={{ fontSize: "0.75rem" }}>{formatNumber(r.orderCount)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: "0.75rem" }}>{formatNumber(r.unitsSold)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: "0.75rem" }}>{formatCurrency(r.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>
        </Grid>

        {/* Top cities */}
        <Grid item xs={12} md={6}>
          <SectionCard title="Top Cities by Revenue" icon={<MapIcon />}>
            <TableContainer sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>City</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>State</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Orders</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Revenue</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {byCity.map((r, i) => (
                    <TableRow key={i} hover>
                      <TableCell sx={{ fontSize: "0.75rem" }}>{r.city}</TableCell>
                      <TableCell sx={{ fontSize: "0.75rem" }}>{r.state}</TableCell>
                      <TableCell align="right" sx={{ fontSize: "0.75rem" }}>{formatNumber(r.orderCount)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: "0.75rem" }}>{formatCurrency(r.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );

  const renderInventoryTab = () => {
    const criticalItems = inventoryExposure.filter(r => r.riskBand === "critical").length;
    const highItems     = inventoryExposure.filter(r => r.riskBand === "high").length;

    return (
      <Stack spacing={3}>
        <Grid container spacing={2}>
          {[
            { label: "Critical Risk SKUs", value: formatNumber(criticalItems), icon: <WarningAmberIcon />, color: "#d32f2f" },
            { label: "High Risk SKUs",     value: formatNumber(highItems),     icon: <WarningAmberIcon />, color: "#ef6c00" },
            { label: "Total Tracked SKUs", value: formatNumber(inventoryExposure.length), icon: <Inventory2Icon /> },
            { label: "Out of Stock",       value: formatNumber(inventoryExposure.filter(r => r.currentQty === 0).length), icon: <ErrorOutlineIcon />, color: "#b71c1c" },
          ].map((kpi, i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <KpiCard {...kpi} color={kpi.color ?? "#e91e63"} />
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2}>
          {/* Risk band donut */}
          <Grid item xs={12} md={4}>
            <SectionCard title="Risk Band Distribution" icon={<PieChartIcon />} minHeight={280}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={riskBandDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={55} outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {riskBandDistribution.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <RechartsTooltip formatter={((v: number, name: string) => [formatNumber(v) + " SKUs", name]) as any} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </SectionCard>
          </Grid>

          {/* Days of cover histogram */}
          <Grid item xs={12} md={4}>
            <SectionCard title="Days of Cover Histogram" icon={<BarChartIcon />} minHeight={280}>
              {daysOfCoverBuckets.every(b => b.count === 0) ? (
                <Typography variant="body2" color="text.secondary">No data available.</Typography>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={daysOfCoverBuckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RechartsTooltip formatter={((v: number) => [formatNumber(v) + " SKUs", "Count"]) as any} />
                    <Bar dataKey="count" name="SKUs" radius={[4, 4, 0, 0]}>
                      {daysOfCoverBuckets.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
          </Grid>

          {/* Stock vs velocity scatter */}
          <Grid item xs={12} md={4}>
            <SectionCard title="Stock vs Daily Sales Velocity" icon={<SpeedIcon />} minHeight={280}>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="avgDailySales" name="Daily Sales" label={{ value: "Daily Sales", position: "insideBottom", offset: -10, fontSize: 11 }} tick={{ fontSize: 10 }} />
                  <YAxis dataKey="currentQty" name="Stock" tick={{ fontSize: 10 }} />
                  <RechartsTooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <Paper sx={{ p: 1.5 }}>
                        <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>{d.sku}</Typography>
                        <Typography variant="caption" display="block">Stock: {formatNumber(d.currentQty)}</Typography>
                        <Typography variant="caption" display="block">Daily Sales: {d.avgDailySales}</Typography>
                        <Typography variant="caption" display="block">Days of Cover: {d.daysOfCover ?? "N/A"}</Typography>
                      </Paper>
                    );
                  }} />
                  {["critical", "high", "medium", "low", "no_signal"].map(band => {
                    const items = inventoryExposure.filter(r => r.riskBand === band);
                    return items.length > 0 ? (
                      <Scatter key={band} name={band} data={items} fill={riskColorMap[band as FulfillmentInventoryExposureRow["riskBand"]]} />
                    ) : null;
                  })}
                  <Legend />
                </ScatterChart>
              </ResponsiveContainer>
            </SectionCard>
          </Grid>
        </Grid>

        {/* Inventory table */}
        <SectionCard title="Inventory Exposure Detail" icon={<Inventory2Icon />}>
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Brand</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Stock</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Units Sold</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Daily Sales</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Days Cover</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Risk</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inventoryExposure.slice(0, 50).map((r, i) => (
                  <TableRow key={i} hover>
                    <TableCell sx={{ fontSize: "0.75rem" }}>{r.sku}</TableCell>
                    <TableCell sx={{ fontSize: "0.75rem" }}>{truncate(r.brand || "", 14)}</TableCell>
                    <TableCell sx={{ fontSize: "0.75rem" }}>{truncate(r.itemName || "", 22)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: "0.75rem" }}>{formatNumber(r.currentQty)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: "0.75rem" }}>{formatNumber(r.unitsSold)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: "0.75rem" }}>{r.avgDailySales}</TableCell>
                    <TableCell align="right" sx={{ fontSize: "0.75rem" }}>{r.daysOfCover ?? "—"}</TableCell>
                    <TableCell>
                      <Chip label={r.riskBand} size="small"
                        sx={{ bgcolor: riskColorMap[r.riskBand], color: "#fff", fontSize: "0.65rem" }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </SectionCard>
      </Stack>
    );
  };

  const renderItemLookupTab = () => (
    <Stack spacing={3}>
      <Box>
        <Autocomplete
          options={skuOptions}
          getOptionLabel={o => `${o.sku} — ${o.brand || ""} ${o.itemName || ""}`.trim()}
          inputValue={skuSearchInput}
          onInputChange={(_, v) => setSkuSearchInput(v)}
          onChange={(_, v) => setSelectedSku(v)}
          renderInput={params => (
            <TextField {...params} label="Search SKU / Brand / Item Name" size="small"
              InputProps={{ ...params.InputProps, startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} /> }} />
          )}
          sx={{ maxWidth: 480 }}
          noOptionsText={skuSearchInput.length < 2 ? "Type at least 2 characters" : "No matching SKUs found"}
        />
      </Box>

      {skuDetailLoading && <CircularProgress size={28} />}
      {skuDetailError && <Alert severity="error">{skuDetailError}</Alert>}

      {skuDetail && !skuDetailLoading && (() => {
        const { product, summary, byShow, byDay, hourOfDay, dayOfWeek, recentSales } = skuDetail;
        return (
          <Stack spacing={3}>
            {/* Product info */}
            <Card variant="outlined">
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{product.sku}</Typography>
                    <Typography variant="body2" color="text.secondary">{[product.brand, product.itemName, product.strength, product.sizeOz && `${product.sizeOz} oz`, product.sizeMl && `${product.sizeMl} mL`].filter(Boolean).join(" · ")}</Typography>
                    <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                      {product.tester && <Chip label="Tester" size="small" color="info" />}
                      {product.condition && <Chip label={product.condition} size="small" />}
                      {product.location && <Chip label={`📍 ${product.location}`} size="small" />}
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Grid container spacing={1}>
                      {[
                        { label: "Current Stock", value: formatNumber(product.quantity) },
                        { label: "Min Stock",     value: formatNumber(product.minimumQuantity) },
                        { label: "Avg Cost",      value: formatCurrency(product.averagePrice) },
                        { label: "Units Sold",    value: formatNumber(summary.unitsSold) },
                        { label: "Revenue",       value: formatCurrency(summary.revenue) },
                        { label: "Avg Sold Price",value: formatCurrency(summary.avgSoldPrice) },
                        { label: "Gross Margin",  value: formatCurrency(summary.grossMargin) },
                        { label: "Total Discounts",value: formatCurrency(summary.totalDiscounts) },
                        { label: "Price Range",   value: `${formatCurrency(summary.lowestSoldPrice)} – ${formatCurrency(summary.highestSoldPrice)}` },
                        { label: "Shows",         value: formatNumber(summary.uniqueShows) },
                      ].map((kv, i) => (
                        <Grid item xs={6} key={i}>
                          <Typography variant="caption" color="text.secondary">{kv.label}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{kv.value}</Typography>
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Grid container spacing={2}>
              {/* Daily trend */}
              <Grid item xs={12} md={6}>
                <SectionCard title="Daily Sales Trend" icon={<ShowChartIcon />} minHeight={220}>
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={[...byDay].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="bucket" tick={{ fontSize: 9 }} tickFormatter={b => formatTick(b, "day")} />
                      <YAxis yAxisId="left" tickFormatter={kFormatter} tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                      <RechartsTooltip formatter={((v: number, name: string) => [name === "Revenue" ? formatCurrency(v) : formatNumber(v), name]) as any} />
                      <Legend />
                      <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" fill="#fce4ec" stroke="#e91e63" strokeWidth={2} fillOpacity={0.5} />
                      <Bar yAxisId="right" dataKey="unitsSold" name="Units" fill="#9c27b0" opacity={0.7} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </SectionCard>
              </Grid>

              {/* Hour of day */}
              <Grid item xs={12} md={6}>
                <SectionCard title="Orders by Hour of Day" icon={<ScheduleIcon />} minHeight={220}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={hourOfDay.map(h => ({ ...h, hourLabel: hourLabel(h.hourOfDay) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="hourLabel" tick={{ fontSize: 9 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tickFormatter={kFormatter} tick={{ fontSize: 10 }} />
                      <RechartsTooltip formatter={((v: number, name: string) => [name === "Revenue" ? formatCurrency(v) : formatNumber(v), name]) as any} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="unitsSold" name="Units" fill="#9c27b0" />
                      <Bar yAxisId="right" dataKey="revenue" name="Revenue" fill="#e91e63" opacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                </SectionCard>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              {/* Day of week */}
              <Grid item xs={12} md={6}>
                <SectionCard title="Orders by Day of Week" icon={<CalendarTodayIcon />} minHeight={220}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dayOfWeek}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="dayName" tick={{ fontSize: 10 }} tickFormatter={v => String(v).slice(0, 3)} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tickFormatter={kFormatter} tick={{ fontSize: 10 }} />
                      <RechartsTooltip formatter={((v: number, name: string) => [name === "Revenue" ? formatCurrency(v) : formatNumber(v), name]) as any} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="unitsSold" name="Units" fill="#9c27b0" />
                      <Bar yAxisId="right" dataKey="revenue" name="Revenue" fill="#e91e63" opacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                </SectionCard>
              </Grid>

              {/* By show */}
              <Grid item xs={12} md={6}>
                <SectionCard title="Revenue by Show" icon={<BarChartIcon />} minHeight={220}>
                  <HorizontalBarList items={byShow} labelKey="showName" valueKey="revenue" maxItems={8} barColor="#e91e63" valueFormatter={formatCurrency} />
                </SectionCard>
              </Grid>
            </Grid>

            {/* Recent sales */}
            <SectionCard title="Recent Sales" icon={<ReceiptIcon />}>
              <TableContainer sx={{ maxHeight: 320 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Show</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Shipment</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>State</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>City</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Payment</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Price</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentSales.map((s, i) => (
                      <TableRow key={i} hover>
                        <TableCell sx={{ fontSize: "0.75rem" }}>{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}</TableCell>
                        <TableCell sx={{ fontSize: "0.75rem" }}>{truncate(s.showName || "", 18)}</TableCell>
                        <TableCell sx={{ fontSize: "0.75rem" }}>{s.shipmentId || "—"}</TableCell>
                        <TableCell sx={{ fontSize: "0.75rem" }}>{s.state || "—"}</TableCell>
                        <TableCell sx={{ fontSize: "0.75rem" }}>{truncate(s.city || "", 14)}</TableCell>
                        <TableCell sx={{ fontSize: "0.75rem" }}>{s.paymentMethod || "—"}</TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.75rem", fontWeight: 600 }}>{formatCurrency(s.soldPrice)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </SectionCard>
          </Stack>
        );
      })()}

      {!selectedSku && !skuDetailLoading && (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <SearchIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
          <Typography color="text.secondary">Search for a SKU above to view detailed analytics.</Typography>
        </Box>
      )}
    </Stack>
  );

  const renderHourlySalesTab = () => {
    const filledCombined = fillAllHours(hourlyCombined);
    const totalRevenue   = filledCombined.reduce((s, r) => s + r.revenue, 0);
    const totalOrders    = filledCombined.reduce((s, r) => s + r.orders,  0);
    const peakRow        = filledCombined.reduce((best, r) => r.revenue > best.revenue ? r : best, filledCombined[0] ?? { hour: 0, revenue: 0, orders: 0 });
    const showRevenue    = filledCombined.filter(r => isShowHour(r.hour)).reduce((s, r) => s + r.revenue, 0);
    const showPct        = totalRevenue > 0 ? Math.round(showRevenue / totalRevenue * 100) : 0;

    // Unique show names for grouped bar chart (cap at 8)
    const showNames = Array.from(new Set(hourlyByShow.map(r => r.showName))).slice(0, 8);

    // Pivot byShow data into {hour, [showName]: revenue, ...}
    const byShowPivoted = Array.from({ length: 24 }, (_, h) => {
      const base: Record<string, number | string> = { hour: h };
      showNames.forEach(name => { base[name] = 0; });
      hourlyByShow.filter(r => r.hour === h).forEach(r => {
        if (showNames.includes(r.showName)) base[r.showName] = r.revenue;
      });
      return base;
    });

    const chartData = hourlyBreakdown === "combined" ? filledCombined : byShowPivoted;

    return (
      <Stack spacing={3}>
        {/* Controls */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} flexWrap="wrap">
            <Autocomplete
              multiple
              options={shows}
              getOptionLabel={s => s.name}
              value={hourlySelectedShows}
              onChange={(_, v) => setHourlySelectedShows(v)}
              renderInput={p => <TextField {...p} label="Filter by show(s) — leave empty to use date range" size="small" />}
              sx={{ minWidth: 360, flex: 1 }}
              limitTags={3}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>View</InputLabel>
              <Select value={hourlyBreakdown} label="View" onChange={e => setHourlyBreakdown(e.target.value as "combined" | "byShow")}>
                <MenuItem value="combined">Combined</MenuItem>
                <MenuItem value="byShow">By Show</MenuItem>
              </Select>
            </FormControl>
            {hourlyLoading && <CircularProgress size={20} sx={{ color: "#e91e63" }} />}
          </Stack>
        </Paper>

        {/* KPI tiles */}
        <Grid container spacing={2}>
          {[
            { label: "Total Revenue",      value: formatCurrency(totalRevenue),         icon: <AttachMoneyIcon />,  color: "#e91e63" },
            { label: "Total Orders",       value: formatNumber(totalOrders),             icon: <ReceiptIcon />,      color: "#9c27b0" },
            { label: "Peak Hour (EDT)",    value: hourLabel(peakRow.hour),               icon: <ScheduleIcon />,     color: "#f57c00", subtext: formatCurrency(peakRow.revenue) },
            { label: "Show Window Rev",    value: formatCurrency(showRevenue),           icon: <ShowChartIcon />,    color: "#1565c0", subtext: `${showPct}% of total (6:30 PM – 4 AM)` },
          ].map((kpi, i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <KpiCard {...kpi} />
            </Grid>
          ))}
        </Grid>

        {/* Chart */}
        <SectionCard
          title={hourlyBreakdown === "combined" ? "Revenue & Orders by Hour (EDT)" : "Revenue by Hour per Show (EDT)"}
          icon={<ScheduleIcon />}
          minHeight={320}
        >
          {hourlyBreakdown === "combined" ? (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData as HourlyCombinedRow[]} margin={{ top: 8, right: 24, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                {/* Show-window shading: midnight→4 AM and 6:30 PM→midnight */}
                <ReferenceArea x1={0}  x2={4}  fill="#e3f2fd" fillOpacity={0.5} />
                <ReferenceArea x1={18} x2={23} fill="#e3f2fd" fillOpacity={0.5} />
                <XAxis dataKey="hour" tickFormatter={h => hourLabel(Number(h))} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="rev" tickFormatter={kFormatter} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 10 }} />
                <RechartsTooltip
                  formatter={((v: number, name: string) =>
                    name === "Revenue" ? [formatCurrency(v), name] : [formatNumber(v), name]
                  ) as any}
                  labelFormatter={(h: number) => `${hourLabel(h)} EDT${isShowHour(h) ? " ▶ show window" : ""}`}
                />
                <Legend />
                <Bar yAxisId="rev" dataKey="revenue" name="Revenue" radius={[3, 3, 0, 0]}>
                  {filledCombined.map((r, i) => (
                    <Cell key={i} fill={r.hour === peakRow.hour ? "#f59e0b" : isShowHour(r.hour) ? "#e91e63" : "#ce93d8"} />
                  ))}
                </Bar>
                <Line yAxisId="ord" type="monotone" dataKey="orders" name="Orders" stroke="#1565c0" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <>
              {showNames.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No data — select show(s) or check date range.</Typography>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={byShowPivoted} margin={{ top: 8, right: 24, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <ReferenceArea x1={0}  x2={4}  fill="#e3f2fd" fillOpacity={0.5} />
                    <ReferenceArea x1={18} x2={23} fill="#e3f2fd" fillOpacity={0.5} />
                    <XAxis dataKey="hour" tickFormatter={h => hourLabel(Number(h))} tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={kFormatter} tick={{ fontSize: 10 }} />
                    <RechartsTooltip formatter={((v: number, name: string) => [formatCurrency(v), name]) as any} labelFormatter={(h: number) => `${hourLabel(h)} EDT`} />
                    <Legend />
                    {showNames.map((name, i) => (
                      <Bar key={name} dataKey={name} name={truncate(name, 20)} stackId="shows" fill={SHOW_COLORS[i % SHOW_COLORS.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </>
          )}

          {/* Legend note */}
          <Box display="flex" gap={2} mt={1.5} flexWrap="wrap">
            <Box display="flex" alignItems="center" gap={0.5}>
              <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: "#e3f2fd", border: "1px solid #90caf9" }} />
              <Typography variant="caption" color="text.secondary">Show window (6:30 PM – 4 AM)</Typography>
            </Box>
            {hourlyBreakdown === "combined" && (
              <>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: "#f59e0b" }} />
                  <Typography variant="caption" color="text.secondary">Peak hour</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: "#e91e63" }} />
                  <Typography variant="caption" color="text.secondary">Show hours</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: "#ce93d8" }} />
                  <Typography variant="caption" color="text.secondary">Off-show hours</Typography>
                </Box>
              </>
            )}
          </Box>
        </SectionCard>

        {/* Data table */}
        <SectionCard title="Hourly Breakdown Table" icon={<ReceiptIcon />}>
          <TableContainer sx={{ maxHeight: 360 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Hour (EDT)</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Window</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Orders</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Revenue</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Avg Order</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filledCombined.map((r, i) => (
                  <TableRow key={i} hover sx={{ bgcolor: r.hour === peakRow.hour ? "#fff8e1" : undefined }}>
                    <TableCell sx={{ fontSize: "0.75rem", fontWeight: 600 }}>{hourLabel(r.hour)}</TableCell>
                    <TableCell>
                      {isShowHour(r.hour)
                        ? <Chip label="Show" size="small" sx={{ bgcolor: "#fce4ec", color: "#c2185b", fontSize: "0.65rem" }} />
                        : <Chip label="Off" size="small" variant="outlined" sx={{ fontSize: "0.65rem" }} />
                      }
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: "0.75rem" }}>{formatNumber(r.orders)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: "0.75rem", fontWeight: r.hour === peakRow.hour ? 700 : 400 }}>{formatCurrency(r.revenue)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: "0.75rem" }}>{r.orders > 0 ? formatCurrency(r.revenue / r.orders) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </SectionCard>
      </Stack>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={1.5} mb={3}>
        <Box sx={{ bgcolor: "#e91e63", borderRadius: 2, p: 1, display: "flex" }}>
          <TrendingUpIcon sx={{ color: "#fff", fontSize: 28 }} />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>TikTok Fulfillment Analytics</Typography>
          <Typography variant="body2" color="text.secondary">Comprehensive analytics for TikTok fulfillment operations</Typography>
        </Box>
      </Box>

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} flexWrap="wrap">
          <TextField label="From" type="date" size="small" value={fromDate}
            onChange={e => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
          <TextField label="To" type="date" size="small" value={toDate}
            onChange={e => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Show (all)</InputLabel>
            <Select value={selectedShowId} label="Show (all)" onChange={e => setSelectedShowId(String(e.target.value))}>
              <MenuItem value="">All Shows</MenuItem>
              {shows.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" size="small" onClick={() => {
            setFromDate(formatDateInput(thirtyDaysAgo));
            setToDate(formatDateInput(now));
            setSelectedShowId("");
          }} sx={{ bgcolor: "#e91e63", "&:hover": { bgcolor: "#c2185b" } }}>Reset</Button>
          {loading && <CircularProgress size={20} sx={{ color: "#e91e63" }} />}
          {overview && (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Badge badgeContent={formatNumber(overview.reviewShipments)} color="error">
                <Chip label="Under Review" size="small" icon={<ErrorOutlineIcon />} />
              </Badge>
              <Badge badgeContent={formatNumber(overview.pendingShipments)} color="warning">
                <Chip label="Pending" size="small" icon={<HourglassEmptyIcon />} />
              </Badge>
            </Stack>
          )}
        </Stack>
      </Paper>

      {error && <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Tabs */}
      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: "divider", "& .MuiTab-root": { fontSize: "0.8rem" },
            "& .Mui-selected": { color: "#e91e63 !important" },
            "& .MuiTabs-indicator": { bgcolor: "#e91e63" } }}>
          {TAB_LABELS.map((label, i) => <Tab key={i} label={label} />)}
        </Tabs>
      </Paper>

      {/* Tab content */}
      <Box>
        {activeTab === 0 && renderOverviewTab()}
        {activeTab === 1 && renderSalesTab()}
        {activeTab === 2 && renderProfitabilityTab()}
        {activeTab === 3 && renderOperationsTab()}
        {activeTab === 4 && renderVelocityTab()}
        {activeTab === 5 && renderGeographyTab()}
        {activeTab === 6 && renderInventoryTab()}
        {activeTab === 7 && renderItemLookupTab()}
        {activeTab === 8 && renderHourlySalesTab()}
      </Box>
    </Box>
  );
}

export default TikTokFulfillmentAnalytics;

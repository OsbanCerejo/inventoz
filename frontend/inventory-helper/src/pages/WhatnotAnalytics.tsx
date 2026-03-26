import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
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
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { getApiUrl } from "../config/api";

type Granularity = "day" | "week" | "month";

interface WhatnotShow {
  id: number;
  name: string;
}

interface OverviewData {
  scanAttempts: number;
  unitsSold: number;
  foundScans: number;
  notFoundScans: number;
  multipleFoundScans: number;
  uniqueSkusSold: number;
  uniqueShowsWithSales: number;
  successRate: number;
}

interface TrendPoint {
  bucket: string;
  scanAttempts: number;
  unitsSold: number;
}

interface ShowPerformance {
  showId: number;
  showName: string;
  scanAttempts: number;
  foundScans: number;
  unitsSold: number;
  notFoundScans: number;
  multipleFoundScans: number;
}

interface TopProduct {
  sku: string;
  brand: string;
  itemName: string;
  strength: string | null;
  sizeOz: number | null;
  sizeMl: number | null;
  condition: string | null;
  tester: boolean | null;
  unitsSold: number;
}

interface BrandMixRow {
  brand: string;
  unitsSold: number;
}

interface OperationsUser {
  userId: string | null;
  scanAttempts: number;
  unitsSold: number;
  issueScans: number;
}

interface InventoryRisk {
  sku: string;
  brand: string;
  itemName: string;
  currentQty: number;
  unitsSoldLookback: number;
  avgDailySales: number;
  daysOfCover: number | null;
}

interface ShowHourlyRow {
  hourOfDay: number;
  scanAttempts: number;
  foundScans: number;
  notFoundScans: number;
  multipleFoundScans: number;
  unitsSold: number;
}

interface ParetoRow {
  sku: string;
  brand: string;
  itemName: string;
  unitsSold: number;
  cumulativeUnits: number;
  cumulativePct: number;
}

interface SkuTrendPoint {
  bucket: string;
  unitsSold: number;
}

interface OperationsHourlyRow {
  hourOfDay: number;
  scanAttempts: number;
  unitsSold: number;
  issueScans: number;
}

interface OperationsErrorTrendRow {
  bucket: string;
  notFoundScans: number;
  multipleFoundScans: number;
  totalIssueScans: number;
}

interface OperationsErrorTableRow {
  id: number;
  createdAt: string;
  userId: string | null;
  whatnotShowId: number | null;
  showName: string | null;
  barcode: string;
  sku: string | null;
  status: "not_found" | "multiple_found";
  errors?: string | null;
}

interface ProductVelocityRow {
  sku: string;
  brand: string;
  itemName: string;
  totalUnits: number;
  points: SkuTrendPoint[];
}

interface DayOfWeekRow {
  dayIndex: number;
  dayName: string;
  unitsSold: number;
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
}

interface FulfillmentTrendPoint {
  bucket: string;
  unitsSold: number;
  revenue: number;
  completedShipments: number;
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
  strength: string | null;
  sizeOz: number | null;
  sizeMl: number | null;
  condition: string | null;
  tester: boolean | null;
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

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

const formatNumber = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("en-US");

const formatCurrency = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const BRAND_COLORS = [
  "#1e88e5",
  "#43a047",
  "#8e24aa",
  "#fb8c00",
  "#e53935",
  "#00897b",
  "#3949ab",
  "#6d4c41",
  "#d81b60",
  "#546e7a",
];

const HorizontalBarList = ({
  items,
  labelKey,
  valueKey,
  maxItems = 10,
  barColor = "#1976d2",
  valueFormatter,
}: {
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
    return (
      <Typography variant="body2" color="text.secondary">
        No data available.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.25}>
      {rows.map((row, idx) => {
        const value = Number(row[valueKey] || 0);
        const widthPct = maxValue > 0 ? Math.max((value / maxValue) * 100, 2) : 0;
        return (
          <Box key={`${row[labelKey]}-${idx}`}>
            <Box display="flex" justifyContent="space-between" mb={0.4}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {row[labelKey] || "N/A"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {valueFormatter ? valueFormatter(value) : formatNumber(value)}
              </Typography>
            </Box>
            <Box sx={{ height: 9, borderRadius: 999, bgcolor: "#edf1f7", overflow: "hidden" }}>
              <Box
                sx={{
                  height: "100%",
                  width: `${widthPct}%`,
                  borderRadius: 999,
                  bgcolor: barColor,
                }}
              />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
};

function WhatnotAnalytics() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [fromDate, setFromDate] = useState(formatDateInput(thirtyDaysAgo));
  const [toDate, setToDate] = useState(formatDateInput(now));
  const [selectedShowId, setSelectedShowId] = useState<string>("");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [lookbackDays, setLookbackDays] = useState<number>(14);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedShowForInsights, setSelectedShowForInsights] = useState<string>("");

  const [shows, setShows] = useState<WhatnotShow[]>([]);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [fulfillmentOverview, setFulfillmentOverview] = useState<FulfillmentOverviewData | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [fulfillmentTrend, setFulfillmentTrend] = useState<FulfillmentTrendPoint[]>([]);
  const [showsPerformance, setShowsPerformance] = useState<ShowPerformance[]>([]);
  const [fulfillmentShowsPerformance, setFulfillmentShowsPerformance] = useState<FulfillmentShowPerformance[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [fulfillmentTopProducts, setFulfillmentTopProducts] = useState<FulfillmentTopProduct[]>([]);
  const [paretoRows, setParetoRows] = useState<ParetoRow[]>([]);
  const [paretoTotalUnits, setParetoTotalUnits] = useState(0);
  const [brandContributionRows, setBrandContributionRows] = useState<BrandMixRow[]>([]);
  const [brandContributionTotal, setBrandContributionTotal] = useState(0);
  const [productWeekdayRows, setProductWeekdayRows] = useState<DayOfWeekRow[]>([]);
  const [brandMix, setBrandMix] = useState<BrandMixRow[]>([]);
  const [fulfillmentBrandMix, setFulfillmentBrandMix] = useState<FulfillmentBrandMixRow[]>([]);
  const [fulfillmentSalesMix, setFulfillmentSalesMix] = useState<FulfillmentSalesMixRow[]>([]);
  const [operationsUsers, setOperationsUsers] = useState<OperationsUser[]>([]);
  const [riskRows, setRiskRows] = useState<InventoryRisk[]>([]);
  const [showHourlyRows, setShowHourlyRows] = useState<ShowHourlyRow[]>([]);
  const [showTopSkus, setShowTopSkus] = useState<TopProduct[]>([]);
  const [showBreakdownLoading, setShowBreakdownLoading] = useState(false);
  const [selectedProductSku, setSelectedProductSku] = useState("");
  const [skuTrendRows, setSkuTrendRows] = useState<SkuTrendPoint[]>([]);
  const [skuTrendLoading, setSkuTrendLoading] = useState(false);
  const [selectedOperationsUserId, setSelectedOperationsUserId] = useState("");
  const [operationsHourlyRows, setOperationsHourlyRows] = useState<OperationsHourlyRow[]>([]);
  const [operationsErrorTrendRows, setOperationsErrorTrendRows] = useState<OperationsErrorTrendRow[]>([]);
  const [operationsErrorRows, setOperationsErrorRows] = useState<OperationsErrorTableRow[]>([]);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [operationsStatusFilter, setOperationsStatusFilter] = useState<"all" | "not_found" | "multiple_found">("all");
  const [riskBandFilter, setRiskBandFilter] = useState<"all" | "critical" | "high" | "medium" | "stable" | "no_signal">("all");
  const [riskCoverageFilter, setRiskCoverageFilter] = useState<"all" | "3" | "7" | "14" | "30">("all");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    return {
      from: fromDate,
      to: toDate,
      showId: selectedShowId ? Number(selectedShowId) : undefined,
      granularity,
      lookbackDays,
      limit: 25,
    };
  }, [fromDate, toDate, selectedShowId, granularity, lookbackDays]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);

      const results = await Promise.allSettled([
        axios.get(getApiUrl("whatnot/analytics/fulfillment-overview"), { params }),
        axios.get(getApiUrl("whatnot/analytics/fulfillment-trend"), { params }),
        axios.get(getApiUrl("whatnot/analytics/fulfillment-shows"), { params }),
        axios.get(getApiUrl("whatnot/analytics/fulfillment-products-top"), { params }),
        axios.get(getApiUrl("whatnot/analytics/fulfillment-brand-mix"), { params: { ...params, limit: 12 } }),
        axios.get(getApiUrl("whatnot/analytics/fulfillment-sales-mix"), { params }),
        axios.get(getApiUrl("whatnot/analytics/overview"), { params }),
        axios.get(getApiUrl("whatnot/analytics/trend"), { params }),
        axios.get(getApiUrl("whatnot/analytics/shows-performance"), { params }),
        axios.get(getApiUrl("whatnot/analytics/products-top"), { params }),
        axios.get(getApiUrl("whatnot/analytics/products-pareto"), { params }),
        axios.get(getApiUrl("whatnot/analytics/products-brand-contribution"), { params }),
        axios.get(getApiUrl("whatnot/analytics/products-day-of-week"), { params }),
        axios.get(getApiUrl("whatnot/analytics/brand-mix"), { params }),
        axios.get(getApiUrl("whatnot/analytics/operations-users"), { params }),
        axios.get(getApiUrl("whatnot/analytics/inventory-risk"), { params }),
      ]);

      const [
        fulfillmentOverviewResult,
        fulfillmentTrendResult,
        fulfillmentShowsResult,
        fulfillmentTopProductsResult,
        fulfillmentBrandMixResult,
        fulfillmentSalesMixResult,
        overviewResult,
        trendResult,
        showsPerfResult,
        topProductsResult,
        paretoResult,
        brandContributionResult,
        weekdayResult,
        brandMixResult,
        operationsResult,
        riskResult,
      ] = results;

      if (fulfillmentOverviewResult.status === "fulfilled") setFulfillmentOverview(fulfillmentOverviewResult.value.data);
      if (fulfillmentTrendResult.status === "fulfilled") setFulfillmentTrend(fulfillmentTrendResult.value.data || []);
      if (fulfillmentShowsResult.status === "fulfilled") setFulfillmentShowsPerformance(fulfillmentShowsResult.value.data || []);
      if (fulfillmentTopProductsResult.status === "fulfilled") setFulfillmentTopProducts(fulfillmentTopProductsResult.value.data || []);
      if (fulfillmentBrandMixResult.status === "fulfilled") {
        const payload = fulfillmentBrandMixResult.value.data || {};
        setFulfillmentBrandMix(payload.rows || []);
      }
      if (fulfillmentSalesMixResult.status === "fulfilled") setFulfillmentSalesMix(fulfillmentSalesMixResult.value.data || []);
      if (overviewResult.status === "fulfilled") setOverview(overviewResult.value.data);
      if (trendResult.status === "fulfilled") setTrend(trendResult.value.data || []);
      if (showsPerfResult.status === "fulfilled") setShowsPerformance(showsPerfResult.value.data || []);
      if (topProductsResult.status === "fulfilled") setTopProducts(topProductsResult.value.data || []);
      if (paretoResult.status === "fulfilled") {
        const payload = paretoResult.value.data || {};
        setParetoRows(payload.rows || []);
        setParetoTotalUnits(Number(payload.totalUnits || 0));
      }
      if (brandContributionResult.status === "fulfilled") {
        const payload = brandContributionResult.value.data || {};
        setBrandContributionRows(payload.rows || []);
        setBrandContributionTotal(Number(payload.totalUnits || 0));
      }
      if (weekdayResult.status === "fulfilled") {
        setProductWeekdayRows(weekdayResult.value.data || []);
      }
      if (brandMixResult.status === "fulfilled") {
        const payload = brandMixResult.value.data || {};
        setBrandMix(payload.rows || []);
      }
      if (operationsResult.status === "fulfilled") setOperationsUsers(operationsResult.value.data || []);
      if (riskResult.status === "fulfilled") setRiskRows(riskResult.value.data || []);

      const failedEndpoints = [
        { name: "fulfillment-overview", result: fulfillmentOverviewResult },
        { name: "fulfillment-trend", result: fulfillmentTrendResult },
        { name: "fulfillment-shows", result: fulfillmentShowsResult },
        { name: "fulfillment-products-top", result: fulfillmentTopProductsResult },
        { name: "fulfillment-brand-mix", result: fulfillmentBrandMixResult },
        { name: "fulfillment-sales-mix", result: fulfillmentSalesMixResult },
        { name: "overview", result: overviewResult },
        { name: "trend", result: trendResult },
        { name: "shows-performance", result: showsPerfResult },
        { name: "products-top", result: topProductsResult },
        { name: "products-pareto", result: paretoResult },
        { name: "products-brand-contribution", result: brandContributionResult },
        { name: "products-day-of-week", result: weekdayResult },
        { name: "brand-mix", result: brandMixResult },
        { name: "operations-users", result: operationsResult },
        { name: "inventory-risk", result: riskResult },
      ].filter((entry) => entry.result.status === "rejected");

      if (failedEndpoints.length > 0) {
        const names = failedEndpoints.map((f) => f.name).join(", ");
        setError(`Some analytics panels failed to load: ${names}.`);
      }
    } catch (fetchError) {
      console.error("Error fetching Whatnot analytics:", fetchError);
      setError("Failed to load analytics data. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchShows = async () => {
      try {
        const response = await axios.get(getApiUrl("whatnot/shows"));
        setShows(response.data || []);
      } catch (showError) {
        console.error("Error loading shows for analytics:", showError);
      }
    };

    fetchShows();
  }, []);

  useEffect(() => {
    if (selectedShowForInsights) return;
    if (selectedShowId) {
      setSelectedShowForInsights(selectedShowId);
      return;
    }
    if (showsPerformance.length > 0) {
      setSelectedShowForInsights(String(showsPerformance[0].showId));
    }
  }, [selectedShowForInsights, selectedShowId, showsPerformance]);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    if (selectedProductSku) return;
    if (topProducts.length > 0) {
      setSelectedProductSku(topProducts[0].sku);
    }
  }, [selectedProductSku, topProducts]);

  useEffect(() => {
    if (selectedOperationsUserId) return;
    if (operationsUsers.length > 0) {
      setSelectedOperationsUserId(String(operationsUsers[0].userId || ""));
    }
  }, [selectedOperationsUserId, operationsUsers]);

  useEffect(() => {
    const fetchSkuTrend = async () => {
      if (!selectedProductSku) {
        setSkuTrendRows([]);
        return;
      }
      try {
        setSkuTrendLoading(true);
        const response = await axios.get(getApiUrl("whatnot/analytics/products-sku-trend"), {
          params: {
            from: fromDate,
            to: toDate,
            showId: selectedShowId ? Number(selectedShowId) : undefined,
            granularity,
            sku: selectedProductSku,
          },
        });
        setSkuTrendRows(response.data || []);
      } catch (err) {
        console.error("Error loading sku trend:", err);
        setSkuTrendRows([]);
      } finally {
        setSkuTrendLoading(false);
      }
    };

    fetchSkuTrend();
  }, [fromDate, toDate, selectedShowId, granularity, selectedProductSku]);

  useEffect(() => {
    const fetchOperationsBreakdown = async () => {
      try {
        setOperationsLoading(true);
        const [hourlyResp, errorsTrendResp, errorsTableResp] = await Promise.all([
          axios.get(getApiUrl("whatnot/analytics/operations-user-hourly"), {
            params: {
              from: fromDate,
              to: toDate,
              showId: selectedShowId ? Number(selectedShowId) : undefined,
              userId: selectedOperationsUserId || undefined,
            },
          }),
          axios.get(getApiUrl("whatnot/analytics/operations-errors-trend"), {
            params: {
              from: fromDate,
              to: toDate,
              showId: selectedShowId ? Number(selectedShowId) : undefined,
              userId: selectedOperationsUserId || undefined,
              granularity,
            },
          }),
          axios.get(getApiUrl("whatnot/analytics/operations-errors-table"), {
            params: {
              from: fromDate,
              to: toDate,
              showId: selectedShowId ? Number(selectedShowId) : undefined,
              userId: selectedOperationsUserId || undefined,
              status: operationsStatusFilter === "all" ? undefined : operationsStatusFilter,
              limit: 100,
            },
          }),
        ]);

        setOperationsHourlyRows(hourlyResp.data || []);
        setOperationsErrorTrendRows(errorsTrendResp.data || []);
        setOperationsErrorRows(errorsTableResp.data || []);
      } catch (err) {
        console.error("Error loading operations section analytics:", err);
      } finally {
        setOperationsLoading(false);
      }
    };

    fetchOperationsBreakdown();
  }, [fromDate, toDate, selectedShowId, selectedOperationsUserId, operationsStatusFilter, granularity]);

  useEffect(() => {
    const fetchShowBreakdown = async () => {
      if (!selectedShowForInsights) {
        setShowHourlyRows([]);
        setShowTopSkus([]);
        return;
      }

      try {
        setShowBreakdownLoading(true);
        const [hourlyResp, topSkuResp] = await Promise.all([
          axios.get(getApiUrl("whatnot/analytics/shows-hourly"), {
            params: {
              from: fromDate,
              to: toDate,
              showId: Number(selectedShowForInsights),
            },
          }),
          axios.get(getApiUrl("whatnot/analytics/shows-top-skus"), {
            params: {
              from: fromDate,
              to: toDate,
              showId: Number(selectedShowForInsights),
              limit: 15,
            },
          }),
        ]);
        setShowHourlyRows(hourlyResp.data || []);
        setShowTopSkus(topSkuResp.data || []);
      } catch (err) {
        console.error("Error fetching show breakdown analytics:", err);
      } finally {
        setShowBreakdownLoading(false);
      }
    };

    fetchShowBreakdown();
  }, [fromDate, toDate, selectedShowForInsights]);

  const trendMax = useMemo(() => {
    return trend.reduce((max, p) => Math.max(max, Number(p.unitsSold || 0)), 0);
  }, [trend]);

  const fulfillmentTrendRevenueMax = useMemo(() => {
    return fulfillmentTrend.reduce((max, p) => Math.max(max, Number(p.revenue || 0)), 0);
  }, [fulfillmentTrend]);

  const fulfillmentBrandMixTotalRevenue = useMemo(
    () => fulfillmentBrandMix.reduce((sum, row) => sum + Number(row.revenue || 0), 0),
    [fulfillmentBrandMix]
  );

  const fulfillmentBrandMixWithPct = useMemo(() => {
    if (fulfillmentBrandMixTotalRevenue === 0) return [];
    return fulfillmentBrandMix.map((row, idx) => ({
      ...row,
      color: BRAND_COLORS[idx % BRAND_COLORS.length],
      pct: (Number(row.revenue || 0) / fulfillmentBrandMixTotalRevenue) * 100,
    }));
  }, [fulfillmentBrandMix, fulfillmentBrandMixTotalRevenue]);

  const fulfillmentBrandDonutGradient = useMemo(() => {
    if (fulfillmentBrandMixWithPct.length === 0) return "#e6edf5";
    let cumulative = 0;
    const parts = fulfillmentBrandMixWithPct.map((row) => {
      const start = cumulative;
      cumulative += row.pct;
      const end = Math.min(cumulative, 100);
      return `${row.color} ${start}% ${end}%`;
    });
    return `conic-gradient(${parts.join(", ")})`;
  }, [fulfillmentBrandMixWithPct]);

  const fulfillmentSalesMixTotalRevenue = useMemo(
    () => fulfillmentSalesMix.reduce((sum, row) => sum + Number(row.revenue || 0), 0),
    [fulfillmentSalesMix]
  );

  const brandMixTotal = useMemo(
    () => brandMix.reduce((sum, row) => sum + Number(row.unitsSold || 0), 0),
    [brandMix]
  );

  const brandMixWithPct = useMemo(() => {
    if (brandMixTotal === 0) return [];
    return brandMix.map((row, idx) => ({
      ...row,
      color: row.brand === "Other" ? "#90a4ae" : BRAND_COLORS[idx % BRAND_COLORS.length],
      pct: (Number(row.unitsSold || 0) / brandMixTotal) * 100,
    }));
  }, [brandMix, brandMixTotal]);

  const brandLegendRows = useMemo(() => {
    if (brandMixWithPct.length === 0) return [];
    const otherRow = brandMixWithPct.find((row) => row.brand === "Other");
    const nonOtherRows = brandMixWithPct.filter((row) => row.brand !== "Other");
    const capped = nonOtherRows.slice(0, 19);
    if (otherRow) {
      capped.push({ ...otherRow, brand: "Other (remaining brands)" });
    }
    return capped;
  }, [brandMixWithPct]);

  const donutGradient = useMemo(() => {
    if (brandMixWithPct.length === 0) return "#e6edf5";
    let cumulative = 0;
    const parts = brandMixWithPct.map((row) => {
      const start = cumulative;
      cumulative += row.pct;
      const end = Math.min(cumulative, 100);
      return `${row.color} ${start}% ${end}%`;
    });
    return `conic-gradient(${parts.join(", ")})`;
  }, [brandMixWithPct]);

  const showStatusRows = useMemo(() => {
    return showsPerformance.slice(0, 12).map((show) => {
      const attempts = Number(show.scanAttempts || 0);
      const found = Number(show.foundScans || 0);
      const notFound = Number(show.notFoundScans || 0);
      const multiple = Number(show.multipleFoundScans || 0);
      const safeTotal = attempts > 0 ? attempts : found + notFound + multiple;
      return {
        ...show,
        foundPct: safeTotal > 0 ? (found / safeTotal) * 100 : 0,
        multiplePct: safeTotal > 0 ? (multiple / safeTotal) * 100 : 0,
        notFoundPct: safeTotal > 0 ? (notFound / safeTotal) * 100 : 0,
      };
    });
  }, [showsPerformance]);

  const hourlyMap = useMemo(() => {
    const map = new Map<number, ShowHourlyRow>();
    showHourlyRows.forEach((row) => map.set(Number(row.hourOfDay), row));
    return map;
  }, [showHourlyRows]);

  const hourlyMax = useMemo(() => {
    return Math.max(1, ...showHourlyRows.map((r) => Number(r.scanAttempts || 0)));
  }, [showHourlyRows]);

  const skuTrendMax = useMemo(() => {
    return Math.max(1, ...skuTrendRows.map((r) => Number(r.unitsSold || 0)));
  }, [skuTrendRows]);

  const selectedProductDetails = useMemo(() => {
    return topProducts.find((p) => p.sku === selectedProductSku) || null;
  }, [topProducts, selectedProductSku]);

  const operationsHourlyMap = useMemo(() => {
    const map = new Map<number, OperationsHourlyRow>();
    operationsHourlyRows.forEach((row) => map.set(Number(row.hourOfDay), row));
    return map;
  }, [operationsHourlyRows]);

  const operationsHourlyMax = useMemo(
    () => Math.max(1, ...operationsHourlyRows.map((r) => Number(r.unitsSold || 0))),
    [operationsHourlyRows]
  );

  const errorTrendMax = useMemo(
    () => Math.max(1, ...operationsErrorTrendRows.map((r) => Number(r.totalIssueScans || 0))),
    [operationsErrorTrendRows]
  );

  const riskRowsEnriched = useMemo(() => {
    return riskRows
      .map((row) => {
        const days = row.daysOfCover === null || row.daysOfCover === undefined ? null : Number(row.daysOfCover);
        const avgDaily = Number(row.avgDailySales || 0);
        const currentQty = Number(row.currentQty || 0);

        let riskBand: "critical" | "high" | "medium" | "stable" | "no_signal" = "stable";
        if (days === null || avgDaily <= 0) {
          riskBand = "no_signal";
        } else if (days <= 3) {
          riskBand = "critical";
        } else if (days <= 7) {
          riskBand = "high";
        } else if (days <= 14) {
          riskBand = "medium";
        } else {
          riskBand = "stable";
        }

        const base =
          riskBand === "critical"
            ? 100
            : riskBand === "high"
            ? 75
            : riskBand === "medium"
            ? 50
            : riskBand === "stable"
            ? 25
            : 0;
        const velocityFactor = Math.min(avgDaily * 6, 30);
        const stockPenalty = currentQty <= 0 ? 20 : currentQty <= 5 ? 10 : 0;
        const priorityScore = Math.round(base + velocityFactor + stockPenalty);

        return {
          ...row,
          riskBand,
          priorityScore,
        };
      })
      .sort((a, b) => Number(b.priorityScore || 0) - Number(a.priorityScore || 0));
  }, [riskRows]);

  const riskBandCounts = useMemo(() => {
    const counts = {
      critical: 0,
      high: 0,
      medium: 0,
      stable: 0,
      no_signal: 0,
    };
    riskRowsEnriched.forEach((row) => {
      counts[row.riskBand] += 1;
    });
    return counts;
  }, [riskRowsEnriched]);

  const filteredRiskRows = useMemo(() => {
    const coverageThreshold =
      riskCoverageFilter === "all" ? null : Number(riskCoverageFilter);

    return riskRowsEnriched.filter((row) => {
      if (riskBandFilter !== "all" && row.riskBand !== riskBandFilter) {
        return false;
      }

      if (coverageThreshold !== null) {
        if (row.daysOfCover === null || row.daysOfCover === undefined) {
          return false;
        }
        if (Number(row.daysOfCover) > coverageThreshold) {
          return false;
        }
      }

      return true;
    });
  }, [riskRowsEnriched, riskBandFilter, riskCoverageFilter]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, mt: 2 }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 3 },
          mb: 2.5,
          borderRadius: 3,
          background: "linear-gradient(135deg, #f8fbff 0%, #f2f8ff 55%, #fff9f2 100%)",
          border: "1px solid #dbe6f3",
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          Whatnot Analytics
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Admin dashboard for scan activity, unit sales, show performance, SKU velocity, and inventory risk.
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="From"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="To"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel id="analytics-show-label">Show</InputLabel>
              <Select
                labelId="analytics-show-label"
                label="Show"
                value={selectedShowId}
                onChange={(e) => setSelectedShowId(String(e.target.value))}
              >
                <MenuItem value="">All Shows</MenuItem>
                {shows.map((show) => (
                  <MenuItem key={show.id} value={String(show.id)}>
                    {show.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel id="analytics-granularity-label">Granularity</InputLabel>
              <Select
                labelId="analytics-granularity-label"
                label="Granularity"
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as Granularity)}
              >
                <MenuItem value="day">Daily</MenuItem>
                <MenuItem value="week">Weekly</MenuItem>
                <MenuItem value="month">Monthly</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel id="analytics-lookback-label">Risk Lookback</InputLabel>
              <Select
                labelId="analytics-lookback-label"
                label="Risk Lookback"
                value={lookbackDays}
                onChange={(e) => setLookbackDays(Number(e.target.value))}
              >
                <MenuItem value={7}>7 days</MenuItem>
                <MenuItem value={14}>14 days</MenuItem>
                <MenuItem value={30}>30 days</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && ((activeTab === 0 && fulfillmentOverview) || (activeTab !== 0 && overview)) && (
        <>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            {(activeTab === 0
              ? [
                  { label: "Revenue", value: formatCurrency(fulfillmentOverview?.revenue || 0), color: "#0b6bcb" },
                  { label: "Units Sold", value: fulfillmentOverview?.unitsSold || 0, color: "#1f7a1f" },
                  { label: "Avg Sold Price", value: formatCurrency(fulfillmentOverview?.avgSoldPrice || 0), color: "#6a1b9a" },
                  { label: "Completed Shipments", value: fulfillmentOverview?.completedShipments || 0, color: "#ef6c00" },
                  { label: "Pending Revenue", value: formatCurrency(fulfillmentOverview?.pendingRevenue || 0), color: "#00838f" },
                  { label: "Review Revenue", value: formatCurrency(fulfillmentOverview?.reviewRevenue || 0), color: "#c62828" },
                ]
              : [
                  { label: "Units Sold", value: overview.unitsSold, color: "#1f7a1f" },
                  { label: "Scan Attempts", value: overview.scanAttempts, color: "#1565c0" },
                  { label: "Success Rate", value: `${overview.successRate}%`, color: "#6a1b9a" },
                  { label: "Unique SKUs Sold", value: overview.uniqueSkusSold, color: "#ef6c00" },
                  { label: "Unique Shows", value: overview.uniqueShowsWithSales, color: "#00838f" },
                  { label: "Issue Scans", value: Number(overview.notFoundScans || 0) + Number(overview.multipleFoundScans || 0), color: "#c62828" },
                ]
            ).map((metric) => (
              <Grid item xs={12} sm={6} md={4} lg={2} key={metric.label}>
                <Card sx={{ borderRadius: 2, border: "1px solid #e3e8ef" }}>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">
                      {metric.label}
                    </Typography>
                    <Typography variant="h5" sx={{ mt: 0.6, color: metric.color, fontWeight: 700 }}>
                      {typeof metric.value === "number" ? formatNumber(metric.value) : metric.value}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Paper sx={{ borderRadius: 2, mb: 2.5 }}>
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
              <Tab label="Fulfillment Sales" />
              <Tab label="Overview" />
              <Tab label="Shows" />
              <Tab label="Products" />
              <Tab label="Operations" />
              <Tab label="Inventory Risk" />
            </Tabs>
          </Paper>

          {activeTab === 0 && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={8}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Revenue Trend ({granularity})
                  </Typography>
                  {fulfillmentTrend.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No fulfillment sales data in this date range.
                    </Typography>
                  ) : (
                    <Stack spacing={1.1}>
                      {fulfillmentTrend.map((point) => {
                        const widthPct =
                          fulfillmentTrendRevenueMax > 0
                            ? Math.max((Number(point.revenue || 0) / fulfillmentTrendRevenueMax) * 100, 2)
                            : 0;
                        return (
                          <Box key={point.bucket}>
                            <Box display="flex" justifyContent="space-between" mb={0.25}>
                              <Typography variant="body2">{point.bucket}</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {formatCurrency(point.revenue)} | {formatNumber(point.unitsSold)} units
                              </Typography>
                            </Box>
                            <Box sx={{ height: 8, bgcolor: "#ebf1f8", borderRadius: 999, overflow: "hidden" }}>
                              <Box sx={{ width: `${widthPct}%`, height: "100%", bgcolor: "#1565c0", borderRadius: 999 }} />
                            </Box>
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Brand Revenue Mix
                  </Typography>
                  {fulfillmentBrandMixWithPct.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No brand revenue data in this range.
                    </Typography>
                  ) : (
                    <>
                      <Box display="flex" justifyContent="center" sx={{ my: 1.5 }}>
                        <Box
                          sx={{
                            width: 170,
                            height: 170,
                            borderRadius: "50%",
                            background: fulfillmentBrandDonutGradient,
                            position: "relative",
                          }}
                        >
                          <Box
                            sx={{
                              position: "absolute",
                              inset: 24,
                              borderRadius: "50%",
                              bgcolor: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              textAlign: "center",
                              px: 1,
                            }}
                          >
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                              {formatCurrency(fulfillmentBrandMixTotalRevenue)}
                              <br />
                              Revenue
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      <Stack spacing={0.8}>
                        {fulfillmentBrandMixWithPct.slice(0, 10).map((row) => (
                          <Box key={row.brand} display="flex" justifyContent="space-between" alignItems="center">
                            <Box display="flex" alignItems="center" gap={1}>
                              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: row.color }} />
                              <Typography variant="body2">{row.brand}</Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {row.pct.toFixed(1)}%
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </>
                  )}
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Revenue by Show
                  </Typography>
                  {fulfillmentShowsPerformance.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No show revenue data in this range.
                    </Typography>
                  ) : (
                    <Stack spacing={1.1}>
                      {fulfillmentShowsPerformance.slice(0, 8).map((show) => {
                        const maxRevenue = Math.max(
                          1,
                          ...fulfillmentShowsPerformance.map((entry) => Number(entry.revenue || 0))
                        );
                        const widthPct = Math.max((Number(show.revenue || 0) / maxRevenue) * 100, 2);
                        return (
                          <Box key={show.showId}>
                            <Box display="flex" justifyContent="space-between" mb={0.25}>
                              <Typography variant="body2">{show.showName}</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {formatCurrency(show.revenue)}
                              </Typography>
                            </Box>
                            <Box sx={{ height: 8, bgcolor: "#ebf1f8", borderRadius: 999, overflow: "hidden" }}>
                              <Box sx={{ width: `${widthPct}%`, height: "100%", bgcolor: "#00838f", borderRadius: 999 }} />
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              {formatNumber(show.unitsSold)} units | {formatNumber(show.completedShipments)} shipments
                            </Typography>
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Top SKUs by Revenue
                  </Typography>
                  {fulfillmentTopProducts.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No fulfilled SKU revenue data in this range.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {fulfillmentTopProducts.slice(0, 8).map((product) => (
                        <Box key={product.sku} sx={{ py: 0.6, borderBottom: "1px solid #edf1f7" }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {product.brand} {product.itemName}
                          </Typography>
                          <Box display="flex" justifyContent="space-between">
                            <Typography variant="caption" color="text.secondary">
                              {product.sku}
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                              {formatCurrency(product.revenue)}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {formatNumber(product.unitsSold)} units | Avg {formatCurrency(product.avgSoldPrice)}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Paper>
              </Grid>
              <Grid item xs={12} md={7}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Sales Mix by Order Type
                  </Typography>
                  <HorizontalBarList
                    items={fulfillmentSalesMix}
                    labelKey="contextType"
                    valueKey="revenue"
                    barColor="#6a1b9a"
                    maxItems={6}
                    valueFormatter={formatCurrency}
                  />
                </Paper>
              </Grid>
              <Grid item xs={12} md={5}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Fulfillment Pipeline Value
                  </Typography>
                  <Stack spacing={1.3}>
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f7fbff", border: "1px solid #d7e7fb" }}>
                      <Typography variant="caption" color="text.secondary">
                        Pending Shipments
                      </Typography>
                      <Typography variant="h6" sx={{ color: "#1565c0", fontWeight: 700 }}>
                        {formatNumber(fulfillmentOverview?.pendingShipments || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatCurrency(fulfillmentOverview?.pendingRevenue || 0)} waiting to be fulfilled
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#fff7f2", border: "1px solid #f5ddca" }}>
                      <Typography variant="caption" color="text.secondary">
                        Under Review
                      </Typography>
                      <Typography variant="h6" sx={{ color: "#ef6c00", fontWeight: 700 }}>
                        {formatNumber(fulfillmentOverview?.reviewShipments || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatCurrency(fulfillmentOverview?.reviewRevenue || 0)} blocked in review
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f5fff7", border: "1px solid #d8efdc" }}>
                      <Typography variant="caption" color="text.secondary">
                        Unique SKUs Sold
                      </Typography>
                      <Typography variant="h6" sx={{ color: "#2e7d32", fontWeight: 700 }}>
                        {formatNumber(fulfillmentOverview?.uniqueSkusSold || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Across {formatNumber(fulfillmentOverview?.uniqueShows || 0)} shows in this period
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          )}

          {activeTab === 2 && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={8}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Sales Trend ({granularity})
                  </Typography>
                  {trend.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No trend data in this date range.
                    </Typography>
                  ) : (
                    <Stack spacing={1.1}>
                      {trend.map((point) => {
                        const widthPct = trendMax > 0 ? Math.max((Number(point.unitsSold || 0) / trendMax) * 100, 2) : 0;
                        return (
                          <Box key={point.bucket}>
                            <Box display="flex" justifyContent="space-between" mb={0.25}>
                              <Typography variant="body2">{point.bucket}</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {formatNumber(point.unitsSold)} sold
                              </Typography>
                            </Box>
                            <Box sx={{ height: 8, bgcolor: "#ebf1f8", borderRadius: 999, overflow: "hidden" }}>
                              <Box sx={{ width: `${widthPct}%`, height: "100%", bgcolor: "#2e7d32", borderRadius: 999 }} />
                            </Box>
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Brand Mix
                  </Typography>
                  {brandMixWithPct.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No brand sales data in this range.
                    </Typography>
                  ) : (
                    <>
                      <Box display="flex" justifyContent="center" sx={{ my: 1.5 }}>
                        <Box
                          sx={{
                            width: 170,
                            height: 170,
                            borderRadius: "50%",
                            background: donutGradient,
                            position: "relative",
                          }}
                        >
                          <Box
                            sx={{
                              position: "absolute",
                              inset: 24,
                              borderRadius: "50%",
                              bgcolor: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              textAlign: "center",
                              px: 1,
                            }}
                          >
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                              {formatNumber(brandMixTotal)}
                              <br />
                              Units Sold
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      <Stack spacing={0.8}>
                        {brandLegendRows.map((row) => (
                          <Box key={row.brand} display="flex" justifyContent="space-between" alignItems="center">
                            <Box display="flex" alignItems="center" gap={1}>
                              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: row.color }} />
                              <Typography variant="body2">{row.brand}</Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {row.pct.toFixed(1)}%
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </>
                  )}
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Top Shows
                  </Typography>
                  <HorizontalBarList
                    items={showsPerformance}
                    labelKey="showName"
                    valueKey="unitsSold"
                    barColor="#1565c0"
                    maxItems={8}
                  />
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Top SKUs
                  </Typography>
                  {topProducts.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No SKU sales data in this range.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {topProducts.slice(0, 8).map((product) => (
                        <Box key={product.sku} sx={{ py: 0.6, borderBottom: "1px solid #edf1f7" }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {product.brand} {product.itemName}
                          </Typography>
                          <Box display="flex" justifyContent="space-between">
                            <Typography variant="caption" color="text.secondary">
                              {product.sku}
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                              {formatNumber(product.unitsSold)} sold
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Paper>
              </Grid>
            </Grid>
          )}

          {activeTab === 1 && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Units Sold by Show
                  </Typography>
                  <HorizontalBarList
                    items={showsPerformance}
                    labelKey="showName"
                    valueKey="unitsSold"
                    barColor="#1565c0"
                    maxItems={12}
                  />
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Scan Status Mix by Show
                  </Typography>
                  <Stack spacing={1.2}>
                    {showStatusRows.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        No show status data for this period.
                      </Typography>
                    )}
                    {showStatusRows.map((row) => (
                      <Box key={row.showId}>
                        <Box display="flex" justifyContent="space-between" mb={0.4}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {row.showName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatNumber(row.scanAttempts)} scans
                          </Typography>
                        </Box>
                        <Box sx={{ height: 10, borderRadius: 999, bgcolor: "#eef2f7", overflow: "hidden", display: "flex" }}>
                          <Box sx={{ width: `${row.foundPct}%`, bgcolor: "#2e7d32" }} />
                          <Box sx={{ width: `${row.multiplePct}%`, bgcolor: "#f57c00" }} />
                          <Box sx={{ width: `${row.notFoundPct}%`, bgcolor: "#d32f2f" }} />
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                  <Box mt={1.5} display="flex" gap={1.5} flexWrap="wrap">
                    <Chip size="small" label="Found" sx={{ bgcolor: "#2e7d32", color: "#fff" }} />
                    <Chip size="small" label="Multiple Found" sx={{ bgcolor: "#f57c00", color: "#fff" }} />
                    <Chip size="small" label="Not Found" sx={{ bgcolor: "#d32f2f", color: "#fff" }} />
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} flexWrap="wrap" gap={1}>
                    <Typography variant="h6">Selected Show Breakdown</Typography>
                    <FormControl sx={{ minWidth: 260 }}>
                      <InputLabel id="show-breakdown-label">Show</InputLabel>
                      <Select
                        labelId="show-breakdown-label"
                        label="Show"
                        value={selectedShowForInsights}
                        onChange={(e) => setSelectedShowForInsights(String(e.target.value))}
                      >
                        {showsPerformance.map((show) => (
                          <MenuItem key={show.showId} value={String(show.showId)}>
                            {show.showName}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  {showBreakdownLoading && (
                    <Box sx={{ py: 2, display: "flex", justifyContent: "center" }}>
                      <CircularProgress size={24} />
                    </Box>
                  )}

                  {!showBreakdownLoading && (
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                          <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>
                            Hourly Scan Heatmap
                          </Typography>
                          <Grid container spacing={1}>
                            {Array.from({ length: 24 }).map((_, hour) => {
                              const row = hourlyMap.get(hour);
                              const attempts = Number(row?.scanAttempts || 0);
                              const intensity = attempts > 0 ? attempts / hourlyMax : 0;
                              const bgColor =
                                attempts === 0
                                  ? "#edf2f7"
                                  : `rgba(33, 150, 243, ${Math.max(0.2, intensity)})`;
                              return (
                                <Grid item xs={3} sm={2} md={3} lg={2} key={hour}>
                                  <Box
                                    sx={{
                                      borderRadius: 1.5,
                                      border: "1px solid #dfe7f1",
                                      bgcolor: bgColor,
                                      px: 0.8,
                                      py: 1,
                                      textAlign: "center",
                                    }}
                                  >
                                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                      {hour.toString().padStart(2, "0")}:00
                                    </Typography>
                                    <Typography variant="body2">{formatNumber(attempts)}</Typography>
                                  </Box>
                                </Grid>
                              );
                            })}
                          </Grid>
                        </Paper>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: "100%", maxHeight: 420, overflow: "auto" }}>
                          <Typography variant="subtitle1" sx={{ mb: 1.2, fontWeight: 700 }}>
                            Top SKUs in Selected Show
                          </Typography>
                          {showTopSkus.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                              No SKU sales data for this show in the selected period.
                            </Typography>
                          ) : (
                            <Stack spacing={1}>
                              {showTopSkus.map((skuRow) => (
                                <Box key={skuRow.sku} sx={{ py: 0.75, borderBottom: "1px solid #edf1f7" }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {skuRow.brand} {skuRow.itemName}
                                  </Typography>
                                  <Box display="flex" justifyContent="space-between">
                                    <Typography variant="caption" color="text.secondary">
                                      {skuRow.sku}
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                      {formatNumber(skuRow.unitsSold)} sold
                                    </Typography>
                                  </Box>
                                </Box>
                              ))}
                            </Stack>
                          )}
                        </Paper>
                      </Grid>
                    </Grid>
                  )}
                </Paper>
              </Grid>
            </Grid>
          )}

          {activeTab === 3 && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Pareto (Top SKUs + Cumulative)
                  </Typography>
                  {paretoRows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No pareto data available.
                    </Typography>
                  ) : (
                    <Stack spacing={1.1}>
                      {paretoRows.slice(0, 12).map((row, idx) => {
                        const contributionPct = paretoTotalUnits > 0 ? (Number(row.unitsSold || 0) / paretoTotalUnits) * 100 : 0;
                        return (
                          <Box key={`${row.sku}-${idx}`}>
                            <Box display="flex" justifyContent="space-between" mb={0.35}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {row.sku}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatNumber(row.unitsSold)} ({contributionPct.toFixed(1)}%) | Cum: {Number(row.cumulativePct || 0).toFixed(1)}%
                              </Typography>
                            </Box>
                            <Box sx={{ height: 8, borderRadius: 999, bgcolor: "#edf2f7", overflow: "hidden" }}>
                              <Box sx={{ height: "100%", width: `${Math.min(100, contributionPct)}%`, bgcolor: "#00838f" }} />
                            </Box>
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%", maxHeight: 520, overflow: "auto" }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Sales by Day of Week
                  </Typography>
                  {productWeekdayRows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No day-of-week sales data available.
                    </Typography>
                  ) : (
                    <HorizontalBarList
                      items={productWeekdayRows}
                      labelKey="dayName"
                      valueKey="unitsSold"
                      barColor="#00838f"
                      maxItems={7}
                    />
                  )}
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Selected SKU Trend ({granularity})
                  </Typography>
                  {skuTrendLoading ? (
                    <Box sx={{ py: 2, display: "flex", justifyContent: "center" }}>
                      <CircularProgress size={22} />
                    </Box>
                  ) : skuTrendRows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No trend points for selected SKU.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {skuTrendRows.map((point) => {
                        const val = Number(point.unitsSold || 0);
                        const widthPct = skuTrendMax > 0 ? Math.max((val / skuTrendMax) * 100, 2) : 0;
                        return (
                          <Box key={point.bucket}>
                            <Box display="flex" justifyContent="space-between" mb={0.25}>
                              <Typography variant="body2">{point.bucket}</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {formatNumber(val)}
                              </Typography>
                            </Box>
                            <Box sx={{ height: 8, borderRadius: 999, bgcolor: "#eef2f7", overflow: "hidden" }}>
                              <Box sx={{ height: "100%", width: `${widthPct}%`, bgcolor: "#6a1b9a" }} />
                            </Box>
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%", maxHeight: 520, overflow: "auto" }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Product Drilldown
                  </Typography>
                  <FormControl fullWidth sx={{ mb: 1.25 }}>
                    <InputLabel id="product-sku-select-label">SKU</InputLabel>
                    <Select
                      labelId="product-sku-select-label"
                      label="SKU"
                      value={selectedProductSku}
                      onChange={(e) => setSelectedProductSku(String(e.target.value))}
                    >
                      {topProducts.map((product) => (
                        <MenuItem key={product.sku} value={product.sku}>
                          {product.sku} - {product.brand} {product.itemName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {selectedProductDetails ? (
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        {selectedProductDetails.brand} {selectedProductDetails.itemName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                        {selectedProductDetails.sku}
                      </Typography>
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Strength</Typography>
                          <Typography variant="body2">{selectedProductDetails.strength || "N/A"}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Size</Typography>
                          <Typography variant="body2">
                            {selectedProductDetails.sizeOz
                              ? `${selectedProductDetails.sizeOz} oz`
                              : selectedProductDetails.sizeMl
                              ? `${selectedProductDetails.sizeMl} ml`
                              : "N/A"}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Condition</Typography>
                          <Typography variant="body2">{selectedProductDetails.condition || "N/A"}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Tester</Typography>
                          <Typography variant="body2">{selectedProductDetails.tester ? "Yes" : "No"}</Typography>
                        </Grid>
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary">Units Sold (Top table)</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {formatNumber(selectedProductDetails.unitsSold)}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Select a SKU to view details.
                    </Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>
          )}

          {activeTab === 4 && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Units Sold by User
                  </Typography>
                  <HorizontalBarList
                    items={operationsUsers.map((u) => ({
                      ...u,
                      userLabel: u.userId || "Unknown User",
                    }))}
                    labelKey="userLabel"
                    valueKey="unitsSold"
                    barColor="#6a1b9a"
                    maxItems={12}
                  />
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} flexWrap="wrap" gap={1}>
                    <Typography variant="h6">Hourly Productivity</Typography>
                    <FormControl sx={{ minWidth: 220 }}>
                      <InputLabel id="operations-user-label">User</InputLabel>
                      <Select
                        labelId="operations-user-label"
                        label="User"
                        value={selectedOperationsUserId}
                        onChange={(e) => setSelectedOperationsUserId(String(e.target.value))}
                      >
                        <MenuItem value="">All Users</MenuItem>
                        {operationsUsers.map((u) => (
                          <MenuItem key={`${u.userId || "unknown"}-${u.scanAttempts}`} value={String(u.userId || "")}>
                            {u.userId || "Unknown User"}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                  <Grid container spacing={1}>
                    {Array.from({ length: 24 }).map((_, hour) => {
                      const row = operationsHourlyMap.get(hour);
                      const unitsSold = Number(row?.unitsSold || 0);
                      const widthPct = operationsHourlyMax > 0 ? Math.max((unitsSold / operationsHourlyMax) * 100, 2) : 0;
                      return (
                        <Grid item xs={6} sm={4} md={3} key={hour}>
                          <Box sx={{ p: 0.8, border: "1px solid #e1e8f0", borderRadius: 1.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                              {hour.toString().padStart(2, "0")}:00
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Sold: {formatNumber(unitsSold)}
                            </Typography>
                            <Box sx={{ height: 6, borderRadius: 999, bgcolor: "#eef1f6", overflow: "hidden", mt: 0.5 }}>
                              <Box sx={{ width: `${widthPct}%`, height: "100%", bgcolor: "#6a1b9a" }} />
                            </Box>
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Error Trend ({granularity})
                  </Typography>
                  {operationsErrorTrendRows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No error trend data in this period.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {operationsErrorTrendRows.map((row) => {
                        const total = Number(row.totalIssueScans || 0);
                        const widthPct = errorTrendMax > 0 ? Math.max((total / errorTrendMax) * 100, 2) : 0;
                        return (
                          <Box key={row.bucket}>
                            <Box display="flex" justifyContent="space-between" mb={0.3}>
                              <Typography variant="body2">{row.bucket}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                Total: {formatNumber(total)} | Not found: {formatNumber(row.notFoundScans)} | Multiple: {formatNumber(row.multipleFoundScans)}
                              </Typography>
                            </Box>
                            <Box sx={{ height: 8, borderRadius: 999, bgcolor: "#f0f3f8", overflow: "hidden" }}>
                              <Box sx={{ width: `${widthPct}%`, height: "100%", bgcolor: "#c62828" }} />
                            </Box>
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.2} flexWrap="wrap" gap={1}>
                    <Typography variant="h6">Error Records</Typography>
                    <FormControl sx={{ minWidth: 190 }}>
                      <InputLabel id="operations-status-filter-label">Status</InputLabel>
                      <Select
                        labelId="operations-status-filter-label"
                        label="Status"
                        value={operationsStatusFilter}
                        onChange={(e) => setOperationsStatusFilter(e.target.value as any)}
                      >
                        <MenuItem value="all">All Issues</MenuItem>
                        <MenuItem value="not_found">Not Found</MenuItem>
                        <MenuItem value="multiple_found">Multiple Found</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                  {operationsLoading ? (
                    <Box sx={{ py: 2, display: "flex", justifyContent: "center" }}>
                      <CircularProgress size={22} />
                    </Box>
                  ) : operationsErrorRows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No error records found for selected filters.
                    </Typography>
                  ) : (
                    <Box sx={{ maxHeight: 380, overflow: "auto" }}>
                      {operationsErrorRows.map((row) => (
                        <Box key={row.id} sx={{ py: 0.9, borderBottom: "1px solid #edf1f7" }}>
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {row.status}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(row.createdAt).toLocaleString()}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Show: {row.showName || row.whatnotShowId || "N/A"} | User: {row.userId || "N/A"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Barcode: {row.barcode} | SKU: {row.sku || "N/A"}
                          </Typography>
                          {row.errors && (
                            <Typography variant="caption" color="error.main" display="block">
                              {row.errors}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                </Paper>
              </Grid>
            </Grid>
          )}

          {activeTab === 5 && (
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Inventory Run-Out Risk
              </Typography>
              <Grid container spacing={1} sx={{ mb: 1.5 }}>
                <Grid item>
                  <Chip label={`Critical: ${riskBandCounts.critical}`} sx={{ bgcolor: "#d32f2f", color: "#fff" }} />
                </Grid>
                <Grid item>
                  <Chip label={`High: ${riskBandCounts.high}`} sx={{ bgcolor: "#ef6c00", color: "#fff" }} />
                </Grid>
                <Grid item>
                  <Chip label={`Medium: ${riskBandCounts.medium}`} sx={{ bgcolor: "#f9a825", color: "#fff" }} />
                </Grid>
                <Grid item>
                  <Chip label={`Stable: ${riskBandCounts.stable}`} sx={{ bgcolor: "#2e7d32", color: "#fff" }} />
                </Grid>
                <Grid item>
                  <Chip label={`No Signal: ${riskBandCounts.no_signal}`} variant="outlined" />
                </Grid>
              </Grid>
              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel id="risk-band-filter-label">Risk Band</InputLabel>
                    <Select
                      labelId="risk-band-filter-label"
                      label="Risk Band"
                      value={riskBandFilter}
                      onChange={(e) => setRiskBandFilter(e.target.value as any)}
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="critical">Critical</MenuItem>
                      <MenuItem value="high">High</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="stable">Stable</MenuItem>
                      <MenuItem value="no_signal">No Signal</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel id="risk-cover-filter-label">Days of Cover</InputLabel>
                    <Select
                      labelId="risk-cover-filter-label"
                      label="Days of Cover"
                      value={riskCoverageFilter}
                      onChange={(e) => setRiskCoverageFilter(e.target.value as any)}
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="3">3 days or less</MenuItem>
                      <MenuItem value="7">7 days or less</MenuItem>
                      <MenuItem value="14">14 days or less</MenuItem>
                      <MenuItem value="30">30 days or less</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              <Box sx={{ maxHeight: 560, overflow: "auto" }}>
                <Grid container sx={{ px: 1, py: 1, fontWeight: 700, borderBottom: "2px solid #e0e7ef" }}>
                  <Grid item xs={3}><Typography variant="caption">SKU</Typography></Grid>
                  <Grid item xs={2}><Typography variant="caption">Risk Band</Typography></Grid>
                  <Grid item xs={1}><Typography variant="caption">Score</Typography></Grid>
                  <Grid item xs={2}><Typography variant="caption">Current Qty</Typography></Grid>
                  <Grid item xs={2}><Typography variant="caption">Sold ({lookbackDays}d)</Typography></Grid>
                  <Grid item xs={2}><Typography variant="caption">Avg Daily</Typography></Grid>
                  <Grid item xs={1}><Typography variant="caption">Days Of Cover</Typography></Grid>
                </Grid>
                {filteredRiskRows.map((row) => (
                  <Grid container key={row.sku} sx={{ px: 1, py: 1, borderBottom: "1px solid #edf1f7" }}>
                    <Grid item xs={3}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.sku}</Typography>
                      <Typography variant="caption" color="text.secondary">{row.brand}</Typography>
                    </Grid>
                    <Grid item xs={2}>
                      <Chip
                        size="small"
                        label={
                          row.riskBand === "no_signal"
                            ? "No Signal"
                            : row.riskBand.charAt(0).toUpperCase() + row.riskBand.slice(1)
                        }
                        sx={{
                          bgcolor:
                            row.riskBand === "critical"
                              ? "#d32f2f"
                              : row.riskBand === "high"
                              ? "#ef6c00"
                              : row.riskBand === "medium"
                              ? "#f9a825"
                              : row.riskBand === "stable"
                              ? "#2e7d32"
                              : "#eceff1",
                          color: row.riskBand === "no_signal" ? "#37474f" : "#fff",
                        }}
                      />
                    </Grid>
                    <Grid item xs={1}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formatNumber(row.priorityScore)}
                      </Typography>
                    </Grid>
                    <Grid item xs={2}><Typography variant="body2">{formatNumber(row.currentQty)}</Typography></Grid>
                    <Grid item xs={2}><Typography variant="body2">{formatNumber(row.unitsSoldLookback)}</Typography></Grid>
                    <Grid item xs={2}><Typography variant="body2">{formatNumber(row.avgDailySales)}</Typography></Grid>
                    <Grid item xs={1}>
                      <Typography variant="body2" color={row.daysOfCover !== null && row.daysOfCover <= 7 ? "error.main" : "text.primary"}>
                        {row.daysOfCover === null ? "No sales signal" : `${row.daysOfCover} days`}
                      </Typography>
                    </Grid>
                  </Grid>
                ))}
                {filteredRiskRows.length === 0 && (
                  <Box sx={{ py: 3, textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      No rows match current risk filters.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}

export default WhatnotAnalytics;

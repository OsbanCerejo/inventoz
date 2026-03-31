
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
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

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);
const formatNumber = (value: number | string | null | undefined) => Number(value || 0).toLocaleString("en-US");
const formatCurrency = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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
  const [salesMix, setSalesMix] = useState<FulfillmentSalesMixRow[]>([]);
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

  const brandMixTotalRevenue = useMemo(() => brandMix.reduce((sum, row) => sum + Number(row.revenue || 0), 0), [brandMix]);
  const brandMixWithPct = useMemo(() => {
    if (brandMixTotalRevenue === 0) return [];
    return brandMix.map((row, idx) => ({
      ...row,
      color: BRAND_COLORS[idx % BRAND_COLORS.length],
      pct: (Number(row.revenue || 0) / brandMixTotalRevenue) * 100,
    }));
  }, [brandMix, brandMixTotalRevenue]);

  const brandDonutGradient = useMemo(() => {
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

  const overviewMetrics = [
    { label: "Revenue", value: formatCurrency(overview?.revenue || 0), color: "#0b6bcb" },
    { label: "Units Sold", value: overview?.unitsSold || 0, color: "#1f7a1f" },
    { label: "Avg Sold Price", value: formatCurrency(overview?.avgSoldPrice || 0), color: "#6a1b9a" },
    { label: "Completed Shipments", value: overview?.completedShipments || 0, color: "#ef6c00" },
    { label: "Pending Revenue", value: formatCurrency(overview?.pendingRevenue || 0), color: "#00838f" },
    { label: "Review Revenue", value: formatCurrency(overview?.reviewRevenue || 0), color: "#c62828" },
  ];

  const renderOverviewTab = () => (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Grid container spacing={2}>
          {overviewMetrics.map((metric) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={metric.label}>
              <Card sx={{ borderRadius: 2, border: "1px solid #e3e8ef" }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">{metric.label}</Typography>
                  <Typography variant="h5" sx={{ mt: 0.6, color: metric.color, fontWeight: 700 }}>
                    {typeof metric.value === "number" ? formatNumber(metric.value) : metric.value}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Grid>

      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Fulfillment Pipeline Value</Typography>
          <Stack spacing={1.3}>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f7fbff", border: "1px solid #d7e7fb" }}>
              <Typography variant="caption" color="text.secondary">Pending Shipments</Typography>
              <Typography variant="h6" sx={{ color: "#1565c0", fontWeight: 700 }}>{formatNumber(overview?.pendingShipments || 0)}</Typography>
              <Typography variant="body2" color="text.secondary">{formatCurrency(overview?.pendingRevenue || 0)} waiting to be fulfilled</Typography>
            </Box>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#fff7f2", border: "1px solid #f5ddca" }}>
              <Typography variant="caption" color="text.secondary">Under Review</Typography>
              <Typography variant="h6" sx={{ color: "#ef6c00", fontWeight: 700 }}>{formatNumber(overview?.reviewShipments || 0)}</Typography>
              <Typography variant="body2" color="text.secondary">{formatCurrency(overview?.reviewRevenue || 0)} blocked in review</Typography>
            </Box>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f5fff7", border: "1px solid #d8efdc" }}>
              <Typography variant="caption" color="text.secondary">Unique SKUs Sold</Typography>
              <Typography variant="h6" sx={{ color: "#2e7d32", fontWeight: 700 }}>{formatNumber(overview?.uniqueSkusSold || 0)}</Typography>
              <Typography variant="body2" color="text.secondary">Across {formatNumber(overview?.uniqueShows || 0)} shows in this period</Typography>
            </Box>
          </Stack>
        </Paper>
      </Grid>

      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Profitability Snapshot</Typography>
          {!profitabilityOverview ? (
            <Typography variant="body2" color="text.secondary">No profitability data available for this range.</Typography>
          ) : (
            <Stack spacing={1.2}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f5fff7", border: "1px solid #d8efdc" }}>
                <Typography variant="caption" color="text.secondary">Net Profit After Whatnot Fees</Typography>
                <Typography variant="h6" sx={{ color: "#2e7d32", fontWeight: 700 }}>{formatCurrency(profitabilityOverview.netMarginAfterFees)}</Typography>
                <Typography variant="body2" color="text.secondary">{profitabilityOverview.netMarginAfterFeesPct}% on {formatCurrency(profitabilityOverview.knownCostRevenue)} cost-known revenue</Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#fff7f2", border: "1px solid #f5ddca" }}>
                <Typography variant="caption" color="text.secondary">Whatnot Took So Far</Typography>
                <Typography variant="h6" sx={{ color: "#ef6c00", fontWeight: 700 }}>{formatCurrency(profitabilityOverview.whatnotFees)}</Typography>
                <Typography variant="body2" color="text.secondary">Includes 8% commission plus estimated processing fees</Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f7fbff", border: "1px solid #d7e7fb" }}>
                <Typography variant="caption" color="text.secondary">Gross Margin Before Fees</Typography>
                <Typography variant="h6" sx={{ color: "#1565c0", fontWeight: 700 }}>{formatCurrency(profitabilityOverview.grossMargin)}</Typography>
                <Typography variant="body2" color="text.secondary">{profitabilityOverview.grossMarginPct}% before Whatnot fees</Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#fff5f5", border: "1px solid #f3d4d4" }}>
                <Typography variant="caption" color="text.secondary">Cost Coverage</Typography>
                <Typography variant="h6" sx={{ color: "#c62828", fontWeight: 700 }}>{formatNumber(profitabilityOverview.knownCostUnits)} known / {formatNumber(profitabilityOverview.unknownCostUnits)} unknown</Typography>
                <Typography variant="body2" color="text.secondary">{formatCurrency(profitabilityOverview.unknownCostRevenue)} sits in cost price not known</Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#fff5f5", border: "1px solid #f3d4d4" }}>
                <Typography variant="caption" color="text.secondary">Margin Risk Units</Typography>
                <Typography variant="h6" sx={{ color: "#c62828", fontWeight: 700 }}>{formatNumber(profitabilityOverview.negativeMarginUnits + profitabilityOverview.lowMarginUnits)}</Typography>
                <Typography variant="body2" color="text.secondary">{formatNumber(profitabilityOverview.negativeMarginUnits)} negative and {formatNumber(profitabilityOverview.lowMarginUnits)} low-margin units</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Payment processing is estimated from item sold price plus $0.30 per fulfilled shipment. Shipping and tax are not stored in fulfillment imports.
              </Typography>
            </Stack>
          )}
        </Paper>
      </Grid>
    </Grid>
  );

  const renderSalesTab = () => (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Brand Revenue Mix</Typography>
          {brandMixWithPct.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No brand revenue data in this range.</Typography>
          ) : (
            <>
              <Box display="flex" justifyContent="center" sx={{ my: 1.5 }}>
                <Box sx={{ width: 170, height: 170, borderRadius: "50%", background: brandDonutGradient, position: "relative" }}>
                  <Box sx={{ position: "absolute", inset: 24, borderRadius: "50%", bgcolor: "#fff", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", px: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>{formatCurrency(brandMixTotalRevenue)}<br />Revenue</Typography>
                  </Box>
                </Box>
              </Box>
              <Stack spacing={0.8}>
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

      <Grid item xs={12} md={8}>
        <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Revenue by Show</Typography>
          {showsPerformance.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No show revenue data in this range.</Typography>
          ) : (
            <Stack spacing={1.1}>
              {showsPerformance.slice(0, 8).map((show) => {
                const maxRevenue = Math.max(1, ...showsPerformance.map((entry) => Number(entry.revenue || 0)));
                const widthPct = Math.max((Number(show.revenue || 0) / maxRevenue) * 100, 2);
                return (
                  <Box key={show.showId}>
                    <Box display="flex" justifyContent="space-between" mb={0.25}>
                      <Typography variant="body2">{show.showName}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(show.revenue)}</Typography>
                    </Box>
                    <Box sx={{ height: 8, bgcolor: "#ebf1f8", borderRadius: 999, overflow: "hidden" }}>
                      <Box sx={{ width: `${widthPct}%`, height: "100%", bgcolor: "#00838f", borderRadius: 999 }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">{formatNumber(show.unitsSold)} units | {formatNumber(show.completedShipments)} shipments</Typography>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Paper>
      </Grid>

      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Top SKUs by Revenue</Typography>
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

      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Sales Mix by Order Type</Typography>
          <HorizontalBarList items={salesMix} labelKey="contextType" valueKey="revenue" barColor="#6a1b9a" maxItems={6} valueFormatter={formatCurrency} />
        </Paper>
      </Grid>
    </Grid>
  );

  const renderProfitabilityTab = () => (
    <Grid container spacing={2}>
      <Grid item xs={12} md={7}>
        <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Margin by Show</Typography>
          {profitabilityShows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No show profitability data in this range.</Typography>
          ) : (
            <Stack spacing={1.1}>
              {profitabilityShows.map((show) => {
                const maxMargin = Math.max(1, ...profitabilityShows.map((entry) => Number(entry.netMarginAfterFees || 0)));
                const widthPct = Math.max((Number(show.netMarginAfterFees || 0) / maxMargin) * 100, 2);
                return (
                  <Box key={show.showId}>
                    <Box display="flex" justifyContent="space-between" mb={0.25}>
                      <Typography variant="body2">{show.showName}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(show.netMarginAfterFees)}</Typography>
                    </Box>
                    <Box sx={{ height: 8, bgcolor: "#ebf1f8", borderRadius: 999, overflow: "hidden" }}>
                      <Box sx={{ width: `${widthPct}%`, height: "100%", bgcolor: "#2e7d32", borderRadius: 999 }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">{show.netMarginAfterFeesPct}% after fees | Whatnot took {formatCurrency(show.whatnotFees)}</Typography>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Paper>
      </Grid>

      <Grid item xs={12} md={5}>
        <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Cost Price Not Known</Typography>
          {!profitabilityOverview ? (
            <Typography variant="body2" color="text.secondary">No profitability coverage data available for this range.</Typography>
          ) : (
            <Stack spacing={1.2}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#fff8e8", border: "1px solid #f2ddb1" }}>
                <Typography variant="caption" color="text.secondary">Unknown Cost Revenue</Typography>
                <Typography variant="h6" sx={{ color: "#a15c00", fontWeight: 700 }}>{formatCurrency(profitabilityOverview.unknownCostRevenue)}</Typography>
                <Typography variant="body2" color="text.secondary">{formatNumber(profitabilityOverview.unknownCostUnits)} units are excluded from margin %</Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f7fbff", border: "1px solid #d7e7fb" }}>
                <Typography variant="caption" color="text.secondary">Cost-Known Revenue</Typography>
                <Typography variant="h6" sx={{ color: "#1565c0", fontWeight: 700 }}>{formatCurrency(profitabilityOverview.knownCostRevenue)}</Typography>
                <Typography variant="body2" color="text.secondary">Margin is calculated only on these {formatNumber(profitabilityOverview.knownCostUnits)} units</Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f5fff7", border: "1px solid #d8efdc" }}>
                <Typography variant="caption" color="text.secondary">Estimated Vendor Cost</Typography>
                <Typography variant="h6" sx={{ color: "#2e7d32", fontWeight: 700 }}>{formatCurrency(profitabilityOverview.estimatedCost)}</Typography>
                <Typography variant="body2" color="text.secondary">Based on active vendor price records only</Typography>
              </Box>
            </Stack>
          )}
        </Paper>
      </Grid>
    </Grid>
  );

  const renderOperationsTab = () => (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Review Queue Aging</Typography>
          <HorizontalBarList items={reviewAging} labelKey="ageBucket" valueKey="shipmentCount" barColor="#ef6c00" maxItems={4} />
        </Paper>
      </Grid>

      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Top Review Reasons</Typography>
          <HorizontalBarList items={reviewReasons} labelKey="mismatchReason" valueKey="shipmentCount" barColor="#c62828" maxItems={8} />
        </Paper>
      </Grid>
      <Grid item xs={12}>
        <Paper sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Review Queue Shipments</Typography>
          {reviewShipments.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No shipments are currently pending review.</Typography>
          ) : (
            <Box sx={{ maxHeight: 420, overflow: "auto" }}>
              {reviewShipments.map((shipment) => (
                <Box key={`${shipment.showId}-${shipment.importId}-${shipment.shipmentId}`} sx={{ py: 1, borderBottom: "1px solid #edf1f7" }}>
                  <Box display="flex" justifyContent="space-between" gap={2} flexWrap="wrap">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{shipment.showName || `Show ${shipment.showId}`} | Shipment {shipment.shipmentId}</Typography>
                    <Typography variant="caption" color="text.secondary">{shipment.ageDays} day(s) old | {formatCurrency(shipment.affectedRevenue)}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block">Tracking: {shipment.tracking || "N/A"} | Expected: {formatNumber(shipment.expectedQty)} | Scanned: {formatNumber(shipment.scannedQty)}</Typography>
                  <Typography variant="caption" color="error.main" display="block">{shipment.mismatchReason}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      </Grid>
    </Grid>
  );

  const renderInventoryTab = () => (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Paper sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Inventory Exposure</Typography>
          {inventoryExposure.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No sold SKU inventory exposure data found for this range.</Typography>
          ) : (
            <Box sx={{ maxHeight: 480, overflow: "auto" }}>
              <Grid container sx={{ px: 1, py: 1, fontWeight: 700, borderBottom: "2px solid #e0e7ef" }}>
                <Grid item xs={3}><Typography variant="caption">SKU</Typography></Grid>
                <Grid item xs={2}><Typography variant="caption">Risk</Typography></Grid>
                <Grid item xs={1}><Typography variant="caption">Qty</Typography></Grid>
                <Grid item xs={1}><Typography variant="caption">Min</Typography></Grid>
                <Grid item xs={1}><Typography variant="caption">Sold</Typography></Grid>
                <Grid item xs={2}><Typography variant="caption">Avg Daily</Typography></Grid>
                <Grid item xs={1}><Typography variant="caption">Cover</Typography></Grid>
                <Grid item xs={2}><Typography variant="caption">Margin</Typography></Grid>
              </Grid>
              {inventoryExposure.map((row) => (
                <Grid container key={row.sku} sx={{ px: 1, py: 1, borderBottom: "1px solid #edf1f7" }}>
                  <Grid item xs={3}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.sku}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.brand}</Typography>
                  </Grid>
                  <Grid item xs={2}>
                    <Box sx={{ display: "inline-block", px: 1, py: 0.4, borderRadius: 999, bgcolor: riskColorMap[row.riskBand], color: "#fff", fontSize: 12, fontWeight: 700, textTransform: "capitalize" }}>
                      {row.riskBand === "no_signal" ? "No Signal" : row.riskBand}
                    </Box>
                  </Grid>
                  <Grid item xs={1}><Typography variant="body2">{formatNumber(row.currentQty)}</Typography></Grid>
                  <Grid item xs={1}><Typography variant="body2">{row.minimumQuantity === null ? "-" : formatNumber(row.minimumQuantity)}</Typography></Grid>
                  <Grid item xs={1}><Typography variant="body2">{formatNumber(row.unitsSold)}</Typography></Grid>
                  <Grid item xs={2}><Typography variant="body2">{formatNumber(row.avgDailySales)}</Typography></Grid>
                  <Grid item xs={1}>
                    <Typography variant="body2" color={row.daysOfCover !== null && row.daysOfCover <= 7 ? "error.main" : "text.primary"}>
                      {row.daysOfCover === null ? "-" : row.daysOfCover}
                    </Typography>
                  </Grid>
                  <Grid item xs={2}>
                    <Typography variant="body2">{row.grossMargin === null ? "Unknown" : formatCurrency(row.grossMargin)}</Typography>
                    {row.unknownCostUnits > 0 && <Typography variant="caption" color="text.secondary">{formatNumber(row.unknownCostUnits)} cost unknown</Typography>}
                  </Grid>
                </Grid>
              ))}
            </Box>
          )}
        </Paper>
      </Grid>
    </Grid>
  );

  const renderItemLookupTab = () => (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Paper sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Item Lookup
          </Typography>
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
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {skuDetail.product.sku}
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {skuDetail.product.brand || "Unknown"} {skuDetail.product.itemName || ""}
                  </Typography>
                  <Grid container spacing={1.5} sx={{ mt: 1 }}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">
                        Strength
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {skuDetail.product.strength || "-"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">
                        Size
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {skuDetail.product.sizeOz || skuDetail.product.sizeMl || "-"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">
                        Condition
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {skuDetail.product.condition || "-"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">
                        Tester
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {skuDetail.product.tester ? "Yes" : "No"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">
                        Location
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {skuDetail.product.location || "-"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Typography variant="caption" color="text.secondary">
                        On Hand
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {skuDetail.product.quantity ?? "-"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Typography variant="caption" color="text.secondary">
                        Min Qty
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {skuDetail.product.minimumQuantity ?? "-"}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Typography variant="caption" color="text.secondary">Known Cost Basis</Typography>
                  <Typography variant="h6" sx={{ color: "#2e7d32", fontWeight: 700 }}>
                    {skuDetail.product.averagePrice === null ? "Unknown" : formatCurrency(skuDetail.product.averagePrice)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
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
            <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Sales by Show</Typography>
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
            <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Price Range</Typography>
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
            <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Day of Week</Typography>
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
            <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Daily Sales Pattern</Typography>
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

          <Grid item xs={12}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Recent Sale Activity</Typography>
              <Box sx={{ maxHeight: 420, overflow: "auto" }}>
                {skuDetail.recentSales.map((sale) => (
                  <Box key={sale.id} sx={{ py: 1, borderBottom: "1px solid #edf1f7" }}>
                    <Box display="flex" justifyContent="space-between" gap={2} flexWrap="wrap">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {sale.showName || "Unknown Show"} | Shipment {sale.shipmentId || "N/A"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(sale.createdAt).toLocaleString()} | {formatCurrency(sale.soldPrice)}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Tracking: {sale.tracking || "N/A"} | Sticker: {sale.auctionStickerNumber || "N/A"} | User: {sale.userId || "N/A"}
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

      <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel id="fulfillment-show-label">Show</InputLabel>
              <Select labelId="fulfillment-show-label" label="Show" value={selectedShowId} onChange={(e) => setSelectedShowId(String(e.target.value))}>
                <MenuItem value="">All Shows</MenuItem>
                {shows.map((show) => <MenuItem key={show.id} value={String(show.id)}>{show.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel shrink htmlFor="fulfillment-from-date">From</InputLabel>
              <input id="fulfillment-from-date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ height: 56, borderRadius: 4, border: "1px solid #c4cdd5", padding: "0 14px" }} />
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel shrink htmlFor="fulfillment-to-date">To</InputLabel>
              <input id="fulfillment-to-date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ height: 56, borderRadius: 4, border: "1px solid #c4cdd5", padding: "0 14px" }} />
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>}

      {!loading && overview && (
        <>
          <Paper sx={{ mb: 2.5, borderRadius: 2, overflow: "hidden" }}>
            <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} variant="scrollable" scrollButtons="auto">
              {tabLabels.map((label) => <Tab key={label} label={label} />)}
            </Tabs>
          </Paper>
          {renderActiveTab()}
        </>
      )}
    </Box>
  );
}

export default WhatnotFulfillmentAnalytics;


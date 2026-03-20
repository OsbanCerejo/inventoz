import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { getApiUrl } from "../config/api";

interface Overview {
  totalBoxesPacked: number;
  totalBoxesPackedMonSat: number;
  activePackers: number;
  activeBusinessDaysMonSat: number;
  activePackerDaysMonSat: number;
  scheduledHoursBusinessDaysMonSat: number;
  scheduledHoursActivePackerDaysMonSat: number;
  avgBoxesPerBusinessDayMonSat: number;
  avgBoxesPerActivePackerDayMonSat: number;
  avgBoxesPerScheduledHourMonSat: number;
  avgBoxesPerActivePackerScheduledHourMonSat: number;
  monFriBoxesPacked: number;
  monFriActiveDays: number;
  monFriAvgBoxesPerDay: number;
  monFriAvgBoxesPerHour8: number;
  saturdayBoxesPacked: number;
  saturdayActiveDays: number;
  saturdayAvgBoxesPerDay: number;
  saturdayAvgBoxesPerHour8: number;
  sundayBoxesPacked: number;
  sundayActiveDays: number;
  sundayAvgBoxesPerDay: number;
  sundayAvgBoxesPerHour8: number;
  firstScanAt: string | null;
  lastScanAt: string | null;
  peakHour: string | null;
  peakHourBoxes: number;
}

interface TrendRow {
  bucket: string;
  boxesPacked: number;
}

interface PackerRow {
  userId: number | null;
  userLabel: string;
  boxesPacked: number;
  firstScanAt: string;
  lastScanAt: string;
  activeHours: number;
  boxesPerHour: number;
  scheduledHoursMonSat?: number;
  boxesPerScheduledHourMonSat?: number;
}

interface WeekdayRow {
  dayIndex: number;
  dayName: string;
  boxesPacked: number;
}

interface HeatmapRow {
  dayIndex: number;
  hourOfDay: number;
  boxesPacked: number;
}

interface DuplicateRow {
  barcode: string;
  scanCount: number;
  distinctUsers: number;
  firstScanAt: string;
  lastScanAt: string;
}

interface PackerDailyRow {
  bucket: string;
  userId: number;
  userLabel: string;
  boxesPacked: number;
}

interface DuplicateByUserRow {
  userId: number;
  userLabel: string;
  rawScans: number;
  uniqueBarcodes: number;
  duplicateExtraScans: number;
  duplicateRatePct: number;
}

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);
const formatNumber = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("en-US");
const formatPct = (value: number) => `${Number(value || 0).toFixed(1)}%`;
const MAX_PACKERS_SUPPORTED = 5;

const HorizontalBarList = ({
  items,
  labelKey,
  valueKey,
  color = "#1565c0",
  maxItems = 12,
}: {
  items: Record<string, any>[];
  labelKey: string;
  valueKey: string;
  color?: string;
  maxItems?: number;
}) => {
  const rows = items.slice(0, maxItems);
  const max = Math.max(1, ...rows.map((r) => Number(r[valueKey] || 0)));
  if (rows.length === 0) {
    return <Typography variant="body2" color="text.secondary">No data.</Typography>;
  }

  return (
    <Stack spacing={1.1}>
      {rows.map((row, idx) => {
        const value = Number(row[valueKey] || 0);
        const width = Math.max((value / max) * 100, 2);
        return (
          <Box key={`${row[labelKey]}-${idx}`}>
            <Box display="flex" justifyContent="space-between" mb={0.35}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {row[labelKey]}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatNumber(value)}
              </Typography>
            </Box>
            <Box sx={{ height: 8, borderRadius: 999, bgcolor: "#edf1f7", overflow: "hidden" }}>
              <Box sx={{ height: "100%", width: `${width}%`, bgcolor: color, borderRadius: 999 }} />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
};

const SimpleLineChart = ({
  data,
  color = "#1565c0",
  height = 220,
}: {
  data: Array<{ label: string; value: number }>;
  color?: string;
  height?: number;
}) => {
  const width = 800;
  const padding = 28;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const maxValue = Math.max(1, ...data.map((d) => Number(d.value || 0)));
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return <Typography variant="body2" color="text.secondary">No data.</Typography>;
  }

  const points = data.map((d, i) => {
    const x = data.length === 1 ? width / 2 : padding + (i * usableWidth) / (data.length - 1);
    const y = padding + usableHeight - (Number(d.value || 0) / maxValue) * usableHeight;
    return { x, y, label: d.label, value: Number(d.value || 0) };
  });
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;
  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let minDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - mouseX);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  };

  return (
    <Box>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padding + usableHeight - tick * usableHeight;
          return (
            <line
              key={`grid-${tick}`}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#e6edf5"
              strokeWidth="1"
            />
          );
        })}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="3"
          points={polylinePoints}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {activePoint && (
          <>
            <line
              x1={activePoint.x}
              y1={padding}
              x2={activePoint.x}
              y2={height - padding}
              stroke="#90a4ae"
              strokeDasharray="4 3"
              strokeWidth="1"
            />
            <circle cx={activePoint.x} cy={activePoint.y} r="4.5" fill={color} />
            <rect
              x={Math.min(Math.max(activePoint.x + 10, padding), width - 170)}
              y={Math.max(activePoint.y - 44, 8)}
              width="160"
              height="36"
              rx="6"
              fill="#111827"
              opacity="0.9"
            />
            <text
              x={Math.min(Math.max(activePoint.x + 18, padding + 8), width - 162)}
              y={Math.max(activePoint.y - 27, 24)}
              fill="#f9fafb"
              fontSize="11"
            >
              {activePoint.label}: {formatNumber(activePoint.value)}
            </text>
          </>
        )}
      </svg>
      <Box display="flex" justifyContent="space-between" mt={0.5}>
        <Typography variant="caption" color="text.secondary">
          {data[0]?.label || ""}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {data[data.length - 1]?.label || ""}
        </Typography>
      </Box>
    </Box>
  );
};

const DualLineChart = ({
  actual,
  rolling,
  actualColor = "#1565c0",
  rollingColor = "#2e7d32",
  height = 240,
  actualLabel = "Daily Actual",
  rollingLabel = "Rolling 7-Day Avg",
}: {
  actual: Array<{ label: string; value: number }>;
  rolling: Array<{ label: string; value: number }>;
  actualColor?: string;
  rollingColor?: string;
  height?: number;
  actualLabel?: string;
  rollingLabel?: string;
}) => {
  const width = 860;
  const padding = 28;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const maxValue = Math.max(
    1,
    ...actual.map((d) => Number(d.value || 0)),
    ...rolling.map((d) => Number(d.value || 0))
  );
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (actual.length === 0) {
    return <Typography variant="body2" color="text.secondary">No data.</Typography>;
  }

  const toPoints = (data: Array<{ label: string; value: number }>) =>
    data.map((d, i) => {
      const x = data.length === 1 ? width / 2 : padding + (i * usableWidth) / (data.length - 1);
      const y = padding + usableHeight - (Number(d.value || 0) / maxValue) * usableHeight;
      return { x, y, label: d.label, value: Number(d.value || 0) };
    });
  const actualPoints = toPoints(actual);
  const rollingPoints = toPoints(rolling);
  const actualPolyline = actualPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const rollingPolyline = rollingPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const activeActual = hoverIndex !== null ? actualPoints[hoverIndex] : null;
  const activeRolling = hoverIndex !== null ? rollingPoints[hoverIndex] : null;
  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let minDist = Infinity;
    actualPoints.forEach((p, i) => {
      const dist = Math.abs(p.x - mouseX);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  };

  return (
    <Box>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padding + usableHeight - tick * usableHeight;
          return (
            <line
              key={`grid-${tick}`}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#e6edf5"
              strokeWidth="1"
            />
          );
        })}
        <polyline
          fill="none"
          stroke={actualColor}
          strokeWidth="3"
          points={actualPolyline}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          fill="none"
          stroke={rollingColor}
          strokeWidth="3"
          points={rollingPolyline}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {activeActual && activeRolling && (
          <>
            <line
              x1={activeActual.x}
              y1={padding}
              x2={activeActual.x}
              y2={height - padding}
              stroke="#90a4ae"
              strokeDasharray="4 3"
              strokeWidth="1"
            />
            <circle cx={activeActual.x} cy={activeActual.y} r="4.5" fill={actualColor} />
            <circle cx={activeRolling.x} cy={activeRolling.y} r="4.5" fill={rollingColor} />
            <rect
              x={Math.min(Math.max(activeActual.x + 10, padding), width - 220)}
              y={Math.max(Math.min(activeActual.y, activeRolling.y) - 52, 8)}
              width="210"
              height="46"
              rx="6"
              fill="#111827"
              opacity="0.9"
            />
            <text
              x={Math.min(Math.max(activeActual.x + 18, padding + 8), width - 212)}
              y={Math.max(Math.min(activeActual.y, activeRolling.y) - 36, 24)}
              fill="#f9fafb"
              fontSize="11"
            >
              {activeActual.label}
            </text>
            <text
              x={Math.min(Math.max(activeActual.x + 18, padding + 8), width - 212)}
              y={Math.max(Math.min(activeActual.y, activeRolling.y) - 22, 38)}
              fill="#93c5fd"
              fontSize="11"
            >
              {actualLabel}: {formatNumber(activeActual.value)}
            </text>
            <text
              x={Math.min(Math.max(activeActual.x + 18, padding + 8), width - 212)}
              y={Math.max(Math.min(activeActual.y, activeRolling.y) - 10, 50)}
              fill="#86efac"
              fontSize="11"
            >
              {rollingLabel}: {formatNumber(activeRolling.value)}
            </text>
          </>
        )}
      </svg>
      <Box display="flex" justifyContent="space-between" mt={0.5}>
        <Typography variant="caption" color="text.secondary">
          {actual[0]?.label || ""}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {actual[actual.length - 1]?.label || ""}
        </Typography>
      </Box>
      <Box display="flex" gap={2} mt={1}>
        <Typography variant="caption" sx={{ color: actualColor, fontWeight: 700 }}>
          {actualLabel}
        </Typography>
        <Typography variant="caption" sx={{ color: rollingColor, fontWeight: 700 }}>
          {rollingLabel}
        </Typography>
      </Box>
    </Box>
  );
};

function PackingAnalytics() {
  const now = new Date();
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [fromDate, setFromDate] = useState(formatDateInput(monthAgo));
  const [toDate, setToDate] = useState(formatDateInput(now));
  const [granularity, setGranularity] = useState<"hour" | "day" | "week">("day");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [activeTab, setActiveTab] = useState(0);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [throughputDaily, setThroughputDaily] = useState<TrendRow[]>([]);
  const [throughputWeekly, setThroughputWeekly] = useState<TrendRow[]>([]);
  const [throughputHourly, setThroughputHourly] = useState<TrendRow[]>([]);
  const [packers, setPackers] = useState<PackerRow[]>([]);
  const [packerOptions, setPackerOptions] = useState<PackerRow[]>([]);
  const [weekday, setWeekday] = useState<WeekdayRow[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapRow[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateRow[]>([]);
  const [packersDaily, setPackersDaily] = useState<PackerDailyRow[]>([]);
  const [duplicatesByUser, setDuplicatesByUser] = useState<DuplicateByUserRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monFriOnlyTrend, setMonFriOnlyTrend] = useState(true);
  const [compareUserA, setCompareUserA] = useState<string>("");
  const [compareUserB, setCompareUserB] = useState<string>("");
  const businessDailyGoal = 600;

  const params = useMemo(
    () => ({
      from: fromDate,
      to: toDate,
      granularity,
      userId: selectedUserId ? Number(selectedUserId) : undefined,
    }),
    [fromDate, toDate, granularity, selectedUserId]
  );

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError(null);
        const results = await Promise.allSettled([
          axios.get(getApiUrl("api/barcode-scan/analytics/overview"), { params }),
          axios.get(getApiUrl("api/barcode-scan/analytics/trend"), { params }),
          axios.get(getApiUrl("api/barcode-scan/analytics/trend"), {
            params: { from: fromDate, to: toDate, userId: selectedUserId ? Number(selectedUserId) : undefined, granularity: "day" },
          }),
          axios.get(getApiUrl("api/barcode-scan/analytics/trend"), {
            params: { from: fromDate, to: toDate, userId: selectedUserId ? Number(selectedUserId) : undefined, granularity: "week" },
          }),
          axios.get(getApiUrl("api/barcode-scan/analytics/trend"), {
            params: { from: fromDate, to: toDate, userId: selectedUserId ? Number(selectedUserId) : undefined, granularity: "hour" },
          }),
          axios.get(getApiUrl("api/barcode-scan/analytics/packers"), { params }),
          axios.get(getApiUrl("api/barcode-scan/analytics/packers"), { params: { from: fromDate, to: toDate } }),
          axios.get(getApiUrl("api/barcode-scan/analytics/packers-daily"), { params }),
          axios.get(getApiUrl("api/barcode-scan/analytics/weekday-summary"), { params }),
          axios.get(getApiUrl("api/barcode-scan/analytics/time-heatmap"), { params }),
          axios.get(getApiUrl("api/barcode-scan/analytics/duplicates"), { params: { from: fromDate, to: toDate, limit: 100 } }),
          axios.get(getApiUrl("api/barcode-scan/analytics/duplicates-by-user"), { params }),
        ]);

        const [o, t, td, tw, th, p, pAll, pd, w, h, d, dbu] = results;
        if (o.status === "fulfilled") setOverview(o.value.data);
        if (t.status === "fulfilled") setTrend(t.value.data || []);
        if (td.status === "fulfilled") setThroughputDaily(td.value.data || []);
        if (tw.status === "fulfilled") setThroughputWeekly(tw.value.data || []);
        if (th.status === "fulfilled") setThroughputHourly(th.value.data || []);
        if (p.status === "fulfilled") {
          const packerRows = (p.value.data || []).filter((row: PackerRow) => row.userId !== null);
          setPackers(packerRows);
        }
        if (pAll.status === "fulfilled") {
          const optionRows = (pAll.value.data || []).filter((row: PackerRow) => row.userId !== null);
          setPackerOptions(optionRows);
        }
        if (pd.status === "fulfilled") setPackersDaily(pd.value.data || []);
        if (w.status === "fulfilled") setWeekday(w.value.data || []);
        if (h.status === "fulfilled") setHeatmap(h.value.data || []);
        if (d.status === "fulfilled") setDuplicates(d.value.data || []);
        if (dbu.status === "fulfilled") setDuplicatesByUser(dbu.value.data || []);

        const failed = results.filter((r) => r.status === "rejected").length;
        if (failed > 0) {
          setError("Some analytics panels failed to load.");
        }
      } catch (err) {
        console.error("Error loading packing analytics:", err);
        setError("Failed to load packing analytics.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [params, fromDate, toDate, selectedUserId]);

  const trendMax = useMemo(() => Math.max(1, ...trend.map((r) => Number(r.boxesPacked || 0))), [trend]);
  const heatmapMax = useMemo(() => Math.max(1, ...heatmap.map((r) => Number(r.boxesPacked || 0))), [heatmap]);
  const isMonFri = (dateLabel: string) => {
    const dt = new Date(`${dateLabel}T00:00:00`);
    const day = dt.getDay();
    return day >= 1 && day <= 5;
  };
  const filteredThroughputDaily = useMemo(
    () =>
      monFriOnlyTrend
        ? throughputDaily.filter((row) => row.bucket && isMonFri(String(row.bucket).slice(0, 10)))
        : throughputDaily,
    [throughputDaily, monFriOnlyTrend]
  );
  const dailyLineSeries = useMemo(
    () =>
      filteredThroughputDaily.map((row) => ({
        label: String(row.bucket),
        value: Number(row.boxesPacked || 0),
      })),
    [filteredThroughputDaily]
  );
  const weeklyBarRows = useMemo(
    () =>
      throughputWeekly.map((row) => ({
        bucket: String(row.bucket),
        boxesPacked: Number(row.boxesPacked || 0),
      })),
    [throughputWeekly]
  );
  const rollingSeries = useMemo(() => {
    const sorted = filteredThroughputDaily
      .map((row) => ({
        date: new Date(`${String(row.bucket).slice(0, 10)}T00:00:00`),
        label: String(row.bucket).slice(5, 10),
        value: Number(row.boxesPacked || 0),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return sorted.map((row, idx) => {
      const start = Math.max(0, idx - 6);
      const window = sorted.slice(start, idx + 1);
      const avg = window.reduce((sum, r) => sum + r.value, 0) / Math.max(window.length, 1);
      return {
        label: row.label,
        actual: row.value,
        rollingAvg: Number(avg.toFixed(2)),
      };
    });
  }, [filteredThroughputDaily]);
  const rollingActualLine = useMemo(
    () => rollingSeries.map((r) => ({ label: r.label, value: r.actual })),
    [rollingSeries]
  );
  const rollingAvgLine = useMemo(
    () => rollingSeries.map((r) => ({ label: r.label, value: r.rollingAvg })),
    [rollingSeries]
  );
  const latestDailyActual = rollingSeries.length > 0 ? rollingSeries[rollingSeries.length - 1].actual : 0;
  const latestRollingAvg = rollingSeries.length > 0 ? rollingSeries[rollingSeries.length - 1].rollingAvg : 0;
  const monFriThroughputHeatmap = useMemo(() => {
    const grid = new Map<string, number>();
    const hourTotals = new Array(24).fill(0);
    let total = 0;

    throughputHourly.forEach((row) => {
      const bucket = String(row.bucket);
      const datePart = bucket.slice(0, 10);
      const hour = Number(bucket.slice(11, 13));
      const date = new Date(`${datePart}T00:00:00`);
      const jsDay = date.getDay(); // 0=Sun,1=Mon,...6=Sat
      const value = Number(row.boxesPacked || 0);

      if (jsDay >= 1 && jsDay <= 5 && hour >= 8 && hour <= 19) {
        const key = `${jsDay}-${hour}`;
        grid.set(key, (grid.get(key) || 0) + value);
        hourTotals[hour] += value;
        total += value;
      }
    });

    return { grid, hourTotals, total };
  }, [throughputHourly]);
  const throughputHeatmapMax = useMemo(
    () => Math.max(1, ...Array.from(monFriThroughputHeatmap.grid.values())),
    [monFriThroughputHeatmap]
  );
  const hourlyShareRows = useMemo(
    () =>
      monFriThroughputHeatmap.hourTotals.map((boxes, hour) => {
        const sharePct =
          monFriThroughputHeatmap.total > 0
            ? Number(((boxes / monFriThroughputHeatmap.total) * 100).toFixed(2))
            : 0;
        return {
          hourLabel: `${String(hour).padStart(2, "0")}:00`,
          sharePct,
          boxes,
        };
      }),
    [monFriThroughputHeatmap]
  );
  const monFriDailyRows = useMemo(
    () =>
      throughputDaily
        .map((row) => ({
          bucket: String(row.bucket).slice(0, 10),
          boxesPacked: Number(row.boxesPacked || 0),
        }))
        .filter((row) => isMonFri(row.bucket))
        .sort((a, b) => new Date(a.bucket).getTime() - new Date(b.bucket).getTime()),
    [throughputDaily]
  );
  const bestDay = useMemo(
    () =>
      monFriDailyRows.reduce<{ bucket: string; boxesPacked: number } | null>(
        (best, row) => (!best || row.boxesPacked > best.boxesPacked ? row : best),
        null
      ),
    [monFriDailyRows]
  );
  const worstDay = useMemo(
    () =>
      monFriDailyRows.reduce<{ bucket: string; boxesPacked: number } | null>(
        (worst, row) => (!worst || row.boxesPacked < worst.boxesPacked ? row : worst),
        null
      ),
    [monFriDailyRows]
  );
  const monFriPacePct = useMemo(
    () =>
      businessDailyGoal > 0
        ? Number(((overview?.monFriAvgBoxesPerDay || 0) / businessDailyGoal * 100).toFixed(2))
        : 0,
    [overview?.monFriAvgBoxesPerDay]
  );
  const weekOverWeek = useMemo(() => {
    if (monFriDailyRows.length === 0) return { current: 0, previous: 0, deltaPct: 0 };
    const byWeek = new Map<string, number>();
    monFriDailyRows.forEach((row) => {
      const dt = new Date(`${row.bucket}T00:00:00`);
      const monday = new Date(dt);
      const day = (dt.getDay() + 6) % 7; // monday=0
      monday.setDate(dt.getDate() - day);
      const key = monday.toISOString().slice(0, 10);
      byWeek.set(key, (byWeek.get(key) || 0) + row.boxesPacked);
    });
    const weeks = Array.from(byWeek.entries()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
    const current = weeks.length > 0 ? Number(weeks[weeks.length - 1][1] || 0) : 0;
    const previous = weeks.length > 1 ? Number(weeks[weeks.length - 2][1] || 0) : 0;
    const deltaPct = previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(2)) : 0;
    return { current, previous, deltaPct };
  }, [monFriDailyRows]);
  const primaryVsSupport = useMemo(() => {
    const sorted = [...packers].sort((a, b) => Number(b.boxesPacked || 0) - Number(a.boxesPacked || 0));
    const primary = sorted.slice(0, 2).reduce((sum, p) => sum + Number(p.boxesPacked || 0), 0);
    const total = sorted.reduce((sum, p) => sum + Number(p.boxesPacked || 0), 0);
    const support = Math.max(total - primary, 0);
    const primaryPct = total > 0 ? Number(((primary / total) * 100).toFixed(2)) : 0;
    const supportPct = total > 0 ? Number(((support / total) * 100).toFixed(2)) : 0;
    return { primary, support, total, primaryPct, supportPct };
  }, [packers]);
  const duplicateMetrics = useMemo(() => {
    const duplicateExtraScans = duplicates.reduce((sum, row) => sum + Math.max(Number(row.scanCount || 0) - 1, 0), 0);
    const dedupedBoxes = Number(overview?.totalBoxesPacked || 0);
    const rawEstimate = dedupedBoxes + duplicateExtraScans;
    const duplicateRatePct = rawEstimate > 0 ? Number(((duplicateExtraScans / rawEstimate) * 100).toFixed(2)) : 0;
    return {
      duplicateBarcodes: duplicates.length,
      duplicateExtraScans,
      duplicateRatePct,
      rawEstimate,
    };
  }, [duplicates, overview?.totalBoxesPacked]);
  const lowOutputDaysCount = useMemo(
    () => monFriDailyRows.filter((row) => Number(row.boxesPacked || 0) < businessDailyGoal).length,
    [monFriDailyRows]
  );
  const weekendTotal = useMemo(
    () => Number(overview?.saturdayBoxesPacked || 0) + Number(overview?.sundayBoxesPacked || 0),
    [overview?.saturdayBoxesPacked, overview?.sundayBoxesPacked]
  );
  const monFriVsWeekendShare = useMemo(() => {
    const monFri = Number(overview?.monFriBoxesPacked || 0);
    const weekend = weekendTotal;
    const total = monFri + weekend;
    return {
      monFri,
      weekend,
      monFriPct: total > 0 ? Number(((monFri / total) * 100).toFixed(2)) : 0,
      weekendPct: total > 0 ? Number(((weekend / total) * 100).toFixed(2)) : 0,
    };
  }, [overview?.monFriBoxesPacked, weekendTotal]);
  const heatMapLookup = useMemo(() => {
    const map = new Map<string, number>();
    heatmap.forEach((r) => map.set(`${r.dayIndex}-${r.hourOfDay}`, Number(r.boxesPacked || 0)));
    return map;
  }, [heatmap]);

  const weekRows = [
    { dayIndex: 1, dayName: "Sun" },
    { dayIndex: 2, dayName: "Mon" },
    { dayIndex: 3, dayName: "Tue" },
    { dayIndex: 4, dayName: "Wed" },
    { dayIndex: 5, dayName: "Thu" },
    { dayIndex: 6, dayName: "Fri" },
    { dayIndex: 7, dayName: "Sat" },
  ];
  const weekendRows = useMemo(
    () =>
      weekday.filter((d) => {
        const day = Number(d.dayIndex);
        return day === 1 || day === 7;
      }),
    [weekday]
  );
  const sortedPackers = useMemo(
    () => [...packers].sort((a, b) => Number(b.boxesPacked || 0) - Number(a.boxesPacked || 0)),
    [packers]
  );
  const visiblePackers = useMemo(
    () => sortedPackers.slice(0, MAX_PACKERS_SUPPORTED),
    [sortedPackers]
  );
  const packerColorPalette = ["#1565c0", "#8e24aa", "#ef6c00", "#2e7d32", "#c62828", "#00838f", "#5d4037", "#6d4c41", "#3949ab", "#7cb342"];
  const packerColorMap = useMemo(() => {
    const map = new Map<number, string>();
    visiblePackers.forEach((p, idx) => {
      map.set(Number(p.userId), packerColorPalette[idx % packerColorPalette.length]);
    });
    return map;
  }, [visiblePackers]);
  const comparisonCandidates = useMemo(
    () => visiblePackers.filter((p) => p.userId !== null),
    [visiblePackers]
  );
  useEffect(() => {
    const ids = comparisonCandidates.map((p) => String(p.userId));
    if (ids.length === 0) {
      setCompareUserA("");
      setCompareUserB("");
      return;
    }
    if (!compareUserA || !ids.includes(compareUserA)) {
      setCompareUserA(ids[0]);
    }
    if (!compareUserB || !ids.includes(compareUserB) || compareUserB === compareUserA) {
      setCompareUserB(ids.length > 1 ? ids[1] : ids[0]);
    }
  }, [comparisonCandidates, compareUserA, compareUserB]);
  const packerDailyComparison = useMemo(() => {
    if (comparisonCandidates.length === 0) return { rows: [], a: null as PackerRow | null, b: null as PackerRow | null };
    const a = comparisonCandidates.find((p) => String(p.userId) === compareUserA) || comparisonCandidates[0];
    const b =
      comparisonCandidates.find((p) => String(p.userId) === compareUserB && String(p.userId) !== String(a.userId)) ||
      comparisonCandidates.find((p) => String(p.userId) !== String(a.userId)) ||
      comparisonCandidates[0];
    const dayMap = new Map<string, { bucket: string; a: number; b: number; total: number }>();
    packersDaily.forEach((row) => {
      const key = String(row.bucket).slice(0, 10);
      const entry = dayMap.get(key) || { bucket: key, a: 0, b: 0, total: 0 };
      const value = Number(row.boxesPacked || 0);
      if (Number(row.userId) === Number(a.userId)) entry.a += value;
      if (Number(row.userId) === Number(b.userId)) entry.b += value;
      entry.total += value;
      dayMap.set(key, entry);
    });
    const rows = Array.from(dayMap.values()).sort((x, y) => new Date(x.bucket).getTime() - new Date(y.bucket).getTime());
    return { rows, a, b };
  }, [packersDaily, comparisonCandidates, compareUserA, compareUserB]);
  const packerLineActual = useMemo(
    () => packerDailyComparison.rows.map((r) => ({ label: r.bucket.slice(5, 10), value: Number(r.a || 0) })),
    [packerDailyComparison]
  );
  const packerLineSecond = useMemo(
    () => packerDailyComparison.rows.map((r) => ({ label: r.bucket.slice(5, 10), value: Number(r.b || 0) })),
    [packerDailyComparison]
  );
  const packerShareRows = useMemo(
    () => {
      const topPackerIds = visiblePackers
        .filter((p) => p.userId !== null)
        .slice(0, MAX_PACKERS_SUPPORTED)
        .map((p) => Number(p.userId));

      const byDay = new Map<string, Map<number, number>>();
      packersDaily.forEach((row) => {
        const day = String(row.bucket).slice(0, 10);
        const uid = Number(row.userId);
        const value = Number(row.boxesPacked || 0);
        const dayMap = byDay.get(day) || new Map<number, number>();
        dayMap.set(uid, (dayMap.get(uid) || 0) + value);
        byDay.set(day, dayMap);
      });

      return Array.from(byDay.entries())
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .map(([day, dayMap]) => {
          const total = Array.from(dayMap.values()).reduce((s, v) => s + v, 0);
          const segments = topPackerIds.map((uid) => {
            const boxes = Number(dayMap.get(uid) || 0);
            const pct = total > 0 ? Number(((boxes / total) * 100).toFixed(2)) : 0;
            return { uid, boxes, pct };
          });
          const topBoxes = segments.reduce((s, seg) => s + seg.boxes, 0);
          const otherBoxes = Math.max(total - topBoxes, 0);
          const otherPct = total > 0 ? Number(((otherBoxes / total) * 100).toFixed(2)) : 0;
          return { day, total, segments, otherBoxes, otherPct };
        });
    },
    [packersDaily, visiblePackers]
  );
  const duplicateByUserMap = useMemo(
    () => new Map(duplicatesByUser.map((d) => [Number(d.userId), d])),
    [duplicatesByUser]
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, mt: 2 }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 3 },
          mb: 2.5,
          borderRadius: 3,
          border: "1px solid #dbe6f3",
          background: "linear-gradient(135deg, #f8fff9 0%, #f3fbf5 55%, #f2f8ff 100%)",
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Packing Analytics</Typography>
        <Typography variant="body2" color="text.secondary">
          Warehouse packing performance from barcode scans (each scan = one packed box).
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="From"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
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
              <InputLabel id="packing-granularity-label">Granularity</InputLabel>
              <Select
                labelId="packing-granularity-label"
                label="Granularity"
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as any)}
              >
                <MenuItem value="hour">Hourly</MenuItem>
                <MenuItem value="day">Daily</MenuItem>
                <MenuItem value="week">Weekly</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel id="packing-user-label">Packer</InputLabel>
              <Select
                labelId="packing-user-label"
                label="Packer"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(String(e.target.value))}
              >
                <MenuItem value="">All Packers</MenuItem>
                {packerOptions.map((p) => (
                  <MenuItem key={`${p.userId}-${p.userLabel}`} value={String(p.userId ?? "")}>
                    {p.userLabel}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && (
        <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && overview && (
        <>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            {[
              { label: "Boxes Packed", value: overview.totalBoxesPacked, color: "#1b5e20" },
              { label: "Active Packers", value: overview.activePackers, color: "#1565c0" },
              { label: "Mon-Fri Boxes", value: overview.monFriBoxesPacked, color: "#6a1b9a" },
              { label: "Mon-Fri Avg / Day", value: overview.monFriAvgBoxesPerDay, color: "#7b1fa2" },
              { label: "Mon-Fri Avg / Hour (8h)", value: overview.monFriAvgBoxesPerHour8, color: "#00695c" },
              { label: "Peak Hour Boxes", value: overview.peakHourBoxes, color: "#ef6c00" },
            ].map((kpi) => (
              <Grid item xs={12} sm={6} md={4} lg={2} key={kpi.label}>
                <Card sx={{ border: "1px solid #e2e8f0" }}>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">{kpi.label}</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: kpi.color, mt: 0.5 }}>
                      {formatNumber(kpi.value)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          <Alert severity="info" sx={{ mb: 2.5 }}>
            Duplicate barcode scans are deduplicated (same barcode counts once). Daily totals use all scans in that day, and average-per-hour uses a fixed 8-hour baseline.
          </Alert>

          <Paper sx={{ borderRadius: 2, mb: 2.5 }}>
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
              <Tab label="Overview" />
              <Tab label="Throughput" />
              <Tab label="Packers" />
              <Tab label="Time Patterns" />
              <Tab label="Quality" />
              <Tab label="Weekend Packing" />
            </Tabs>
          </Paper>

          {activeTab === 0 && (
            <Grid container spacing={2}>
              <Grid item xs={12} lg={8}>
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.3}>
                    <Typography variant="h6">Pace Vs Goal</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Daily Goal: {formatNumber(businessDailyGoal)} boxes
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.8 }}>
                    Mon-Fri Avg/Day: {formatNumber(overview.monFriAvgBoxesPerDay)} ({formatPct(monFriPacePct)} of goal)
                  </Typography>
                  <Box sx={{ height: 14, borderRadius: 999, bgcolor: "#edf1f7", overflow: "hidden", mb: 1.2 }}>
                    <Box
                      sx={{
                        width: `${Math.max(Math.min(monFriPacePct, 100), 2)}%`,
                        height: "100%",
                        bgcolor: monFriPacePct >= 100 ? "#2e7d32" : monFriPacePct >= 85 ? "#f9a825" : "#d32f2f",
                        borderRadius: 999,
                      }}
                    />
                  </Box>
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="caption" color="text.secondary">This Week</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatNumber(weekOverWeek.current)}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="caption" color="text.secondary">Last Week</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatNumber(weekOverWeek.previous)}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="caption" color="text.secondary">WoW Delta</Typography>
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 700, color: weekOverWeek.deltaPct >= 0 ? "#2e7d32" : "#d32f2f" }}
                      >
                        {weekOverWeek.deltaPct >= 0 ? "+" : ""}{formatPct(weekOverWeek.deltaPct)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="caption" color="text.secondary">Avg Boxes / Hour</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatNumber(overview.monFriAvgBoxesPerHour8)}</Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
              <Grid item xs={12} lg={4}>
                <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 1.2 }}>Exception Snapshot</Typography>
                  <Stack spacing={1.2}>
                    <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: "#fff8e1", border: "1px solid #ffe0b2" }}>
                      <Typography variant="caption" color="text.secondary">Low-output Mon-Fri Days (&lt; goal)</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "#ef6c00" }}>{formatNumber(lowOutputDaysCount)}</Typography>
                    </Box>
                    <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: "#fbe9e7", border: "1px solid #ffccbc" }}>
                      <Typography variant="caption" color="text.secondary">Duplicate Extra Scans</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "#d84315" }}>{formatNumber(duplicateMetrics.duplicateExtraScans)}</Typography>
                    </Box>
                    <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: "#e8f5e9", border: "1px solid #c8e6c9" }}>
                      <Typography variant="caption" color="text.secondary">Duplicate Rate (Raw)</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "#1b5e20" }}>{formatPct(duplicateMetrics.duplicateRatePct)}</Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>

              <Grid item xs={12} lg={7}>
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1.2 }}>Performance Trend Snapshot</Typography>
                  <DualLineChart actual={rollingActualLine} rolling={rollingAvgLine} />
                </Paper>
              </Grid>
              <Grid item xs={12} lg={5}>
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1.2 }}>Contribution View</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Primary team is top 2 packers by output in selected range.
                  </Typography>
                  <Box sx={{ mt: 1.1, height: 16, borderRadius: 999, bgcolor: "#edf1f7", overflow: "hidden", display: "flex" }}>
                    <Box sx={{ width: `${Math.max(primaryVsSupport.primaryPct, 2)}%`, bgcolor: "#1565c0" }} />
                    <Box sx={{ width: `${Math.max(primaryVsSupport.supportPct, 2)}%`, bgcolor: "#90caf9" }} />
                  </Box>
                  <Grid container spacing={1.5} sx={{ mt: 0.7 }}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Primary Team</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "#1565c0" }}>
                        {formatNumber(primaryVsSupport.primary)} ({formatPct(primaryVsSupport.primaryPct)})
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Support Team</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "#1e88e5" }}>
                        {formatNumber(primaryVsSupport.support)} ({formatPct(primaryVsSupport.supportPct)})
                      </Typography>
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 1.2 }}>
                    <Typography variant="caption" color="text.secondary">Best Day (Mon-Fri)</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {bestDay ? `${bestDay.bucket}: ${formatNumber(bestDay.boxesPacked)}` : "N/A"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">Worst Day (Mon-Fri)</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {worstDay ? `${worstDay.bucket}: ${formatNumber(worstDay.boxesPacked)}` : "N/A"}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1.2 }}>Mon-Fri Vs Weekend Summary</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ p: 1.5, borderRadius: 1.5, border: "1px solid #dbe6f3", bgcolor: "#f8fbff" }}>
                        <Typography variant="caption" color="text.secondary">Mon-Fri Total</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: "#1565c0" }}>
                          {formatNumber(monFriVsWeekendShare.monFri)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Share: {formatPct(monFriVsWeekendShare.monFriPct)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ p: 1.5, borderRadius: 1.5, border: "1px solid #f1e3d3", bgcolor: "#fffaf3" }}>
                        <Typography variant="caption" color="text.secondary">Weekend Total</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: "#ef6c00" }}>
                          {formatNumber(monFriVsWeekendShare.weekend)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Share: {formatPct(monFriVsWeekendShare.weekendPct)}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          )}

          {activeTab === 1 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                    <Typography variant="h6">Daily Throughput Trend (Line)</Typography>
                    <FormControlLabel
                      control={<Switch checked={monFriOnlyTrend} onChange={(e) => setMonFriOnlyTrend(e.target.checked)} />}
                      label="Mon-Fri only"
                    />
                  </Box>
                  <SimpleLineChart data={dailyLineSeries} color="#1565c0" />
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>Weekly Totals (Bar)</Typography>
                  <HorizontalBarList items={weeklyBarRows} labelKey="bucket" valueKey="boxesPacked" color="#2e7d32" maxItems={26} />
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.2}>
                    <Typography variant="h6">Mon-Fri Hourly Heatmap</Typography>
                    <Typography variant="caption" color="text.secondary">Total boxes by day/hour</Typography>
                  </Box>
                  <Box sx={{ overflowX: "auto", mb: 1.5 }}>
                    <Grid container>
                      <Grid item xs={12}>
                        <Grid container>
                          <Grid item sx={{ width: 78 }} />
                          {Array.from({ length: 12 }).map((_, idx) => {
                            const hour = idx + 8;
                            return (
                            <Grid item key={`thr-h-${hour}`} sx={{ width: 32, textAlign: "center" }}>
                              <Typography variant="caption">{hour}</Typography>
                            </Grid>
                            );
                          })}
                        </Grid>
                      </Grid>
                      {[
                        { day: 1, label: "Mon" },
                        { day: 2, label: "Tue" },
                        { day: 3, label: "Wed" },
                        { day: 4, label: "Thu" },
                        { day: 5, label: "Fri" },
                      ].map((d) => (
                        <Grid item xs={12} key={`thr-day-${d.day}`}>
                          <Grid container alignItems="center">
                            <Grid item sx={{ width: 78 }}>
                              <Typography variant="caption" sx={{ fontWeight: 700 }}>{d.label}</Typography>
                            </Grid>
                            {Array.from({ length: 12 }).map((_, idx) => {
                              const hour = idx + 8;
                              const value = monFriThroughputHeatmap.grid.get(`${d.day}-${hour}`) || 0;
                              const intensity = value > 0 ? Math.max(0.15, value / throughputHeatmapMax) : 0;
                              return (
                                <Grid item key={`thr-cell-${d.day}-${hour}`} sx={{ width: 32, p: 0.25 }}>
                                  <Tooltip title={`${d.label} ${hour}:00 - ${value} boxes`} arrow>
                                    <Box
                                      sx={{
                                        width: 26,
                                        height: 18,
                                        borderRadius: 0.7,
                                        bgcolor: value === 0 ? "#edf1f7" : `rgba(239, 108, 0, ${intensity})`,
                                        border: "1px solid #dbe4ef",
                                      }}
                                    />
                                  </Tooltip>
                                </Grid>
                              );
                            })}
                          </Grid>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Hourly Share Of Mon-Fri Output (%)</Typography>
                  <Stack spacing={0.9}>
                    {hourlyShareRows
                      .map((row) => ({
                        ...row,
                        hourNum: Number(String(row.hourLabel).slice(0, 2)),
                      }))
                      .filter((row) => row.hourNum >= 8 && row.hourNum <= 19)
                      .map((row) => (
                      <Box key={`share-${row.hourLabel}`}>
                        <Box display="flex" justifyContent="space-between" mb={0.2}>
                          <Typography variant="caption">{row.hourLabel}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {row.sharePct.toFixed(2)}% ({formatNumber(row.boxes)})
                          </Typography>
                        </Box>
                        <Box sx={{ height: 7, borderRadius: 999, bgcolor: "#edf1f7", overflow: "hidden" }}>
                          <Box
                            sx={{
                              height: "100%",
                              width: `${Math.max(row.sharePct, 1)}%`,
                              bgcolor: "#2e7d32",
                              borderRadius: 999,
                            }}
                          />
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              </Grid>
              <Grid item xs={12}>
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.2}>
                    <Typography variant="h6">Daily vs Rolling 7-Day Average</Typography>
                  </Box>
                  <Grid container spacing={2} sx={{ mb: 1.2 }}>
                    <Grid item xs={12} md={3}>
                      <Typography variant="caption" color="text.secondary">Latest Daily</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatNumber(latestDailyActual)}</Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Typography variant="caption" color="text.secondary">Latest Rolling 7-Day Avg</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatNumber(latestRollingAvg)}</Typography>
                    </Grid>
                  </Grid>
                  <DualLineChart actual={rollingActualLine} rolling={rollingAvgLine} />
                </Paper>
              </Grid>
            </Grid>
          )}

          {activeTab === 2 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.2}>
                    <Typography variant="h6">Packer Daily Comparison</Typography>
                    <Box display="flex" gap={1.2}>
                      <FormControl size="small" sx={{ minWidth: 170 }}>
                        <InputLabel id="compare-packer-a-label">Packer A</InputLabel>
                        <Select
                          labelId="compare-packer-a-label"
                          label="Packer A"
                          value={compareUserA}
                          onChange={(e) => setCompareUserA(String(e.target.value))}
                        >
                          {comparisonCandidates.map((p) => (
                            <MenuItem key={`ca-${p.userId}`} value={String(p.userId)}>
                              {p.userLabel}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl size="small" sx={{ minWidth: 170 }}>
                        <InputLabel id="compare-packer-b-label">Packer B</InputLabel>
                        <Select
                          labelId="compare-packer-b-label"
                          label="Packer B"
                          value={compareUserB}
                          onChange={(e) => setCompareUserB(String(e.target.value))}
                        >
                          {comparisonCandidates.map((p) => (
                            <MenuItem key={`cb-${p.userId}`} value={String(p.userId)}>
                              {p.userLabel}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                  </Box>
                  {packerDailyComparison.a ? (
                    <DualLineChart
                      actual={packerLineActual}
                      rolling={packerLineSecond}
                      actualColor={packerColorMap.get(Number(packerDailyComparison.a.userId)) || "#1565c0"}
                      rollingColor={packerColorMap.get(Number(packerDailyComparison.b?.userId)) || "#8e24aa"}
                      actualLabel={packerDailyComparison.a.userLabel}
                      rollingLabel={packerDailyComparison.b?.userLabel || "Second Packer"}
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary">No packer comparison data.</Typography>
                  )}
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1.2 }}>Daily Output Share (Multi-Packer)</Typography>
                  <Box display="flex" flexWrap="wrap" gap={1} mb={1.2}>
                    {visiblePackers.map((p) => (
                      <Typography key={`legend-${p.userId}`} variant="caption" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: 999, bgcolor: packerColorMap.get(Number(p.userId)) || "#90a4ae" }} />
                        {p.userLabel}
                      </Typography>
                    ))}
                    {sortedPackers.length > MAX_PACKERS_SUPPORTED && (
                      <Typography variant="caption" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: 999, bgcolor: "#cfd8dc" }} />
                        Others
                      </Typography>
                    )}
                  </Box>
                  <Stack spacing={0.9} sx={{ maxHeight: 420, overflow: "auto" }}>
                    {packerShareRows.map((row) => (
                      <Box key={`share-day-${row.day}`}>
                        <Box display="flex" justifyContent="space-between" mb={0.25}>
                          <Typography variant="caption">{row.day}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatNumber(row.total)} boxes
                          </Typography>
                        </Box>
                        <Box sx={{ height: 10, borderRadius: 999, bgcolor: "#edf1f7", overflow: "hidden", display: "flex" }}>
                          {row.segments.map((seg) => (
                            <Box
                              key={`seg-${row.day}-${seg.uid}`}
                              sx={{
                                width: `${Math.max(seg.pct, 0)}%`,
                                bgcolor: packerColorMap.get(seg.uid) || "#90a4ae",
                              }}
                            />
                          ))}
                          {row.otherPct > 0 && (
                            <Box sx={{ width: `${Math.max(row.otherPct, 0)}%`, bgcolor: "#cfd8dc" }} />
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1.2 }}>Productivity And Quality</Typography>
                  <Grid container spacing={1.5}>
                    {visiblePackers.map((p, idx) => {
                      const dup = duplicateByUserMap.get(Number(p.userId));
                      return (
                        <Grid item xs={12} key={`packer-card-${p.userId}-${idx}`}>
                          <Box sx={{ p: 1.3, borderRadius: 1.5, border: "1px solid #e2e8f0", bgcolor: "#f9fbff" }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{p.userLabel}</Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Boxes: {formatNumber(p.boxesPacked)} | Boxes / Scheduled Hour: {formatNumber(p.boxesPerScheduledHourMonSat)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Duplicate Rate: {formatPct(Number(dup?.duplicateRatePct || 0))} | Duplicate Extra Scans: {formatNumber(dup?.duplicateExtraScans || 0)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              First scan: {p.firstScanAt ? new Date(p.firstScanAt).toLocaleString() : "N/A"} | Last scan: {p.lastScanAt ? new Date(p.lastScanAt).toLocaleString() : "N/A"}
                            </Typography>
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          )}

          {activeTab === 3 && (
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Day-of-Week x Hour Heatmap</Typography>
              <Box sx={{ overflowX: "auto" }}>
                <Grid container sx={{ minWidth: 980 }}>
                  <Grid item xs={12}>
                    <Grid container>
                      <Grid item sx={{ width: 80 }} />
                      {Array.from({ length: 24 }).map((_, hour) => (
                        <Grid item key={`h-${hour}`} sx={{ width: 36, textAlign: "center" }}>
                          <Typography variant="caption">{hour}</Typography>
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>
                  {weekRows.map((day) => (
                    <Grid item xs={12} key={day.dayIndex}>
                      <Grid container alignItems="center">
                        <Grid item sx={{ width: 80 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>{day.dayName}</Typography>
                        </Grid>
                        {Array.from({ length: 24 }).map((_, hour) => {
                          const value = heatMapLookup.get(`${day.dayIndex}-${hour}`) || 0;
                          const intensity = value > 0 ? Math.max(0.15, value / heatmapMax) : 0;
                          return (
                            <Grid item key={`${day.dayIndex}-${hour}`} sx={{ width: 36, p: 0.25 }}>
                              <Tooltip title={`${day.dayName} ${hour}:00 - ${value} boxes`} arrow>
                                <Box
                                  sx={{
                                    width: 30,
                                    height: 22,
                                    borderRadius: 0.8,
                                    bgcolor: value === 0 ? "#edf1f7" : `rgba(21, 101, 192, ${intensity})`,
                                    border: "1px solid #dbe4ef",
                                  }}
                                />
                              </Tooltip>
                            </Grid>
                          );
                        })}
                      </Grid>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Paper>
          )}

          {activeTab === 4 && (
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Duplicate Barcode Scans</Typography>
              <Box sx={{ maxHeight: 560, overflow: "auto" }}>
                <Grid container sx={{ px: 1, py: 1, borderBottom: "2px solid #e0e7ef" }}>
                  <Grid item xs={4}><Typography variant="caption">Barcode</Typography></Grid>
                  <Grid item xs={2}><Typography variant="caption">Scan Count</Typography></Grid>
                  <Grid item xs={2}><Typography variant="caption">Users</Typography></Grid>
                  <Grid item xs={2}><Typography variant="caption">First Scan</Typography></Grid>
                  <Grid item xs={2}><Typography variant="caption">Last Scan</Typography></Grid>
                </Grid>
                {duplicates.map((row) => (
                  <Grid container key={row.barcode} sx={{ px: 1, py: 1, borderBottom: "1px solid #edf1f7" }}>
                    <Grid item xs={4}><Typography variant="body2" sx={{ fontWeight: 600 }}>{row.barcode}</Typography></Grid>
                    <Grid item xs={2}><Typography variant="body2">{formatNumber(row.scanCount)}</Typography></Grid>
                    <Grid item xs={2}><Typography variant="body2">{formatNumber(row.distinctUsers)}</Typography></Grid>
                    <Grid item xs={2}><Typography variant="caption">{row.firstScanAt ? new Date(row.firstScanAt).toLocaleString() : "N/A"}</Typography></Grid>
                    <Grid item xs={2}><Typography variant="caption">{row.lastScanAt ? new Date(row.lastScanAt).toLocaleString() : "N/A"}</Typography></Grid>
                  </Grid>
                ))}
                {duplicates.length === 0 && (
                  <Box sx={{ py: 3, textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary">No duplicate scans in selected range.</Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          )}

          {activeTab === 5 && (
            <Grid container spacing={2}>
              {[
                { label: "Saturday Boxes", value: overview.saturdayBoxesPacked, color: "#ef6c00" },
                { label: "Saturday Avg / Day", value: overview.saturdayAvgBoxesPerDay, color: "#f57c00" },
                { label: "Saturday Avg / Hour (8h)", value: overview.saturdayAvgBoxesPerHour8, color: "#e65100" },
                { label: "Sunday Boxes", value: overview.sundayBoxesPacked, color: "#546e7a" },
                { label: "Sunday Avg / Day", value: overview.sundayAvgBoxesPerDay, color: "#455a64" },
                { label: "Sunday Avg / Hour (8h)", value: overview.sundayAvgBoxesPerHour8, color: "#37474f" },
              ].map((kpi) => (
                <Grid item xs={12} sm={6} md={4} key={kpi.label}>
                  <Card sx={{ border: "1px solid #e2e8f0" }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">{kpi.label}</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: kpi.color, mt: 0.5 }}>
                        {formatNumber(kpi.value)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              <Grid item xs={12}>
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>Weekend Day Summary</Typography>
                  <HorizontalBarList items={weekendRows} labelKey="dayName" valueKey="boxesPacked" color="#8e24aa" maxItems={2} />
                </Paper>
              </Grid>
            </Grid>
          )}
        </>
      )}
    </Box>
  );
}

export default PackingAnalytics;

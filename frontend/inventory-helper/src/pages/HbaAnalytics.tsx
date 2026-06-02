import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { getApiUrl } from "../config/api";

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);
const formatNumber = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("en-US");
const formatMoney = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString();
};

function MetricCard({ label, value, helper }: { label: string; value: string | number; helper?: string }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
          {value}
        </Typography>
        {helper ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {helper}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

function HorizontalList({
  title,
  rows,
  labelKey = "label",
  valueKey = "count",
  valueFormatter = formatNumber,
}: {
  title: string;
  rows: any[];
  labelKey?: string;
  valueKey?: string;
  valueFormatter?: (value: any) => string;
}) {
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey] || 0)));
  return (
    <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No data yet.
        </Typography>
      ) : (
        <Stack spacing={1.1}>
          {rows.slice(0, 12).map((row, index) => {
            const value = Number(row[valueKey] || 0);
            const width = Math.max((value / max) * 100, 2);
            return (
              <Box key={`${row[labelKey]}-${index}`}>
                <Box display="flex" justifyContent="space-between" gap={1} mb={0.35}>
                  <Typography variant="body2" fontWeight={600}>
                    {row[labelKey] || "Unknown"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {valueFormatter(value)}
                  </Typography>
                </Box>
                <Box sx={{ height: 8, bgcolor: "#edf1f7", borderRadius: 999, overflow: "hidden" }}>
                  <Box sx={{ width: `${width}%`, height: "100%", bgcolor: "#1565c0", borderRadius: 999 }} />
                </Box>
              </Box>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
}

function ProductTable({ title, rows, valueLabel }: { title: string; rows: any[]; valueLabel: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>SKU</TableCell>
              <TableCell>Product</TableCell>
              <TableCell align="right">{valueLabel}</TableCell>
              <TableCell align="right">Units</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>No product activity yet.</TableCell>
              </TableRow>
            ) : (
              rows.slice(0, 12).map((row) => (
                <TableRow key={row.sku}>
                  <TableCell>{row.sku}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {row.brand || "-"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.itemName || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{formatNumber(row.sessions ?? row.count)}</TableCell>
                  <TableCell align="right">{formatNumber(row.units ?? row.quantity)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

function CartTable({ title, rows }: { title: string; rows: any[] }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      <TableContainer sx={{ maxHeight: 420 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Last Updated</TableCell>
              <TableCell align="right">SKUs</TableCell>
              <TableCell align="right">Units</TableCell>
              <TableCell align="right">Value</TableCell>
              <TableCell>Items</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>No carts in this bucket.</TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.sessionId}>
                  <TableCell>{formatDateTime(row.lastUpdatedAt)}</TableCell>
                  <TableCell align="right">{formatNumber(row.totalSkus)}</TableCell>
                  <TableCell align="right">{formatNumber(row.totalUnits)}</TableCell>
                  <TableCell align="right">{formatMoney(row.totalPrice)}</TableCell>
                  <TableCell>
                    {(row.items || [])
                      .slice(0, 3)
                      .map((item: any) => `${item.sku} x ${item.quantity}`)
                      .join(", ")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

function HbaAnalytics() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [fromDate, setFromDate] = useState(formatDateInput(thirtyDaysAgo));
  const [toDate, setToDate] = useState(formatDateInput(now));
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => ({ from: fromDate, to: toDate, activeMinutes: 1440 }), [fromDate, toDate]);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await axios.get(getApiUrl("hba-analytics/overview"), { params });
        setData(response.data || {});
      } catch (analyticsError: any) {
        console.error("Failed to load HBA analytics:", analyticsError);
        setError(analyticsError?.response?.data?.error || "Failed to load HBA analytics");
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [params]);

  const overview = data?.overview || {};
  const cartConversion =
    Number(overview.sessions || 0) > 0
      ? `${((Number(overview.ordersSubmitted || 0) / Number(overview.sessions || 1)) * 100).toFixed(1)}%`
      : "0.0%";

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            HBA Analytics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Anonymous catalog, cart, product interest, and region signals for the public HBA order site.
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="From"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="To"
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </Paper>

        {error ? <Alert severity="error">{error}</Alert> : null}

        {loading ? (
          <Box display="flex" justifyContent="center" py={8}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard label="Visitors" value={formatNumber(overview.sessions)} helper={`${formatNumber(overview.totalEvents)} tracked actions`} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard label="Active Carts" value={formatNumber(overview.activeCarts)} helper={`${formatMoney(overview.activeCartValue)} in cart value`} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard label="Abandoned Carts" value={formatNumber(overview.abandonedCarts)} helper={`${formatMoney(overview.abandonedCartValue)} in cart value`} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard label="Orders Submitted" value={formatNumber(overview.ordersSubmitted)} helper={`${cartConversion} visitor conversion`} />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <HorizontalList title="Conversion Funnel" rows={data?.funnel || []} valueKey="value" />
              </Grid>
              <Grid item xs={12} md={6}>
                <HorizontalList title="Interest By Region" rows={data?.regions || []} />
              </Grid>
              <Grid item xs={12} md={6}>
                <ProductTable title="Products Most Often In Carts" rows={data?.topCartProducts || []} valueLabel="Carts" />
              </Grid>
              <Grid item xs={12} md={6}>
                <ProductTable title="Most Eye-Clicked Products" rows={data?.topImageClicks || []} valueLabel="Clicks" />
              </Grid>
              <Grid item xs={12} md={4}>
                <HorizontalList title="Top Search Terms" rows={data?.topSearchTerms || []} />
              </Grid>
              <Grid item xs={12} md={4}>
                <HorizontalList title="Devices" rows={data?.devices || []} />
              </Grid>
              <Grid item xs={12} md={4}>
                <HorizontalList title="Browsers" rows={data?.browsers || []} />
              </Grid>
              <Grid item xs={12}>
                <CartTable title="Active Carts - Last 24 Hours" rows={data?.activeCarts || []} />
              </Grid>
              <Grid item xs={12}>
                <CartTable title="Abandoned Carts" rows={data?.abandonedCarts || []} />
              </Grid>
            </Grid>
          </>
        )}
      </Stack>
    </Box>
  );
}

export default HbaAnalytics;

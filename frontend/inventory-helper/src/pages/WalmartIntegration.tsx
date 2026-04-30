import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { toast } from "react-toastify";
import { getApiUrl } from "../config/api";

type ResourceKey = "orders" | "items" | "inventory" | "pricing";

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
};

const statusColor = (status?: string | null) => {
  switch (status) {
    case "active":
    case "success":
      return "success";
    case "running":
      return "info";
    case "partial":
      return "warning";
    case "error":
    case "failed":
      return "error";
    default:
      return "default";
  }
};

function WalmartIntegration() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusData, setStatusData] = useState<any>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(getApiUrl("walmart-integration/status"));
      setStatusData(data);
    } catch (error: any) {
      console.error("Failed to load Walmart status:", error);
      toast.error(error?.response?.data?.error || "Failed to load Walmart integration status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const runAction = useCallback(
    async (actionKey: string, request: () => Promise<any>, successMessage: string) => {
      setActionLoading(actionKey);
      try {
        await request();
        toast.success(successMessage);
        await loadStatus();
      } catch (error: any) {
        console.error(`Walmart action failed (${actionKey}):`, error);
        toast.error(error?.response?.data?.error || `Failed to ${actionKey}.`);
      } finally {
        setActionLoading(null);
      }
    },
    [loadStatus]
  );

  const resourceCards = useMemo(
    () => [
      {
        key: "orders" as ResourceKey,
        label: "Orders",
        count: statusData?.counts?.orders ?? 0,
        lastSync: statusData?.connection?.lastOrdersSyncAt,
      },
      {
        key: "items" as ResourceKey,
        label: "Items",
        count: statusData?.counts?.items ?? 0,
        lastSync: statusData?.connection?.lastItemsSyncAt,
      },
      {
        key: "inventory" as ResourceKey,
        label: "Inventory",
        count: statusData?.counts?.inventorySnapshots ?? 0,
        lastSync: statusData?.connection?.lastInventorySyncAt,
      },
      {
        key: "pricing" as ResourceKey,
        label: "Pricing",
        count: statusData?.counts?.pricingSnapshots ?? 0,
        lastSync: statusData?.connection?.lastPricingSyncAt,
      },
    ],
    [statusData]
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Walmart Integration
          </Typography>
          <Typography color="text.secondary">
            Manage the Walmart USA connection, run read-only syncs, and monitor sync health.
          </Typography>
        </Box>

        {!statusData?.hasCredentials && (
          <Alert severity="warning">
            Walmart credentials are not configured yet. Add <code>WALMART_CLIENT_ID</code> and{" "}
            <code>WALMART_CLIENT_SECRET</code> in the backend environment before testing the connection.
          </Alert>
        )}

        <Paper sx={{ p: 3 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Connection Status
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                <Chip
                  label={statusData?.connection?.status || "unknown"}
                  color={statusColor(statusData?.connection?.status) as any}
                />
                <Chip label={`Market: ${statusData?.connection?.market || "US"}`} variant="outlined" />
                <Chip label={`Client: ${statusData?.connection?.clientIdHint || "Not set"}`} variant="outlined" />
              </Stack>
              <Typography sx={{ mt: 2 }}>API Base URL: {statusData?.connection?.apiBaseUrl || "—"}</Typography>
              <Typography>Last token success: {formatDateTime(statusData?.connection?.lastTokenSuccessAt)}</Typography>
              <Typography>Last token error: {formatDateTime(statusData?.connection?.lastTokenErrorAt)}</Typography>
              <Typography color={statusData?.connection?.lastTokenErrorMessage ? "error.main" : "text.secondary"}>
                {statusData?.connection?.lastTokenErrorMessage || "No recent token errors."}
              </Typography>
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap flexWrap="wrap">
              <Button variant="outlined" onClick={loadStatus} disabled={actionLoading !== null}>
                Refresh
              </Button>
              <Button
                variant="contained"
                onClick={() =>
                  runAction(
                    "test-connection",
                    () => axios.post(getApiUrl("walmart-integration/test-connection")),
                    "Walmart connection verified."
                  )
                }
                disabled={actionLoading !== null}
              >
                {actionLoading === "test-connection" ? "Testing..." : "Test Connection"}
              </Button>
              <Button
                variant="contained"
                color="secondary"
                onClick={() =>
                  runAction(
                    "sync-catalog",
                    () => axios.post(getApiUrl("walmart-integration/sync/catalog")),
                    "Walmart catalog sync completed."
                  )
                }
                disabled={actionLoading !== null}
              >
                {actionLoading === "sync-catalog" ? "Syncing Catalog..." : "Sync Catalog"}
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={() =>
                  runAction(
                    "sync-all",
                    () => axios.post(getApiUrl("walmart-integration/sync/all")),
                    "All Walmart syncs completed."
                  )
                }
                disabled={actionLoading !== null}
              >
                {actionLoading === "sync-all" ? "Syncing All..." : "Sync All Walmart Data"}
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Grid container spacing={2}>
          {resourceCards.map((resource) => (
            <Grid item xs={12} md={6} lg={3} key={resource.key}>
              <Card sx={{ height: "100%" }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {resource.label}
                  </Typography>
                  <Typography variant="h3" sx={{ mt: 1, fontWeight: 700 }}>
                    {resource.count}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    Last sync: {formatDateTime(resource.lastSync)}
                  </Typography>
                  <Button
                    variant="contained"
                    sx={{ mt: 2 }}
                    fullWidth
                    onClick={() =>
                      runAction(
                        `sync-${resource.key}`,
                        () => axios.post(getApiUrl(`walmart-integration/sync/${resource.key}`)),
                        `${resource.label} sync completed.`
                      )
                    }
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === `sync-${resource.key}` ? "Syncing..." : `Sync ${resource.label}`}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} lg={7}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Recent Sync Runs
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Started</TableCell>
                    <TableCell>Resource</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Fetched</TableCell>
                    <TableCell>Inserted</TableCell>
                    <TableCell>Updated</TableCell>
                    <TableCell>Requested By</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(statusData?.recentRuns || []).map((run: any) => (
                    <TableRow key={run.id} hover>
                      <TableCell>{formatDateTime(run.startedAt)}</TableCell>
                      <TableCell>{run.resourceType}</TableCell>
                      <TableCell>
                        <Chip size="small" label={run.status} color={statusColor(run.status) as any} />
                      </TableCell>
                      <TableCell>{run.recordsFetched}</TableCell>
                      <TableCell>{run.recordsInserted}</TableCell>
                      <TableCell>{run.recordsUpdated}</TableCell>
                      <TableCell>{run.requester?.name || run.requester?.username || "System"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Grid>

          <Grid item xs={12} lg={5}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Recent Errors
              </Typography>
              <Stack spacing={1.5}>
                {(statusData?.recentErrors || []).length === 0 && (
                  <Alert severity="success">No recent Walmart sync errors.</Alert>
                )}
                {(statusData?.recentErrors || []).map((error: any) => (
                  <Paper key={error.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack spacing={0.5}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip label={error.resourceType} size="small" />
                        <Chip
                          label={error.syncRun?.status || "unknown"}
                          size="small"
                          color={statusColor(error.syncRun?.status) as any}
                        />
                      </Stack>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {error.errorMessage}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateTime(error.createdAt)}
                      </Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
}

export default WalmartIntegration;

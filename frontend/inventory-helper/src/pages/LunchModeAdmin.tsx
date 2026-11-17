import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  Alert, Box, Button, Chip, CircularProgress, Paper,
  Stack, Switch, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tooltip, Typography,
} from "@mui/material";
import LunchDiningIcon from "@mui/icons-material/LunchDining";
import RefreshIcon from "@mui/icons-material/Refresh";
import BugReportIcon from "@mui/icons-material/BugReport";
import { getApiUrl } from "../config/api";

interface UserRow {
  id: number;
  name: string;
  username: string;
  role: string;
  lunchModeEnabled: boolean;
  lunchModeEnabledAt: string | null;
  lunchModeEnabledBy: number | null;
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function LunchModeAdmin() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [simulateUserId, setSimulateUserId] = useState<number | null>(null);

  const headers = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await axios.get(getApiUrl("lunch-mode/users"), { headers: headers() });
      setUsers(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(fetchUsers, 30_000);
    return () => clearInterval(id);
  }, [fetchUsers]);

  const toggle = async (userId: number) => {
    setToggling(t => ({ ...t, [userId]: true }));
    try {
      await axios.post(getApiUrl(`lunch-mode/toggle/${userId}`), {}, { headers: headers() });
      await fetchUsers();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Toggle failed");
    } finally {
      setToggling(t => ({ ...t, [userId]: false }));
    }
  };

  const activeCount = users.filter(u => u.lunchModeEnabled).length;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2.5}>
        {/* Header */}
        <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <LunchDiningIcon sx={{ color: "#f59e0b", fontSize: 32 }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>Lunch Mode</Typography>
              <Typography variant="body2" color="text.secondary">
                Toggle lunch lockout for TikTok fulfilment users. Activates after their next shipment close.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button size="small" startIcon={<RefreshIcon />} onClick={fetchUsers} disabled={loading}>
              Refresh
            </Button>
          </Stack>
        </Box>

        {/* Status bar */}
        {activeCount > 0 && (
          <Alert severity="info" icon={<LunchDiningIcon />}>
            <strong>{activeCount} user{activeCount > 1 ? "s are" : " is"} in lunch mode</strong> — their screen will show the lockout after their current shipment is closed. Auto-releases at 2:00 PM EST.
          </Alert>
        )}

        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

        {/* Table */}
        <Paper sx={{ borderRadius: 2 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Username</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Lunch Mode</TableCell>
                  <TableCell>Enabled At</TableCell>
                  <TableCell>Simulate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center"><CircularProgress size={24} /></TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}><Typography variant="body2" color="text.secondary">No users found.</Typography></TableCell>
                  </TableRow>
                ) : users.map(u => (
                  <TableRow key={u.id} sx={{ bgcolor: u.lunchModeEnabled ? "rgba(245,158,11,0.06)" : undefined }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{u.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{u.username}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={u.role} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {toggling[u.id] ? (
                          <CircularProgress size={20} />
                        ) : (
                          <Switch
                            checked={u.lunchModeEnabled}
                            onChange={() => toggle(u.id)}
                            color="warning"
                            size="small"
                          />
                        )}
                        {u.lunchModeEnabled && (
                          <Chip
                            label="ACTIVE"
                            size="small"
                            sx={{ bgcolor: "#f59e0b", color: "#fff", fontWeight: 700, fontSize: 10 }}
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {fmtTime(u.lunchModeEnabledAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Simulate lunch mode for this user — their next page load will show the lockout even if it's not 1:30 PM">
                        <Button
                          size="small"
                          variant={simulateUserId === u.id ? "contained" : "outlined"}
                          color="secondary"
                          startIcon={<BugReportIcon />}
                          onClick={() => setSimulateUserId(simulateUserId === u.id ? null : u.id)}
                          sx={{ fontSize: 11 }}
                        >
                          {simulateUserId === u.id ? "Simulating" : "Simulate"}
                        </Button>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Simulate instructions */}
        {simulateUserId !== null && (
          <Alert severity="warning" icon={<BugReportIcon />}>
            <strong>Simulate mode active for user {simulateUserId}.</strong>
            {" "}Open TikTok Fulfillment as that user (or use the simulate button on the fulfillment page) to trigger the lockout screen immediately after any shipment close.
            To test: on the TikTok Fulfillment page, hold{" "}
            <code style={{ background: "rgba(0,0,0,0.08)", padding: "1px 4px", borderRadius: 3 }}>Shift</code>
            {" "}and click the Close button — it will act as if lunch mode fired.
          </Alert>
        )}

        {/* How it works */}
        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(0,0,0,0.02)" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>How It Works</Typography>
          <Stack spacing={0.5}>
            {[
              "Toggle a user ON at 1:30 PM — lunch mode is 'pending' for them.",
              "The lockout screen appears after their NEXT shipment close (doesn't interrupt active sorting).",
              "The user's screen shows 'Time For A Break' with a countdown to 2:00 PM EST.",
              "A manager walks up, enters their user ID and password to unlock early.",
              "At 2:00 PM EST the lockout clears automatically on the next status poll.",
              "Toggle a user OFF at any time to cancel before it fires.",
            ].map((text, i) => (
              <Typography key={i} variant="body2" color="text.secondary">
                {i + 1}. {text}
              </Typography>
            ))}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}

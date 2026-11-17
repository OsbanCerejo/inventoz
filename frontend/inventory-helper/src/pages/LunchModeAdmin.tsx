import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  Alert, Box, Button, Chip, CircularProgress, MenuItem, Paper,
  Select, Stack, Switch, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from "@mui/material";
import LunchDiningIcon from "@mui/icons-material/LunchDining";
import RefreshIcon from "@mui/icons-material/Refresh";
import { getApiUrl } from "../config/api";

interface UserRow {
  id: number;
  name: string;
  username: string;
  role: string;
  lunchModeEnabled: boolean;
  lunchModeEnabledAt: string | null;
  lunchModeEndsAt: string | null;
  lunchModeEnabledBy: number | null;
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

// { h: 0-23, m: 0|15|30|45 }
function defaultEndTime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30);
  const m = Math.round(d.getMinutes() / 15) * 15 % 60;
  return { h: d.getHours(), m };
}

const MINUTES = [0, 15, 30, 45];

interface TimeVal { h: number; m: number }

function TimePicker({ value, onChange }: { value: TimeVal; onChange: (v: TimeVal) => void }) {
  const h12 = value.h % 12 === 0 ? 12 : value.h % 12;
  const ampm = value.h < 12 ? "AM" : "PM";
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Select
        size="small"
        value={h12}
        onChange={e => {
          const newH12 = Number(e.target.value);
          const newH = ampm === "AM" ? (newH12 === 12 ? 0 : newH12) : (newH12 === 12 ? 12 : newH12 + 12);
          onChange({ ...value, h: newH });
        }}
        sx={{ width: 70 }}
      >
        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(h => (
          <MenuItem key={h} value={h}>{h}</MenuItem>
        ))}
      </Select>
      <Select
        size="small"
        value={value.m}
        onChange={e => onChange({ ...value, m: Number(e.target.value) })}
        sx={{ width: 70 }}
      >
        {MINUTES.map(m => (
          <MenuItem key={m} value={m}>{String(m).padStart(2, "0")}</MenuItem>
        ))}
      </Select>
      <Select
        size="small"
        value={ampm}
        onChange={e => {
          const newAmpm = e.target.value as "AM" | "PM";
          let newH = value.h;
          if (newAmpm === "AM" && value.h >= 12) newH = value.h - 12;
          if (newAmpm === "PM" && value.h < 12) newH = value.h + 12;
          onChange({ ...value, h: newH });
        }}
        sx={{ width: 70 }}
      >
        <MenuItem value="AM">AM</MenuItem>
        <MenuItem value="PM">PM</MenuItem>
      </Select>
    </Stack>
  );
}

export default function LunchModeAdmin() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [endTimes, setEndTimes] = useState<Record<number, TimeVal>>({});

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

  useEffect(() => {
    const id = setInterval(fetchUsers, 30_000);
    return () => clearInterval(id);
  }, [fetchUsers]);

  const toggle = async (user: UserRow) => {
    if (!user.lunchModeEnabled) {
      const tv = endTimes[user.id] ?? defaultEndTime();
      const endsAt = new Date();
      endsAt.setHours(tv.h, tv.m, 0, 0);
      if (endsAt <= new Date()) {
        setError(`End time for ${user.name} must be in the future`);
        return;
      }
      setToggling(t => ({ ...t, [user.id]: true }));
      try {
        await axios.post(
          getApiUrl(`lunch-mode/toggle/${user.id}`),
          { endsAt: endsAt.toISOString() },
          { headers: headers() }
        );
        await fetchUsers();
      } catch (e: any) {
        setError(e?.response?.data?.error || "Failed to enable lunch mode");
      } finally {
        setToggling(t => ({ ...t, [user.id]: false }));
      }
    } else {
      // Disabling — no end time needed
      setToggling(t => ({ ...t, [user.id]: true }));
      try {
        await axios.post(getApiUrl(`lunch-mode/toggle/${user.id}`), {}, { headers: headers() });
        await fetchUsers();
      } catch (e: any) {
        setError(e?.response?.data?.error || "Failed to disable lunch mode");
      } finally {
        setToggling(t => ({ ...t, [user.id]: false }));
      }
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
                Lock a user's screen with a break overlay. Set the end time and toggle it on — the overlay fires within 30 seconds on their screen.
              </Typography>
            </Box>
          </Stack>
          <Button size="small" startIcon={<RefreshIcon />} onClick={fetchUsers} disabled={loading}>Refresh</Button>
        </Box>

        {activeCount > 0 && (
          <Alert severity="info" icon={<LunchDiningIcon />}>
            <strong>{activeCount} user{activeCount > 1 ? "s are" : " is"} in lunch mode.</strong>
            {" "}The overlay clears automatically when the end time is reached, or when you toggle it off (clears within ~30 seconds).
          </Alert>
        )}

        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

        <Paper sx={{ borderRadius: 2 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>End Time</TableCell>
                  <TableCell>Started At</TableCell>
                  <TableCell>Ends At</TableCell>
                  <TableCell>Lunch Mode</TableCell>
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
                      <Stack>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{u.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{u.username}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip label={u.role} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      {u.lunchModeEnabled ? (
                        <Typography variant="body2" color="text.secondary">—</Typography>
                      ) : (
                        <TimePicker
                          value={endTimes[u.id] ?? defaultEndTime()}
                          onChange={v => setEndTimes(t => ({ ...t, [u.id]: v }))}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{fmtTime(u.lunchModeEnabledAt)}</Typography>
                    </TableCell>
                    <TableCell>
                      {u.lunchModeEnabled && u.lunchModeEndsAt ? (
                        <Typography variant="body2" sx={{ fontWeight: 600, color: "#f59e0b" }}>
                          {fmtTime(u.lunchModeEndsAt)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {toggling[u.id] ? (
                          <CircularProgress size={20} />
                        ) : (
                          <Switch
                            checked={u.lunchModeEnabled}
                            onChange={() => toggle(u)}
                            color="warning"
                            size="small"
                          />
                        )}
                        {u.lunchModeEnabled && (
                          <Chip
                            label="ON"
                            size="small"
                            sx={{ bgcolor: "#f59e0b", color: "#fff", fontWeight: 700, fontSize: 10 }}
                          />
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(0,0,0,0.02)" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>How It Works</Typography>
          <Stack spacing={0.5}>
            {[
              "Set the end time, then toggle ON — the overlay fires on their screen within ~30 seconds.",
              "Toggle OFF at any time — the overlay clears on their next poll (~30 seconds), no refresh needed.",
              "Overlay auto-clears when the end time is reached.",
              "A manager enters their user ID and password on the locked screen to unlock early.",
              "Admins are never subject to lunch mode.",
            ].map((text, i) => (
              <Typography key={i} variant="body2" color="text.secondary">{i + 1}. {text}</Typography>
            ))}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}

import { useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { getApiUrl } from "../config/api";

type LogEntry = {
  id: number;
  timestamp: string;
  action: string;
  entityType: string;
  entityId: string;
  type: string;
  changes: any;
  previousState: any;
  newState: any;
  metaData: any;
  userId: string | null;
  userName: string;
};

type LogsResponse = {
  sku: string;
  total: number;
  logs: LogEntry[];
};

const ACTION_META: Record<string, { label: string; color: "success" | "warning" | "error" | "default"; icon: React.ReactNode }> = {
  create: { label: "CREATE", color: "success", icon: <AddCircleOutlineIcon fontSize="small" /> },
  update: { label: "UPDATE", color: "warning", icon: <EditIcon fontSize="small" /> },
  delete: { label: "DELETE", color: "error", icon: <DeleteOutlineIcon fontSize="small" /> },
};

const ENTITY_LABELS: Record<string, string> = {
  product: "Product",
  product_details: "Product Details",
  listings: "Listings",
  inbound: "Inbound",
  sales: "Sales",
  invoice: "Invoice",
};

function formatDate(ts: string) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function ChangesDiff({ previous, next, changes }: { previous: any; next: any; changes: any }) {
  // Build field-level diff from whatever data is available
  const rows: { field: string; from: string; to: string }[] = [];

  if (previous && next && typeof previous === "object" && typeof next === "object") {
    const allKeys = new Set([...Object.keys(previous), ...Object.keys(next)]);
    allKeys.forEach((key) => {
      const oldVal = previous[key];
      const newVal = next[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        rows.push({ field: key, from: oldVal == null ? "—" : String(oldVal), to: newVal == null ? "—" : String(newVal) });
      }
    });
  } else if (Array.isArray(changes)) {
    changes.forEach((c: any) => {
      if (c && typeof c === "object") {
        Object.entries(c).forEach(([k, v]) => {
          if (k !== "sku") rows.push({ field: k, from: "—", to: String(v) });
        });
      }
    });
  } else if (changes && typeof changes === "object" && !Array.isArray(changes)) {
    Object.entries(changes).forEach(([k, v]) => {
      if (k !== "sku") rows.push({ field: k, from: "—", to: String(v) });
    });
  }

  if (!rows.length) return null;

  return (
    <Table size="small" sx={{ mt: 1 }}>
      <TableHead>
        <TableRow sx={{ "& th": { fontWeight: 700, fontSize: 11, color: "text.secondary", py: 0.5 } }}>
          <TableCell>Field</TableCell>
          <TableCell>Before</TableCell>
          <TableCell>After</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.field} sx={{ "& td": { py: 0.5, fontSize: 13 } }}>
            <TableCell sx={{ fontWeight: 600, color: "text.secondary", fontFamily: "monospace" }}>{r.field}</TableCell>
            <TableCell sx={{ color: "error.main", maxWidth: 260, wordBreak: "break-word" }}>{r.from}</TableCell>
            <TableCell sx={{ color: "success.main", maxWidth: 260, wordBreak: "break-word" }}>{r.to}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LogCard({ log }: { log: LogEntry }) {
  const meta = ACTION_META[log.action] ?? { label: log.action.toUpperCase(), color: "default", icon: null };
  const entityLabel = ENTITY_LABELS[log.entityType] ?? log.entityType;
  const hasChanges = log.previousState || log.newState || log.changes;

  return (
    <Box sx={{ display: "flex", gap: 2 }}>
      {/* Timeline dot + line */}
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", pt: 0.5 }}>
        <Box sx={{
          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
          bgcolor: `${meta.color}.main`, color: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {meta.icon}
        </Box>
        <Box sx={{ flex: 1, width: "2px", bgcolor: "divider", mt: 0.5 }} />
      </Box>

      {/* Card */}
      <Paper variant="outlined" sx={{ flex: 1, p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip label={meta.label} color={meta.color} size="small" sx={{ fontWeight: 700, fontSize: 11 }} />
          <Chip label={entityLabel} size="small" variant="outlined" />
          <Typography variant="body2" color="text.secondary" sx={{ ml: "auto" }}>
            {formatDate(log.timestamp)}
          </Typography>
        </Stack>

        <Typography variant="body2" sx={{ mt: 1 }}>
          <strong>{log.userName}</strong>
          {log.action === "create" && ` created this ${entityLabel.toLowerCase()}`}
          {log.action === "update" && ` updated this ${entityLabel.toLowerCase()}`}
          {log.action === "delete" && ` deleted this ${entityLabel.toLowerCase()}`}
          {!["create", "update", "delete"].includes(log.action) && ` performed ${log.action} on ${entityLabel.toLowerCase()}`}
        </Typography>

        {hasChanges && (
          <ChangesDiff previous={log.previousState} next={log.newState} changes={log.changes} />
        )}
      </Paper>
    </Box>
  );
}

export default function AuditLog() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LogsResponse | null>(null);
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [entityFilter, setEntityFilter] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const sku = input.trim();
    if (!sku) return;
    setLoading(true);
    setError(null);
    setData(null);
    setActionFilter(null);
    setEntityFilter(null);
    try {
      const res = await axios.get<LogsResponse>(getApiUrl(`logs/sku/${encodeURIComponent(sku)}`));
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = (data?.logs ?? []).filter((l) => {
    if (actionFilter && l.action !== actionFilter) return false;
    if (entityFilter && l.entityType !== entityFilter) return false;
    return true;
  });

  const entityTypes = data ? [...new Set(data.logs.map((l) => l.entityType))] : [];

  return (
    <Box sx={{ px: 3, py: 3, maxWidth: 900, mx: "auto" }}>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>Audit Log</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter a SKU to view its full history — creation, edits, and deletions.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Box component="form" onSubmit={handleSearch} sx={{ display: "flex", gap: 1.5 }}>
          <TextField
            fullWidth
            label="SKU"
            placeholder="e.g. ABC-123"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            autoFocus
          />
          <Box>
            <Box
              component="button"
              type="submit"
              disabled={loading || !input.trim()}
              sx={{
                height: 56, px: 3, borderRadius: 1, border: "none", cursor: "pointer",
                bgcolor: "primary.main", color: "white", fontWeight: 700, fontSize: 15,
                display: "flex", alignItems: "center", gap: 1,
                "&:disabled": { opacity: 0.5, cursor: "default" },
              }}
            >
              {loading ? <CircularProgress size={20} color="inherit" /> : <><SearchIcon fontSize="small" /> Search</>}
            </Box>
          </Box>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {data && (
        <>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
            <Typography variant="h6" fontWeight={700}>
              {data.sku}
            </Typography>
            <Chip label={`${data.total} event${data.total !== 1 ? "s" : ""}`} size="small" />
            <Box sx={{ ml: "auto" }} />

            {/* Action filter */}
            <ToggleButtonGroup
              size="small"
              value={actionFilter}
              exclusive
              onChange={(_, v) => setActionFilter(v)}
            >
              <ToggleButton value="create" sx={{ fontSize: 11, fontWeight: 700 }}>Creates</ToggleButton>
              <ToggleButton value="update" sx={{ fontSize: 11, fontWeight: 700 }}>Updates</ToggleButton>
              <ToggleButton value="delete" sx={{ fontSize: 11, fontWeight: 700 }}>Deletes</ToggleButton>
            </ToggleButtonGroup>

            {/* Entity filter */}
            {entityTypes.length > 1 && (
              <ToggleButtonGroup
                size="small"
                value={entityFilter}
                exclusive
                onChange={(_, v) => setEntityFilter(v)}
              >
                {entityTypes.map((et) => (
                  <ToggleButton key={et} value={et} sx={{ fontSize: 11 }}>
                    {ENTITY_LABELS[et] ?? et}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}
          </Stack>

          <Divider sx={{ mb: 2 }} />

          {filteredLogs.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
              No events match the current filters.
            </Typography>
          ) : (
            <Box>
              {filteredLogs.map((log) => (
                <LogCard key={log.id} log={log} />
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

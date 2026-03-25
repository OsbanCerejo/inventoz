import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { getApiUrl } from "../config/api";
import { useAuth } from "../context/AuthContext";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Save as SaveIcon,
} from "@mui/icons-material";

type UserMini = {
  id: number;
  name?: string;
  username: string;
};

type TicketItem = {
  id?: number;
  sku: string;
  itemName: string;
  quantity: number;
  notes: string;
};

type TicketActivity = {
  id: number;
  actionType: string;
  fromStatus: string | null;
  toStatus: string | null;
  details: string | null;
  createdAt: string;
  actor?: UserMini | null;
};

type Ticket = {
  id: number;
  ticketNumber: string;
  status: string;
  priority: string;
  reason: string | null;
  username: string;
  orderId: string;
  trackingNumber: string | null;
  shippingAddress: string;
  needsReturnLabel: boolean;
  notes: string | null;
  assignedTo: number | null;
  createdAt: string;
  updatedAt: string;
  items: TicketItem[];
  activities?: TicketActivity[];
  creator?: UserMini | null;
  assignee?: UserMini | null;
  updater?: UserMini | null;
};

type TicketListResponse = {
  data: Ticket[];
  page: number;
  total: number;
  totalPages: number;
};

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "ready_to_ship", label: "Ready to Ship" },
  { value: "waiting_on_item", label: "Waiting on Item" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const emptyForm = {
  id: null as number | null,
  updatedAt: "",
  username: "",
  orderId: "",
  trackingNumber: "",
  shippingAddress: "",
  reason: "",
  notes: "",
  status: "new",
  priority: "normal",
  needsReturnLabel: false,
  assignedTo: "",
  items: [{ sku: "", itemName: "", quantity: 1, notes: "" }] as TicketItem[],
};

function Tickets() {
  const { token, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [totalTickets, setTotalTickets] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [comment, setComment] = useState("");
  const [users, setUsers] = useState<UserMini[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "board">("list");

  const canCreate = hasPermission("tickets", "create");
  const canEdit = hasPermission("tickets", "edit");
  const canDelete = hasPermission("tickets", "delete");

  const groupedByStatus = useMemo(() => {
    const groups: Record<string, Ticket[]> = {
      new: [],
      acknowledged: [],
      ready_to_ship: [],
      waiting_on_item: [],
      done: [],
    };
    tickets.forEach((ticket) => {
      if (groups[ticket.status]) {
        groups[ticket.status].push(ticket);
      }
    });
    return groups;
  }, [tickets]);

  const loadTickets = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await axios.get<TicketListResponse>(getApiUrl("tickets"), {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          page: 1,
          limit: 50,
          status: statusFilter,
          search: search || undefined,
        },
      });
      setTickets(response.data.data || []);
      setTotalTickets(response.data.total || 0);
    } catch (error) {
      console.error("Failed to load tickets:", error);
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  const loadTicketDetail = async (ticketId: number) => {
    if (!token) return;
    try {
      const response = await axios.get<Ticket>(getApiUrl(`tickets/${ticketId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedTicket(response.data);
      return response.data;
    } catch (error) {
      console.error("Failed to load ticket details:", error);
      toast.error("Failed to load ticket details");
      return null;
    }
  };

  const loadUsers = async () => {
    if (!token) return;
    try {
      const response = await axios.get<UserMini[]>(getApiUrl("api/users"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data || []);
    } catch (error) {
      console.error("Failed to load users for assignment:", error);
      setUsers([]);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [token, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [token]);

  const openCreateDialog = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = async (ticketId: number) => {
    const detail = await loadTicketDetail(ticketId);
    if (!detail) return;
    setForm({
      id: detail.id,
      updatedAt: detail.updatedAt || "",
      username: detail.username || "",
      orderId: detail.orderId || "",
      trackingNumber: detail.trackingNumber || "",
      shippingAddress: detail.shippingAddress || "",
      reason: detail.reason || "",
      notes: detail.notes || "",
      status: detail.status || "new",
      priority: detail.priority || "normal",
      needsReturnLabel: !!detail.needsReturnLabel,
      assignedTo: detail.assignedTo ? String(detail.assignedTo) : "",
      items:
        detail.items && detail.items.length > 0
          ? detail.items.map((item) => ({
              id: item.id,
              sku: item.sku || "",
              itemName: item.itemName || "",
              quantity: item.quantity || 1,
              notes: item.notes || "",
            }))
          : [{ sku: "", itemName: "", quantity: 1, notes: "" }],
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setForm(emptyForm);
  };

  const saveTicket = async () => {
    if (!token) return;
    if (!form.username.trim() || !form.orderId.trim() || !form.shippingAddress.trim()) {
      toast.error("Username, Order ID, and Shipping Address are required");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        username: form.username.trim(),
        orderId: form.orderId.trim(),
        trackingNumber: form.trackingNumber.trim(),
        shippingAddress: form.shippingAddress.trim(),
        reason: form.reason.trim(),
        notes: form.notes.trim(),
        status: form.status,
        priority: form.priority,
        needsReturnLabel: form.needsReturnLabel,
        assignedTo: form.assignedTo ? Number(form.assignedTo) : null,
        items: form.items,
        expectedUpdatedAt: form.id ? form.updatedAt : undefined,
      };
      if (form.id) {
        await axios.put(getApiUrl(`tickets/${form.id}`), payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Ticket updated");
      } else {
        await axios.post(getApiUrl("tickets"), payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Ticket created");
      }
      closeDialog();
      await loadTickets();
      if (selectedTicketId) {
        await loadTicketDetail(selectedTicketId);
      }
    } catch (error: any) {
      console.error("Failed to save ticket:", error);
      if (error?.response?.status === 409) {
        toast.error(error?.response?.data?.error || "Ticket changed by another user. Refresh and retry.");
      } else {
        toast.error(error?.response?.data?.error || "Failed to save ticket");
      }
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (ticket: Ticket, newStatus: string) => {
    if (!token) return;
    try {
      await axios.patch(
        getApiUrl(`tickets/${ticket.id}/status`),
        { status: newStatus, expectedUpdatedAt: ticket.updatedAt },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Status updated");
      await loadTickets();
      if (selectedTicketId === ticket.id) {
        await loadTicketDetail(ticket.id);
      }
    } catch (error: any) {
      console.error("Failed to update status:", error);
      if (error?.response?.status === 409) {
        toast.error(error?.response?.data?.error || "Ticket changed by another user. Refresh and retry.");
      } else {
        toast.error(error?.response?.data?.error || "Failed to update status");
      }
    }
  };

  const addComment = async () => {
    if (!token || !selectedTicketId) return;
    if (!comment.trim()) return;
    try {
      await axios.post(
        getApiUrl(`tickets/${selectedTicketId}/comment`),
        { comment: comment.trim(), expectedUpdatedAt: selectedTicket?.updatedAt },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setComment("");
      toast.success("Comment added");
      await loadTicketDetail(selectedTicketId);
      await loadTickets();
    } catch (error: any) {
      console.error("Failed to add comment:", error);
      if (error?.response?.status === 409) {
        toast.error(error?.response?.data?.error || "Ticket changed by another user. Refresh and retry.");
      } else {
        toast.error(error?.response?.data?.error || "Failed to add comment");
      }
    }
  };

  const deleteTicket = async (ticket: Ticket) => {
    if (!token) return;
    if (!window.confirm("Archive this ticket?")) return;
    try {
      await axios.delete(getApiUrl(`tickets/${ticket.id}`), {
        headers: { Authorization: `Bearer ${token}` },
        data: { expectedUpdatedAt: ticket.updatedAt },
      });
      toast.success("Ticket archived");
      if (selectedTicketId === ticket.id) {
        setSelectedTicketId(null);
        setSelectedTicket(null);
      }
      await loadTickets();
    } catch (error: any) {
      console.error("Failed to delete ticket:", error);
      if (error?.response?.status === 409) {
        toast.error(error?.response?.data?.error || "Ticket changed by another user. Refresh and retry.");
      } else {
        toast.error(error?.response?.data?.error || "Failed to archive ticket");
      }
    }
  };

  const addItemRow = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { sku: "", itemName: "", quantity: 1, notes: "" }],
    }));
  };

  const removeItemRow = (index: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const updateItemRow = (index: number, key: keyof TicketItem, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, rowIndex) =>
        rowIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const getStatusChipColor = (status: string) => {
    switch (status) {
      case "done":
        return "success";
      case "ready_to_ship":
        return "info";
      case "waiting_on_item":
        return "warning";
      case "acknowledged":
        return "primary";
      default:
        return "default";
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "new":
        return { bg: "#1e88e5", border: "#1e88e5", text: "#ffffff" };
      case "acknowledged":
        return { bg: "#8e24aa", border: "#8e24aa", text: "#ffffff" };
      case "ready_to_ship":
        return { bg: "#00897b", border: "#00897b", text: "#ffffff" };
      case "waiting_on_item":
        return { bg: "#fb8c00", border: "#fb8c00", text: "#ffffff" };
      case "done":
        return { bg: "#43a047", border: "#43a047", text: "#ffffff" };
      default:
        return { bg: "#475569", border: "#475569", text: "#ffffff" };
    }
  };

  const getUrgentRowStyles = (ticket: Ticket) => {
    if (ticket.priority !== "urgent" || ticket.status === "done") {
      return {};
    }

    return {
      backgroundColor: "#ffebee",
      "&:hover": {
        backgroundColor: "#ffcdd2",
      },
      "&.Mui-selected": {
        backgroundColor: "#ef9a9a",
      },
      "&.Mui-selected:hover": {
        backgroundColor: "#e57373",
      },
    };
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Reshipment Tickets
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track customer care reshipments and fulfillment updates in one workflow.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={viewMode}
            onChange={(_, value) => {
              if (value) setViewMode(value);
            }}
          >
            <ToggleButton value="list">List</ToggleButton>
            <ToggleButton value="board">Board</ToggleButton>
          </ToggleButtonGroup>
          <Button startIcon={<RefreshIcon />} onClick={loadTickets} variant="outlined">
            Refresh
          </Button>
          {canCreate && (
            <Button startIcon={<AddIcon />} onClick={openCreateDialog} variant="contained">
              New Ticket
            </Button>
          )}
        </Stack>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search"
                placeholder="Ticket, username, order ID, or tracking #"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(String(e.target.value))}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  {STATUS_OPTIONS.map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button variant="contained" fullWidth sx={{ height: "56px" }} onClick={loadTickets}>
                Apply
              </Button>
            </Grid>
            <Grid item xs={12} md={3}>
              <Paper
                variant="outlined"
                sx={{ height: "56px", display: "flex", alignItems: "center", px: 2 }}
              >
                <Typography variant="body2" color="text.secondary">
                  Total: <strong>{totalTickets}</strong>
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <Card>
            <CardContent>
              {loading ? (
                <Box display="flex" justifyContent="center" py={5}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  {tickets.length === 0 && <Alert severity="info">No tickets found.</Alert>}
                  {viewMode === "list" && tickets.length > 0 && (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Ticket</TableCell>
                            <TableCell>Customer</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Priority</TableCell>
                            <TableCell>Created</TableCell>
                            <TableCell align="right">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {tickets.map((ticket) => (
                            <TableRow
                              key={ticket.id}
                              hover
                              selected={selectedTicketId === ticket.id}
                              onClick={async () => {
                                setSelectedTicketId(ticket.id);
                                await loadTicketDetail(ticket.id);
                              }}
                              sx={{
                                cursor: "pointer",
                                ...getUrgentRowStyles(ticket),
                              }}
                            >
                              <TableCell>{ticket.ticketNumber}</TableCell>
                              <TableCell>{ticket.username}</TableCell>
                              <TableCell>
                                <Chip
                                  label={STATUS_OPTIONS.find((s) => s.value === ticket.status)?.label || ticket.status}
                                  color={getStatusChipColor(ticket.status) as any}
                                  size="small"
                                  sx={{
                                    backgroundColor: getStatusStyles(ticket.status).bg,
                                    color: getStatusStyles(ticket.status).text,
                                    border: `1px solid ${getStatusStyles(ticket.status).border}`,
                                  }}
                                />
                              </TableCell>
                              <TableCell>{ticket.priority}</TableCell>
                              <TableCell>{new Date(ticket.createdAt).toLocaleString()}</TableCell>
                              <TableCell align="right">
                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                  <IconButton
                                    size="small"
                                    onClick={async (event) => {
                                      event.stopPropagation();
                                      setSelectedTicketId(ticket.id);
                                      await loadTicketDetail(ticket.id);
                                    }}
                                  >
                                    <VisibilityIcon fontSize="small" />
                                  </IconButton>
                                  {canEdit && (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openEditDialog(ticket.id);
                                      }}
                                    >
                                      Edit
                                    </Button>
                                  )}
                                  {canDelete && (
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        deleteTicket(ticket);
                                      }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  )}
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                  {viewMode === "board" && tickets.length > 0 && (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                        gap: 1.5,
                      }}
                    >
                      {STATUS_OPTIONS.map((status) => {
                        const statusTickets = groupedByStatus[status.value] || [];
                        const style = getStatusStyles(status.value);
                        return (
                          <Paper
                            key={status.value}
                            variant="outlined"
                            sx={{
                              p: 1,
                              backgroundColor: style.bg,
                              borderColor: style.border,
                              minHeight: 180,
                            }}
                          >
                            <Typography variant="subtitle2" sx={{ color: style.text, fontWeight: 700, mb: 1 }}>
                              {status.label} ({statusTickets.length})
                            </Typography>
                            <Stack spacing={1}>
                              {statusTickets.length === 0 && (
                                <Typography variant="caption" color="text.secondary">
                                  No tickets
                                </Typography>
                              )}
                              {statusTickets.map((ticket) => (
                                <Paper
                                  key={ticket.id}
                                  variant="outlined"
                                  onClick={async () => {
                                    setSelectedTicketId(ticket.id);
                                    await loadTicketDetail(ticket.id);
                                  }}
                                  sx={{
                                    p: 1,
                                    cursor: "pointer",
                                    borderColor: selectedTicketId === ticket.id ? "#1976d2" : "#dbeafe",
                                  }}
                                >
                                  <Typography variant="caption" fontWeight={700}>
                                    {ticket.ticketNumber}
                                  </Typography>
                                  <Typography variant="body2">{ticket.username}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    Order: {ticket.orderId}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    Tracking: {ticket.trackingNumber || "-"}
                                  </Typography>
                                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                                    <Chip size="small" label={ticket.priority} />
                                    <Chip size="small" label={`${ticket.items?.length || 0} item(s)`} />
                                  </Stack>
                                </Paper>
                              ))}
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Box>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Card>
            <CardContent>
              {!selectedTicket && (
                <Alert severity="info">Select a ticket to view details and activity.</Alert>
              )}
              {selectedTicket && (
                <Stack spacing={2}>
                  <Typography variant="h6" fontWeight={700}>
                    {selectedTicket.ticketNumber}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Customer:</strong> {selectedTicket.username}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Order ID:</strong> {selectedTicket.orderId}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Tracking #:</strong> {selectedTicket.trackingNumber || "-"}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Address:</strong> {selectedTicket.shippingAddress}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Return Label:</strong>{" "}
                    {selectedTicket.needsReturnLabel ? "Required" : "Not required"}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Items:</strong> {selectedTicket.items?.length || 0}
                  </Typography>
                  <Box
                    sx={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 1,
                      p: 1.5,
                      backgroundColor: "#f8fafc",
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                      Ticket Items
                    </Typography>
                    {(selectedTicket.items || []).length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No items added to this ticket.
                      </Typography>
                    ) : (
                      <Stack spacing={1}>
                        {selectedTicket.items.map((item, index) => (
                          <Box
                            key={`${item.id || "item"}-${index}`}
                            sx={{
                              p: 1,
                              borderRadius: 1,
                              backgroundColor: "#ffffff",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            <Typography variant="body2" fontWeight={600}>
                              {item.itemName || "Unnamed Item"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              SKU: {item.sku || "-"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Qty: {item.quantity || 1}
                            </Typography>
                            {item.notes ? (
                              <Typography variant="caption" color="text.secondary" display="block">
                                Notes: {item.notes}
                              </Typography>
                            ) : null}
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                  <FormControl fullWidth size="small" disabled={!canEdit}>
                    <InputLabel>Quick Status</InputLabel>
                    <Select
                      label="Quick Status"
                      value={selectedTicket.status}
                      onChange={(e) => updateStatus(selectedTicket, String(e.target.value))}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <MenuItem key={status.value} value={status.value}>
                          {status.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {canEdit && (
                    <Stack direction="row" spacing={1}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Add Comment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />
                      <Button variant="contained" onClick={addComment}>
                        Add
                      </Button>
                    </Stack>
                  )}
                  <Typography variant="subtitle2" fontWeight={700}>
                    Activity
                  </Typography>
                  <Box sx={{ maxHeight: 360, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 1, p: 1 }}>
                    {(selectedTicket.activities || []).length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        No activity yet.
                      </Typography>
                    )}
                    {(selectedTicket.activities || []).map((activity) => (
                      <Box key={activity.id} sx={{ mb: 1.5, pb: 1.5, borderBottom: "1px solid #f1f5f9" }}>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(activity.createdAt).toLocaleString()} by{" "}
                          {activity.actor?.name || activity.actor?.username || "System"}
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {activity.actionType.replaceAll("_", " ")}
                        </Typography>
                        <Typography variant="body2">{activity.details || "-"}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="md">
        <DialogTitle>{form.id ? "Edit Ticket" : "Create Ticket"}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Customer Username *"
                value={form.username}
                onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Order ID *"
                value={form.orderId}
                onChange={(e) => setForm((prev) => ({ ...prev, orderId: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Tracking Number"
                value={form.trackingNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, trackingNumber: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Shipping Address *"
                value={form.shippingAddress}
                onChange={(e) => setForm((prev) => ({ ...prev, shippingAddress: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Reason"
                placeholder="Damaged, wrong item, not delivered..."
                value={form.reason}
                onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: String(e.target.value) }))}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  label="Priority"
                  value={form.priority}
                  onChange={(e) => setForm((prev) => ({ ...prev, priority: String(e.target.value) }))}
                >
                  {PRIORITY_OPTIONS.map((priority) => (
                    <MenuItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Assign To</InputLabel>
                <Select
                  label="Assign To"
                  value={form.assignedTo}
                  onChange={(e) => setForm((prev) => ({ ...prev, assignedTo: String(e.target.value) }))}
                >
                  <MenuItem value="">Unassigned</MenuItem>
                  {users.map((user) => (
                    <MenuItem key={user.id} value={String(user.id)}>
                      {user.name || user.username}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Return Label Needed</InputLabel>
                <Select
                  label="Return Label Needed"
                  value={form.needsReturnLabel ? "yes" : "no"}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, needsReturnLabel: String(e.target.value) === "yes" }))
                  }
                >
                  <MenuItem value="no">No</MenuItem>
                  <MenuItem value="yes">Yes</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                Products To Reship
              </Typography>
              <Stack spacing={1}>
                {form.items.map((item, index) => (
                  <Grid container spacing={1} key={`${item.id || "new"}-${index}`}>
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="SKU"
                        value={item.sku}
                        onChange={(e) => updateItemRow(index, "sku", e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Item Name"
                        value={item.itemName}
                        onChange={(e) => updateItemRow(index, "itemName", e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItemRow(index, "quantity", Number(e.target.value) || 1)}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Notes"
                        value={item.notes}
                        onChange={(e) => updateItemRow(index, "notes", e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} md={1}>
                      <IconButton
                        color="error"
                        onClick={() => removeItemRow(index)}
                        disabled={form.items.length === 1}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Grid>
                  </Grid>
                ))}
                <Box>
                  <Button startIcon={<AddIcon />} onClick={addItemRow} variant="outlined">
                    Add Product Row
                  </Button>
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={saveTicket}
            disabled={saving}
          >
            {saving ? "Saving..." : form.id ? "Save Changes" : "Create Ticket"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Tickets;

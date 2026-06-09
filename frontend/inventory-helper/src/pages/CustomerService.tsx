import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { getApiUrl } from "../config/api";

const API_BASE = "customer-service";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = ["whatnot", "tiktok"] as const;
const PRIORITIES = ["normal", "high", "urgent"] as const;
const STATUSES = ["open", "assigned", "in_progress", "waiting_on_customer", "waiting_on_internal_team", "resolved"] as const;
const CATEGORIES = [
  "missing_item", "wrong_item", "damaged_item", "package_not_received",
  "return_refund_request", "complaint", "address_issue", "general_question", "other",
] as const;

type Platform = typeof PLATFORMS[number];
type Priority = typeof PRIORITIES[number];
type Status = typeof STATUSES[number];
type Category = typeof CATEGORIES[number];

const LABEL: Record<string, string> = {
  whatnot: "Whatnot", tiktok: "TikTok",
  normal: "Normal", high: "High", urgent: "Urgent",
  open: "Open", assigned: "Assigned", in_progress: "In Progress",
  waiting_on_customer: "Waiting on Customer", waiting_on_internal_team: "Waiting on Internal Team",
  resolved: "Resolved",
  missing_item: "Missing Item", wrong_item: "Wrong Item", damaged_item: "Damaged Item",
  package_not_received: "Package Not Received", return_refund_request: "Return / Refund Request",
  complaint: "Complaint", address_issue: "Address Issue", general_question: "General Question",
  other: "Other",
};

const STATUS_STYLE: Record<Status, { bg: string; text: string; dot: string }> = {
  open:                     { bg: "#dbeafe", text: "#1d4ed8", dot: "#3b82f6" },
  assigned:                 { bg: "#ede9fe", text: "#6d28d9", dot: "#8b5cf6" },
  in_progress:              { bg: "#fef3c7", text: "#b45309", dot: "#f59e0b" },
  waiting_on_customer:      { bg: "#cffafe", text: "#0e7490", dot: "#06b6d4" },
  waiting_on_internal_team: { bg: "#f1f5f9", text: "#475569", dot: "#94a3b8" },
  resolved:                 { bg: "#dcfce7", text: "#15803d", dot: "#22c55e" },
};

const PRIORITY_STYLE: Record<Priority, { bg: string; text: string; dot: string }> = {
  normal: { bg: "#f1f5f9", text: "#475569", dot: "#94a3b8" },
  high:   { bg: "#fef3c7", text: "#b45309", dot: "#f59e0b" },
  urgent: { bg: "#fee2e2", text: "#b91c1c", dot: "#ef4444" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRef { id: number; name: string | null; username: string; }

interface Ticket {
  id: number; ticketNumber: string; platform: Platform; username: string;
  orderNumber: string; issueCategory: Category; priority: Priority; status: Status;
  assignedTo: number | null; dueAt: string | null; resolvedAt: string | null;
  isArchived: boolean; archivedAt: string | null; archiveReason: string | null;
  createdAt: string; updatedAt: string;
  creator?: UserRef; assignee?: UserRef; updater?: UserRef;
  notes?: Note[]; activities?: Activity[];
}

interface Note { id: number; ticketId: number; note: string; createdBy: number | null; createdAt: string; author?: UserRef; }
interface Activity { id: number; ticketId: number; actionType: string; fromValue: string | null; toValue: string | null; details: string | null; performedBy: number | null; createdAt: string; actor?: UserRef; }
interface Notification { id: number; ticketId: number; type: string; message: string; isRead: boolean; createdAt: string; ticket?: Pick<Ticket, "id" | "ticketNumber" | "platform" | "username" | "status">; }

interface Dashboard { open: number; assigned: number; inProgress: number; waitingCustomer: number; waitingInternal: number; urgent: number; dueToday: number; overdue: number; resolvedThisWeek: number; archivedTotal: number; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function timeDiff(dueAt: string | null): { label: string; overdue: boolean } | null {
  if (!dueAt) return null;
  const diff = new Date(dueAt).getTime() - Date.now();
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const label = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`;
  return { label: overdue ? `${label} overdue` : `${label} left`, overdue };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ text, color, bg, dot }: { text: string; color?: string; bg?: string; dot?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600, color: color || "#fff", backgroundColor: bg || "#6b7280", whiteSpace: "nowrap" }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: dot, flexShrink: 0 }} />}
      {text}
    </span>
  );
}

function DueChip({ dueAt, status }: { dueAt: string | null; status: Status }) {
  if (status === "resolved" || !dueAt) return null;
  const info = timeDiff(dueAt);
  if (!info) return null;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: info.overdue ? "#dc2626" : "#6b7280", whiteSpace: "nowrap" }}>
      {info.label}
    </span>
  );
}

function Card({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px 20px", minWidth: 120, flex: "1 1 120px" }}>
      <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{title}</div>
    </div>
  );
}

function TicketRow({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  return (
    <tr
      onClick={onClick}
      style={{ cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
    >
      <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: 13, color: "#2563eb" }}>{ticket.ticketNumber}</td>
      <td style={{ padding: "10px 8px" }}><Badge text={LABEL[ticket.platform]} bg={ticket.platform === "whatnot" ? "#7c3aed" : "#0f172a"} /></td>
      <td style={{ padding: "10px 8px", fontSize: 13 }}>{ticket.username}</td>
      <td style={{ padding: "10px 8px", fontSize: 12, color: "#64748b" }}>{ticket.orderNumber}</td>
      <td style={{ padding: "10px 8px" }}><Badge text={LABEL[ticket.issueCategory]} bg="#e2e8f0" color="#334155" /></td>
      <td style={{ padding: "10px 8px" }}><Badge text={LABEL[ticket.priority]} bg={PRIORITY_STYLE[ticket.priority].bg} color={PRIORITY_STYLE[ticket.priority].text} dot={PRIORITY_STYLE[ticket.priority].dot} /></td>
      <td style={{ padding: "10px 8px" }}><Badge text={LABEL[ticket.status]} bg={STATUS_STYLE[ticket.status].bg} color={STATUS_STYLE[ticket.status].text} dot={STATUS_STYLE[ticket.status].dot} /></td>
      <td style={{ padding: "10px 8px", fontSize: 12, color: "#64748b" }}>{ticket.assignee?.name || ticket.assignee?.username || "—"}</td>
      <td style={{ padding: "10px 8px" }}><DueChip dueAt={ticket.dueAt} status={ticket.status} /></td>
      <td style={{ padding: "10px 8px", fontSize: 12, color: "#94a3b8" }}>{fmtDate(ticket.createdAt)}</td>
    </tr>
  );
}

// ─── Create Ticket Modal ──────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated, token }: { onClose: () => void; onCreated: (t: Ticket) => void; token: string | null }) {
  const [form, setForm] = useState({ platform: "whatnot" as Platform, username: "", orderNumber: "", issueCategory: "missing_item" as Category, priority: "normal" as Priority });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.username.trim() || !form.orderNumber.trim()) { toast.error("Username and Order Number are required"); return; }
    setSaving(true);
    try {
      const { data } = await axios.post(getApiUrl(API_BASE), form, { headers: authHeaders(token) });
      toast.success(`Ticket ${data.ticketNumber} created`);
      onCreated(data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create ticket");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrap title="New Customer Service Ticket" onClose={onClose}>
      <FormRow label="Platform">
        <select value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value as Platform }))} style={inputStyle}>
          {PLATFORMS.map((p) => <option key={p} value={p}>{LABEL[p]}</option>)}
        </select>
      </FormRow>
      <FormRow label="Customer Username"><input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} style={inputStyle} placeholder="e.g. johndoe" /></FormRow>
      <FormRow label="Order Number"><input value={form.orderNumber} onChange={(e) => setForm((f) => ({ ...f, orderNumber: e.target.value }))} style={inputStyle} placeholder="Order ID" /></FormRow>
      <FormRow label="Issue Category">
        <select value={form.issueCategory} onChange={(e) => setForm((f) => ({ ...f, issueCategory: e.target.value as Category }))} style={inputStyle}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{LABEL[c]}</option>)}
        </select>
      </FormRow>
      <FormRow label="Priority">
        <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Priority }))} style={inputStyle}>
          {PRIORITIES.map((p) => <option key={p} value={p}>{LABEL[p]}</option>)}
        </select>
      </FormRow>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
        <button onClick={onClose} style={btnSecondary}>Cancel</button>
        <button onClick={submit} disabled={saving} style={btnPrimary}>{saving ? "Creating…" : "Create Ticket"}</button>
      </div>
    </ModalWrap>
  );
}

// ─── Ticket Detail Modal ──────────────────────────────────────────────────────

function TicketDetail({
  ticket, onClose, onUpdated, allUsers, token,
}: { ticket: Ticket; onClose: () => void; onUpdated: (t: Ticket) => void; allUsers: UserRef[]; token: string | null }) {
  const { user, hasPermission } = useAuth();
  const [full, setFull] = useState<Ticket>(ticket);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [pendingResolve, setPendingResolve] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ platform: ticket.platform, username: ticket.username, orderNumber: ticket.orderNumber, issueCategory: ticket.issueCategory, priority: ticket.priority, assignedTo: String(ticket.assignedTo || "") });

  const isAdmin = user?.role === "admin";
  const canAssign = isAdmin || hasPermission("customerService", "assign");
  const canResolve = isAdmin || hasPermission("customerService", "resolve");
  const canArchive = isAdmin || hasPermission("customerService", "archive");
  const canEdit = isAdmin || canAssign || full.assignedTo === user?.id;

  const reload = async () => {
    try {
      const { data } = await axios.get(`${getApiUrl(API_BASE)}/${full.id}`, { headers: authHeaders(token) });
      setFull(data);
    } catch {}
  };

  useEffect(() => { reload(); }, []);

  const addNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      await axios.post(`${getApiUrl(API_BASE)}/${full.id}/notes`, { note: noteText }, { headers: authHeaders(token) });
      setNoteText("");
      await reload();
      toast.success("Note added");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add note");
    } finally {
      setAddingNote(false);
    }
  };

  const changeStatus = async (newStatus: Status) => {
    setChangingStatus(true);
    try {
      await axios.patch(`${getApiUrl(API_BASE)}/${full.id}/status`, { status: newStatus }, { headers: authHeaders(token) });
      await reload();
      onUpdated({ ...full, status: newStatus });
      toast.success("Status updated");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update status");
    } finally {
      setChangingStatus(false);
    }
  };

  const saveEdit = async () => {
    try {
      const payload = { ...editForm, assignedTo: editForm.assignedTo ? Number(editForm.assignedTo) : null };
      const { data } = await axios.put(`${getApiUrl(API_BASE)}/${full.id}`, payload, { headers: authHeaders(token) });
      setFull(data);
      onUpdated(data);
      setEditMode(false);
      toast.success("Ticket updated");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update ticket");
    }
  };

  const doArchive = async () => {
    setArchiving(true);
    try {
      await axios.patch(`${getApiUrl(API_BASE)}/${full.id}/archive`, { archiveReason }, { headers: authHeaders(token) });
      toast.success("Ticket archived");
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to archive");
    } finally {
      setArchiving(false);
    }
  };

  const timeInfo = timeDiff(full.dueAt);

  return (
    <ModalWrap title={`${full.ticketNumber}`} onClose={onClose} wide>
      {/* Header badges */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Badge text={LABEL[full.platform]} bg={full.platform === "whatnot" ? "#7c3aed" : "#0f172a"} />
        <Badge text={LABEL[full.status]} bg={STATUS_STYLE[full.status].bg} color={STATUS_STYLE[full.status].text} dot={STATUS_STYLE[full.status].dot} />
        <Badge text={LABEL[full.priority]} bg={PRIORITY_STYLE[full.priority].bg} color={PRIORITY_STYLE[full.priority].text} dot={PRIORITY_STYLE[full.priority].dot} />
        <Badge text={LABEL[full.issueCategory]} bg="#e2e8f0" color="#334155" />
        {full.isArchived && <Badge text="Archived" bg="#dc2626" />}
        {timeInfo && <span style={{ fontSize: 12, fontWeight: 600, color: timeInfo.overdue ? "#dc2626" : "#64748b", alignSelf: "center" }}>{timeInfo.label}</span>}
      </div>

      {/* Info grid */}
      {!editMode ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", marginBottom: 16, fontSize: 13 }}>
          <InfoRow label="Customer" value={full.username} />
          <InfoRow label="Order #" value={full.orderNumber} />
          <InfoRow label="Assigned To" value={full.assignee?.name || full.assignee?.username || "—"} />
          <InfoRow label="Created By" value={full.creator?.name || full.creator?.username || "—"} />
          <InfoRow label="Due At" value={full.dueAt ? fmtDate(full.dueAt) : "—"} />
          <InfoRow label="Created" value={fmtDate(full.createdAt)} />
          {full.resolvedAt && <InfoRow label="Resolved At" value={fmtDate(full.resolvedAt)} />}
          {full.isArchived && full.archiveReason && <InfoRow label="Archive Reason" value={full.archiveReason} />}
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
            <FormRow label="Platform">
              <select value={editForm.platform} onChange={(e) => setEditForm((f) => ({ ...f, platform: e.target.value as Platform }))} style={inputStyle}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{LABEL[p]}</option>)}
              </select>
            </FormRow>
            <FormRow label="Issue Category">
              <select value={editForm.issueCategory} onChange={(e) => setEditForm((f) => ({ ...f, issueCategory: e.target.value as Category }))} style={inputStyle}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{LABEL[c]}</option>)}
              </select>
            </FormRow>
            <FormRow label="Username"><input value={editForm.username} onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))} style={inputStyle} /></FormRow>
            <FormRow label="Order Number"><input value={editForm.orderNumber} onChange={(e) => setEditForm((f) => ({ ...f, orderNumber: e.target.value }))} style={inputStyle} /></FormRow>
            <FormRow label="Priority">
              <select value={editForm.priority} onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value as Priority }))} style={inputStyle}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{LABEL[p]}</option>)}
              </select>
            </FormRow>
            {canAssign && (
              <FormRow label="Assigned To">
                <select value={editForm.assignedTo} onChange={(e) => setEditForm((f) => ({ ...f, assignedTo: e.target.value }))} style={inputStyle}>
                  <option value="">Unassigned</option>
                  {allUsers.map((u) => <option key={u.id} value={String(u.id)}>{u.name || u.username}</option>)}
                </select>
              </FormRow>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={saveEdit} style={btnPrimary}>Save</button>
            <button onClick={() => setEditMode(false)} style={btnSecondary}>Cancel</button>
          </div>
        </div>
      )}

      {/* Status change */}
      {!full.isArchived && full.status !== "resolved" && canEdit && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>Change Status</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {STATUSES.filter((s) => s !== full.status && (s !== "resolved" || canResolve)).map((s) => (
              <button key={s} onClick={() => s === "resolved" ? setPendingResolve(true) : changeStatus(s)} disabled={changingStatus} style={{ ...btnSecondary, fontSize: 12, padding: "4px 12px", backgroundColor: STATUS_STYLE[s].bg, color: STATUS_STYLE[s].text, borderColor: STATUS_STYLE[s].dot, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: STATUS_STYLE[s].dot, flexShrink: 0 }} />
                {LABEL[s]}
              </button>
            ))}
            {pendingResolve && (
              <div style={{ width: "100%", marginTop: 10, background: "#dcfce7", border: "1px solid #22c55e", borderRadius: 8, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 13, color: "#15803d", fontWeight: 500 }}>
                  ✓ Mark this ticket as <strong>Resolved</strong>? This cannot be undone.
                </span>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => { setPendingResolve(false); changeStatus("resolved"); }} disabled={changingStatus} style={{ ...btnSecondary, fontSize: 12, padding: "4px 12px", backgroundColor: "#16a34a", color: "#fff", borderColor: "#16a34a" }}>
                    {changingStatus ? "Resolving…" : "Yes, Resolve"}
                  </button>
                  <button onClick={() => setPendingResolve(false)} style={{ ...btnSecondary, fontSize: 12, padding: "4px 12px" }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
          {!canResolve && (
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
              When done, set to <strong>Waiting on Internal Team</strong> — a manager will review and resolve.
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Notes ({full.notes?.length || 0})</div>
        {(full.notes || []).map((n) => (
          <div key={n.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: "#1e293b", whiteSpace: "pre-wrap" }}>{n.note}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{n.author?.name || n.author?.username || "Unknown"} · {fmtDate(n.createdAt)}</div>
          </div>
        ))}
        {!full.isArchived && canEdit && (
          <div style={{ marginTop: 10 }}>
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note…" rows={3} style={{ ...inputStyle, width: "100%", resize: "vertical", fontFamily: "inherit" }} />
            <button onClick={addNote} disabled={addingNote || !noteText.trim()} style={{ ...btnPrimary, marginTop: 6 }}>{addingNote ? "Adding…" : "Add Note"}</button>
          </div>
        )}
      </div>

      {/* Activity log — only shown to admins and assign-permission users */}
      {canAssign && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Activity Log</div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {(full.activities || []).length === 0 && (
              <div style={{ fontSize: 12, color: "#94a3b8", padding: "4px 0" }}>No activity yet</div>
            )}
            {(full.activities || []).map((a) => (
              <div key={a.id} style={{ fontSize: 12, color: "#64748b", padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontWeight: 600, color: "#475569" }}>{a.actor?.name || a.actor?.username || "System"}</span>
                {" · "}{LABEL[a.actionType] || a.actionType}
                {a.fromValue && a.toValue && ` · ${a.fromValue} → ${a.toValue}`}
                {a.details && !a.toValue && ` · ${a.details}`}
                <span style={{ float: "right" }}>{fmtDate(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
        {canEdit && !full.isArchived && !editMode && <button onClick={() => setEditMode(true)} style={btnSecondary}>Edit</button>}
        {canArchive && !full.isArchived && (
          !showArchiveConfirm
            ? <button onClick={() => setShowArchiveConfirm(true)} style={{ ...btnSecondary, color: "#dc2626", borderColor: "#dc2626" }}>Archive</button>
            : (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
                <input value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} placeholder="Reason (optional)" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={doArchive} disabled={archiving} style={{ ...btnSecondary, color: "#dc2626", borderColor: "#dc2626" }}>{archiving ? "…" : "Confirm Archive"}</button>
                <button onClick={() => setShowArchiveConfirm(false)} style={btnSecondary}>Cancel</button>
              </div>
            )
        )}
        <button onClick={onClose} style={btnSecondary}>Close</button>
      </div>
    </ModalWrap>
  );
}

// ─── Notification Panel ───────────────────────────────────────────────────────

function NotificationPanel({ onClose, token }: { onClose: () => void; token: string | null }) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    axios.get(getApiUrl(`${API_BASE}/notifications/mine`), { headers: authHeaders(token) })
      .then(({ data }) => { setNotifs(data.notifications); setUnread(data.unreadCount); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const markAll = async () => {
    await axios.patch(getApiUrl(`${API_BASE}/notifications/read-all`), {}, { headers: authHeaders(token) });
    setNotifs((n) => n.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
  };

  const markOne = async (id: number) => {
    await axios.patch(getApiUrl(`${API_BASE}/notifications/${id}/read`), {}, { headers: authHeaders(token) });
    setNotifs((n) => n.map((x) => x.id === id ? { ...x, isRead: true } : x));
    setUnread((c) => Math.max(0, c - 1));
  };

  return (
    <div ref={panelRef} style={{ position: "fixed", top: 64, right: 16, zIndex: 2000, width: 360, maxHeight: "80vh", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.12)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>CS Notifications {unread > 0 && <span style={{ background: "#dc2626", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11, marginLeft: 6 }}>{unread}</span>}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {unread > 0 && <button onClick={markAll} style={{ ...btnSecondary, fontSize: 11, padding: "3px 8px" }}>Mark all read</button>}
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      </div>
      <div style={{ overflowY: "auto", flex: 1 }}>
        {notifs.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No notifications</div>}
        {notifs.map((n) => (
          <div key={n.id} onClick={() => !n.isRead && markOne(n.id)} style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", background: n.isRead ? "#fff" : "#eff6ff", cursor: n.isRead ? "default" : "pointer" }}>
            <div style={{ fontSize: 12, color: "#334155" }}>{n.message}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{n.ticket?.ticketNumber} · {fmtDate(n.createdAt)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Shared layout helpers ────────────────────────────────────────────────────

function ModalWrap({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: wide ? 800 : 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ fontSize: 11, color: "#94a3b8", display: "block" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box" };
const btnPrimary: React.CSSProperties = { background: "#2563eb", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { background: "#fff", color: "#334155", border: "1px solid #e2e8f0", borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" };

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { key: "all", label: "All Tickets" },
  { key: "mine", label: "My Assigned" },
  { key: "overdue", label: "Overdue" },
  { key: "waiting", label: "Waiting" },
  { key: "resolved", label: "Resolved" },
  { key: "archived", label: "Archived" },
];

export default function CustomerService() {
  const { hasPermission, user, token } = useAuth();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [allUsers, setAllUsers] = useState<UserRef[]>([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({ status: "", priority: "", platform: "", category: "", assignedTo: "", createdBy: "", search: "", overdueOnly: false });

  const canCreate = hasPermission("customerService", "create");

  const loadDashboard = useCallback(async () => {
    try {
      const { data } = await axios.get(getApiUrl(`${API_BASE}/dashboard`), { headers: authHeaders(token) });
      setDashboard(data);
    } catch {}
  }, [token]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: "25", tab };
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.platform) params.platform = filters.platform;
      if (filters.category) params.category = filters.category;
      if (filters.assignedTo) params.assignedTo = filters.assignedTo;
      if (filters.createdBy) params.createdBy = filters.createdBy;
      if (filters.search) params.search = filters.search;
      if (filters.overdueOnly) params.overdueOnly = "true";

      const { data } = await axios.get(getApiUrl(API_BASE), { params, headers: authHeaders(token) });
      setTickets(data.data);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [page, tab, filters, token]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const { data } = await axios.get(getApiUrl(`${API_BASE}/notifications/mine`), { params: { unreadOnly: "true", limit: "1" }, headers: authHeaders(token) });
      setUnreadCount(data.unreadCount);
    } catch {}
  }, [token]);

  useEffect(() => {
    loadDashboard();
    loadUnreadCount();
    axios.get(getApiUrl(`${API_BASE}/users`), { headers: authHeaders(token) })
      .then(({ data }) => setAllUsers(data))
      .catch(() => {});
  }, [token]);

  useEffect(() => { setPage(1); }, [tab, filters]);
  useEffect(() => { loadTickets(); }, [loadTickets]);

  const handleCreated = (t: Ticket) => {
    setShowCreate(false);
    loadDashboard();
    loadTickets();
    setSelectedTicket(t);
  };

  const handleUpdated = (updated: Ticket) => {
    setTickets((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    loadDashboard();
  };

  const tabStyle = (key: string): React.CSSProperties => ({
    padding: "8px 16px", border: "none", background: "none", cursor: "pointer",
    fontSize: 13, fontWeight: tab === key ? 700 : 500,
    color: tab === key ? "#2563eb" : "#64748b",
    borderBottom: tab === key ? "2px solid #2563eb" : "2px solid transparent",
  });

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1400, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0f172a" }}>Customer Service</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => setShowNotifs((v) => !v)} style={{ ...btnSecondary, position: "relative", padding: "8px 14px" }}>
            🔔
            {unreadCount > 0 && (
              <span style={{ position: "absolute", top: -4, right: -4, background: "#dc2626", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "1px 5px" }}>{unreadCount}</span>
            )}
          </button>
          {canCreate && <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ New Ticket</button>}
        </div>
      </div>

      {/* Dashboard cards */}
      {dashboard && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          <Card title="Open" value={dashboard.open} color="#2563eb" />
          <Card title="Assigned" value={dashboard.assigned} color="#7c3aed" />
          <Card title="In Progress" value={dashboard.inProgress} color="#d97706" />
          <Card title="Waiting on Customer" value={dashboard.waitingCustomer} color="#0891b2" />
          <Card title="Waiting Internal" value={dashboard.waitingInternal} color="#6b7280" />
          <Card title="Urgent" value={dashboard.urgent} color="#dc2626" />
          <Card title="Due Today" value={dashboard.dueToday} color="#ea580c" />
          <Card title="Overdue" value={dashboard.overdue} color="#dc2626" />
          <Card title="Resolved This Week" value={dashboard.resolvedThisWeek} color="#16a34a" />
          <Card title="Archived" value={dashboard.archivedTotal} color="#94a3b8" />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <input value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Search ticket #, username, order…" style={{ ...inputStyle, width: 240 }} />
        <select value={filters.platform} onChange={(e) => setFilters((f) => ({ ...f, platform: e.target.value }))} style={{ ...inputStyle, width: 130 }}>
          <option value="">All Platforms</option>
          {PLATFORMS.map((p) => <option key={p} value={p}>{LABEL[p]}</option>)}
        </select>
        <select value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))} style={{ ...inputStyle, width: 130 }}>
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{LABEL[p]}</option>)}
        </select>
        <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} style={{ ...inputStyle, width: 180 }}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{LABEL[c]}</option>)}
        </select>
        <select value={filters.assignedTo} onChange={(e) => setFilters((f) => ({ ...f, assignedTo: e.target.value }))} style={{ ...inputStyle, width: 160 }}>
          <option value="">All Assignees</option>
          {allUsers.map((u) => <option key={u.id} value={String(u.id)}>{u.name || u.username}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b", cursor: "pointer" }}>
          <input type="checkbox" checked={filters.overdueOnly} onChange={(e) => setFilters((f) => ({ ...f, overdueOnly: e.target.checked }))} />
          Overdue only
        </label>
        <button onClick={() => setFilters({ status: "", priority: "", platform: "", category: "", assignedTo: "", createdBy: "", search: "", overdueOnly: false })} style={{ ...btnSecondary, fontSize: 12 }}>Clear</button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", marginBottom: 16 }}>
        {TABS.map((t) => <button key={t.key} style={tabStyle(t.key)} onClick={() => setTab(t.key)}>{t.label}</button>)}
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["Ticket #", "Platform", "Username", "Order #", "Category", "Priority", "Status", "Assigned To", "Time Left", "Created"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>Loading…</td></tr>}
            {!loading && tickets.length === 0 && <tr><td colSpan={10} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>No tickets found</td></tr>}
            {!loading && tickets.map((t) => <TicketRow key={t.id} ticket={t} onClick={() => setSelectedTicket(t)} />)}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 25 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16, fontSize: 13, color: "#64748b" }}>
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} style={btnSecondary}>← Prev</button>
          <span>Page {page} of {Math.ceil(total / 25)}</span>
          <button disabled={page >= Math.ceil(total / 25)} onClick={() => setPage((p) => p + 1)} style={btnSecondary}>Next →</button>
        </div>
      )}

      {/* Modals */}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCreated} token={token} />}
      {selectedTicket && (
        <TicketDetail
          ticket={selectedTicket}
          onClose={() => { setSelectedTicket(null); loadTickets(); }}
          onUpdated={handleUpdated}
          allUsers={allUsers}
          token={token}
        />
      )}
      {showNotifs && <NotificationPanel onClose={() => { setShowNotifs(false); loadUnreadCount(); }} token={token} />}
    </div>
  );
}

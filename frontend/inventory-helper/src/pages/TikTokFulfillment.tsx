import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  Dialog,
  DialogContent,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ScienceIcon from "@mui/icons-material/Science";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { getApiUrl } from "../config/api";
import { useAuth } from "../context/AuthContext";

interface ShowItem {
  id: number;
  name: string;
}

interface PendingReviewRow {
  shipmentId: string;
  tracking: string;
  mismatchReason: string;
  expectedItems: number;
  scannedItems: number;
}

interface CompletedShipmentRow {
  shipmentId: string;
  tracking: string;
  expectedItems: number;
  scannedItems: number;
  closedAt?: string | null;
  closedBy?: string | null;
  closedByName?: string | null;
}

interface PendingShipmentRow {
  shipmentId: string;
  tracking: string;
  expectedItems: number;
  scannedItems: number;
  status?: string;
}

interface UnderReviewShipmentRow {
  shipmentId: string;
  tracking: string;
  mismatchReason: string;
  expectedItems: number;
  scannedItems: number;
}

interface FailedOrderRow {
  id: number;
  buyer: string;
  stickerNumber: string;
  soldPrice?: string | number | null;
  failureStatus?: string;
  attemptCount?: number;
}

interface TerminalOrderRow {
  id: number;
  shipmentId: string;
  tracking?: string | null;
  buyer: string;
  stickerNumber?: string | null;
  orderId?: string | null;
  orderStatus?: string | null;
  orderSubstatus?: string | null;
  cancelledAt?: string | null;
  mismatchReason?: string | null;
  soldPrice?: string | number | null;
}

interface FulfillmentSummary {
  readyToBegin: boolean;
  activeImport: null | {
    id: number;
    fileName: string;
    totalRows: number;
    totalShipments: number;
    readyShipments: number;
    pendingReviewShipments: number;
    remainingShipments?: number;
    closedShipments?: number;
    uploadedBy?: string | null;
    uploadedAt?: string;
  };
  categoryCounts?: Record<
    string,
    {
      rows: number;
      expectedQty: number;
      scannedQty: number;
      expectedProductLinks?: number;
    }
  >;
  pendingReview: PendingReviewRow[];
  underReviewShipments?: UnderReviewShipmentRow[];
  pendingShipments?: PendingShipmentRow[];
  completedShipments?: CompletedShipmentRow[];
  failedOrders?: FailedOrderRow[];
  terminalOrders?: TerminalOrderRow[];
}

interface ShipmentChecklistItem {
  stickerNumber: string;
  expectedQty: number;
  expectedProductLinks?: number;
  scannedQty: number;
  linkedProductScans?: number;
  pendingProductLinks?: number;
  nonAuctionContext?: string | null;
  nonAuctionContextIndex?: number;
  displayTitle?: string | null;
  linkedProducts?: Array<{
    sku: string;
    count: number;
    latestScanId?: number | null;
    contextSticker?: string | null;
    brand?: string;
    itemName?: string;
    strength?: string;
    sizeOz?: string | number;
    sizeMl?: string | number;
    tester?: boolean;
  }>;
}

interface ActiveShipment {
  shipmentId: string;
  tracking: string;
  expectedItems: number;
  scannedItems: number;
  remainingItems: number;
  completed: boolean;
  auctionExpectedItems: number;
  auctionScannedItems: number;
  auctionRemainingItems: number;
  nonAuctionExpectedItems: number;
  nonAuctionScannedItems: number;
  nonAuctionRemainingItems: number;
  checklist: ShipmentChecklistItem[];
}

interface ShipmentViewDetails extends ActiveShipment {
  closedAt?: string | null;
  closedBy?: string | null;
  closedByName?: string | null;
}

interface ProductLookupResult {
  sku: string;
  upc?: string | null;
  brand?: string | null;
  itemName?: string | null;
  strength?: string | null;
  sizeOz?: string | number | null;
  sizeMl?: string | number | null;
  condition?: string | null;
  quantity?: number;
  image?: string | null;
  tester?: boolean;
  ProductDetail?: {
    tester?: boolean;
    strength?: string | null;
  };
}

interface ShipmentHistorySectionProps {
  shipmentTab: "completed" | "pending" | "underReview" | "failed" | "terminal";
  completedSearch: string;
  filteredCompletedShipments: Array<
    CompletedShipmentRow | PendingShipmentRow | UnderReviewShipmentRow | FailedOrderRow | TerminalOrderRow
  >;
  completedCount: number;
  pendingCount: number;
  underReviewCount: number;
  failedCount: number;
  terminalCount: number;
  onShipmentTabChange: (value: "completed" | "pending" | "underReview" | "failed" | "terminal") => void;
  onCompletedSearchChange: (value: string) => void;
  onOpenShipmentView: (shipmentId: string) => void;
}

const ShipmentHistorySection = memo(
  ({
    shipmentTab,
    completedSearch,
    filteredCompletedShipments,
    completedCount,
    pendingCount,
    underReviewCount,
    failedCount,
    terminalCount,
    onShipmentTabChange,
    onCompletedSearchChange,
    onOpenShipmentView,
  }: ShipmentHistorySectionProps) => (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: { xs: "stretch", md: "center" },
          justifyContent: "space-between",
          flexDirection: { xs: "column", md: "row" },
          gap: 1.5,
          mb: 2,
        }}
      >
        <Tabs
          value={shipmentTab}
          onChange={(_, value) => onShipmentTabChange(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 36 }}
        >
          <Tab
            value="completed"
            label={`Completed Shipments (${completedCount})`}
            sx={{ minHeight: 36, textTransform: "none" }}
          />
          <Tab
            value="pending"
            label={`Pending Shipments (${pendingCount})`}
            sx={{ minHeight: 36, textTransform: "none" }}
          />
          <Tab
            value="underReview"
            label={`Under Review Shipments (${underReviewCount})`}
            sx={{ minHeight: 36, textTransform: "none" }}
          />
          <Tab
            value="failed"
            label={`Failed Orders (${failedCount})`}
            sx={{ minHeight: 36, textTransform: "none" }}
          />
          <Tab
            value="terminal"
            label={`Cancelled / Failed (${terminalCount})`}
            sx={{ minHeight: 36, textTransform: "none" }}
          />
        </Tabs>
        <TextField
          size="small"
          label={
            shipmentTab === "failed"
              ? "Search Buyer / Item #"
              : shipmentTab === "terminal"
              ? "Search Buyer / Order / Item #"
              : "Search Shipment / Tracking"
          }
          value={completedSearch}
          onChange={(e) => onCompletedSearchChange(e.target.value)}
          sx={{ width: { xs: "100%", md: 280 } }}
        />
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            {shipmentTab === "failed" ? (
              <>
                <TableCell>Username</TableCell>
                <TableCell>Item #</TableCell>
                <TableCell align="right">Price</TableCell>
              </>
            ) : shipmentTab === "terminal" ? (
              <>
                <TableCell>Username</TableCell>
                <TableCell>Item #</TableCell>
                <TableCell>Order ID</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Cancelled / Updated</TableCell>
              </>
            ) : (
              <>
                <TableCell>Shipment ID</TableCell>
                <TableCell>Tracking</TableCell>
                <TableCell align="right">Orders</TableCell>
                <TableCell>{shipmentTab === "completed" ? "Closed" : "Status"}</TableCell>
                <TableCell align="right">Action</TableCell>
              </>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredCompletedShipments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={shipmentTab === "failed" ? 3 : shipmentTab === "terminal" ? 5 : 5}>
                <Typography variant="body2" color="text.secondary">
                  {shipmentTab === "completed"
                    ? "No completed shipments found."
                    : shipmentTab === "pending"
                    ? "No pending shipments found."
                    : shipmentTab === "underReview"
                    ? "No under-review shipments found."
                    : shipmentTab === "terminal"
                    ? "No cancelled or failed TikTok orders found."
                    : "No failed orders found."}
                </Typography>
              </TableCell>
            </TableRow>
          ) : shipmentTab === "failed" ? (
            filteredCompletedShipments.map((row) => {
              const failedRow = row as FailedOrderRow;
              return (
                <TableRow key={`failed-${failedRow.id}`}>
                  <TableCell>{failedRow.buyer}</TableCell>
                  <TableCell>#{failedRow.stickerNumber}</TableCell>
                  <TableCell align="right">
                    {Number(failedRow.soldPrice || 0).toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                    })}
                  </TableCell>
                </TableRow>
              );
            })
          ) : shipmentTab === "terminal" ? (
            filteredCompletedShipments.map((row) => {
              const terminalRow = row as TerminalOrderRow;
              return (
                <TableRow key={`terminal-${terminalRow.id}`}>
                  <TableCell>{terminalRow.buyer}</TableCell>
                  <TableCell>{terminalRow.stickerNumber ? `#${terminalRow.stickerNumber}` : "N/A"}</TableCell>
                  <TableCell>{terminalRow.orderId || "N/A"}</TableCell>
                  <TableCell>
                    {[terminalRow.orderStatus, terminalRow.orderSubstatus].filter(Boolean).join(" / ") || "Terminal"}
                  </TableCell>
                  <TableCell>
                    {terminalRow.cancelledAt ? new Date(terminalRow.cancelledAt).toLocaleString() : "N/A"}
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            filteredCompletedShipments.map((row) => (
              <TableRow
                key={row.shipmentId}
                hover
                sx={{ cursor: "pointer" }}
                onClick={() => onOpenShipmentView(row.shipmentId)}
              >
                <TableCell>{row.shipmentId}</TableCell>
                <TableCell>{row.tracking}</TableCell>
                <TableCell align="right">
                  {Number(row.scannedItems || 0)} / {Number(row.expectedItems || 0)}
                </TableCell>
                <TableCell>
                  {shipmentTab === "completed" ? (
                    (row as CompletedShipmentRow).closedAt ? (
                      new Date((row as CompletedShipmentRow).closedAt || "").toLocaleString()
                    ) : (
                      "N/A"
                    )
                  ) : shipmentTab === "underReview" ? (
                    (row as UnderReviewShipmentRow).mismatchReason || "Requires review"
                  ) : (
                    (row as PendingShipmentRow).status || "ready"
                  )}
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenShipmentView(row.shipmentId);
                    }}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Paper>
  )
);
ShipmentHistorySection.displayName = "ShipmentHistorySection";

const FLASH_SALE_STICKER = "TIKTOK-FLASH-SALE";
const RAID_GIVEAWAY_STICKER = "RAID-GIVEAWAY";
const BUYERS_GIVEAWAY_STICKER = "BUYERS-GIVEAWAY";
const COFFEE_STICKER = "COFFEE";
const SPONSORED_GIVEAWAY_STICKER = "SPONSORED-GIVEAWAY";
const OTHERS_STICKER = "OTHERS";
const NON_AUCTION_ROW_STICKER = "NON-AUCTION-ITEMS";
const NON_AUCTION_INSTANCE_PREFIX = "NON-AUCTION-CONTEXT:";
const SPECIAL_NON_AUCTION_CONTEXTS = [
  FLASH_SALE_STICKER,
  RAID_GIVEAWAY_STICKER,
  BUYERS_GIVEAWAY_STICKER,
  COFFEE_STICKER,
  SPONSORED_GIVEAWAY_STICKER,
  OTHERS_STICKER,
];

const TikTokFulfillment = () => {
  const { user } = useAuth();
  const [shows, setShows] = useState<ShowItem[]>([]);
  const [showsLoading, setShowsLoading] = useState(false);
  const [selectedShowId, setSelectedShowId] = useState<string>("");
  const [newShowName, setNewShowName] = useState("");
  const [creatingShow, setCreatingShow] = useState(false);

  const [summary, setSummary] = useState<FulfillmentSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [trackingInput, setTrackingInput] = useState("");
  const [itemScanInput, setItemScanInput] = useState("");
  const [shipmentLoading, setShipmentLoading] = useState(false);
  const [itemLoading, setItemLoading] = useState(false);
  const [productLoading, setProductLoading] = useState(false);
  const [activeShipment, setActiveShipment] = useState<ActiveShipment | null>(null);
  const [activeAuctionSticker, setActiveAuctionSticker] = useState<string>("");
  const [autoReturnToAuction, setAutoReturnToAuction] = useState(false);
  const [productFocusPinned, setProductFocusPinned] = useState(false);
  const [productInput, setProductInput] = useState("");
  const [productCandidates, setProductCandidates] = useState<ProductLookupResult[]>([]);
  const [deletingLinkKey, setDeletingLinkKey] = useState<string>("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [interventionAlert, setInterventionAlert] = useState<string | null>(null);
  const [completedSearch, setCompletedSearch] = useState("");
  const [shipmentTab, setShipmentTab] = useState<"completed" | "pending" | "underReview" | "failed" | "terminal">("completed");
  const [shipmentView, setShipmentView] = useState<ShipmentViewDetails | null>(null);
  const [shipmentViewLoading, setShipmentViewLoading] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const trackingRef = useRef<HTMLInputElement>(null);
  const itemScanRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const suppressNextProductFocusPinRef = useRef(false);

  const isAdmin = user?.role === "admin";
  const getSpecialNonAuctionContext = (value?: string | null) => {
    const token = String(value || "").trim().toUpperCase();
    if (!token) return null;
    return SPECIAL_NON_AUCTION_CONTEXTS.find((entry) => entry === token) || null;
  };
  const formatSpecialContextLabel = (value?: string | null) => {
    const token = getSpecialNonAuctionContext(value);
    if (!token) return "";
    if (token === FLASH_SALE_STICKER) return "TikTok Flash Sale";
    if (token === RAID_GIVEAWAY_STICKER) return "Raid Giveaway";
    if (token === BUYERS_GIVEAWAY_STICKER) return "Buyers Giveaway";
    if (token === COFFEE_STICKER) return "Coffee";
    if (token === SPONSORED_GIVEAWAY_STICKER) return "Sponsored Giveaway";
    if (token === OTHERS_STICKER) return "Others";
    return token;
  };
  const formatStickerContext = (value?: string | null) => {
    const normalized = String(value || "").trim().replace(/^#/, "");
    if (!normalized) return "None";
    const specialContext = getSpecialNonAuctionContext(normalized);
    return specialContext ? formatSpecialContextLabel(specialContext) : `#${normalized}`;
  };
  const formatChecklistRowLabel = (item: ShipmentChecklistItem) => {
    const raw = String(item.stickerNumber || "").trim();
    const displayTitle = String(item.displayTitle || "").trim();
    if (
      displayTitle &&
      (raw.startsWith(NON_AUCTION_ROW_STICKER) || raw.startsWith("AUTO-NON-AUCTION:"))
    ) {
      return displayTitle;
    }
    if (
      item.nonAuctionContext &&
      raw.startsWith(NON_AUCTION_INSTANCE_PREFIX)
    ) {
      return displayTitle || item.nonAuctionContext;
    }
    if (raw !== NON_AUCTION_ROW_STICKER) return raw;
    if (displayTitle) return displayTitle;
    const contextActivated =
      Number(item.scannedQty || 0) > 0 || Number(item.linkedProductScans || 0) > 0;
    if (!contextActivated) return "Non Auction Items";
    const activeContext = getSpecialNonAuctionContext(item.nonAuctionContext);
    return activeContext || "Non Auction Items";
  };
  const getChecklistItemBySticker = (sticker?: string | null) => {
    if (!activeShipment || !sticker) return null;
    return (
      activeShipment.checklist.find((entry) => String(entry.stickerNumber || "") === String(sticker)) ||
      null
    );
  };
  const formatActiveContextLabel = (sticker?: string | null) => {
    const token = String(sticker || "").trim();
    if (!token) return "None";
    const checklistItem = getChecklistItemBySticker(token);
    if (checklistItem) {
      const rowLabel = formatChecklistRowLabel(checklistItem);
      if (
        checklistItem.nonAuctionContext &&
        token.startsWith(NON_AUCTION_INSTANCE_PREFIX) &&
        checklistItem.nonAuctionContextIndex
      ) {
        return `${rowLabel} #${checklistItem.nonAuctionContextIndex}`;
      }
      return rowLabel;
    }
    return formatStickerContext(token);
  };
  const normalizeTrackingForSearch = (value?: string | null) => {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    return digits.length >= 22 ? digits.slice(-22) : digits;
  };

  const playInterventionSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const context = audioContextRef.current;
      if (!context) return;
      if (context.state === "suspended") {
        context.resume().catch(() => {});
      }
      const now = context.currentTime;
      const playTone = (startAt: number, frequency: number, duration: number) => {
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(frequency, startAt);
        gainNode.gain.setValueAtTime(0.0001, startAt);
        gainNode.gain.exponentialRampToValueAtTime(0.42, startAt + 0.006);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + duration + 0.01);
      };
      playTone(now, 980, 0.18);
      playTone(now + 0.22, 740, 0.2);
      playTone(now + 0.47, 980, 0.24);
    } catch (soundError) {
      console.warn("Unable to play intervention sound", soundError);
    }
  };

  const selectedShowName = useMemo(() => {
    return shows.find((show) => String(show.id) === selectedShowId)?.name || "";
  }, [shows, selectedShowId]);
  const isShipmentFullyScanned = useMemo(() => {
    if (!activeShipment) return false;
    return Number(activeShipment.remainingItems || 0) <= 0;
  }, [activeShipment]);
  const canCloseShipment = useMemo(() => {
    if (!activeShipment) return false;
    if (!isShipmentFullyScanned) return false;
    if (!activeShipment.checklist.length) return true;
    return activeShipment.checklist.every((item) => Number(item.pendingProductLinks || 0) <= 0);
  }, [activeShipment, isShipmentFullyScanned]);
  const filteredCompletedShipments = useMemo(() => {
    const completedRows = summary?.completedShipments || [];
    const pendingRows = summary?.pendingShipments || [];
    const underReviewRows = summary?.underReviewShipments || summary?.pendingReview || [];
    const failedRows = summary?.failedOrders || [];
    const terminalRows = summary?.terminalOrders || [];
    const rows =
      shipmentTab === "completed"
        ? completedRows
        : shipmentTab === "pending"
        ? pendingRows
        : shipmentTab === "underReview"
        ? underReviewRows
        : shipmentTab === "terminal"
        ? terminalRows
        : failedRows;
    const token = completedSearch.trim().toLowerCase();
    if (!token) return rows;
    const trackingToken = normalizeTrackingForSearch(token);
    return rows.filter((row) => {
      if (shipmentTab === "failed") {
        const failedRow = row as FailedOrderRow;
        return (
          String(failedRow.buyer || "").toLowerCase().includes(token) ||
          String(failedRow.stickerNumber || "").toLowerCase().includes(token)
        );
      }
      if (shipmentTab === "terminal") {
        const terminalRow = row as TerminalOrderRow;
        return (
          String(terminalRow.buyer || "").toLowerCase().includes(token) ||
          String(terminalRow.stickerNumber || "").toLowerCase().includes(token) ||
          String(terminalRow.orderId || "").toLowerCase().includes(token) ||
          String(terminalRow.orderStatus || "").toLowerCase().includes(token) ||
          String(terminalRow.orderSubstatus || "").toLowerCase().includes(token)
        );
      }
      const shipmentMatch = String(row.shipmentId || "").toLowerCase().includes(token);
      const trackingMatch = trackingToken
        ? normalizeTrackingForSearch(row.tracking).includes(trackingToken)
        : String(row.tracking || "").toLowerCase().includes(token);
      return shipmentMatch || trackingMatch;
    });
  }, [
    summary?.completedShipments,
    summary?.pendingShipments,
    summary?.underReviewShipments,
    summary?.pendingReview,
    summary?.failedOrders,
    summary?.terminalOrders,
    completedSearch,
    shipmentTab,
  ]);
  const categoryCounts = summary?.categoryCounts || {};
  const itemContextCount = Number(categoryCounts.auction?.rows || 0);
  const expectedProductLinkCount = Number(categoryCounts.auction?.expectedProductLinks || 0);
  const completedShipmentCount = Number(summary?.activeImport?.closedShipments || 0);
  const failedOrderCount = Number(summary?.failedOrders?.length || 0);
  const terminalOrderCount = Number(summary?.terminalOrders?.length || 0);

  const fetchShows = async () => {
    setShowsLoading(true);
    try {
      const response = await axios.get(getApiUrl("tiktok/shows"));
      const showList: ShowItem[] = response.data || [];
      setShows(showList);
      if (!selectedShowId && showList.length > 0) {
        setSelectedShowId(String(showList[0].id));
      }
    } catch (fetchError) {
      console.error("Error loading shows for fulfillment:", fetchError);
      setError("Failed to load shows");
    } finally {
      setShowsLoading(false);
    }
  };

  const fetchSummary = async (showId: string) => {
    if (!showId) {
      setSummary(null);
      return;
    }
    setSummaryLoading(true);
    try {
      const response = await axios.get(getApiUrl("tiktok/fulfillment/summary"), {
        params: { showId: Number(showId) },
      });
      setSummary(response.data || null);
    } catch (fetchError) {
      console.error("Error loading fulfillment summary:", fetchError);
      setError("Failed to load fulfillment status");
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleCreateShow = async () => {
    const trimmed = newShowName.trim();
    if (!trimmed) return;
    setCreatingShow(true);
    try {
      const response = await axios.post(getApiUrl("tiktok/shows"), { name: trimmed });
      const created = response.data as ShowItem;
      setNewShowName("");
      await fetchShows();
      if (created?.id) {
        setSelectedShowId(String(created.id));
      }
      setSuccess(`TikTok show "${trimmed}" created.`);
    } catch (createError: any) {
      console.error("Error creating TikTok show:", createError);
      setError(createError?.response?.data?.error || "Failed to create TikTok show");
    } finally {
      setCreatingShow(false);
    }
  };

  useEffect(() => {
    fetchShows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setActiveShipment(null);
    setTrackingInput("");
    setItemScanInput("");
    setProductInput("");
    setProductCandidates([]);
    setActiveAuctionSticker("");
    setAutoReturnToAuction(false);
    setProductFocusPinned(false);
    setInterventionAlert(null);
    setCompletedSearch("");
    setShipmentView(null);
    if (selectedShowId) {
      fetchSummary(selectedShowId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShowId]);

  const handleUpload = async () => {
    if (!selectedShowId || !uploadFile) return;
    setError(null);
    setSuccess(null);
    setInterventionAlert(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("showId", selectedShowId);
      formData.append("file", uploadFile);
      const response = await axios.post(getApiUrl("tiktok/fulfillment/import"), formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      const summaryData = response.data?.summary;
      setSuccess(
        `CSV imported. Ready shipments: ${summaryData?.readyShipments || 0}, Pending review: ${
          summaryData?.pendingReviewShipments || 0
        }, Cancelled orders: ${summaryData?.cancelledOrders || 0}, Failed status orders: ${
          summaryData?.failedStatusOrders || 0
        }.`
      );
      setUploadFile(null);
      await fetchSummary(selectedShowId);
      trackingRef.current?.focus();
    } catch (uploadError: any) {
      const message = uploadError?.response?.data?.error || "Failed to upload CSV";
      setError(message);
      setInterventionAlert(message);
      playInterventionSound();
    } finally {
      setUploading(false);
    }
  };

  const handleLoadShipment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedShowId || !trackingInput.trim()) return;
    setError(null);
    setSuccess(null);
    setInterventionAlert(null);
    setShipmentLoading(true);
    try {
      const response = await axios.post(getApiUrl("tiktok/fulfillment/shipment"), {
        showId: Number(selectedShowId),
        tracking: trackingInput.trim(),
      });
      setActiveShipment({
        shipmentId: response.data.shipmentId,
        tracking: response.data.tracking,
        expectedItems: response.data.expectedItems,
        scannedItems: response.data.scannedItems,
        remainingItems: response.data.remainingItems,
        completed: response.data.completed,
        auctionExpectedItems: response.data.auctionExpectedItems || 0,
        auctionScannedItems: response.data.auctionScannedItems || 0,
        auctionRemainingItems: response.data.auctionRemainingItems || 0,
        nonAuctionExpectedItems: response.data.nonAuctionExpectedItems || 0,
        nonAuctionScannedItems: response.data.nonAuctionScannedItems || 0,
        nonAuctionRemainingItems: response.data.nonAuctionRemainingItems || 0,
        checklist: response.data.checklist || [],
      });
      setActiveAuctionSticker("");
      setAutoReturnToAuction(false);
      setProductFocusPinned(false);
      setProductCandidates([]);
      setProductInput("");
      setSuccess(`Shipment ${response.data.shipmentId} loaded. Start scanning order contexts.`);
      setItemScanInput("");
      setTimeout(() => itemScanRef.current?.focus(), 100);
    } catch (loadError: any) {
      const message = loadError?.response?.data?.error || "Failed to load shipment";
      setError(message);
      setActiveShipment(null);
      setInterventionAlert(message);
      playInterventionSound();
    } finally {
      setShipmentLoading(false);
    }
  };

  const handleItemScan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedShowId || !activeShipment || !itemScanInput.trim()) return;

    const scannedSticker = itemScanInput.trim().replace(/^#/, "");
    const currentActiveSticker = activeAuctionSticker.trim().replace(/^#/, "");
    if (
      currentActiveSticker &&
      scannedSticker &&
      scannedSticker !== currentActiveSticker
    ) {
      const activeChecklistItem = activeShipment.checklist.find(
        (item) => String(item.stickerNumber).trim().replace(/^#/, "") === currentActiveSticker
      );
      const linkedForActive = Number(activeChecklistItem?.linkedProductScans || 0);
      if (linkedForActive < 1) {
        const activeLabel =
          getChecklistItemBySticker(currentActiveSticker)
            ? formatActiveContextLabel(currentActiveSticker)
            : formatStickerContext(currentActiveSticker);
        const blockMessage = `Link at least one product to ${activeLabel} before scanning another item number.`;
        setError(blockMessage);
        setInterventionAlert(blockMessage);
        playInterventionSound();
        return;
      }
    }

    setError(null);
    setSuccess(null);
    setInterventionAlert(null);
    setItemLoading(true);
    try {
      const response = await axios.post(getApiUrl("tiktok/fulfillment/scan-item"), {
        showId: Number(selectedShowId),
        tracking: activeShipment.tracking,
        stickerNumber: itemScanInput.trim(),
      });
      setActiveShipment({
        shipmentId: response.data.shipmentId,
        tracking: response.data.tracking,
        expectedItems: response.data.expectedItems,
        scannedItems: response.data.scannedItems,
        remainingItems: response.data.remainingItems,
        completed: response.data.completed,
        auctionExpectedItems: response.data.auctionExpectedItems || 0,
        auctionScannedItems: response.data.auctionScannedItems || 0,
        auctionRemainingItems: response.data.auctionRemainingItems || 0,
        nonAuctionExpectedItems: response.data.nonAuctionExpectedItems || 0,
        nonAuctionScannedItems: response.data.nonAuctionScannedItems || 0,
        nonAuctionRemainingItems: response.data.nonAuctionRemainingItems || 0,
        checklist: response.data.checklist || [],
      });
      if (response.data.matchedAuctionSticker) {
        const matchedContext = String(response.data.matchedAuctionSticker);
        setActiveAuctionSticker(matchedContext);
        const isStickyNonAuctionContext =
          Boolean(getSpecialNonAuctionContext(matchedContext)) ||
          matchedContext.startsWith(NON_AUCTION_INSTANCE_PREFIX);
        // Non-auction contexts behave like a sticky mode: stay in product scan until user changes context.
        setAutoReturnToAuction(!isStickyNonAuctionContext);
      }
      let shouldFocusItemScan = false;
      if (response.data.scanResult === "matched") {
        if (response.data.matchedAuctionSticker) {
          const matchedContext = String(response.data.matchedAuctionSticker);
          const matchedContextLabel = response.data.matchedContextType
            ? formatStickerContext(String(response.data.matchedContextType))
            : formatStickerContext(matchedContext);
          setSuccess(
            response.data.completed
              ? `Shipment complete. ${matchedContextLabel} verified.`
              : `${matchedContextLabel} verified. Now scan UPC/SKU product(s) for this order.`
          );
          suppressNextProductFocusPinRef.current = true;
          setTimeout(() => productInputRef.current?.focus(), 80);
        } else {
          setSuccess(response.data.completed ? "Shipment complete and verified." : "Order scan verified.");
          shouldFocusItemScan = true;
          setTimeout(() => itemScanRef.current?.focus(), 80);
        }
      } else {
        setInterventionAlert(response.data.message || "Scan requires intervention.");
        playInterventionSound();
        shouldFocusItemScan = true;
      }
      setItemScanInput("");
      if (shouldFocusItemScan) {
        itemScanRef.current?.focus();
      }
    } catch (scanError: any) {
      const message = scanError?.response?.data?.error || "Failed to scan order context";
      setError(message);
      setInterventionAlert(message);
      playInterventionSound();
    } finally {
      setItemLoading(false);
    }
  };

  const handleCloseShipment = async () => {
    if (!activeShipment || !selectedShowId) return;
    if (!canCloseShipment) {
      if (!isShipmentFullyScanned) {
        setError("Cannot close shipment yet. Scan all shipment items first.");
        setInterventionAlert("Close blocked: shipment still has remaining unscanned orders.");
      } else {
        setError("Cannot close shipment. Every scanned order context must have at least one linked product.");
        setInterventionAlert(
          "Close blocked: one or more scanned order contexts do not have any linked product scan yet."
        );
      }
      playInterventionSound();
      return;
    }
    setError(null);
    setSuccess(null);
    setInterventionAlert(null);
    try {
      await axios.post(getApiUrl("tiktok/fulfillment/close-shipment"), {
        showId: Number(selectedShowId),
        tracking: activeShipment.tracking,
      });
      setActiveShipment(null);
      setActiveAuctionSticker("");
      setAutoReturnToAuction(false);
      setProductFocusPinned(false);
      setProductInput("");
      setProductCandidates([]);
      setItemScanInput("");
      setTrackingInput("");
      setSuccess("Shipment closed. Scan next shipping label to continue.");
      await fetchSummary(selectedShowId);
      setTimeout(() => trackingRef.current?.focus(), 80);
    } catch (closeError: any) {
      const message = closeError?.response?.data?.error || "Failed to close shipment";
      setError(message);
      setInterventionAlert(message);
      playInterventionSound();
    }
  };

  const handleDismissShipmentModal = async () => {
    if (!activeShipment) return;
    const hasUnfinishedWork =
      Number(activeShipment.remainingItems || 0) > 0 ||
      activeShipment.checklist.some((item) => Number(item.pendingProductLinks || 0) > 0);
    if (hasUnfinishedWork) {
      const shouldClose = window.confirm(
        "This shipment is not complete yet. Exit shipment view and continue later?"
      );
      if (!shouldClose) return;
    }
    const unlinkedScannedStickers = activeShipment.checklist
      .filter(
        (item) =>
          Number(item.scannedQty || 0) > 0 &&
          Number(item.pendingProductLinks || 0) > 0 &&
          Number(item.linkedProductScans || 0) === 0
      )
      .map((item) => String(item.stickerNumber).trim().replace(/^#/, ""))
      .filter(Boolean);
    if (selectedShowId && unlinkedScannedStickers.length > 0) {
      try {
        const response = await axios.post(getApiUrl("tiktok/fulfillment/reset-unlinked-auction-scans"), {
          showId: Number(selectedShowId),
          tracking: activeShipment.tracking,
        });
        const resetList: string[] = response?.data?.resetAuctionStickers || [];
        if (resetList.length > 0) {
          setSuccess(`Reset unlinked order contexts: ${resetList.join(", ")}.`);
        }
      } catch (resetError: any) {
        const message =
          resetError?.response?.data?.error || "Failed to reset unlinked item-number scans before exiting.";
        setError(message);
        setInterventionAlert(message);
        playInterventionSound();
        return;
      }
    }
    setActiveShipment(null);
    setActiveAuctionSticker("");
    setAutoReturnToAuction(false);
    setProductFocusPinned(false);
    setProductCandidates([]);
    setProductInput("");
    setItemScanInput("");
    setTimeout(() => trackingRef.current?.focus(), 80);
  };

  const handleProductScan = async (selectedSku?: string) => {
    if (!selectedShowId || !activeShipment || !activeAuctionSticker || !productInput.trim()) return;
    const normalizedProductInput = productInput.trim();
    if (normalizedProductInput.length <= 4 && !selectedSku) {
      setError("This looks like an order barcode. Use Scan Order first, then scan UPC/SKU here.");
      setInterventionAlert(
        "Short 4-character order code detected in product scan. Please scan product UPC/SKU (usually longer)."
      );
      playInterventionSound();
      return;
    }
    setError(null);
    setSuccess(null);
    setInterventionAlert(null);
    setProductLoading(true);
    try {
      const response = await axios.post(getApiUrl("tiktok/fulfillment/scan-product"), {
        showId: Number(selectedShowId),
        tracking: activeShipment.tracking,
        auctionStickerNumber: activeAuctionSticker,
        barcode: productInput.trim(),
        selectedSku: selectedSku || undefined,
      });

      setProductCandidates([]);
      setProductInput("");
      const product = response.data?.product;
      setActiveShipment({
        shipmentId: response.data.shipmentId,
        tracking: response.data.tracking,
        expectedItems: response.data.expectedItems,
        scannedItems: response.data.scannedItems,
        remainingItems: response.data.remainingItems,
        completed: response.data.completed,
        auctionExpectedItems: response.data.auctionExpectedItems || 0,
        auctionScannedItems: response.data.auctionScannedItems || 0,
        auctionRemainingItems: response.data.auctionRemainingItems || 0,
        nonAuctionExpectedItems: response.data.nonAuctionExpectedItems || 0,
        nonAuctionScannedItems: response.data.nonAuctionScannedItems || 0,
        nonAuctionRemainingItems: response.data.nonAuctionRemainingItems || 0,
        checklist: response.data.checklist || [],
      });
      if (product?.sku) {
        const contextLabel = formatActiveContextLabel(activeAuctionSticker);
        setSuccess(
          `Linked ${product.sku} (${product.brand || ""} ${product.itemName || ""}) to ${contextLabel}. Inventory will update when shipment is closed.`
        );
      } else {
        setSuccess(response.data?.message || "Product linked to selected order.");
      }
      const isStickyNonAuctionContext =
        Boolean(getSpecialNonAuctionContext(activeAuctionSticker)) ||
        activeAuctionSticker.startsWith(NON_AUCTION_INSTANCE_PREFIX);
      if (isStickyNonAuctionContext || productFocusPinned) {
        suppressNextProductFocusPinRef.current = true;
        setTimeout(() => productInputRef.current?.focus(), 80);
      } else if (autoReturnToAuction) {
        setTimeout(() => itemScanRef.current?.focus(), 80);
        setAutoReturnToAuction(false);
      }
    } catch (scanError: any) {
      if (scanError?.response?.data?.multiple && Array.isArray(scanError?.response?.data?.products)) {
        setProductCandidates(scanError.response.data.products);
        setInterventionAlert("Multiple products matched. Select the correct SKU.");
        playInterventionSound();
      } else {
        const message = scanError?.response?.data?.error || "Failed to link product to selected order";
        setError(message);
        setInterventionAlert(message);
        playInterventionSound();
      }
    } finally {
      setProductLoading(false);
    }
  };

  const handleDeleteLinkedProduct = async (
    contextStickerNumber: string,
    sku: string,
    scanId?: number | null
  ) => {
    if (!selectedShowId || !activeShipment || !contextStickerNumber || !sku) return;
    setError(null);
    setSuccess(null);
    setInterventionAlert(null);

    let pinValue = "";
    if (!isAdmin) {
      const entered = window.prompt(
        "Supervisor PIN required to remove linked product.\nScan or enter PIN:"
      );
      if (entered === null) return;
      pinValue = entered.trim();
      if (!pinValue) {
        setError("PIN is required to remove a linked product.");
        setInterventionAlert("PIN required for link removal.");
        playInterventionSound();
        return;
      }
    }

    const actionKey = `${contextStickerNumber}:${sku}`;
    setDeletingLinkKey(actionKey);
    try {
      const response = await axios.post(getApiUrl("tiktok/fulfillment/delete-link"), {
        showId: Number(selectedShowId),
        tracking: activeShipment.tracking,
        auctionStickerNumber: contextStickerNumber,
        sku,
        scanId: scanId || undefined,
        pin: pinValue || undefined,
      });
      const payload = response.data || {};
      setActiveShipment((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          expectedItems: payload.expectedItems ?? prev.expectedItems,
          scannedItems: payload.scannedItems ?? prev.scannedItems,
          remainingItems: payload.remainingItems ?? prev.remainingItems,
          completed: payload.completed ?? prev.completed,
          auctionExpectedItems: payload.auctionExpectedItems ?? prev.auctionExpectedItems,
          auctionScannedItems: payload.auctionScannedItems ?? prev.auctionScannedItems,
          auctionRemainingItems: payload.auctionRemainingItems ?? prev.auctionRemainingItems,
          nonAuctionExpectedItems: payload.nonAuctionExpectedItems ?? prev.nonAuctionExpectedItems,
          nonAuctionScannedItems: payload.nonAuctionScannedItems ?? prev.nonAuctionScannedItems,
          nonAuctionRemainingItems:
            payload.nonAuctionRemainingItems ?? prev.nonAuctionRemainingItems,
          checklist: payload.checklist || prev.checklist,
        };
      });
      if (
        activeAuctionSticker &&
        !((payload.checklist || []).some(
          (item: ShipmentChecklistItem) => String(item.stickerNumber || "") === activeAuctionSticker
        ))
      ) {
        setActiveAuctionSticker("");
        setAutoReturnToAuction(false);
        setProductFocusPinned(false);
      }
      setSuccess(payload.message || `Removed one linked scan for ${sku}.`);
    } catch (deleteError: any) {
      const message =
        deleteError?.response?.data?.error || "Failed to remove linked product from order context";
      setError(message);
      setInterventionAlert(message);
      playInterventionSound();
    } finally {
      setDeletingLinkKey("");
    }
  };

  const handleOpenShipmentView = useCallback(async (shipmentId: string) => {
    if (!selectedShowId || !shipmentId) return;
    setShipmentViewLoading(true);
    try {
      const response = await axios.get(getApiUrl("tiktok/fulfillment/shipment-details"), {
        params: {
          showId: Number(selectedShowId),
          shipmentId,
        },
      });
      const payload = response.data || {};
      setShipmentView({
        shipmentId: payload.shipmentId,
        tracking: payload.tracking,
        expectedItems: payload.expectedItems || 0,
        scannedItems: payload.scannedItems || 0,
        remainingItems: payload.remainingItems || 0,
        completed: Boolean(payload.completed),
        auctionExpectedItems: payload.auctionExpectedItems || 0,
        auctionScannedItems: payload.auctionScannedItems || 0,
        auctionRemainingItems: payload.auctionRemainingItems || 0,
        nonAuctionExpectedItems: payload.nonAuctionExpectedItems || 0,
        nonAuctionScannedItems: payload.nonAuctionScannedItems || 0,
        nonAuctionRemainingItems: payload.nonAuctionRemainingItems || 0,
        checklist: payload.checklist || [],
        closedAt: payload.closedAt || null,
        closedBy: payload.closedBy || null,
        closedByName: payload.closedByName || null,
      });
    } catch (viewError: any) {
      const message = viewError?.response?.data?.error || "Failed to load shipment details";
      setError(message);
    } finally {
      setShipmentViewLoading(false);
    }
  }, [selectedShowId]);

  const handleShipmentTabChange = useCallback(
    (value: "completed" | "pending" | "underReview" | "failed" | "terminal") => {
      setShipmentTab(value);
    },
    []
  );

  const handleCompletedSearchChange = useCallback((value: string) => {
    setCompletedSearch(value);
  }, []);

  return (
    <Box sx={{ mt: 4, px: 3, pb: 6 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        TikTok Fulfillment
      </Typography>

      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <Box>
              <FormControl fullWidth>
                <InputLabel id="fulfillment-show-label">Show</InputLabel>
                <Select
                  labelId="fulfillment-show-label"
                  label="Show"
                  value={selectedShowId}
                  onChange={(e) => setSelectedShowId(String(e.target.value))}
                  disabled={showsLoading}
                >
                  {shows.map((show) => (
                    <MenuItem key={show.id} value={String(show.id)}>
                      {show.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 0.5 }}>
                Selected show: <strong>{selectedShowName || "N/A"}</strong>
              </Typography>
              {summary?.activeImport ? (
                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-all" }}>
                  Active CSV: <strong>{summary.activeImport.fileName}</strong>
                </Typography>
              ) : (
                <Typography variant="body2" color="error">
                  No CSV uploaded yet. Admin must upload before scanning begins.
                </Typography>
              )}
              {isAdmin && (
                <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
                  <TextField
                    size="small"
                    fullWidth
                    label="New TikTok Show"
                    value={newShowName}
                    onChange={(e) => setNewShowName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateShow();
                      }
                    }}
                  />
                  <Button
                    variant="outlined"
                    onClick={handleCreateShow}
                    disabled={!newShowName.trim() || creatingShow}
                  >
                    {creatingShow ? <CircularProgress size={18} /> : "Create"}
                  </Button>
                </Box>
              )}
            </Box>
          </Grid>
          <Grid item xs={12} md={8}>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6} md={3}>
                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Typography variant="caption" color="text.secondary">
                    Total Shipments
                  </Typography>
                  <Typography variant="h6">{summary?.activeImport?.totalShipments ?? 0}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Typography variant="caption" color="text.secondary">
                    Ready Shipments
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    {summary?.activeImport?.readyShipments ?? 0}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Typography variant="caption" color="text.secondary">
                    Pending Review
                  </Typography>
                  <Typography variant="h6" color="warning.main">
                    {summary?.activeImport?.pendingReviewShipments ?? 0}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Typography variant="caption" color="text.secondary">
                    Remaining Shipments
                  </Typography>
                  <Typography variant="h6" color="error.main">
                    {Number(summary?.activeImport?.remainingShipments ?? summary?.activeImport?.totalShipments ?? 0)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Typography variant="caption" color="text.secondary">
                    Item Number Contexts
                  </Typography>
                  <Typography variant="h6">{itemContextCount}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Typography variant="caption" color="text.secondary">
                    Expected Product Links
                  </Typography>
                  <Typography variant="h6">{expectedProductLinkCount}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Typography variant="caption" color="text.secondary">
                    Completed Shipments
                  </Typography>
                  <Typography variant="h6">{completedShipmentCount}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Typography variant="caption" color="text.secondary">
                    Missing Order #s
                  </Typography>
                  <Typography variant="h6" color="error.main">
                    {failedOrderCount}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Typography variant="caption" color="text.secondary">
                    Cancelled / Failed Orders
                  </Typography>
                  <Typography variant="h6" color="warning.main">
                    {terminalOrderCount}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Paper>

      {isAdmin && (
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Admin: Upload Show CSV
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <Button variant="outlined" component="label" fullWidth>
                {uploadFile ? uploadFile.name : "Choose CSV file"}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
              </Button>
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="contained"
                disabled={!uploadFile || !selectedShowId || uploading}
                onClick={handleUpload}
              >
                {uploading ? <CircularProgress size={22} /> : "Upload & Prepare"}
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {summaryLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Step 1: Scan Shipping Label (Tracking)
        </Typography>
        <form onSubmit={handleLoadShipment}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs>
              <TextField
                fullWidth
                inputRef={trackingRef}
                label="Tracking Number"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                required
                disabled={!summary?.activeImport}
              />
            </Grid>
            <Grid item>
              <Button
                type="submit"
                variant="contained"
                disabled={!summary?.activeImport || shipmentLoading}
                sx={{
                  height: 56,
                  bgcolor: "#00897b",
                  "&:hover": { bgcolor: "#00695c" },
                }}
              >
                {shipmentLoading ? <CircularProgress size={22} /> : "Load Shipment"}
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      {activeShipment && (
        <Dialog
          open={Boolean(activeShipment)}
          onClose={handleDismissShipmentModal}
          fullWidth
          maxWidth="xl"
        >
          <DialogContent sx={{ p: 3 }}>
            <Paper elevation={0} sx={{ p: 1 }}>
          {interventionAlert && (
            <Box
              sx={{
                mb: 2,
                p: 2,
                borderRadius: 1.5,
                border: "2px solid #d32f2f",
                bgcolor: "#ffebee",
                display: "flex",
                alignItems: "center",
                gap: 1.5,
              }}
            >
              <ReportProblemOutlinedIcon color="error" sx={{ fontSize: 30 }} />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#b71c1c", lineHeight: 1.1 }}>
                  Stop - Review Needed
                </Typography>
                <Typography variant="body2" sx={{ color: "#7f1d1d" }}>
                  {interventionAlert}
                </Typography>
              </Box>
            </Box>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
            <Typography variant="h6">
              Shipment {activeShipment.shipmentId} ({activeShipment.tracking})
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              {activeShipment.completed ? (
              <Box display="flex" alignItems="center" gap={1} color="success.main">
                <CheckCircleOutlineIcon />
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  Completed
                </Typography>
              </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Remaining items: <strong>{activeShipment.remainingItems}</strong>
                </Typography>
              )}
              <Button variant="outlined" onClick={handleDismissShipmentModal}>
                Back
              </Button>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleCloseShipment}
                disabled={!canCloseShipment}
              >
                Close Shipment
              </Button>
            </Box>
          </Box>

          <Box sx={{ mt: 2 }}>
            <form onSubmit={handleItemScan}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs>
                  <TextField
                    fullWidth
                    inputRef={itemScanRef}
                    label="Scan Item Number"
                    value={itemScanInput}
                    onChange={(e) => setItemScanInput(e.target.value)}
                    onFocus={() => {
                      setProductFocusPinned(false);
                    }}
                    required
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                    Scan the TikTok item number sticker first. After it verifies, scan the product barcode to link it.
                  </Typography>
                </Grid>
                <Grid item>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={itemLoading}
                    sx={{ height: 56 }}
                  >
                    {itemLoading ? <CircularProgress size={22} /> : "Verify Order"}
                  </Button>
                </Grid>
              </Grid>
            </form>
          </Box>

          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Total Shipment Progress
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  {activeShipment.scannedItems} / {activeShipment.expectedItems}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Item Number Contexts
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  {activeShipment.auctionScannedItems} / {activeShipment.auctionExpectedItems}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Remaining Contexts
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  {activeShipment.remainingItems}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: "#f8fafc" }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Active Order Context: {formatActiveContextLabel(activeAuctionSticker)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Scan one item number first. Then scan every product barcode that belongs to that TikTok order context.
              If one item number contains multiple products, keep scanning products under the same context until it is complete.
            </Typography>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleProductScan();
              }}
            >
              <Grid container spacing={2} alignItems="center">
                <Grid item xs>
                  <TextField
                    fullWidth
                    inputRef={productInputRef}
                    label="Scan Product UPC or paste SKU"
                    value={productInput}
                    onChange={(e) => setProductInput(e.target.value)}
                    onFocus={() => {
                      if (suppressNextProductFocusPinRef.current) {
                        suppressNextProductFocusPinRef.current = false;
                        return;
                      }
                      if (!productLoading) {
                        setAutoReturnToAuction(false);
                      }
                      if (activeShipment && activeAuctionSticker) {
                        setProductFocusPinned(true);
                      }
                    }}
                    disabled={!activeAuctionSticker}
                    required
                  />
                </Grid>
                <Grid item>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={!activeAuctionSticker || productLoading}
                    sx={{ height: 56 }}
                  >
                    {productLoading ? <CircularProgress size={22} /> : "Link Product"}
                  </Button>
                </Grid>
              </Grid>
            </form>
            {productCandidates.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  Multiple matches found. Choose one:
                </Typography>
                <Grid container spacing={1}>
                  {productCandidates.map((candidate) => (
                    <Grid item xs={12} md={6} key={candidate.sku}>
                      {(() => {
                        const normalizedImage = String(candidate.image || "").trim();
                        const hasImage =
                          normalizedImage.length > 0 &&
                          normalizedImage.toLowerCase() !== "null" &&
                          normalizedImage.toLowerCase() !== "n/a";
                        const hasSizeOz =
                          candidate.sizeOz !== null &&
                          candidate.sizeOz !== undefined &&
                          String(candidate.sizeOz).trim() !== "";
                        const hasSizeMl =
                          candidate.sizeMl !== null &&
                          candidate.sizeMl !== undefined &&
                          String(candidate.sizeMl).trim() !== "";
                        const sizeText = hasSizeOz
                          ? `${candidate.sizeOz} oz`
                          : hasSizeMl
                          ? `${candidate.sizeMl} ml`
                          : "No size";
                        const strengthText =
                          String(candidate.strength ?? candidate.ProductDetail?.strength ?? "").trim() ||
                          "No strength";
                        const conditionText =
                          String(candidate.condition ?? "").trim() || "No condition";
                        const testerText =
                          Boolean(candidate.tester ?? candidate.ProductDetail?.tester ?? false)
                            ? "Tester"
                            : "Non-tester";
                        return (
                      <Button
                        fullWidth
                        variant="outlined"
                        onClick={() => handleProductScan(candidate.sku)}
                        disabled={productLoading}
                        sx={{
                          justifyContent: "flex-start",
                          textAlign: "left",
                          py: 1,
                          px: 1.25,
                          minHeight: 88,
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, width: "100%" }}>
                          <Box
                            sx={{
                              width: 56,
                              height: 56,
                              borderRadius: 1,
                              border: "1px solid",
                              borderColor: "divider",
                              bgcolor: "#f8fafc",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                              flexShrink: 0,
                            }}
                          >
                            {hasImage ? (
                              <img
                                src={normalizedImage}
                                alt={candidate.itemName || candidate.sku}
                                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                              />
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                No image
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: "normal", lineHeight: 1.2 }}>
                              {candidate.brand || "N/A"} {candidate.itemName || ""}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.2 }}>
                              SKU: {candidate.sku}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.2 }}>
                              {strengthText} |{" "}
                              {sizeText}{" "}
                              | {conditionText} |{" "}
                              {testerText}
                            </Typography>
                          </Box>
                        </Box>
                      </Button>
                        );
                      })()}
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </Paper>

          <Table
            size="medium"
            sx={{
              mt: 2,
              "& .MuiTableCell-root": {
                py: 1.4,
                fontSize: "0.98rem",
              },
              "& .MuiTableHead-root .MuiTableCell-root": {
                fontSize: "1.02rem",
                fontWeight: 700,
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell>Order / Context</TableCell>
                <TableCell align="right">Scanned</TableCell>
                <TableCell>Products Linked</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activeShipment.checklist.map((item) => (
                <TableRow key={item.stickerNumber}>
                  <TableCell>
                    {item.nonAuctionContext && item.nonAuctionContextIndex
                      ? `${formatChecklistRowLabel(item)} #${item.nonAuctionContextIndex}`
                      : formatChecklistRowLabel(item)}
                  </TableCell>
                  <TableCell align="right">
                    {Number(item.scannedQty || 0) > 0 ? (
                      <CheckCircleIcon sx={{ color: "success.main", fontSize: 18 }} />
                    ) : (
                      <CancelIcon sx={{ color: "error.main", fontSize: 18 }} />
                    )}
                  </TableCell>
                  <TableCell>
                    {item.linkedProducts && item.linkedProducts.length > 0 ? (
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {Number(item.linkedProductScans || 0)} linked
                        </Typography>
                        {item.linkedProducts.map((product) => {
                          const sizeText = product.sizeOz
                            ? `${product.sizeOz} oz`
                            : product.sizeMl
                            ? `${product.sizeMl} ml`
                            : "";
                          const title = [product.brand, product.itemName, product.strength, sizeText]
                            .filter(Boolean)
                            .join(" ");
                          return (
                            <Box key={`${item.stickerNumber}-${product.sku}`} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {title || product.sku}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                [{product.sku}]
                              </Typography>
                              {product.tester && <ScienceIcon sx={{ color: "red", fontSize: 15 }} />}
                              <Typography variant="caption" color="text.secondary">
                                x{product.count}
                              </Typography>
                              <Button
                                size="small"
                                variant="text"
                                color="error"
                                startIcon={<DeleteOutlineIcon sx={{ fontSize: 14 }} />}
                                onClick={() =>
                                  handleDeleteLinkedProduct(
                                    product.contextSticker || item.stickerNumber,
                                    product.sku,
                                    product.latestScanId
                                  )
                                }
                                disabled={deletingLinkKey === `${item.stickerNumber}:${product.sku}`}
                                sx={{ minWidth: "auto", px: 0.75, ml: 0.5 }}
                              >
                                Delete
                              </Button>
                            </Box>
                          );
                        })}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        0
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {activeShipment.checklist.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              No scannable contexts found in this shipment.
            </Alert>
          )}
            </Paper>
          </DialogContent>
        </Dialog>
      )}

      {!activeShipment && interventionAlert && (
        <Box
          sx={{
            mb: 3,
            p: 2,
            borderRadius: 1.5,
            border: "2px solid #d32f2f",
            bgcolor: "#ffebee",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
          }}
        >
          <ReportProblemOutlinedIcon color="error" sx={{ fontSize: 30 }} />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#b71c1c", lineHeight: 1.1 }}>
              Stop - Review Needed
            </Typography>
            <Typography variant="body2" sx={{ color: "#7f1d1d" }}>
              {interventionAlert}
            </Typography>
          </Box>
        </Box>
      )}

      {!activeShipment && error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {!activeShipment && success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <ShipmentHistorySection
        shipmentTab={shipmentTab}
        completedSearch={completedSearch}
        filteredCompletedShipments={filteredCompletedShipments}
        completedCount={summary?.completedShipments?.length || 0}
        pendingCount={summary?.pendingShipments?.length || 0}
        underReviewCount={summary?.underReviewShipments?.length || summary?.pendingReview?.length || 0}
        failedCount={summary?.failedOrders?.length || 0}
        terminalCount={summary?.terminalOrders?.length || 0}
        onShipmentTabChange={handleShipmentTabChange}
        onCompletedSearchChange={handleCompletedSearchChange}
        onOpenShipmentView={handleOpenShipmentView}
      />

      <Dialog open={Boolean(shipmentView)} onClose={() => setShipmentView(null)} fullWidth maxWidth="lg">
        <DialogContent sx={{ p: 3 }}>
          {shipmentViewLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : shipmentView ? (
            <Box>
              <Typography variant="h6">
                Shipment {shipmentView.shipmentId} ({shipmentView.tracking})
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Closed: {shipmentView.closedAt ? new Date(shipmentView.closedAt).toLocaleString() : "N/A"}
                {shipmentView.closedByName || shipmentView.closedBy
                  ? ` | Closed by: ${shipmentView.closedByName || shipmentView.closedBy}`
                  : ""}
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} md={4}>
                  <Paper variant="outlined" sx={{ p: 1.25 }}>
                    <Typography variant="caption" color="text.secondary">
                      Total Shipment Progress
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {shipmentView.scannedItems} / {shipmentView.expectedItems}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper variant="outlined" sx={{ p: 1.25 }}>
                    <Typography variant="caption" color="text.secondary">
                      Item Number Contexts
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {shipmentView.auctionScannedItems} / {shipmentView.auctionExpectedItems}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Typography variant="caption" color="text.secondary">
                  Remaining Contexts
                </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {shipmentView.remainingItems}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
              <Table size="small" sx={{ mt: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Order / Context</TableCell>
                    <TableCell align="right">Scanned</TableCell>
                    <TableCell>Products Linked</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shipmentView.checklist.map((item) => (
                    <TableRow key={`view-${item.stickerNumber}`}>
                      <TableCell>
                        {item.nonAuctionContext && item.nonAuctionContextIndex
                          ? `${formatChecklistRowLabel(item)} #${item.nonAuctionContextIndex}`
                          : formatChecklistRowLabel(item)}
                      </TableCell>
                      <TableCell align="right">
                        {Number(item.scannedQty || 0) > 0 ? (
                          <CheckCircleIcon sx={{ color: "success.main", fontSize: 18 }} />
                        ) : (
                          <CancelIcon sx={{ color: "error.main", fontSize: 18 }} />
                        )}
                      </TableCell>
                      <TableCell>
                        {item.linkedProducts && item.linkedProducts.length > 0 ? (
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                            {item.linkedProducts.map((product) => (
                              <Typography key={`view-${item.stickerNumber}-${product.sku}`} variant="body2">
                                {product.brand || ""} {product.itemName || ""} [{product.sku}] x{product.count}
                              </Typography>
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            0
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          ) : null}
        </DialogContent>
      </Dialog>

    </Box>
  );
};

export default TikTokFulfillment;

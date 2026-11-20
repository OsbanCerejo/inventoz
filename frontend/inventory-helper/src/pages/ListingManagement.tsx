import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, IconButton, Paper,
  Switch, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Tooltip, Typography, Alert, Divider,
  Select, MenuItem, FormControl, InputLabel, InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Link as LinkIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Search as SearchIcon,
  OpenInNew as OpenInNewIcon,
  Sync as SyncIcon,
  DeleteOutline as DeleteIcon,
  EditOutlined as EditIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { getServerUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';

const API = () => getServerUrl();

interface ManagedSkuRow {
  id: number;
  sku: string;
  itemName: string;
  brand: string;
  strength: string | null;
  sizeOz: number | null;
  sizeMl: number | null;
  inventozQty: number;
  pendingSales: number;
  effectiveAvailable: number;
  isGenericAuction: boolean;
  syncEnabled: boolean;
  mapping: {
    id: number;
    shopId: string;
    marketplaceProductId: string | null;
    marketplaceSkuId: string | null;
    currentQty: number;
    lastConfirmedQty: number | null;
    currentPrice: number | null;
    listingStatus: string;
    syncEnabled: boolean;
    lastSyncAt: string | null;
    lastSyncStatus: string | null;
  } | null;
  stockAlert: boolean;
}

interface ConnectedShop {
  id: number;
  shopId: string;
  shopName: string;
  isActive: boolean;
  accessTokenExpiry: string;
}


function StockAlertBadge({ alert }: { alert: boolean }) {
  if (!alert) return null;
  return (
    <Tooltip title="TikTok listing qty exceeds effective available stock">
      <WarningIcon fontSize="small" sx={{ color: 'warning.main', ml: 0.5, verticalAlign: 'middle' }} />
    </Tooltip>
  );
}

export default function ListingManagement() {
  const { token } = useAuth();
  const [rows, setRows] = useState<ManagedSkuRow[]>([]);
  const [shops, setShops] = useState<ConnectedShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAlert, setFilterAlert] = useState(false);
  const [filterFailed, setFilterFailed] = useState(false);
  const [sortField, setSortField] = useState<'none' | 'tiktokQty' | 'stock'>('none');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [syncCountdown, setSyncCountdown] = useState(300);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = 300 - (elapsed % 300);
      setSyncCountdown(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Add SKU dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addSku, setAddSku] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addGeneric, setAddGeneric] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // Map to TikTok dialog
  const [linkingRowId, setLinkingRowId] = useState<number | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapRow, setMapRow] = useState<ManagedSkuRow | null>(null);
  const [tiktokProducts, setTiktokProducts] = useState<any[]>([]);
  const [tiktokLoading, setTiktokLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_tiktokNextPage, setTiktokNextPage] = useState<string | null>(null);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedSkuId, setSelectedSkuId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState('');
  const [productDetail, setProductDetail] = useState<any>(null);
  const [searchInput, setSearchInput] = useState('');

  // Inline editing
  const [editingMappingId, setEditingMappingId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Settings panel per listing
  const [settingsRow, setSettingsRow] = useState<ManagedSkuRow | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [skusRes, shopsRes] = await Promise.all([
        axios.get(`${API()}/listing-management/skus`, { headers }),
        axios.get(`${API()}/listing-management/auth/status`, { headers }),
      ]);
      setRows(skusRes.data);
      setShops(shopsRes.data.filter((s: ConnectedShop) => s.isActive));
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const connectTikTok = async () => {
    try {
      const res = await axios.get(`${API()}/listing-management/auth/tiktok`, { headers });
      window.location.href = res.data.url;
    } catch (e: any) {
      alert('Failed to get TikTok auth URL: ' + e.message);
    }
  };

  const handleRemoveSku = async (id: number, sku: string) => {
    if (!window.confirm(`Remove "${sku}" from Listing Management?\n\nThis deletes it from Inventoz listing management only. TikTok Shop and your Inventoz product are not affected.`)) return;
    try {
      await axios.delete(`${API()}/listing-management/skus/${id}`, { headers });
      load();
    } catch (e: any) {
      alert('Failed to remove SKU: ' + (e.response?.data?.error || e.message));
    }
  };

  const refreshCipher = async () => {
    try {
      const res = await axios.post(`${API()}/listing-management/auth/tiktok/refresh-cipher`, {}, { headers });
      const ok = res.data.results.filter((r: any) => r.cipher).length;
      const fail = res.data.results.filter((r: any) => r.error).length;
      alert(`Cipher refresh: ${ok} shop(s) updated${fail ? `, ${fail} failed (check backend logs)` : ''}`);
      load();
    } catch (e: any) {
      alert('Cipher refresh failed: ' + e.message);
    }
  };

  const handleAddSku = async () => {
    if (!addSku.trim()) return;
    setAddLoading(true);
    setAddError('');
    try {
      await axios.post(`${API()}/listing-management/skus`, {
        sku: addSku.trim(), isGenericAuction: addGeneric, notes: addNotes,
      }, { headers });
      setAddOpen(false);
      setAddSku(''); setAddNotes(''); setAddGeneric(false);
      load();
    } catch (e: any) {
      setAddError(e.response?.data?.error || e.message);
    } finally {
      setAddLoading(false);
    }
  };

  const toggleSync = async (row: ManagedSkuRow) => {
    try {
      await axios.patch(`${API()}/listing-management/skus/${row.id}`,
        { syncEnabled: !row.syncEnabled }, { headers });
      load();
    } catch (e: any) {
      alert('Failed: ' + e.message);
    }
  };

  const openMapDialog = async (row: ManagedSkuRow) => {
    setLinkingRowId(row.id);
    setMapRow(row);
    setMapError('');
    setSelectedProductId('');
    setSelectedSkuId('');
    setSelectedWarehouseId('');
    setProductDetail(null);
    setTiktokProducts([]);
    setTiktokNextPage(null);
    setSearchInput('');
    setMapOpen(true);
    if (shops.length > 0) {
      const shopId = shops[0].shopId;
      setSelectedShopId(shopId);
      await fetchTikTokProducts(shopId);
    }
    setLinkingRowId(null);
  };

  const disconnectShop = async (shopId: string) => {
    if (!window.confirm(`Disconnect shop ${shopId}?`)) return;
    try {
      await axios.delete(`${API()}/listing-management/auth/tiktok/${shopId}`, { headers });
      load();
    } catch (e: any) {
      alert('Failed to disconnect: ' + e.message);
    }
  };

  // Fetch ALL TikTok listings by auto-paginating, then search client-side
  const fetchTikTokProducts = async (shopId: string, _keyword?: string, _pageToken?: string) => {
    setTiktokLoading(true);
    setTiktokNextPage(null);
    try {
      let allProducts: any[] = [];
      let nextPage: string | null = null;
      let page = 0;
      const MAX_PAGES = 20; // safety cap — 20 pages × 20 items = 400 listings
      do {
        const params: any = { shopId };
        if (nextPage) params.pageToken = nextPage;
        const res = await axios.get(`${API()}/listing-management/tiktok/products`, { headers, params });
        const products = res.data?.products || res.data?.list || [];
        allProducts = [...allProducts, ...products];
        nextPage = res.data?.next_page_token || null;
        page++;
        // Show progress as pages load
        setTiktokProducts([...allProducts]);
      } while (nextPage && page < MAX_PAGES);
      setTiktokProducts(allProducts);
      setTiktokNextPage(null); // all loaded — no manual load more needed
    } catch (e: any) {
      setMapError('Failed to load TikTok products: ' + (e.response?.data?.error || e.message));
    } finally {
      setTiktokLoading(false);
    }
  };

  const fetchProductDetail = async (productId: string) => {
    if (!selectedShopId || !productId) return;
    try {
      const res = await axios.get(`${API()}/listing-management/tiktok/products/${productId}`, {
        headers, params: { shopId: selectedShopId },
      });
      setProductDetail(res.data);
      // Auto-select first SKU
      const skus = res.data?.skus || res.data?.sku_list || [];
      if (skus.length === 1) {
        setSelectedSkuId(skus[0].id);
        const warehouses = skus[0].inventory || skus[0].stock_infos || [];
        if (warehouses.length === 1) setSelectedWarehouseId(warehouses[0].warehouse_id);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleMapConfirm = async () => {
    if (!mapRow || !selectedSkuId) return;
    setMapLoading(true);
    setMapError('');
    try {
      await axios.post(`${API()}/listing-management/mappings`, {
        managedSkuId: mapRow.id,
        shopId: selectedShopId,
        marketplaceProductId: selectedProductId,
        marketplaceSkuId: selectedSkuId,
        warehouseId: selectedWarehouseId || null,
      }, { headers });
      setMapOpen(false);
      load();
    } catch (e: any) {
      setMapError(e.response?.data?.error || e.message);
    } finally {
      setMapLoading(false);
    }
  };

  const startEdit = (row: ManagedSkuRow) => {
    if (!row.mapping) return;
    setEditingMappingId(row.mapping.id);
    setEditQty(String(row.mapping.currentQty ?? ''));
    setEditPrice(row.mapping.currentPrice != null ? String(row.mapping.currentPrice) : '');
  };

  const cancelEdit = () => {
    setEditingMappingId(null);
    setEditQty('');
    setEditPrice('');
  };

  const saveEdit = async (row: ManagedSkuRow) => {
    if (!row.mapping) return;
    setEditSaving(true);
    try {
      const calls: Promise<any>[] = [];
      if (editQty !== '' && Number(editQty) !== row.mapping.currentQty) {
        calls.push(axios.post(`${API()}/listing-management/mappings/${row.mapping.id}/push-qty`,
          { qty: Number(editQty) }, { headers }));
      }
      if (editPrice !== '' && Number(editPrice) !== row.mapping.currentPrice) {
        calls.push(axios.post(`${API()}/listing-management/mappings/${row.mapping.id}/push-price`,
          { price: Number(editPrice) }, { headers }));
      }
      if (calls.length > 0) await Promise.all(calls);
      cancelEdit();
      load();
    } catch (e: any) {
      alert('Failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setEditSaving(false);
    }
  };

  const retryFailedJobs = async () => {
    try {
      const jobsRes = await axios.get(`${API()}/listing-management/sync-jobs`, {
        headers, params: { status: 'failed', limit: 100 },
      });
      await Promise.all(jobsRes.data.map((j: any) =>
        axios.post(`${API()}/listing-management/sync-jobs/${j.id}/retry`, {}, { headers })
      ));
      load();
    } catch (e: any) {
      alert('Retry failed: ' + e.message);
    }
  };

  const filtered = (() => {
    let result = rows.filter(r => {
      if (filterAlert && !r.stockAlert) return false;
      if (filterFailed && r.mapping?.lastSyncStatus !== 'failed') return false;
      if (search) {
        const q = search.toLowerCase();
        return r.sku.toLowerCase().includes(q) || (r.itemName || '').toLowerCase().includes(q);
      }
      return true;
    });
    if (sortField !== 'none') {
      result = [...result].sort((a, b) => {
        const aVal = sortField === 'tiktokQty' ? (a.mapping?.currentQty ?? -1) : a.inventozQty;
        const bVal = sortField === 'tiktokQty' ? (b.mapping?.currentQty ?? -1) : b.inventozQty;
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }
    return result;
  })();

  const failedCount = rows.filter(r => r.mapping?.lastSyncStatus === 'failed').length;
  const alertCount = rows.filter(r => r.stockAlert).length;

  const syncedCount = rows.filter(r => r.mapping?.lastSyncStatus === 'ok').length;

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 0 }}>
        {/* Top bar */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.2,
          borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap',
        }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mr: 1 }}>
            TikTok Listing Management
          </Typography>

          <TextField
            size="small" placeholder="Search SKU or product…"
            value={search} onChange={e => setSearch(e.target.value)}
            sx={{ width: 260 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />

          <Select
            size="small" value={sortField}
            onChange={e => setSortField(e.target.value as typeof sortField)}
            sx={{ fontSize: 13, minWidth: 160 }}
          >
            <MenuItem value="none">Sort: newest first</MenuItem>
            <MenuItem value="stock">Sort: stock</MenuItem>
            <MenuItem value="tiktokQty">Sort: TikTok qty</MenuItem>
          </Select>

          {sortField !== 'none' && (
            <Select
              size="small" value={sortDir}
              onChange={e => setSortDir(e.target.value as 'asc' | 'desc')}
              sx={{ fontSize: 13, minWidth: 120 }}
            >
              <MenuItem value="desc">High → Low</MenuItem>
              <MenuItem value="asc">Low → High</MenuItem>
            </Select>
          )}

          <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Tooltip title="Refresh data">
              <IconButton size="small" onClick={load}><RefreshIcon sx={{ fontSize: 18 }} /></IconButton>
            </Tooltip>
            {failedCount > 0 && (
              <Button size="small" variant="outlined" color="error" startIcon={<SyncIcon />} onClick={retryFailedJobs}>
                Retry {failedCount} failed
              </Button>
            )}
            {shops.length === 0 ? (
              <Button size="small" variant="outlined" startIcon={<OpenInNewIcon />} onClick={connectTikTok}>
                Connect TikTok Shop
              </Button>
            ) : (
              <>
                {shops.map(s => (
                  <Chip key={s.shopId} label={s.shopName || s.shopId} color="success" size="small"
                    onDelete={() => disconnectShop(s.shopId)}
                    deleteIcon={<Tooltip title="Disconnect"><span style={{ fontSize: 14 }}>×</span></Tooltip>}
                  />
                ))}
                <Button size="small" variant="outlined" startIcon={<OpenInNewIcon />} onClick={connectTikTok}>Add shop</Button>
                <Button size="small" variant="outlined" onClick={refreshCipher}>Refresh cipher</Button>
              </>
            )}
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
              Add SKU
            </Button>
          </Box>
        </Box>

        {/* Stats strip */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 2.5, px: 2, py: 0.8,
          bgcolor: 'grey.50', borderBottom: filtered.length > 0 ? '1px solid' : 'none', borderColor: 'divider',
          flexWrap: 'wrap',
        }}>
          {alertCount > 0 && (
            <Box
              onClick={() => setFilterAlert(v => !v)}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.7, cursor: 'pointer',
                color: filterAlert ? 'error.main' : 'text.secondary',
                '&:hover': { color: 'error.main' } }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main', flexShrink: 0 }} />
              <Typography variant="caption" fontWeight={500}>
                <strong>{alertCount}</strong> stock alert{alertCount > 1 ? 's' : ''}
              </Typography>
            </Box>
          )}
          {failedCount > 0 && (
            <Box
              onClick={() => setFilterFailed(v => !v)}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.7, cursor: 'pointer',
                color: filterFailed ? 'warning.main' : 'text.secondary',
                '&:hover': { color: 'warning.main' } }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main', flexShrink: 0 }} />
              <Typography variant="caption" fontWeight={500}>
                <strong>{failedCount}</strong> failed sync
              </Typography>
            </Box>
          )}
          {syncedCount > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, color: 'text.secondary' }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', flexShrink: 0 }} />
              <Typography variant="caption" fontWeight={500}>
                <strong>{syncedCount}</strong> synced
              </Typography>
            </Box>
          )}
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.disabled' }}>
            <SyncIcon sx={{ fontSize: 12 }} />
            <Typography variant="caption">
              Next sync in {Math.floor(syncCountdown / 60)}:{String(syncCountdown % 60).padStart(2, '0')}
            </Typography>
          </Box>
        </Box>

        {/* Table */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {rows.length === 0 ? 'No SKUs enrolled yet. Click "+ Add SKU" to get started.' : 'No results match your filters.'}
            </Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{
                '& th': {
                  fontWeight: 600, fontSize: 11, color: 'text.secondary', bgcolor: 'grey.50',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  borderBottom: '1px solid', borderColor: 'divider', py: 1,
                }
              }}>
                <TableCell sx={{ pl: 2 }}>Product</TableCell>
                <TableCell align="center">Stock</TableCell>
                <TableCell align="center">Pending</TableCell>
                <TableCell align="center">Avail.</TableCell>
                <TableCell align="center">Delta</TableCell>
                <TableCell align="center">TikTok Qty</TableCell>
                <TableCell align="center">Price</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Sync</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(row => {
                const isEditing = row.mapping && editingMappingId === row.mapping.id;
                const isOverListed = row.stockAlert && row.mapping;
                return (
                  <TableRow
                    key={row.id}
                    hover
                    sx={{
                      opacity: row.isGenericAuction ? 0.6 : 1,
                      '& td': { py: 1, borderBottom: '1px solid', borderColor: 'divider' },
                      ...(isOverListed ? { bgcolor: 'rgba(211,47,47,0.03)' } : {}),
                    }}
                  >
                    {/* Product */}
                    <TableCell sx={{ pl: 2, minWidth: 230 }}>
                      <Typography variant="body2" fontWeight={600} fontSize={12}>
                        {row.itemName || <em style={{ opacity: 0.5 }}>No name</em>}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                        {row.sku}
                      </Typography>
                      {(row.strength || row.sizeOz || row.sizeMl) && (
                        <Typography variant="caption" color="text.disabled" display="block" sx={{ lineHeight: 1.3 }}>
                          {[row.strength, row.sizeOz ? `${row.sizeOz} oz` : null, row.sizeMl ? `${row.sizeMl} ml` : null].filter(Boolean).join(' · ')}
                        </Typography>
                      )}
                    </TableCell>

                    {/* Stock */}
                    <TableCell align="center">
                      <Typography variant="body2" fontWeight={600}>{row.inventozQty}</Typography>
                    </TableCell>

                    {/* Pending */}
                    <TableCell align="center">
                      {row.pendingSales > 0
                        ? <Chip label={`-${row.pendingSales}`} size="small" color="warning" sx={{ fontSize: 11 }} />
                        : <Typography variant="body2" color="text.disabled">0</Typography>}
                    </TableCell>

                    {/* Effective available */}
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.3 }}>
                        <Typography variant="body2" fontWeight={600}
                          color={row.effectiveAvailable < 0 ? 'error.main' : 'inherit'}>
                          {row.effectiveAvailable}
                        </Typography>
                        <StockAlertBadge alert={row.stockAlert} />
                      </Box>
                    </TableCell>

                    {/* Next Sync delta */}
                    <TableCell align="center">
                      {(() => {
                        const m = row.mapping;
                        if (!m || m.lastConfirmedQty === null || m.lastConfirmedQty === undefined) {
                          return <Typography variant="body2" color="text.disabled">—</Typography>;
                        }
                        const delta = row.inventozQty - m.lastConfirmedQty;
                        if (delta === 0) return <Typography variant="body2" color="text.disabled">—</Typography>;
                        return (
                          <Chip label={delta > 0 ? `+${delta}` : `${delta}`} size="small"
                            color={delta > 0 ? 'success' : 'error'} sx={{ fontSize: 11, fontWeight: 600 }} />
                        );
                      })()}
                    </TableCell>

                    {/* TikTok Qty — inline edit */}
                    <TableCell align="center" sx={{ minWidth: 90 }}>
                      {isEditing ? (
                        <TextField
                          size="small" type="number" value={editQty}
                          onChange={e => setEditQty(e.target.value)}
                          sx={{ width: 76 }}
                          inputProps={{ style: { textAlign: 'center', fontFamily: 'monospace', fontSize: 13, padding: '5px 6px' } }}
                        />
                      ) : row.mapping ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                          <Typography variant="body2" fontWeight={600}
                            color={isOverListed ? 'error.main' : 'inherit'}>
                            {row.mapping.currentQty}
                          </Typography>
                          {isOverListed && (
                            <Typography variant="caption" color="error.main" fontWeight={600}>▲</Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.disabled">—</Typography>
                      )}
                    </TableCell>

                    {/* TikTok Price — inline edit */}
                    <TableCell align="center" sx={{ minWidth: 90 }}>
                      {isEditing ? (
                        <TextField
                          size="small" type="number" value={editPrice}
                          onChange={e => setEditPrice(e.target.value)}
                          sx={{ width: 88 }}
                          inputProps={{ style: { textAlign: 'right', fontFamily: 'monospace', fontSize: 13, padding: '5px 6px' } }}
                          InputProps={{ startAdornment: <InputAdornment position="start" sx={{ mr: 0, fontSize: 13 }}>$</InputAdornment> }}
                        />
                      ) : row.mapping?.currentPrice ? (
                        <Typography variant="body2" fontWeight={500}>${Number(row.mapping.currentPrice).toFixed(2)}</Typography>
                      ) : (
                        <Typography variant="body2" color="text.disabled">—</Typography>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell align="center">
                      {row.mapping ? (
                        row.stockAlert ? (
                          <Chip label="Alert" size="small" color="error" sx={{ fontSize: 11 }} />
                        ) : row.mapping.lastSyncStatus === 'failed' ? (
                          <Chip label="Failed" size="small" color="warning" sx={{ fontSize: 11 }} />
                        ) : row.mapping.lastSyncStatus === 'ok' ? (
                          <Chip label="Synced" size="small" color="success" sx={{ fontSize: 11 }} />
                        ) : (
                          <Chip label={row.mapping.listingStatus || 'linked'} size="small" sx={{ fontSize: 11 }} />
                        )
                      ) : (
                        <Chip label="Not linked" size="small" variant="outlined" sx={{ fontSize: 11, color: 'text.disabled' }} />
                      )}
                    </TableCell>

                    {/* Sync toggle — inline */}
                    <TableCell align="center">
                      <Tooltip title={row.syncEnabled ? 'Auto-sync on' : 'Auto-sync off'}>
                        <Switch
                          size="small"
                          checked={row.syncEnabled}
                          onChange={() => toggleSync(row)}
                          disabled={row.isGenericAuction || !row.mapping}
                          color="success"
                        />
                      </Tooltip>
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.3, justifyContent: 'center', alignItems: 'center' }}>
                        {!row.mapping && (
                          <Tooltip title="Link to TikTok listing">
                            <IconButton size="small" onClick={() => openMapDialog(row)} color="primary" disabled={linkingRowId === row.id}>
                              {linkingRowId === row.id ? <CircularProgress size={14} /> : <LinkIcon sx={{ fontSize: 17 }} />}
                            </IconButton>
                          </Tooltip>
                        )}
                        {row.mapping && isEditing ? (
                          <>
                            <Tooltip title="Save">
                              <IconButton size="small" color="success" onClick={() => saveEdit(row)} disabled={editSaving}>
                                {editSaving ? <CircularProgress size={14} /> : <CheckIcon sx={{ fontSize: 17 }} />}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Cancel">
                              <IconButton size="small" onClick={cancelEdit}>
                                <CloseIcon sx={{ fontSize: 17 }} />
                              </IconButton>
                            </Tooltip>
                          </>
                        ) : row.mapping ? (
                          <Tooltip title="Edit qty / price">
                            <IconButton size="small" onClick={() => startEdit(row)} color="primary">
                              <EditIcon sx={{ fontSize: 17 }} />
                            </IconButton>
                          </Tooltip>
                        ) : null}
                        {row.mapping && (
                          <Tooltip title="Listing settings">
                            <IconButton size="small" onClick={() => setSettingsRow(row)}>
                              <SettingsIcon sx={{ fontSize: 17 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Remove from Listing Management">
                          <IconButton size="small" onClick={() => handleRemoveSku(row.id, row.sku)} color="error">
                            <DeleteIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Listing Settings Dialog */}
      <Dialog open={!!settingsRow} onClose={() => setSettingsRow(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box>
            <Typography fontWeight={600} fontSize={15}>Listing Settings</Typography>
            <Typography variant="caption" color="text.secondary" fontFamily="monospace">{settingsRow?.sku}</Typography>
          </Box>
          <IconButton size="small" onClick={() => setSettingsRow(null)}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {settingsRow?.mapping && (
            <>
              {/* Stats */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                {[
                  { label: 'Listing status', value: settingsRow.mapping.listingStatus || '—' },
                  { label: 'Sync status', value: settingsRow.mapping.lastSyncStatus || 'Never synced' },
                  { label: 'Last sync', value: settingsRow.mapping.lastSyncAt ? new Date(settingsRow.mapping.lastSyncAt).toLocaleString() : '—' },
                  { label: 'Shop', value: settingsRow.mapping.shopId },
                ].map(item => (
                  <Box key={item.label} sx={{ bgcolor: 'grey.50', borderRadius: 1.5, p: 1.2 }}>
                    <Typography variant="caption" color="text.secondary" display="block">{item.label}</Typography>
                    <Typography variant="body2" fontWeight={500} fontSize={12}>{item.value}</Typography>
                  </Box>
                ))}
              </Box>
              <Divider />
              {/* Auto-sync toggle */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" fontWeight={500}>Auto-sync</Typography>
                  <Typography variant="caption" color="text.secondary">Automatically push qty changes to TikTok</Typography>
                </Box>
                <Switch
                  checked={settingsRow.syncEnabled}
                  onChange={async () => {
                    await toggleSync(settingsRow);
                    setSettingsRow(null);
                  }}
                  disabled={settingsRow.isGenericAuction}
                />
              </Box>
              {settingsRow.isGenericAuction && (
                <Alert severity="info" sx={{ py: 0.5, fontSize: 12 }}>Generic Auction SKUs are excluded from auto-sync.</Alert>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add SKU Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Enroll SKU in Listing Management</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {addError && <Alert severity="error">{addError}</Alert>}
          <TextField
            label="SKU" size="small" value={addSku}
            onChange={e => setAddSku(e.target.value)} autoFocus
            onKeyDown={e => e.key === 'Enter' && handleAddSku()}
          />
          <TextField
            label="Notes (optional)" size="small" value={addNotes}
            onChange={e => setAddNotes(e.target.value)} multiline rows={2}
          />
          <FormControlLabel
            control={<Switch checked={addGeneric} onChange={e => setAddGeneric(e.target.checked)} />}
            label="Generic Auction SKU (exclude from auto-deduction)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddSku} disabled={addLoading || !addSku.trim()}>
            {addLoading ? <CircularProgress size={18} /> : 'Enroll'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Map to TikTok Listing Dialog */}
      <Dialog open={mapOpen} onClose={() => setMapOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Link {mapRow?.sku} to TikTok Listing</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {mapError && <Alert severity="error" sx={{ mb: 2 }}>{mapError}</Alert>}
          {shops.length === 0 ? (
            <Alert severity="warning">
              No connected TikTok shop. Click "Connect TikTok Shop" first.
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', gap: 2, minHeight: 420 }}>
              {/* Left: search + listing list */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {shops.length > 1 && (
                  <FormControl size="small" fullWidth>
                    <InputLabel>Shop</InputLabel>
                    <Select value={selectedShopId} label="Shop"
                      onChange={e => { setSelectedShopId(e.target.value); fetchTikTokProducts(e.target.value, searchInput || undefined); }}>
                      {shops.map(s => (
                        <MenuItem key={s.shopId} value={s.shopId}>{s.shopName || s.shopId}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <TextField
                  size="small" fullWidth
                  label="Search TikTok listings"
                  value={searchInput}
                  onChange={e => { setSearchInput(e.target.value); setSelectedProductId(''); setProductDetail(null); }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                  }}
                  helperText={tiktokLoading ? 'Loading all listings…' : `${tiktokProducts.length} listings loaded — type to filter`}
                />

                {tiktokLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress size={24} /></Box>
                ) : tiktokProducts.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    No results. Try a different search.
                  </Typography>
                ) : (
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, flex: 1, overflowY: 'auto', maxHeight: 320 }}>
                      {tiktokProducts.filter((p: any) => {
                        if (!searchInput.trim()) return true;
                        const q = searchInput.trim().toLowerCase();
                        const title = (p.title || p.name || '').toLowerCase();
                        const id = (p.id || '').toLowerCase();
                        const skuMatch = (p.skus || p.sku_list || []).some((s: any) => (s.seller_sku || '').toLowerCase().includes(q));
                        return title.includes(q) || id.includes(q) || skuMatch;
                      }).map((p: any) => (
                        <Box
                          key={p.id}
                          onClick={() => { setSelectedProductId(p.id); fetchProductDetail(p.id); }}
                          sx={{
                            px: 1.5, py: 1.2, cursor: 'pointer', borderBottom: '1px solid', borderColor: 'divider',
                            bgcolor: selectedProductId === p.id ? 'primary.50' : 'transparent',
                            '&:hover': { bgcolor: selectedProductId === p.id ? 'primary.50' : 'action.hover' },
                            '&:last-child': { borderBottom: 'none' },
                          }}
                        >
                          <Typography variant="body2" fontWeight={selectedProductId === p.id ? 600 : 400}>
                            {p.title || p.name || p.id}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">{p.id}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>

              {/* Right: SKU + warehouse selection */}
              <Box sx={{ width: 260, display: 'flex', flexDirection: 'column', gap: 1.5, borderLeft: '1px solid', borderColor: 'divider', pl: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Selected Listing
                </Typography>
                {!productDetail ? (
                  <Typography variant="body2" color="text.disabled" sx={{ pt: 1 }}>
                    Click a listing on the left to select it
                  </Typography>
                ) : (() => {
                  const skus = productDetail.skus || productDetail.sku_list || [];
                  const selectedSku = skus.find((s: any) => s.id === selectedSkuId);
                  const warehouses = selectedSku?.inventory || selectedSku?.stock_infos || [];
                  return (
                    <>
                      <Typography variant="body2" fontWeight={600}>
                        {productDetail.title || productDetail.name || selectedProductId}
                      </Typography>
                      <FormControl size="small" fullWidth>
                        <InputLabel>SKU / Variation</InputLabel>
                        <Select value={selectedSkuId} label="SKU / Variation"
                          onChange={e => {
                            setSelectedSkuId(e.target.value as string);
                            const sku = skus.find((s: any) => s.id === e.target.value);
                            const wh = sku?.inventory || sku?.stock_infos || [];
                            if (wh.length === 1) setSelectedWarehouseId(wh[0].warehouse_id);
                            else setSelectedWarehouseId('');
                          }}>
                          {skus.map((s: any) => (
                            <MenuItem key={s.id} value={s.id}>
                              {s.seller_sku || s.id}
                              {s.sales_attributes?.map((a: any) => ` · ${a.value_name}`).join('') || ''}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {warehouses.length > 1 && (
                        <FormControl size="small" fullWidth>
                          <InputLabel>Warehouse</InputLabel>
                          <Select value={selectedWarehouseId} label="Warehouse"
                            onChange={e => setSelectedWarehouseId(e.target.value as string)}>
                            {warehouses.map((w: any) => (
                              <MenuItem key={w.warehouse_id} value={w.warehouse_id}>
                                {w.warehouse_name || w.warehouse_id} (qty: {w.quantity ?? w.available_stock ?? '?'})
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    </>
                  );
                })()}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMapOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleMapConfirm}
            disabled={mapLoading || !selectedSkuId || shops.length === 0}>
            {mapLoading ? <CircularProgress size={18} /> : 'Link Listing'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

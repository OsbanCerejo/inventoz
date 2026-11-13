import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, IconButton, Paper,
  Switch, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography, Alert, Divider,
  Select, MenuItem, FormControl, InputLabel, InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Link as LinkIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Search as SearchIcon,
  OpenInNew as OpenInNewIcon,
  Sync as SyncIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import { getServerUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';

const API = () => getServerUrl();

interface ManagedSkuRow {
  id: number;
  sku: string;
  itemName: string;
  brand: string;
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

function SyncStatusChip({ status }: { status: string | null }) {
  if (!status) return <Chip label="Never synced" size="small" variant="outlined" />;
  if (status === 'ok') return <Chip label="Synced" size="small" color="success" icon={<CheckIcon />} />;
  if (status === 'failed') return <Chip label="Failed" size="small" color="error" icon={<ErrorIcon />} />;
  if (status === 'pending') return <Chip label="Pending" size="small" color="warning" icon={<SyncIcon />} />;
  return <Chip label={status} size="small" />;
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

  // Add SKU dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addSku, setAddSku] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addGeneric, setAddGeneric] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // Map to TikTok dialog
  const [mapOpen, setMapOpen] = useState(false);
  const [mapRow, setMapRow] = useState<ManagedSkuRow | null>(null);
  const [tiktokProducts, setTiktokProducts] = useState<any[]>([]);
  const [tiktokLoading, setTiktokLoading] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedSkuId, setSelectedSkuId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState('');
  const [productDetail, setProductDetail] = useState<any>(null);

  // Push qty dialog
  const [pushQtyOpen, setPushQtyOpen] = useState(false);
  const [pushQtyRow, setPushQtyRow] = useState<ManagedSkuRow | null>(null);
  const [pushQtyValue, setPushQtyValue] = useState('');
  const [pushQtyReason, setPushQtyReason] = useState('');
  const [pushQtyLoading, setPushQtyLoading] = useState(false);

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
    setMapRow(row);
    setMapError('');
    setSelectedProductId('');
    setSelectedSkuId('');
    setSelectedWarehouseId('');
    setProductDetail(null);
    setTiktokProducts([]);
    if (shops.length > 0) {
      const shopId = shops[0].shopId;
      setSelectedShopId(shopId);
      await fetchTikTokProducts(shopId);
    }
    setMapOpen(true);
  };

  const fetchTikTokProducts = async (shopId: string) => {
    setTiktokLoading(true);
    try {
      const res = await axios.get(`${API()}/listing-management/tiktok/products`, {
        headers, params: { shopId },
      });
      setTiktokProducts(res.data?.products || res.data?.list || []);
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

  const openPushQty = (row: ManagedSkuRow) => {
    setPushQtyRow(row);
    setPushQtyValue(String(row.mapping?.currentQty ?? ''));
    setPushQtyReason('');
    setPushQtyOpen(true);
  };

  const handlePushQty = async () => {
    if (!pushQtyRow?.mapping) return;
    setPushQtyLoading(true);
    try {
      await axios.post(`${API()}/listing-management/mappings/${pushQtyRow.mapping.id}/push-qty`, {
        qty: Number(pushQtyValue), reason: pushQtyReason,
      }, { headers });
      setPushQtyOpen(false);
      load();
    } catch (e: any) {
      alert('Failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setPushQtyLoading(false);
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

  const filtered = rows.filter(r => {
    if (filterAlert && !r.stockAlert) return false;
    if (filterFailed && r.mapping?.lastSyncStatus !== 'failed') return false;
    if (search) {
      const q = search.toLowerCase();
      return r.sku.toLowerCase().includes(q) || (r.itemName || '').toLowerCase().includes(q);
    }
    return true;
  });

  const failedCount = rows.filter(r => r.mapping?.lastSyncStatus === 'failed').length;
  const alertCount = rows.filter(r => r.stockAlert).length;

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>TikTok Listing Management</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage inventory sync between Inventoz and TikTok Shop listings
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>
          {failedCount > 0 && (
            <Button variant="outlined" color="error" startIcon={<SyncIcon />} onClick={retryFailedJobs}>
              Retry {failedCount} Failed
            </Button>
          )}
          <Button variant="outlined" startIcon={<OpenInNewIcon />} onClick={connectTikTok}>
            {shops.length > 0 ? `Connected: ${shops.map(s => s.shopName).join(', ')}` : 'Connect TikTok Shop'}
          </Button>
          {shops.length > 0 && (
            <Button variant="outlined" size="small" onClick={refreshCipher} title="Re-sync shop cipher from TikTok">
              Refresh Cipher
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
            Add SKU
          </Button>
        </Box>
      </Box>

      {/* Summary chips */}
      {(alertCount > 0 || failedCount > 0) && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          {alertCount > 0 && (
            <Chip
              label={`${alertCount} stock protection alert${alertCount > 1 ? 's' : ''}`}
              color="warning" icon={<WarningIcon />} clickable
              onClick={() => setFilterAlert(v => !v)}
              variant={filterAlert ? 'filled' : 'outlined'}
            />
          )}
          {failedCount > 0 && (
            <Chip
              label={`${failedCount} sync failed`}
              color="error" icon={<ErrorIcon />} clickable
              onClick={() => setFilterFailed(v => !v)}
              variant={filterFailed ? 'filled' : 'outlined'}
            />
          )}
        </Box>
      )}

      {/* Search */}
      <TextField
        size="small" placeholder="Search by SKU or product name…"
        value={search} onChange={e => setSearch(e.target.value)}
        sx={{ mb: 2, width: 320 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {rows.length === 0
              ? 'No SKUs enrolled yet. Click "Add SKU" to get started.'
              : 'No results match your filters.'}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'grey.50' } }}>
                <TableCell>SKU</TableCell>
                <TableCell>Product</TableCell>
                <TableCell align="center">Inventoz Stock</TableCell>
                <TableCell align="center">Pending</TableCell>
                <TableCell align="center">Effective Avail.</TableCell>
                <TableCell align="center">TikTok Qty</TableCell>
                <TableCell align="center">TikTok Price</TableCell>
                <TableCell align="center">Listing Status</TableCell>
                <TableCell align="center">Sync Status</TableCell>
                <TableCell align="center">Auto-Sync</TableCell>
                <TableCell align="center">Last Sync</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(row => (
                <TableRow key={row.id} hover sx={{ opacity: row.isGenericAuction ? 0.6 : 1 }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} fontFamily="monospace">
                      {row.sku}
                    </Typography>
                    {row.isGenericAuction && (
                      <Chip label="Generic Auction" size="small" variant="outlined" sx={{ mt: 0.3 }} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>{row.itemName}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.brand}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight={600}>{row.inventozQty}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    {row.pendingSales > 0
                      ? <Chip label={`-${row.pendingSales}`} size="small" color="warning" />
                      : <Typography variant="body2" color="text.secondary">0</Typography>}
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="body2" fontWeight={600}
                        color={row.effectiveAvailable < 0 ? 'error.main' : 'inherit'}>
                        {row.effectiveAvailable}
                      </Typography>
                      <StockAlertBadge alert={row.stockAlert} />
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    {row.mapping
                      ? <Typography variant="body2">{row.mapping.currentQty}</Typography>
                      : <Typography variant="body2" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell align="center">
                    {row.mapping?.currentPrice
                      ? <Typography variant="body2">${Number(row.mapping.currentPrice).toFixed(2)}</Typography>
                      : <Typography variant="body2" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell align="center">
                    {row.mapping
                      ? <Chip label={row.mapping.listingStatus} size="small"
                          color={row.mapping.listingStatus === 'active' ? 'success' : 'default'} />
                      : <Typography variant="body2" color="text.disabled">Not linked</Typography>}
                  </TableCell>
                  <TableCell align="center">
                    <SyncStatusChip status={row.mapping?.lastSyncStatus ?? null} />
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      size="small"
                      checked={row.syncEnabled}
                      onChange={() => toggleSync(row)}
                      disabled={row.isGenericAuction}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="caption" color="text.secondary">
                      {row.mapping?.lastSyncAt
                        ? new Date(row.mapping.lastSyncAt).toLocaleString()
                        : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                      {!row.mapping && (
                        <Tooltip title="Link to TikTok listing">
                          <IconButton size="small" onClick={() => openMapDialog(row)} color="primary">
                            <LinkIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {row.mapping && (
                        <Tooltip title="Push quantity to TikTok">
                          <IconButton size="small" onClick={() => openPushQty(row)} color="primary">
                            <SyncIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Remove from Listing Management">
                        <IconButton size="small" onClick={() => handleRemoveSku(row.id, row.sku)} color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

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
      <Dialog open={mapOpen} onClose={() => setMapOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link {mapRow?.sku} to TikTok Listing</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {mapError && <Alert severity="error">{mapError}</Alert>}
          {shops.length === 0 ? (
            <Alert severity="warning">
              No connected TikTok shop. Click "Connect TikTok Shop" first.
            </Alert>
          ) : (
            <>
              <FormControl size="small" fullWidth>
                <InputLabel>Shop</InputLabel>
                <Select value={selectedShopId} label="Shop"
                  onChange={e => { setSelectedShopId(e.target.value); fetchTikTokProducts(e.target.value); }}>
                  {shops.map(s => (
                    <MenuItem key={s.shopId} value={s.shopId}>{s.shopName || s.shopId}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {tiktokLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>
              ) : (
                <FormControl size="small" fullWidth>
                  <InputLabel>TikTok Product</InputLabel>
                  <Select value={selectedProductId} label="TikTok Product"
                    onChange={e => { setSelectedProductId(e.target.value as string); fetchProductDetail(e.target.value as string); }}>
                    {tiktokProducts.map((p: any) => (
                      <MenuItem key={p.id} value={p.id}>{p.title || p.name || p.id}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {productDetail && (() => {
                const skus = productDetail.skus || productDetail.sku_list || [];
                return (
                  <FormControl size="small" fullWidth>
                    <InputLabel>TikTok SKU / Variation</InputLabel>
                    <Select value={selectedSkuId} label="TikTok SKU / Variation"
                      onChange={e => {
                        setSelectedSkuId(e.target.value as string);
                        const sku = skus.find((s: any) => s.id === e.target.value);
                        const warehouses = sku?.inventory || sku?.stock_infos || [];
                        if (warehouses.length === 1) setSelectedWarehouseId(warehouses[0].warehouse_id);
                      }}>
                      {skus.map((s: any) => (
                        <MenuItem key={s.id} value={s.id}>
                          {s.seller_sku || s.id}
                          {s.sales_attributes?.map((a: any) => ` · ${a.value_name}`).join('') || ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                );
              })()}

              {selectedSkuId && productDetail && (() => {
                const skus = productDetail.skus || productDetail.sku_list || [];
                const sku = skus.find((s: any) => s.id === selectedSkuId);
                const warehouses = sku?.inventory || sku?.stock_infos || [];
                if (warehouses.length <= 1) return null;
                return (
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
                );
              })()}
            </>
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

      {/* Push Qty Dialog */}
      <Dialog open={pushQtyOpen} onClose={() => setPushQtyOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Push Quantity to TikTok</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            SKU: <strong>{pushQtyRow?.sku}</strong> · Effective available: <strong>{pushQtyRow?.effectiveAvailable}</strong>
          </Typography>
          <Divider />
          <TextField
            label="New TikTok Quantity" type="number" size="small"
            value={pushQtyValue} onChange={e => setPushQtyValue(e.target.value)} autoFocus
          />
          <TextField
            label="Reason (optional)" size="small"
            value={pushQtyReason} onChange={e => setPushQtyReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPushQtyOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handlePushQty}
            disabled={pushQtyLoading || pushQtyValue === ''}>
            {pushQtyLoading ? <CircularProgress size={18} /> : 'Push to TikTok'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

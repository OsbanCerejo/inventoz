import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  Box, Typography, Paper, TextField, Button, CircularProgress,
  Chip, Pagination, Switch, FormControlLabel, Alert,
} from '@mui/material';
import { CheckCircle as CheckCircleIcon, Image as ImageIcon } from '@mui/icons-material';
import { getApiUrl } from '../config/api';

const FIELD_LABELS: Record<string, string> = {
  image:          'Image URL',
  brand:          'Brand',
  itemName:       'Item Name',
  alternativeSku: 'Alternative SKU',
  upc:            'UPC Code',
  location:       'Location',
  sizeOz:         'Size (oz)',
  sizeMl:         'Size (ml)',
  strength:       'Strength',
  shade:          'Shade',
  category:       'Category',
  type:           'Type',
  formulation:    'Formulation',
  batch:          'Batch',
  verified:       'Verified',
  listed:         'Listed',
};

const BOOLEAN_FIELDS = new Set(['verified', 'listed']);
const PAGE_SIZE = 20;

type Product = Record<string, any>;

type RowState = {
  values: Record<string, any>;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
};

export default function DataEntry() {
  const [enabledFields, setEnabledFields] = useState<string[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [productsLoading, setProductsLoading] = useState(false);

  const [rows, setRows] = useState<Record<string, RowState>>({});

  // Load config once
  useEffect(() => {
    axios.get(getApiUrl('products/data-entry/config'))
      .then(res => {
        setEnabledFields(res.data.enabledFields || []);
        if ((res.data.enabledFields || []).length === 0) {
          setConfigError('No fields have been configured for data entry. An admin must set this up in Settings.');
        }
      })
      .catch(() => setConfigError('Failed to load configuration.'))
      .finally(() => setConfigLoading(false));
  }, []);

  // Load products page
  const loadProducts = useCallback(async (pageNum: number) => {
    setProductsLoading(true);
    try {
      const res = await axios.get(getApiUrl('products/list'), {
        params: { page: pageNum, pageSize: PAGE_SIZE, sortKey: 'sku', sortDirection: 'asc' },
      });
      const fetched: Product[] = res.data?.rows || [];
      setProducts(fetched);
      setTotal(res.data?.total || 0);

      // Initialise row state from fetched data
      const initial: Record<string, RowState> = {};
      fetched.forEach(p => {
        const values: Record<string, any> = {};
        enabledFields.forEach(f => { values[f] = p[f] ?? ''; });
        initial[p.sku] = { values, dirty: false, saving: false, saved: false };
      });
      setRows(initial);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setProductsLoading(false);
    }
  }, [enabledFields]);

  useEffect(() => {
    if (enabledFields.length > 0) {
      loadProducts(page);
    }
  }, [page, enabledFields]);

  const handleChange = (sku: string, field: string, value: any) => {
    setRows(prev => ({
      ...prev,
      [sku]: { ...prev[sku], values: { ...prev[sku].values, [field]: value }, dirty: true, saved: false },
    }));
  };

  const handleSave = async (sku: string) => {
    setRows(prev => ({ ...prev, [sku]: { ...prev[sku], saving: true } }));
    try {
      await axios.put(getApiUrl('products/data-entry'), { sku, ...rows[sku].values });
      setRows(prev => ({ ...prev, [sku]: { ...prev[sku], saving: false, dirty: false, saved: true } }));
    } catch {
      toast.error(`Failed to save ${sku}`);
      setRows(prev => ({ ...prev, [sku]: { ...prev[sku], saving: false } }));
    }
  };

  const pageCount = Math.ceil(total / PAGE_SIZE);

  if (configLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (configError) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 6, px: 2 }}>
        <Alert severity="warning">{configError}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', mt: 4, px: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.25 }}>
            Data Entry
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#64748b' }}>
            {total} products &nbsp;·&nbsp; editing:&nbsp;
            {enabledFields.map(f => (
              <Chip key={f} label={FIELD_LABELS[f] ?? f} size="small" sx={{ mr: 0.5, fontSize: 11, height: 20 }} />
            ))}
          </Typography>
        </Box>
      </Box>

      {productsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {products.map(product => {
              const row = rows[product.sku];
              if (!row) return null;

              return (
                <Paper
                  key={product.sku}
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: row.saved ? '1px solid #86efac' : row.dirty ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                    transition: 'border-color 0.2s',
                  }}
                >
                  {/* Row header */}
                  <Box sx={{ px: 2.5, py: 1.5, background: row.saved ? '#f0fdf4' : row.dirty ? '#f0f9ff' : '#f8fafc', display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid #e2e8f0' }}>
                    {/* Image preview */}
                    <Box sx={{ width: 44, height: 44, borderRadius: 1, background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {product.image ? (
                        <img src={product.image} alt="" style={{ maxWidth: 44, maxHeight: 44, objectFit: 'contain' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <ImageIcon sx={{ color: '#cbd5e1', fontSize: 20 }} />
                      )}
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontFamily: 'Consolas, monospace', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                        {product.sku}
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {product.brand} {product.itemName}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                      {row.saved && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#16a34a' }}>
                          <CheckCircleIcon sx={{ fontSize: 16 }} />
                          <Typography sx={{ fontSize: 12, fontWeight: 600 }}>Saved</Typography>
                        </Box>
                      )}
                      <Button
                        variant="contained"
                        size="small"
                        disabled={!row.dirty || row.saving}
                        onClick={() => handleSave(product.sku)}
                        sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1, fontSize: 13, minWidth: 70, px: 2 }}
                      >
                        {row.saving ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : 'Save'}
                      </Button>
                    </Box>
                  </Box>

                  {/* Fields */}
                  <Box sx={{ px: 2.5, py: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {enabledFields.map(field => {
                      if (BOOLEAN_FIELDS.has(field)) {
                        return (
                          <Box key={field} sx={{ display: 'flex', alignItems: 'center', minWidth: 140 }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  size="small"
                                  checked={Boolean(row.values[field])}
                                  onChange={e => handleChange(product.sku, field, e.target.checked)}
                                />
                              }
                              label={<Typography sx={{ fontSize: 13 }}>{FIELD_LABELS[field]}</Typography>}
                            />
                          </Box>
                        );
                      }

                      const isImageField = field === 'image';
                      const isWide = field === 'image' || field === 'itemName' || field === 'alternativeSku';

                      return (
                        <Box key={field} sx={{ flex: isWide ? '1 1 340px' : '1 1 160px', minWidth: isWide ? 260 : 140 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label={FIELD_LABELS[field] ?? field}
                            value={row.values[field] ?? ''}
                            onChange={e => handleChange(product.sku, field, e.target.value)}
                            InputProps={isImageField && row.values.image ? {
                              endAdornment: (
                                <Box sx={{ width: 28, height: 28, flexShrink: 0, ml: 0.5 }}>
                                  <img
                                    src={row.values.image}
                                    alt=""
                                    style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4 }}
                                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                  />
                                </Box>
                              ),
                            } : undefined}
                            sx={{ '& .MuiInputBase-input': { fontSize: 13 }, '& .MuiInputLabel-root': { fontSize: 13 } }}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                </Paper>
              );
            })}
          </Box>

          {pageCount > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
              <Pagination
                count={pageCount}
                page={page}
                onChange={(_, v) => setPage(v)}
                color="primary"
                shape="rounded"
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

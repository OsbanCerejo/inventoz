import { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  Box, Typography, Paper, TextField, Button, CircularProgress,
  Divider, Alert, Chip,
} from '@mui/material';
import { MergeType as MergeIcon, CheckCircle as CheckCircleIcon, Warning as WarningIcon } from '@mui/icons-material';
import { getApiUrl } from '../config/api';

type Product = { sku: string; brand: string; itemName: string; category: string; image?: string };
type Counts = Record<string, number>;

type PreviewData = {
  sourceProduct: Product;
  targetProduct: Product;
  counts: Counts;
  total: number;
};

type ResultData = {
  source: string;
  target: string;
  moved: Counts;
  total: number;
};

function ProductCard({ product, label, color }: { product: Product; label: string; color: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: color, flex: 1 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color, mb: 1 }}>
        {label}
      </Typography>
      <Box display="flex" gap={1.5} alignItems="center">
        {product.image && (
          <Box sx={{ width: 48, height: 48, flexShrink: 0, border: '1px solid #e2e8f0', borderRadius: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={product.image} alt="" style={{ maxWidth: 48, maxHeight: 48, objectFit: 'contain' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </Box>
        )}
        <Box>
          <Typography sx={{ fontFamily: 'Consolas, monospace', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{product.sku}</Typography>
          <Typography sx={{ fontSize: 13, color: '#374151' }}>{product.brand} — {product.itemName}</Typography>
          <Typography sx={{ fontSize: 12, color: '#64748b' }}>{product.category}</Typography>
        </Box>
      </Box>
    </Paper>
  );
}

export default function SkuMerge() {
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);

  const handlePreview = async () => {
    if (!source.trim() || !target.trim()) { toast.error('Enter both SKUs'); return; }
    if (source.trim() === target.trim()) { toast.error('Source and target must be different'); return; }
    setPreviewing(true);
    setPreview(null);
    setResult(null);
    try {
      const { data } = await axios.get(getApiUrl('sku-merge/preview'), {
        params: { source: source.trim(), target: target.trim() },
      });
      setPreview(data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const handleMerge = async () => {
    if (!preview) return;
    setMerging(true);
    try {
      const { data } = await axios.post(getApiUrl('sku-merge'), {
        source: source.trim(),
        target: target.trim(),
      });
      setResult(data);
      setPreview(null);
      toast.success('Merge completed successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Merge failed — no changes were made');
    } finally {
      setMerging(false);
    }
  };

  const reset = () => {
    setSource(''); setTarget(''); setPreview(null); setResult(null);
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, px: 2, pb: 6 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={1.5} mb={0.5}>
        <MergeIcon sx={{ color: '#7c3aed', fontSize: 28 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>SKU Merge</Typography>
      </Box>
      <Typography sx={{ fontSize: 14, color: '#64748b', mb: 3 }}>
        Move all historical data from a wrong SKU onto the correct one. The source SKU is not deleted — you confirm and delete it manually after verifying.
      </Typography>

      {/* Input */}
      {!result && (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
          <Box sx={{ px: 3, py: 2, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Step 1 — Enter SKUs</Typography>
          </Box>
          <Box sx={{ px: 3, py: 2.5, display: 'flex', gap: 2, alignItems: 'flex-end' }}>
            <Box flex={1}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#ef4444', mb: 0.5 }}>Source SKU (wrong)</Typography>
              <TextField
                fullWidth size="small" placeholder="e.g. LAT-FR-SE-00085"
                value={source} onChange={e => { setSource(e.target.value); setPreview(null); }}
                sx={{ '& .MuiInputBase-input': { fontFamily: 'Consolas, monospace', fontSize: 13 } }}
              />
            </Box>
            <Box flex={1}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#16a34a', mb: 0.5 }}>Target SKU (correct)</Typography>
              <TextField
                fullWidth size="small" placeholder="e.g. LAT-FR-EDP-00085"
                value={target} onChange={e => { setTarget(e.target.value); setPreview(null); }}
                sx={{ '& .MuiInputBase-input': { fontFamily: 'Consolas, monospace', fontSize: 13 } }}
              />
            </Box>
            <Button
              variant="contained" onClick={handlePreview} disabled={previewing}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, px: 3, whiteSpace: 'nowrap', height: 40 }}
            >
              {previewing ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Preview'}
            </Button>
          </Box>
        </Paper>
      )}

      {/* Preview */}
      {preview && (
        <Box>
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 2 }}>
            <Box sx={{ px: 3, py: 2, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Step 2 — Confirm Products</Typography>
            </Box>
            <Box sx={{ px: 3, py: 2.5, display: 'flex', gap: 2 }}>
              <ProductCard product={preview.sourceProduct} label="Source — will be emptied" color="#ef4444" />
              <Box display="flex" alignItems="center" sx={{ color: '#94a3b8', fontSize: 22 }}>→</Box>
              <ProductCard product={preview.targetProduct} label="Target — receives all data" color="#16a34a" />
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 2 }}>
            <Box sx={{ px: 3, py: 2, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Step 3 — Records to Move</Typography>
              <Chip label={`${preview.total} total records`} size="small" sx={{ background: preview.total > 0 ? '#dbeafe' : '#f1f5f9', color: preview.total > 0 ? '#1d4ed8' : '#64748b', fontWeight: 600 }} />
            </Box>
            <Box sx={{ px: 3, py: 2 }}>
              {preview.total === 0 ? (
                <Typography sx={{ fontSize: 13, color: '#94a3b8' }}>No records found for the source SKU.</Typography>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
                  {Object.entries(preview.counts).filter(([, count]) => count > 0).map(([table, count]) => (
                    <Box key={table} display="flex" justifyContent="space-between" alignItems="center"
                      sx={{ px: 1.5, py: 0.75, borderRadius: 1, background: '#f8fafc' }}>
                      <Typography sx={{ fontSize: 13, color: '#374151' }}>{table}</Typography>
                      <Chip label={count} size="small" sx={{ background: '#dbeafe', color: '#1d4ed8', fontWeight: 700, fontSize: 12, height: 20 }} />
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Paper>

          <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
            This operation cannot be undone. All records from <strong>{preview.sourceProduct.sku}</strong> will be reassigned to <strong>{preview.targetProduct.sku}</strong>. The source SKU product record will remain — you delete it manually after verifying.
          </Alert>

          <Box display="flex" gap={1.5}>
            <Button variant="outlined" onClick={() => setPreview(null)} disabled={merging}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}>
              Back
            </Button>
            <Button variant="contained" color="error" onClick={handleMerge} disabled={merging}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, px: 4 }}>
              {merging ? <><CircularProgress size={14} sx={{ color: '#fff', mr: 1 }} />Merging...</> : `Confirm & Merge`}
            </Button>
          </Box>
        </Box>
      )}

      {/* Result */}
      {result && (
        <Box>
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', borderColor: '#86efac', mb: 2 }}>
            <Box sx={{ px: 3, py: 2, background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 20 }} />
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#15803d' }}>Merge Complete</Typography>
            </Box>
            <Box sx={{ px: 3, py: 2.5 }}>
              <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                <Chip label={`Source: ${result.source}`} size="small" sx={{ fontFamily: 'Consolas, monospace', background: '#fee2e2', color: '#b91c1c', fontWeight: 600 }} />
                <Typography sx={{ fontSize: 13, color: '#94a3b8', alignSelf: 'center' }}>→</Typography>
                <Chip label={`Target: ${result.target}`} size="small" sx={{ fontFamily: 'Consolas, monospace', background: '#dcfce7', color: '#15803d', fontWeight: 600 }} />
                <Chip label={`${result.total} records moved`} size="small" sx={{ background: '#dbeafe', color: '#1d4ed8', fontWeight: 600, ml: 'auto' }} />
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
                {Object.entries(result.moved).filter(([, count]) => count > 0).map(([table, count]) => (
                  <Box key={table} display="flex" justifyContent="space-between" alignItems="center"
                    sx={{ px: 1.5, py: 0.75, borderRadius: 1, background: '#f0fdf4' }}>
                    <Typography sx={{ fontSize: 13, color: '#374151' }}>{table}</Typography>
                    <Chip label={count} size="small" sx={{ background: '#bbf7d0', color: '#15803d', fontWeight: 700, fontSize: 12, height: 20 }} />
                  </Box>
                ))}
              </Box>
            </Box>
          </Paper>

          <Alert severity="info" sx={{ mb: 2 }}>
            The source SKU <strong>{result.source}</strong> still exists as a product record. Go to its product page and delete it once you have verified the data has moved correctly.
          </Alert>

          <Button variant="outlined" onClick={reset} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}>
            Merge Another SKU
          </Button>
        </Box>
      )}
    </Box>
  );
}

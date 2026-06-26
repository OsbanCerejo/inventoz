import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  Box, Typography, Paper, Switch,
  Button, CircularProgress, Divider, Chip,
} from '@mui/material';
import { getApiUrl } from '../config/api';

const FIELD_LABELS: Record<string, string> = {
  image:        'Image URL',
  brand:        'Brand',
  itemName:     'Item Name',
  alternativeSku: 'Alternative SKU',
  upc:          'UPC Code',
  location:     'Location',
  sizeOz:       'Size (oz)',
  sizeMl:       'Size (ml)',
  strength:     'Strength',
  shade:        'Shade',
  category:     'Category',
  type:         'Type',
  formulation:  'Formulation',
  batch:        'Batch',
  verified:     'Verified',
  listed:       'Listed',
  fragranceNotes: 'Fragrance Notes',
};

export default function Settings() {
  const [eligibleFields, setEligibleFields] = useState<string[]>([]);
  const [enabledFields, setEnabledFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(getApiUrl('products/data-entry/config'))
      .then(res => {
        setEligibleFields(res.data.eligibleFields);
        setEnabledFields(res.data.enabledFields);
      })
      .catch(() => toast.error('Failed to load data entry config'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (field: string) => {
    setEnabledFields(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(getApiUrl('products/data-entry/config'), { enabledFields });
      toast.success('Data entry fields saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', mt: 4, px: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: '#0f172a' }}>
        Settings
      </Typography>
      <Typography sx={{ color: '#64748b', mb: 3, fontSize: 14 }}>
        Manage system-wide configuration.
      </Typography>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {/* Header */}
        <Box sx={{ px: 3, py: 2, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
              Data Entry Fields
            </Typography>
            <Typography sx={{ fontSize: 13, color: '#64748b', mt: 0.25 }}>
              Choose which product fields are visible on the Data Entry page.
            </Typography>
          </Box>
          <Chip
            label={`${enabledFields.length} enabled`}
            size="small"
            sx={{ background: enabledFields.length > 0 ? '#dbeafe' : '#f1f5f9', color: enabledFields.length > 0 ? '#1d4ed8' : '#64748b', fontWeight: 600, fontSize: 12 }}
          />
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Box sx={{ px: 3, py: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              {eligibleFields.map((field, i) => (
                <Box
                  key={field}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: 1.25,
                    px: 1.5,
                    borderRadius: 1,
                    background: enabledFields.includes(field) ? '#f0f9ff' : 'transparent',
                    border: enabledFields.includes(field) ? '1px solid #bae6fd' : '1px solid transparent',
                    mb: 0.5,
                    mr: i % 2 === 0 ? 1 : 0,
                    transition: 'all 0.15s',
                  }}
                >
                  <Typography sx={{ fontSize: 14, fontWeight: enabledFields.includes(field) ? 600 : 400, color: enabledFields.includes(field) ? '#0369a1' : '#374151' }}>
                    {FIELD_LABELS[field] ?? field}
                  </Typography>
                  <Switch
                    checked={enabledFields.includes(field)}
                    onChange={() => toggle(field)}
                    size="small"
                    color="primary"
                  />
                </Box>
              ))}
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={save}
                disabled={saving}
                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, px: 3 }}
              >
                {saving ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Save Changes
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

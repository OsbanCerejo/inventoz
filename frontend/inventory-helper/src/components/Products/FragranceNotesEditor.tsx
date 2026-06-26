import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Box, Typography, TextField, Chip, Paper, CircularProgress } from '@mui/material';
import { getApiUrl } from '../../config/api';

type Tier = 'top' | 'middle' | 'base';

interface NoteOption {
  id: number;
  name: string;
}

interface FragranceNotes {
  top: NoteOption[];
  middle: NoteOption[];
  base: NoteOption[];
}

interface Props {
  sku: string | null; // null = new product (AddProduct)
  onChange?: (notes: FragranceNotes) => void;
}

const TIER_CONFIG: { key: Tier; label: string; sub: string; color: string; bg: string; border: string }[] = [
  { key: 'top',    label: 'Top Notes',    sub: 'First impression',  color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  { key: 'middle', label: 'Middle Notes', sub: 'Heart',             color: '#065f46', bg: '#d1fae5', border: '#a7f3d0' },
  { key: 'base',   label: 'Base Notes',   sub: 'Lasting dry-down',  color: '#4c1d95', bg: '#ede9fe', border: '#ddd6fe' },
];

const TIER_DOT: Record<Tier, string> = { top: '#f59e0b', middle: '#10b981', base: '#6366f1' };

const FragranceNotesEditor: React.FC<Props> = ({ sku, onChange }) => {
  const [notes, setNotes] = useState<FragranceNotes>({ top: [], middle: [], base: [] });
  const [inputs, setInputs] = useState<Record<Tier, string>>({ top: '', middle: '', base: '' });
  const [suggestions, setSuggestions] = useState<Record<Tier, NoteOption[]>>({ top: [], middle: [], base: [] });
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<Record<Tier, ReturnType<typeof setTimeout>>>({} as any);

  // Load existing notes when editing a product
  useEffect(() => {
    if (!sku) return;
    setLoading(true);
    axios.get(getApiUrl(`fragrance-notes/product/${sku}`))
      .then(res => {
        setNotes(res.data);
        onChange?.(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sku]);

  const fetchSuggestions = (tier: Tier, q: string) => {
    clearTimeout(debounceRef.current[tier]);
    if (!q.trim()) { setSuggestions(s => ({ ...s, [tier]: [] })); return; }
    debounceRef.current[tier] = setTimeout(() => {
      axios.get(getApiUrl(`fragrance-notes?q=${encodeURIComponent(q)}`))
        .then(res => {
          const existing = notes[tier].map(n => n.name.toLowerCase());
          setSuggestions(s => ({
            ...s,
            [tier]: res.data.filter((n: NoteOption) => !existing.includes(n.name.toLowerCase())),
          }));
        })
        .catch(() => {});
    }, 200);
  };

  const addNote = (tier: Tier, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (notes[tier].some(n => n.name.toLowerCase() === trimmed.toLowerCase())) return;
    const updated = {
      ...notes,
      [tier]: [...notes[tier], { id: 0, name: trimmed }],
    };
    setNotes(updated);
    setInputs(i => ({ ...i, [tier]: '' }));
    setSuggestions(s => ({ ...s, [tier]: [] }));
    onChange?.(updated);
  };

  const removeNote = (tier: Tier, name: string) => {
    const updated = { ...notes, [tier]: notes[tier].filter(n => n.name !== name) };
    setNotes(updated);
    onChange?.(updated);
  };

  const handleKeyDown = (tier: Tier, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); addNote(tier, inputs[tier]); }
  };

  if (loading) return <Box py={2}><CircularProgress size={20} /></Box>;

  return (
    <Box>
      <Box display="flex" alignItems="baseline" gap={1} mb={1.5}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Fragrance Notes</Typography>
        <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>Top · Middle · Base</Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {TIER_CONFIG.map(({ key, label, sub, color, bg, border }) => (
          <Paper key={key} variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderColor: '#e2e8f0' }}>
            {/* Tier header */}
            <Box display="flex" alignItems="center" gap={1} mb={1.2}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: TIER_DOT[key], flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{label}</Typography>
              <Typography sx={{ fontSize: 11, color: '#94a3b8', ml: 'auto' }}>{sub}</Typography>
            </Box>

            {/* Chips */}
            <Box display="flex" flexWrap="wrap" gap={0.6} minHeight={32} mb={1}>
              {notes[key].map(n => (
                <Chip
                  key={n.name}
                  label={n.name}
                  size="small"
                  onDelete={() => removeNote(key, n.name)}
                  sx={{ background: bg, border: `1px solid ${border}`, color, fontSize: 11, height: 24,
                    '& .MuiChip-deleteIcon': { color, fontSize: 14, '&:hover': { color } } }}
                />
              ))}
            </Box>

            {/* Input */}
            <Box position="relative">
              <Box display="flex" gap={0.75}>
                <TextField
                  size="small"
                  placeholder={`Add ${label.toLowerCase()}...`}
                  value={inputs[key]}
                  onChange={e => { setInputs(i => ({ ...i, [key]: e.target.value })); fetchSuggestions(key, e.target.value); }}
                  onKeyDown={e => handleKeyDown(key, e)}
                  sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 12, py: '6px' } }}
                />
                <Box
                  component="button"
                  type="button"
                  onClick={() => addNote(key, inputs[key])}
                  sx={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 1, px: 1.5,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    '&:hover': { background: '#1d4ed8' } }}
                >
                  + Add
                </Box>
              </Box>

              {/* Autocomplete dropdown */}
              {suggestions[key].length > 0 && (
                <Paper elevation={4} sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  mt: 0.5, maxHeight: 160, overflowY: 'auto', borderRadius: 1 }}>
                  {suggestions[key].map(s => (
                    <Box
                      key={s.id}
                      onClick={() => addNote(key, s.name)}
                      sx={{ px: 1.5, py: 1, fontSize: 12, cursor: 'pointer', color: '#334155',
                        '&:hover': { background: '#f1f5f9' } }}
                    >
                      {s.name}
                    </Box>
                  ))}
                </Paper>
              )}
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  );
};

export default FragranceNotesEditor;

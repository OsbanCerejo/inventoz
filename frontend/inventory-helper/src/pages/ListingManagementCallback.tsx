import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { getServerUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';

export default function ListingManagementCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('No authorization code received from TikTok.');
      return;
    }

    axios.get(`${getServerUrl()}/listing-management/auth/tiktok/callback`, {
      params: { code },
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(() => navigate('/listing-management', { replace: true }))
      .catch(e => setError(e.response?.data?.error || e.message));
  }, []);

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">TikTok connection failed: {error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
      <CircularProgress />
      <Typography color="text.secondary">Connecting TikTok Shop…</Typography>
    </Box>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Fade,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

interface BarcodeScan {
  id: number;
  barcode: string;
  scannedAt: string;
  userId?: number;
  user?: {
    id: number;
    name: string | null;
    username: string;
  } | null;
}

interface FulfillmentCheckSource {
  source: string;
  found: boolean;
  shipmentIds: string[];
  matchedRows: number;
  closed: boolean;
  open: boolean;
  closedRows: number;
  openRows: number;
}

interface FulfillmentCheck {
  tracking: string;
  status: 'not_checked' | 'not_found' | 'open' | 'closed';
  alert: boolean;
  message: string;
  sources: FulfillmentCheckSource[];
}

interface SearchResult {
  success: boolean;
  barcode: string;
  count: number;
  scans: BarcodeScan[];
}

const BarcodeScan: React.FC = () => {
  const { hasPermission } = useAuth();
  const canScanBarcode = hasPermission('barcodeScan', 'create');
  const canSearchBarcode = hasPermission('barcodeScan', 'view');
  const [barcode, setBarcode] = useState('');
  const [searchBarcode, setSearchBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showScanSuccessCue, setShowScanSuccessCue] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [fulfillmentCheck, setFulfillmentCheck] = useState<FulfillmentCheck | null>(null);
  const [openFulfillmentAlert, setOpenFulfillmentAlert] = useState<FulfillmentCheck | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const successCueTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }

    return () => {
      if (successCueTimerRef.current) {
        window.clearTimeout(successCueTimerRef.current);
      }
    };
  }, []);

  const formatLocalTime = (dateString: string): string => {
    const date = new Date(dateString);
    // Format as local time
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canScanBarcode) {
      setError('You do not have permission to scan barcodes.');
      return;
    }
    setError('');
    setSuccess('');
    setFulfillmentCheck(null);
    setLoading(true);
    
    try {
      const response = await axios.post(getApiUrl('api/barcode-scan'), { 
        barcode: barcode.trim()
      });
      
      if (response.data.success) {
        const userInfo = response.data.scan.user 
          ? ` by ${response.data.scan.user.name || response.data.scan.user.username}`
          : '';
        setSuccess(`Barcode ${barcode.trim()} scanned successfully at ${formatLocalTime(response.data.scan.scannedAt)}${userInfo}`);
        const nextFulfillmentCheck = response.data.fulfillmentCheck || null;
        setFulfillmentCheck(nextFulfillmentCheck);
        if (nextFulfillmentCheck?.status === 'open' && nextFulfillmentCheck?.alert) {
          setOpenFulfillmentAlert(nextFulfillmentCheck);
        }
        setShowScanSuccessCue(true);
        if (successCueTimerRef.current) {
          window.clearTimeout(successCueTimerRef.current);
        }
        successCueTimerRef.current = window.setTimeout(() => {
          setShowScanSuccessCue(false);
        }, 2500);
        setBarcode('');
        // Auto-focus for next scan
        setTimeout(() => {
          if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
          }
        }, 100);
      }
    } catch (error: any) {
      const blockedFulfillmentCheck = error?.response?.data?.fulfillmentCheck || null;
      if (blockedFulfillmentCheck?.status === 'open' && blockedFulfillmentCheck?.alert) {
        setFulfillmentCheck(blockedFulfillmentCheck);
        setOpenFulfillmentAlert(blockedFulfillmentCheck);
      }
      setError(error.response?.data?.error || 'Error scanning barcode');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSearchBarcode) {
      setError('You do not have permission to search barcode scans.');
      return;
    }
    setError('');
    setSearchLoading(true);
    setSearchResult(null);
    
    try {
      const response = await axios.get(getApiUrl(`api/barcode-scan/search/${encodeURIComponent(searchBarcode.trim())}`));
      
      if (response.data.success) {
        setSearchResult(response.data);
        if (response.data.count === 0) {
          setError(`No scans found for barcode: ${searchBarcode.trim()}`);
        }
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Error searching barcode scans');
      setSearchResult(null);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <Box sx={{ mt: 4, px: 3, pb: 4 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Barcode Scanner
      </Typography>

      {!canScanBarcode && !canSearchBarcode && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          You currently do not have access to scan or search barcodes.
        </Alert>
      )}
      
      {/* Scanning Section */}
      {canScanBarcode && (
      <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
        <Typography variant="h5" gutterBottom>
          Scan Barcode
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Scan or enter a barcode to record it with a timestamp
        </Typography>
        <form onSubmit={handleBarcodeSubmit}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs>
              <TextField
                fullWidth
                inputRef={barcodeInputRef}
                label="Enter or Scan Barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                required
                autoFocus
                disabled={loading}
                placeholder="Scan barcode here..."
              />
            </Grid>
            <Grid item>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={loading || !barcode.trim()}
                sx={{ height: 56, minWidth: 120 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Scan'}
              </Button>
            </Grid>
          </Grid>
        </form>
        <Fade in={showScanSuccessCue} timeout={{ enter: 120, exit: 700 }}>
          <Box
            sx={{
              mt: 2,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 96,
            }}
          >
            <CheckCircleRoundedIcon
              sx={{
                fontSize: 92,
                color: "#2e7d32",
                filter: "drop-shadow(0 6px 10px rgba(46,125,50,0.25))",
              }}
            />
          </Box>
        </Fade>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}
        {fulfillmentCheck && (
          <Alert
            severity={fulfillmentCheck.alert ? "warning" : fulfillmentCheck.status === "closed" ? "success" : "info"}
            sx={{ mt: 2 }}
            onClose={() => setFulfillmentCheck(null)}
          >
            {fulfillmentCheck.message}
          </Alert>
        )}
      </Paper>
      )}

      <Dialog
        open={Boolean(openFulfillmentAlert)}
        onClose={() => setOpenFulfillmentAlert(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            color: 'error.main',
            fontWeight: 700,
            fontSize: 30,
            pb: 1,
          }}
        >
          <WarningAmberRoundedIcon sx={{ fontSize: 42 }} />
          Stop - Intervention Required
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2, fontSize: 18, alignItems: 'center' }}>
            This tracking number exists in fulfillment but the shipment is not closed.
          </Alert>
          <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 1 }}>
            {openFulfillmentAlert?.message}
          </Typography>
          <Typography sx={{ fontSize: 16, color: 'text.secondary', mb: 2 }}>
            Do not continue packing this order until a lead or fulfillment manager reviews it and closes the shipment correctly.
          </Typography>
          {openFulfillmentAlert?.sources?.map((source) => (
            <Box
              key={source.source}
              sx={{
                border: '1px solid',
                borderColor: source.open ? 'error.light' : 'success.light',
                borderRadius: 2,
                p: 2,
                mb: 1.5,
                backgroundColor: source.open ? '#fff5f5' : '#f4fbf6',
              }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: 17, textTransform: 'capitalize', mb: 0.5 }}>
                {source.source} Fulfillment
              </Typography>
              <Typography sx={{ fontSize: 15 }}>
                Shipment IDs: {source.shipmentIds.length ? source.shipmentIds.join(', ') : 'N/A'}
              </Typography>
              <Typography sx={{ fontSize: 15 }}>
                Status: {source.open ? 'Open / Not Closed' : 'Closed'}
              </Typography>
            </Box>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="contained"
            color="error"
            size="large"
            onClick={() => setOpenFulfillmentAlert(null)}
          >
            Acknowledge And Get Help
          </Button>
        </DialogActions>
      </Dialog>

      {canScanBarcode && canSearchBarcode && <Divider sx={{ my: 4 }} />}

      {/* Search Section */}
      {canSearchBarcode && (
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          Search Barcode Scans
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter a barcode number to view all timestamps when it was scanned
        </Typography>
        <form onSubmit={handleSearchSubmit}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs>
              <TextField
                fullWidth
                inputRef={searchInputRef}
                label="Enter Barcode Number"
                value={searchBarcode}
                onChange={(e) => setSearchBarcode(e.target.value)}
                required
                disabled={searchLoading}
                placeholder="Enter barcode to search..."
              />
            </Grid>
            <Grid item>
              <Button
                type="submit"
                variant="contained"
                color="secondary"
                disabled={searchLoading || !searchBarcode.trim()}
                sx={{ height: 56, minWidth: 120 }}
              >
                {searchLoading ? <CircularProgress size={24} /> : 'Search'}
              </Button>
            </Grid>
          </Grid>
        </form>

        {searchResult && searchResult.count > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Found {searchResult.count} scan{searchResult.count !== 1 ? 's' : ''} for barcode: {searchResult.barcode}
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>#</strong></TableCell>
                    <TableCell><strong>Barcode</strong></TableCell>
                    <TableCell><strong>Scanned By</strong></TableCell>
                    <TableCell><strong>Scanned At (Local Time)</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {searchResult.scans.map((scan, index) => (
                    <TableRow key={scan.id} hover>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{scan.barcode}</TableCell>
                      <TableCell>
                        {scan.user 
                          ? (scan.user.name || scan.user.username)
                          : 'Unknown'}
                      </TableCell>
                      <TableCell>{formatLocalTime(scan.scannedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {searchResult && searchResult.count === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            No scans found for barcode: {searchBarcode.trim()}
          </Alert>
        )}
      </Paper>
      )}
    </Box>
  );
};

export default BarcodeScan;


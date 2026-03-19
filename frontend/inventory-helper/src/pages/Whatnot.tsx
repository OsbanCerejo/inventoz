import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl } from '../config/api';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardMedia,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  ListItemText
} from '@mui/material';
import ScienceIcon from "@mui/icons-material/Science";
import { invalidateProductsCache } from "../utils/productCache";
import { useAuth } from "../context/AuthContext";


interface ProductDetails {
  images?: string[];
  sizeOz?: string;
  strength?: string;
  shade?: string;
}

interface Product {
  sku: string;
  upc?: string;
  itemName: string;
  brand: string;
  quantity: number;
  productDetails?: ProductDetails;
  ProductDetail?: {
    tester?: boolean;
  };
  image?: string;
  category?: string;
  sizeOz?: number;
  sizeMl?: number;
  condition?: string;
}

interface SearchResult {
  success: boolean;
  found: boolean;
  multiple?: boolean;
  products?: Product[];
  product?: Product;
  message?: string;
}

interface WhatnotShow {
  id: number;
  name: string;
  isActive: boolean;
}

interface WhatnotScanLog {
  id: number;
  barcode: string;
  status: 'not_found' | 'found' | 'multiple_found';
  sku?: string | null;
  previousQuantity?: number | null;
  newQuantity?: number | null;
  createdAt: string;
  product?: Product | null;
}



const Whatnot: React.FC = () => {
  const { user } = useAuth();
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showsLoading, setShowsLoading] = useState(false);
  const [creatingShow, setCreatingShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [shows, setShows] = useState<WhatnotShow[]>([]);
  const [selectedShowId, setSelectedShowId] = useState<string>('');
  const [newShowName, setNewShowName] = useState('');
  const [scanLogs, setScanLogs] = useState<WhatnotScanLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const showStorageKey = user?.id
    ? `whatnot:selectedShow:${user.id}`
    : 'whatnot:selectedShow';

  const fetchShows = async () => {
    try {
      setShowsLoading(true);
      const response = await axios.get(getApiUrl('whatnot/shows'));
      const showList: WhatnotShow[] = response.data || [];
      setShows(showList);

      let savedShowId = '';
      try {
        savedShowId = localStorage.getItem(showStorageKey) || '';
      } catch (storageError) {
        console.warn('Unable to read selected show from localStorage', storageError);
      }

      const hasSelectedShow = selectedShowId
        ? showList.some((show) => String(show.id) === selectedShowId)
        : false;
      const hasSavedShow = savedShowId
        ? showList.some((show) => String(show.id) === savedShowId)
        : false;

      if (hasSavedShow && savedShowId !== selectedShowId) {
        setSelectedShowId(savedShowId);
      } else if (!hasSelectedShow && showList.length > 0) {
        setSelectedShowId(String(showList[0].id));
      } else if (showList.length === 0) {
        setSelectedShowId('');
      }
    } catch (err) {
      console.error('Error fetching Whatnot shows:', err);
      setError('Failed to load shows');
    } finally {
      setShowsLoading(false);
    }
  };

  const fetchScanLogs = async (showId: string) => {
    if (!showId) {
      setScanLogs([]);
      return;
    }

    try {
      setLogsLoading(true);
      const response = await axios.get(getApiUrl('whatnot/logs'), {
        params: {
          showId: Number(showId),
          limit: 10
        }
      });
      setScanLogs(response.data || []);
    } catch (err) {
      console.error('Error fetching Whatnot scan logs:', err);
      setError('Failed to load recent scans');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
    fetchShows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedShowId) {
      return;
    }

    try {
      localStorage.setItem(showStorageKey, selectedShowId);
    } catch (storageError) {
      console.warn('Unable to save selected show in localStorage', storageError);
    }
  }, [selectedShowId, showStorageKey]);

  useEffect(() => {
    fetchScanLogs(selectedShowId);
  }, [selectedShowId]);

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    setSearchResult(null);

    if (!selectedShowId) {
      setError('Please select a show before scanning');
      setLoading(false);
      return;
    }
    
    try {
      const response = await axios.post(getApiUrl('whatnot/search-barcode'), { 
        barcode,
        showId: Number(selectedShowId)
      });
      if (response.data.success) {
        if (response.data.multiple) {
          setOpenDialog(true);
        }
        setSearchResult(response.data);
        if (response.data.found && !response.data.multiple) {
          invalidateProductsCache();
          await fetchScanLogs(selectedShowId);
        }
        if (!response.data.found) {
          setError(response.data.message);
        }
      }
    } catch {
      setError('Error searching product');
    } finally {
      setBarcode('');
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
      setLoading(false);
    }
  };

  const handleProductSelect = async (product: Product) => {
    setLoading(true);
    setError('');
    setSuccess('');
    setOpenDialog(false);
    
    try {
      const response = await axios.post(
        getApiUrl('whatnot/search-barcode'),
        { 
          barcode: product.sku,
          showId: Number(selectedShowId),
          reduceQuantity: true,
          isMultipleSelection: true
        }
      );
      
      if (response.data.success && response.data.found) {
        const newSearchResult: SearchResult = {
          success: true,
          found: true,
          product: {
            sku: response.data.product.sku,
            upc: response.data.product.upc,
            itemName: response.data.product.itemName,
            brand: response.data.product.brand,
            quantity: response.data.product.quantity,
            image: response.data.product.image,
            category: response.data.product.category
          }
        };
        
        setSearchResult(newSearchResult);
        invalidateProductsCache();
        await fetchScanLogs(selectedShowId);
        setSuccess('Product quantity updated successfully');
        
        setBarcode('');
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus();
        }
      }
    } catch (error) {
      console.error('Error updating product:', error);
      setError('Error updating product quantity');
      setSearchResult(prev => prev ? { ...prev } : null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShow = async () => {
    setError('');
    setSuccess('');

    if (!newShowName.trim()) {
      setError('Show name is required');
      return;
    }

    try {
      setCreatingShow(true);
      const response = await axios.post(getApiUrl('whatnot/shows'), {
        name: newShowName.trim()
      });

      await fetchShows();
      if (response.data?.id) {
        setSelectedShowId(String(response.data.id));
      }
      setNewShowName('');
      setSuccess('Show added successfully');
      await fetchScanLogs(String(response.data.id || selectedShowId));
    } catch (err: unknown) {
      console.error('Error creating show:', err);
      const errorMessage =
        axios.isAxiosError(err) && err.response?.data?.error
          ? String(err.response.data.error)
          : 'Failed to create show';
      setError(errorMessage);
    } finally {
      setCreatingShow(false);
    }
  };

  const selectedShow = shows.find((show) => String(show.id) === selectedShowId);
  return (
    <Box sx={{ mt: 4, px: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Whatnot
      </Typography>

      <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Select Show
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel id="whatnot-show-label">Show</InputLabel>
              <Select
                labelId="whatnot-show-label"
                value={selectedShowId}
                label="Show"
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
          </Grid>
          <Grid item xs={12} md={6}>
            {selectedShow && (
              <Typography variant="body2" color="text.secondary">
                Scans will be associated with: <strong>{selectedShow.name}</strong>
              </Typography>
            )}
          </Grid>
        </Grid>

        {user?.role === 'admin' && (
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={9}>
              <TextField
                fullWidth
                label="New Show Name"
                value={newShowName}
                onChange={(e) => setNewShowName(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleCreateShow}
                disabled={creatingShow}
                sx={{ height: 56 }}
              >
                {creatingShow ? <CircularProgress size={24} /> : 'Add Show'}
              </Button>
            </Grid>
          </Grid>
        )}
      </Paper>

      <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
        <Typography variant="h5" gutterBottom>
          Barcode Scanner
        </Typography>
        <form onSubmit={handleBarcodeSubmit}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs>
              <TextField
                fullWidth
                inputRef={barcodeInputRef}
                label="Enter Barcode (UPC or SKU)"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                required
                autoFocus
              />
            </Grid>
            <Grid item>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={loading}
                sx={{ height: 56 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Search'}
              </Button>
            </Grid>
          </Grid>
        </form>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {success}
          </Alert>
        )}
      </Paper>

      {searchResult && (
        <Box sx={{ mt: 4 }}>
          {searchResult.found && !searchResult.multiple && (
            <ProductCard product={searchResult.product!} />
          )}
          {!searchResult.found && (
            <Alert severity="info">
              No products found with this barcode
            </Alert>
          )}
        </Box>
      )}

      <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
        <Typography variant="h5" gutterBottom>
          Recent Scans (Newest to Oldest)
        </Typography>

        {!selectedShowId && (
          <Alert severity="info">Select a show to view recent scans.</Alert>
        )}

        {selectedShowId && logsLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {selectedShowId && !logsLoading && scanLogs.length === 0 && (
          <Alert severity="info">No scans yet for this show.</Alert>
        )}

        {selectedShowId && !logsLoading && scanLogs.length > 0 && (
          <List>
            {scanLogs.map((log) => {
              const qtyText =
                log.previousQuantity !== null &&
                log.previousQuantity !== undefined &&
                log.newQuantity !== null &&
                log.newQuantity !== undefined
                  ? `Qty: ${log.previousQuantity} -> ${log.newQuantity}`
                  : 'Qty unchanged';
              const brand = log.product?.brand || 'N/A';
              const itemName = log.product?.itemName || log.sku || log.barcode;
              const size =
                log.product?.sizeOz
                  ? `${log.product.sizeOz} oz`
                  : log.product?.sizeMl
                  ? `${log.product.sizeMl} ml`
                  : 'N/A';
              const strength = log.product?.strength || 'N/A';
              const condition = log.product?.condition || 'N/A';
              const isTester = Boolean(log.product?.ProductDetail?.tester);
              const thumbnailUrl = log.product?.image || '';
              const formattedTitle = [
                log.product?.brand,
                log.product?.itemName,
                log.product?.strength,
                log.product?.sizeOz ? `${log.product.sizeOz} oz` : null,
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <ListItem key={log.id} divider sx={{ alignItems: 'flex-start', gap: 2 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      flexShrink: 0,
                      borderRadius: 1,
                      border: '1px solid #e0e0e0',
                      overflow: 'hidden',
                      bgcolor: '#fafafa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {thumbnailUrl ? (
                      <Box
                        component="img"
                        src={thumbnailUrl}
                        alt={itemName}
                        loading="lazy"
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        No Img
                      </Typography>
                    )}
                  </Box>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                        <Typography variant="body1" component="span" sx={{ fontWeight: 600 }}>
                          {formattedTitle || itemName}
                        </Typography>
                        {isTester && (
                          <ScienceIcon sx={{ color: "red", fontSize: 16 }} />
                        )}
                        <Typography variant="body2" component="span" color="text.secondary">
                          ({log.status})
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="body2" component="span" display="block">
                          {new Date(log.createdAt).toLocaleString()} | Barcode: {log.barcode} | {qtyText}
                        </Typography>
                        <Typography variant="body2" component="span" display="block">
                          Brand: {brand} | Size: {size} | Strength: {strength}
                        </Typography>
                        <Typography variant="body2" component="span" display="block">
                          Condition: {condition} | Tester: {isTester ? 'Yes' : 'No'}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        )}

      </Paper>

      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Select Product</DialogTitle>
        <DialogContent>
          <List>
            {searchResult?.products?.map((product) => (
              <ListItem 
                key={product.sku}
                button
                onClick={() => handleProductSelect(product)}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 2,
                  py: 2,
                  borderBottom: '1px solid #eee'
                }}
              >
                <Box sx={{ width: 100, height: 100, flexShrink: 0 }}>
                  <img
                    src={product.image || 'https://via.placeholder.com/100'}
                    alt={product.itemName}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain'
                    }}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {product.itemName}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>SKU:</strong> {product.sku}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Brand:</strong> {product.brand}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Category:</strong> {product.category || 'N/A'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Condition:</strong> {product.condition || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>UPC:</strong> {product.upc || 'N/A'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Quantity:</strong> {product.quantity}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Size:</strong> {product.sizeOz ? `${product.sizeOz}oz` : product.sizeMl ? `${product.sizeMl}ml` : 'N/A'}
                      </Typography>
                      {product.productDetails && (
                        <>
                          {product.productDetails.strength && (
                            <Typography variant="body2" color="text.secondary">
                              <strong>Strength:</strong> {product.productDetails.strength}
                            </Typography>
                          )}
                          {product.productDetails.shade && (
                            <Typography variant="body2" color="text.secondary">
                              <strong>Shade:</strong> {product.productDetails.shade}
                            </Typography>
                          )}
                        </>
                      )}
                    </Grid>
                  </Grid>
                </Box>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const imageUrl = product.image || 'https://via.placeholder.com/300';
  
  return (
    <Card sx={{ height: '100%', display: 'flex' }}>
      <Box sx={{ 
        width: '200px',
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <CardMedia
          component="img"
          image={imageUrl}
          alt={product.itemName}
          sx={{
            width: '100%',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: '4px'
          }}
        />
      </Box>
      <Box sx={{ flex: 1, p: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Title
              </Typography>
              <Typography variant="h6" sx={{ 
                fontSize: '1rem',
                fontWeight: 500,
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                minHeight: '2.4em'
              }}>
                {product.itemName}
              </Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Brand
              </Typography>
              <Typography variant="body2">
                {product.brand}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Quantity
              </Typography>
              <Typography 
                variant="body2" 
                color={product.quantity === 0 ? 'error' : 'inherit'}
                sx={{ 
                  fontWeight: 'bold',
                  fontSize: '1.1rem'
                }}
              >
                {product.quantity}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Category
              </Typography>
              <Typography variant="body2">
                {product.category || 'N/A'}
              </Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                SKU
              </Typography>
              <Typography variant="body2">
                {product.sku}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                UPC
              </Typography>
              <Typography variant="body2">
                {product.upc || 'N/A'}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Card>
  );
};

export default Whatnot; 

import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
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
  ListItemText,
  CircularProgress,
  Alert,
  Snackbar,
  Grid,
  Card,
  CardMedia,
  CardContent
} from '@mui/material';
import { styled } from '@mui/material/styles';

interface ProductDetails {
  images?: string[];
}

interface Product {
  sku: string;
  upc?: string;
  itemName: string;
  brand: string;
  quantity: number;
  productDetails?: ProductDetails;
  image?: string;
  category?: string;
}

interface SearchResult {
  success: boolean;
  found: boolean;
  multiple?: boolean;
  products?: Product[];
  product?: Product;
  message?: string;
}

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  margin: theme.spacing(2),
  backgroundColor: '#f5f5f5',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
}));

const Whatnot: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAuthenticated && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [isAuthenticated]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const response = await axios.post(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/whatnot/verify-password`, { password });
      if (response.data.success) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      setError('Invalid password');
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    setSearchResult(null);
    
    try {
      const response = await axios.post(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/whatnot/search-barcode`, { barcode });
      if (response.data.success) {
        if (response.data.multiple) {
          setOpenDialog(true);
        }
        setSearchResult(response.data);
        if (!response.data.found) {
          setError(response.data.message);
        }
      }
    } catch (error) {
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
        `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/whatnot/search-barcode`,
        { 
          barcode: product.sku,
          reduceQuantity: true
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

  if (!isAuthenticated) {
    return (
      <Box sx={{ maxWidth: 400, mx: 'auto', mt: 4, p: 3 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>
            Whatnot Menu Access
          </Typography>
          <form onSubmit={handlePasswordSubmit}>
            <TextField
              fullWidth
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
            />
            <Button
              fullWidth
              type="submit"
              variant="contained"
              color="primary"
              sx={{ mt: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Access Menu'}
            </Button>
          </form>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4, p: 3 }}>
      <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
        <Typography variant="h5" gutterBottom>
          Whatnot Barcode Scanner
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

      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
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
                  alignItems: 'center',
                  gap: 2,
                  py: 2
                }}
              >
                <Box sx={{ width: 80, height: 80, flexShrink: 0 }}>
                  <img
                    src={product.image || 'https://via.placeholder.com/80'}
                    alt={product.itemName}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain'
                    }}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" noWrap>
                    {product.itemName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    SKU: {product.sku}
                  </Typography>
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
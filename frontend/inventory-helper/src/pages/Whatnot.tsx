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
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardMedia
} from '@mui/material';


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



const Whatnot: React.FC = () => {
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    setSearchResult(null);
    
    try {
      const response = await axios.post(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/whatnot/search-barcode`, { 
        barcode
      });
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

  return (
    <Box sx={{ mt: 4, px: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Whatnot
      </Typography>
      
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
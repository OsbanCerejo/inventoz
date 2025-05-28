import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  CircularProgress
} from '@mui/material';
import axios from 'axios';

const ProductSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const searchProducts = async () => {
      if (!searchQuery) {
        setProducts([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await axios.get(
          `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/api/price-list/search-products?query=${encodeURIComponent(searchQuery)}`
        );
        setProducts(response.data);
      } catch (err) {
        setError('Failed to search products. Please try again.');
        console.error('Error searching products:', err);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchProducts, 500);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Search Products
      </Typography>
      
      <TextField
        fullWidth
        label="Search by product name or UPC"
        variant="outlined"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 3 }}
      />

      {loading && (
        <Box display="flex" justifyContent="center" my={3}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {!loading && !error && products.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Product Name</TableCell>
                <TableCell>UPC</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Price List</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.productName}</TableCell>
                  <TableCell>{product.upc}</TableCell>
                  <TableCell>${product.price}</TableCell>
                  <TableCell>{product.priceListFile.customName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && !error && searchQuery && products.length === 0 && (
        <Typography color="textSecondary" sx={{ mt: 2 }}>
          No products found matching your search.
        </Typography>
      )}
    </Box>
  );
};

export default ProductSearch; 
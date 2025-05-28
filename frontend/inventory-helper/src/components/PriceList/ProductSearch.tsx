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
import { Search as SearchIcon } from '@mui/icons-material';

interface Product {
  id: string;
  productName: string;
  upc: string;
  price: number;
  priceListFile: {
    customName: string;
  };
}

const ProductSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const searchProducts = async () => {
      if (!searchQuery) {
        setProducts([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/api/price-list/search-products?query=${encodeURIComponent(searchQuery)}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to search products');
        }

        const data = await response.json();
        setProducts(data);
      } catch (err: any) {
        setError(err.message || 'Failed to search products. Please try again.');
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
        InputProps={{
          startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
        }}
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
                  <TableCell>${Number(product.price).toFixed(2)}</TableCell>
                  <TableCell>{product.priceListFile?.customName}</TableCell>
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
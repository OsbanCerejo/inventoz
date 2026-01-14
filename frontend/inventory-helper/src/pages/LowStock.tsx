import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Box,
  Container,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
} from "@mui/material";
import ScienceIcon from "@mui/icons-material/Science";
import { getApiUrl } from "../config/api";
import { useAuth } from "../context/AuthContext";

interface LowStockProduct {
  sku: string;
  brand: string;
  itemName: string;
  quantity: number;
  minimumQuantity: number;
  location: string | null;
  image: string | null;
  size: string;
  strength: string | null;
  tester: boolean;
}

function LowStock() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [products, setProducts] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is admin
    if (user?.role !== 'admin') {
      navigate('/');
      return;
    }

    fetchLowStockProducts();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchLowStockProducts, 30000);
    return () => clearInterval(interval);
  }, [user, navigate]);

  const fetchLowStockProducts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(getApiUrl('products/low-stock'));
      setProducts(response.data);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching low stock products:", err);
      setError(err.response?.data?.error || "Failed to fetch low stock products");
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = (sku: string) => {
    navigate(`/products/${sku}`);
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Low Stock Products
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Products below their minimum quantity threshold
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {products.length === 0 ? (
        <Paper sx={{ p: 3 }}>
          <Typography variant="body1" color="text.secondary" align="center">
            No products are currently low on stock.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>SKU</strong></TableCell>
                <TableCell><strong>Brand</strong></TableCell>
                <TableCell><strong>Item Name</strong></TableCell>
                <TableCell><strong>Size</strong></TableCell>
                <TableCell><strong>Strength</strong></TableCell>
                <TableCell><strong>Tester</strong></TableCell>
                <TableCell align="right"><strong>Current Quantity</strong></TableCell>
                <TableCell align="right"><strong>Minimum Quantity</strong></TableCell>
                <TableCell><strong>Location</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product) => (
                <TableRow
                  key={product.sku}
                  onClick={() => handleProductClick(product.sku)}
                  sx={{
                    cursor: "pointer",
                    "&:hover": {
                      backgroundColor: "action.hover",
                    },
                  }}
                >
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>{product.brand}</TableCell>
                  <TableCell>{product.itemName}</TableCell>
                  <TableCell>{product.size || "N/A"}</TableCell>
                  <TableCell>{product.strength || "N/A"}</TableCell>
                  <TableCell>
                    {product.tester === true || product.tester === 1 ? (
                      <Tooltip title="Tester Product">
                        <Chip
                          icon={<ScienceIcon />}
                          label="Tester"
                          size="small"
                          color="warning"
                          variant="outlined"
                        />
                      </Tooltip>
                    ) : (
                      <span style={{ color: '#999' }}>—</span>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      color={product.quantity < product.minimumQuantity ? "error" : "text.primary"}
                      fontWeight="bold"
                    >
                      {product.quantity}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{product.minimumQuantity}</TableCell>
                  <TableCell>{product.location || "N/A"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
}

export default LowStock;


import axios from "axios";
import { useEffect, useState } from "react";
import ProductList from "../components/ProductList";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Box, Stack, Typography } from "@mui/material";
import PermissionGuard from "../components/PermissionGuard";

function Products() {
  // State Variables
  const [listOfProducts, setListOfProducts] = useState<any[]>([]);
  const location = useLocation();
  const navigate = useNavigate();

  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: string;
  }>({
    key: null,
    direction: "asc",
  });
  const [filterConfig, setFilterConfig] = useState<
    { key: string; value: string }[]
  >([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(20);

  // Constants
  const heading = "Products";

  // Fetch initial product list on component mount
  useEffect(() => {
    // Clear filters if navigated with the clearFilters state
    if (location.state?.clearFilters) {
      fetchProducts();
      setSortConfig({ key: "sku", direction: "asc" });
      setFilterConfig([]);
      setCurrentPage(1);
      try {
        localStorage.removeItem("sortConfig");
        localStorage.removeItem("filterConfig");
        localStorage.removeItem("currentPage");
      } catch (error) {
        console.warn("localStorage error:", error);
      }

      navigate(location.pathname, { replace: true, state: {} });
    }

    let savedProducts, savedSortConfig, savedFilterConfig, savedCurrentPage;
    
    try {
      savedProducts = localStorage.getItem("listOfProducts");
      savedSortConfig = localStorage.getItem("sortConfig");
      savedFilterConfig = localStorage.getItem("filterConfig");
      savedCurrentPage = localStorage.getItem("currentPage");
    } catch (error) {
      console.warn("localStorage error:", error);
      fetchProducts();
      return;
    }

    if (savedProducts) {
      const parsedProducts = JSON.parse(savedProducts);
      const hasNewStructure = parsedProducts.length > 0 && parsedProducts[0].ProductDetail !== undefined;
      
      if (hasNewStructure) {
        setListOfProducts(parsedProducts);
      } else {
        fetchProducts();
      }
    } else {
      fetchProducts();
    }

    if (savedSortConfig) {
      setSortConfig(JSON.parse(savedSortConfig));
    }

    if (savedFilterConfig) {
      const parsedFilterConfig = JSON.parse(savedFilterConfig);
      if (Array.isArray(parsedFilterConfig)) {
        setFilterConfig(parsedFilterConfig);
      } else {
        console.warn("savedFilterConfig is not an array", parsedFilterConfig);
        setFilterConfig([]);
      }
    }

    if (savedCurrentPage) {
      setCurrentPage(parseInt(savedCurrentPage, 10));
    }
  }, [location.state]);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/products`);
      setListOfProducts(response.data);
      try {
        localStorage.setItem("listOfProducts", JSON.stringify(response.data));
      } catch (error) {
        console.warn("Failed to save products to localStorage:", error);
        // Continue without caching if localStorage is full
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  // Function to handle sorting
  const handleSort = (columnKey: string) => {
    let direction = "asc";
    if (sortConfig.key === columnKey && sortConfig.direction === "asc") {
      direction = "desc";
    }
    const newSortConfig = { key: columnKey, direction };
    setSortConfig({ key: columnKey, direction });
    try {
      localStorage.setItem("sortConfig", JSON.stringify(newSortConfig));
    } catch (error) {
      console.warn("Failed to save sort config to localStorage:", error);
    }
  };

  const handleFilterChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    columnKey: string
  ) => {
    const { value } = e.target;
    const newFilterConfig = filterConfig.filter((f) => f.key !== columnKey);
    if (value) {
      newFilterConfig.push({ key: columnKey, value });
    }
    setFilterConfig(newFilterConfig);
    try {
      localStorage.setItem("filterConfig", JSON.stringify(newFilterConfig));
    } catch (error) {
      console.warn("Failed to save filter config to localStorage:", error);
    }
    paginate(1);
  };

  const sortedAndFilteredProducts = listOfProducts
    .filter((product) => {
      return filterConfig.every(({ key, value }) => {
        const productValue = product[key];
        return productValue
          ? productValue.toLowerCase().includes(value.toLowerCase())
          : false;
      });
    })
    .sort((a, b) => {
      if (sortConfig.key) {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (sortConfig.key === "quantity") {
          return sortConfig.direction === "asc"
            ? aValue - bValue
            : bValue - aValue;
        } else {
          const aStr = aValue?.toString().toLowerCase() ?? "";
          const bStr = bValue?.toString().toLowerCase() ?? "";
          if (aStr < bStr) return sortConfig.direction === "asc" ? -1 : 1;
          if (aStr > bStr) return sortConfig.direction === "asc" ? 1 : -1;
          return 0;
        }
      }
      return 0;
    });

  const paginate = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    try {
      localStorage.setItem("currentPage", pageNumber.toString());
    } catch (error) {
      console.warn("Failed to save current page to localStorage:", error);
    }
  };

  const handleRefresh = () => {
    fetchProducts();
    setSortConfig({ key: null, direction: "asc" });
    setFilterConfig([]);
    setCurrentPage(1);
    try {
      localStorage.removeItem("sortConfig");
      localStorage.removeItem("filterConfig");
      localStorage.removeItem("currentPage");
    } catch (error) {
      console.warn("Failed to clear localStorage:", error);
    }
  };

  return (
    <div>
      <Box mt={4} mb={3} px={2} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h4" component="h1" sx={{ mb: 0 }}>
          Products
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <PermissionGuard
            resource="products"
            action="create"
            fallback={
              <Button
                variant="contained"
                color="primary"
                size="large"
                style={{ fontWeight: 500, textTransform: 'none', boxShadow: 'none' }}
                disabled
                title="You don't have permission to create products"
              >
                Add Product
              </Button>
            }
            showError={false}
          >
            <Button
              variant="contained"
              color="primary"
              size="large"
              style={{ fontWeight: 500, textTransform: 'none', boxShadow: 'none' }}
              onClick={() => navigate("/addProduct")}
            >
              Add Product
            </Button>
          </PermissionGuard>
          <Button
            variant="contained"
            color="error"
            size="large"
            style={{ fontWeight: 500, textTransform: 'none', boxShadow: 'none' }}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Stack>
      </Box>
      <ProductList
        products={sortedAndFilteredProducts}
        heading={""}
        handleSort={handleSort}
        sortConfig={sortConfig}
        filterConfig={filterConfig}
        handleFilterChange={handleFilterChange}
        currentPage={currentPage}
        productsPerPage={productsPerPage}
        paginate={paginate}
        totalProducts={listOfProducts.length}
      ></ProductList>
    </div>
  );
}

export default Products; 
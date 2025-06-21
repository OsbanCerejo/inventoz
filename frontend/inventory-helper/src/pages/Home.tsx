import axios from "axios";
import { useEffect, useState } from "react";
import ProductList from "../components/ProductList";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Box, Stack, Typography } from "@mui/material";

function Home() {
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
      localStorage.removeItem("sortConfig");
      localStorage.removeItem("filterConfig");
      localStorage.removeItem("currentPage");

      navigate(location.pathname, { replace: true, state: {} });
    }

    const savedProducts = localStorage.getItem("listOfProducts");
    const savedSortConfig = localStorage.getItem("sortConfig");
    const savedFilterConfig = localStorage.getItem("filterConfig");
    const savedCurrentPage = localStorage.getItem("currentPage");

    if (savedProducts) {
      setListOfProducts(JSON.parse(savedProducts));
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
      localStorage.setItem("listOfProducts", JSON.stringify(response.data));
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
    localStorage.setItem("sortConfig", JSON.stringify(newSortConfig));
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
    localStorage.setItem("filterConfig", JSON.stringify(newFilterConfig));
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
    localStorage.setItem("currentPage", pageNumber.toString());
  };

  const handleRefresh = () => {
    fetchProducts();
    setSortConfig({ key: null, direction: "asc" });
    setFilterConfig([]);
    setCurrentPage(1);
    localStorage.removeItem("sortConfig");
    localStorage.removeItem("filterConfig");
    localStorage.removeItem("currentPage");
  };

  return (
    <div>
      <Box mt={4} mb={3} px={2} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h4" component="h1" sx={{ mb: 0 }}>
          Products
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            variant="contained"
            color="primary"
            size="large"
            style={{ fontWeight: 500, textTransform: 'none', boxShadow: 'none' }}
            onClick={() => navigate("/addProduct")}
          >
            Add Product
          </Button>
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

export default Home;

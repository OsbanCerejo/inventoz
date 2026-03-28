import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import ProductList from "../components/ProductList";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Box, Stack, Typography } from "@mui/material";
import PermissionGuard from "../components/PermissionGuard";
import { getApiUrl } from "../config/api";

function Products() {
  const [listOfProducts, setListOfProducts] = useState<any[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const hasHydratedFromStorageRef = useRef(false);

  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: string;
  }>({
    key: "sku",
    direction: "asc",
  });
  const [filterConfig, setFilterConfig] = useState<
    { key: string; value: string }[]
  >([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(20);

  const fetchProducts = useCallback(
    async (options?: { signal?: AbortSignal; silent?: boolean }) => {
      if (!options?.silent) {
        setIsLoadingProducts(true);
      }
      setFetchError(null);
      try {
        const params: Record<string, string | number> = {
          page: currentPage,
          pageSize: productsPerPage,
          sortKey: sortConfig.key || "sku",
          sortDirection: sortConfig.direction || "asc",
        };

        filterConfig.forEach(({ key, value }) => {
          const trimmedValue = String(value || "").trim();
          if (trimmedValue) {
            params[key] = trimmedValue;
          }
        });

        const response = await axios.get(getApiUrl("products/list"), {
          signal: options?.signal,
          params,
        });
        setListOfProducts(response.data?.rows || []);
        setTotalProducts(Number(response.data?.total || 0));
      } catch (error: any) {
        if (axios.isCancel && axios.isCancel(error)) {
          return;
        }
        console.error("Error fetching products:", error);
        setFetchError("Unable to load products. Please try again.");
      } finally {
        if (!options?.silent) {
          setIsLoadingProducts(false);
        }
      }
    },
    [currentPage, productsPerPage, sortConfig.key, sortConfig.direction, filterConfig]
  );

  useEffect(() => {
    if (hasHydratedFromStorageRef.current) return;
    hasHydratedFromStorageRef.current = true;
    try {
      const savedSortConfig = localStorage.getItem("sortConfig");
      const savedFilterConfig = localStorage.getItem("filterConfig");
      const savedCurrentPage = localStorage.getItem("currentPage");

      if (savedSortConfig) {
        const parsedSortConfig = JSON.parse(savedSortConfig);
        setSortConfig({
          key: parsedSortConfig?.key || "sku",
          direction: parsedSortConfig?.direction || "asc",
        });
      }

      if (savedFilterConfig) {
        const parsedFilterConfig = JSON.parse(savedFilterConfig);
        if (Array.isArray(parsedFilterConfig)) {
          setFilterConfig(parsedFilterConfig);
        }
      }

      if (savedCurrentPage) {
        const parsedPage = parseInt(savedCurrentPage, 10);
        if (!Number.isNaN(parsedPage) && parsedPage > 0) {
          setCurrentPage(parsedPage);
        }
      }
    } catch (error) {
      console.warn("localStorage error:", error);
    }
  }, []);

  useEffect(() => {
    if (!location.state?.clearFilters) return;
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
  }, [location.state, navigate, location.pathname]);

  useEffect(() => {
    const controller = new AbortController();
    fetchProducts({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchProducts]);

  const handleSort = (columnKey: string) => {
    let direction = "asc";
    if (sortConfig.key === columnKey && sortConfig.direction === "asc") {
      direction = "desc";
    }
    const newSortConfig = { key: columnKey, direction };
    setSortConfig(newSortConfig);
    setCurrentPage(1);
    try {
      localStorage.setItem("sortConfig", JSON.stringify(newSortConfig));
      localStorage.setItem("currentPage", "1");
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
    setCurrentPage(1);
    try {
      localStorage.setItem("filterConfig", JSON.stringify(newFilterConfig));
      localStorage.setItem("currentPage", "1");
    } catch (error) {
      console.warn("Failed to save filter config to localStorage:", error);
    }
  };

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalProducts / productsPerPage));
    if (currentPage > totalPages) {
      paginate(totalPages);
    }
  }, [totalProducts, currentPage, productsPerPage]);

  const paginate = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    try {
      localStorage.setItem("currentPage", pageNumber.toString());
    } catch (error) {
      console.warn("Failed to save current page to localStorage:", error);
    }
  };

  const handleRefresh = () => {
    const isAlreadyDefaultState =
      (sortConfig.key || "sku") === "sku" &&
      sortConfig.direction === "asc" &&
      filterConfig.length === 0 &&
      currentPage === 1;
    setSortConfig({ key: "sku", direction: "asc" });
    setFilterConfig([]);
    setCurrentPage(1);
    try {
      localStorage.removeItem("sortConfig");
      localStorage.removeItem("filterConfig");
      localStorage.removeItem("currentPage");
    } catch (error) {
      console.warn("Failed to clear localStorage:", error);
    }
    if (isAlreadyDefaultState) {
      fetchProducts();
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
                style={{ fontWeight: 500, textTransform: "none", boxShadow: "none" }}
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
              style={{ fontWeight: 500, textTransform: "none", boxShadow: "none" }}
              onClick={() => navigate("/addProduct")}
            >
              Add Product
            </Button>
          </PermissionGuard>
          <Button
            variant="contained"
            color="error"
            size="large"
            style={{ fontWeight: 500, textTransform: "none", boxShadow: "none" }}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Stack>
      </Box>
      {fetchError && (
        <Typography color="error" sx={{ mb: 2 }}>
          {fetchError}
        </Typography>
      )}
      <ProductList
        products={listOfProducts}
        heading={""}
        handleSort={handleSort}
        sortConfig={sortConfig}
        filterConfig={filterConfig}
        handleFilterChange={handleFilterChange}
        currentPage={currentPage}
        productsPerPage={productsPerPage}
        paginate={paginate}
        totalProducts={totalProducts}
      />
      {isLoadingProducts && (
        <Typography variant="body2" sx={{ mt: 2 }}>
          Refreshing inventory...
        </Typography>
      )}
    </div>
  );
}

export default Products;

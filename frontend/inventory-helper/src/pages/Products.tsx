import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import ProductList from "../components/ProductList";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Box, Stack, Typography } from "@mui/material";
import PermissionGuard from "../components/PermissionGuard";
import { getApiUrl } from '../config/api';
import {
  PRODUCTS_CACHE_KEY,
  PRODUCTS_CACHE_TIMESTAMP_KEY,
} from "../utils/productCache";

const PRODUCTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const PRODUCTS_AUTO_REFETCH_INTERVAL_MS = 60 * 1000; // 60 seconds

function Products() {
  // State Variables
  const [listOfProducts, setListOfProducts] = useState<any[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const backgroundRefreshInFlightRef = useRef(false);
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

  const fetchProducts = useCallback(
    async (options?: { signal?: AbortSignal; silent?: boolean }) => {
      if (!options?.silent) {
        setIsLoadingProducts(true);
      }
      setFetchError(null);
      try {
        const response = await axios.get(getApiUrl("products"), {
          signal: options?.signal,
        });
        setListOfProducts(response.data);
        try {
          // Strip each product down to only the fields used for display/filtering
          // to stay well under the localStorage 5 MB limit.
          const slim = response.data.map((p: any) => ({
            sku: p.sku,
            brand: p.brand,
            itemName: p.itemName,
            sizeOz: p.sizeOz,
            sizeMl: p.sizeMl,
            strength: p.strength,
            shade: p.shade,
            location: p.location,
            warehouseLocations: p.warehouseLocations,
            quantity: p.quantity,
            listed: p.listed,
            verified: p.verified,
            image: p.image,
            category: p.category,
            type: p.type,
            condition: p.condition,
            upc: p.upc,
            alternativeSku: p.alternativeSku,
            ProductDetail: p.ProductDetail
              ? { tester: p.ProductDetail.tester, discontinued: p.ProductDetail.discontinued }
              : undefined,
          }));
          localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(slim));
          localStorage.setItem(
            PRODUCTS_CACHE_TIMESTAMP_KEY,
            Date.now().toString()
          );
        } catch (storageError) {
          console.warn("Failed to save products to localStorage:", storageError);
        }
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
    []
  );

  const triggerBackgroundRefresh = useCallback(async () => {
    if (document.hidden || backgroundRefreshInFlightRef.current) return;
    backgroundRefreshInFlightRef.current = true;
    try {
      await fetchProducts({ silent: true });
    } finally {
      backgroundRefreshInFlightRef.current = false;
    }
  }, [fetchProducts]);

  // Fetch initial product list on component mount
  useEffect(() => {
    const controller = new AbortController();

    // Clear filters if navigated with the clearFilters state
    if (location.state?.clearFilters) {
      fetchProducts({ signal: controller.signal });
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

    let savedProducts: string | null = null;
    let savedSortConfig: string | null = null;
    let savedFilterConfig: string | null = null;
    let savedCurrentPage: string | null = null;

    try {
      savedProducts = localStorage.getItem(PRODUCTS_CACHE_KEY);
      savedSortConfig = localStorage.getItem("sortConfig");
      savedFilterConfig = localStorage.getItem("filterConfig");
      savedCurrentPage = localStorage.getItem("currentPage");
    } catch (error) {
      console.warn("localStorage error:", error);
    }

    if (savedProducts) {
      try {
        const parsedProducts = JSON.parse(savedProducts);
        const hasNewStructure =
          parsedProducts.length > 0 &&
          parsedProducts[0].ProductDetail !== undefined;

        if (hasNewStructure) {
          setListOfProducts(parsedProducts);
        }
      } catch (error) {
        console.warn("Failed to parse cached products:", error);
        localStorage.removeItem(PRODUCTS_CACHE_KEY);
        localStorage.removeItem(PRODUCTS_CACHE_TIMESTAMP_KEY);
      }
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

    const cacheTimestamp = localStorage.getItem(PRODUCTS_CACHE_TIMESTAMP_KEY);
    const isCacheFresh =
      cacheTimestamp &&
      Date.now() - parseInt(cacheTimestamp, 10) < PRODUCTS_CACHE_TTL;

    if (!isCacheFresh) {
      fetchProducts({ signal: controller.signal });
    } else {
      // Refresh in background without blocking UI
      fetchProducts({ signal: controller.signal, silent: true });
    }

    return () => controller.abort();
  }, [location.state, fetchProducts, navigate, location.pathname]);

  useEffect(() => {
    const onWindowFocus = () => {
      triggerBackgroundRefresh();
    };

    const onVisibilityChange = () => {
      if (!document.hidden) {
        triggerBackgroundRefresh();
      }
    };

    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        triggerBackgroundRefresh();
      }
    }, PRODUCTS_AUTO_REFETCH_INTERVAL_MS);

    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [triggerBackgroundRefresh]);

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
        if (productValue === null || productValue === undefined) return false;
        return String(productValue).toLowerCase().includes(value.toLowerCase());
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

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(sortedAndFilteredProducts.length / productsPerPage)
    );
    if (currentPage > totalPages) {
      paginate(totalPages);
    }
  }, [sortedAndFilteredProducts.length, currentPage, productsPerPage]);

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
      {fetchError && (
        <Typography color="error" sx={{ mb: 2 }}>
          {fetchError}
        </Typography>
      )}
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
        totalProducts={sortedAndFilteredProducts.length}
      ></ProductList>
      {isLoadingProducts && (
        <Typography variant="body2" sx={{ mt: 2 }}>
                    Refreshing inventory...
        </Typography>
      )}
    </div>
  );
}

export default Products; 

import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import ProductList from "../components/ProductList";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Box, Stack, Typography } from "@mui/material";
import { getApiUrl } from "../config/api";
import { useAuth } from "../context/AuthContext";
import skuData from "../data/skuData.json";

const ALL_CATEGORIES = Object.keys(skuData.CATEGORY) as string[];
const ALL_TYPES = ["Sealed", "Unsealed", "Unboxed", "Tester"];

function Products() {
  const { hasPermission, hasMenuAccess } = useAuth();
  const [listOfProducts, setListOfProducts] = useState<any[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const hasHydratedFromStorageRef = useRef(false);

  // Data entry scope — loaded once, stored in refs so fetchProducts always reads latest
  const scopeBrandsRef = useRef<string[]>([]);
  const scopeCategoriesRef = useRef<string[]>([]);
  const isDataEntryUser = hasPermission('products', 'dataEntry');
  const [scopeReady, setScopeReady] = useState(!isDataEntryUser);

  useEffect(() => {
    if (!isDataEntryUser) return;
    axios.get(getApiUrl('products/data-entry/config'))
      .then(res => {
        scopeBrandsRef.current = res.data.allowedBrands || [];
        scopeCategoriesRef.current = res.data.allowedCategories || [];
      })
      .catch(() => {})
      .finally(() => setScopeReady(true));
  }, []);

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
  const [selectedCategories, setSelectedCategories] = useState<string[]>(ALL_CATEGORIES);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(ALL_TYPES);
  const [isHydrated, setIsHydrated] = useState(false);

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

        // Apply data entry scope restrictions (brands + categories)
        if (scopeBrandsRef.current.length > 0) {
          params.brands = scopeBrandsRef.current.join(",");
        }

        // All selected → omit param (backend shows everything)
        // None selected → send "__none__" so backend returns empty
        // Subset selected → send comma-separated list
        const effectiveCategories = scopeCategoriesRef.current.length > 0
          ? selectedCategories.filter(c => scopeCategoriesRef.current.includes(c))
          : selectedCategories;

        if (effectiveCategories.length === 0) {
          params.categories = "__none__";
        } else if (effectiveCategories.length < ALL_CATEGORIES.length) {
          params.categories = effectiveCategories.join(",");
        }

        if (selectedTypes.length === 0) {
          params.types = "__none__";
        } else if (selectedTypes.length < ALL_TYPES.length) {
          params.types = selectedTypes.join(",");
        }

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
    [currentPage, productsPerPage, sortConfig.key, sortConfig.direction, filterConfig, selectedCategories, selectedTypes]
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

      const savedCategories = localStorage.getItem("selectedCategories");
      if (savedCategories) {
        const parsed = JSON.parse(savedCategories);
        if (Array.isArray(parsed)) setSelectedCategories(parsed);
      }

      const savedTypes = localStorage.getItem("selectedTypes");
      if (savedTypes) {
        const parsed = JSON.parse(savedTypes);
        if (Array.isArray(parsed)) setSelectedTypes(parsed);
      }
    } catch (error) {
      console.warn("localStorage error:", error);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!location.state?.clearFilters) return;
    setSortConfig({ key: "sku", direction: "asc" });
    setFilterConfig([]);
    setCurrentPage(1);
    setSelectedCategories(ALL_CATEGORIES);
    setSelectedTypes(ALL_TYPES);
    try {
      localStorage.removeItem("sortConfig");
      localStorage.removeItem("filterConfig");
      localStorage.removeItem("currentPage");
      localStorage.removeItem("selectedCategories");
      localStorage.removeItem("selectedTypes");
    } catch (error) {
      console.warn("localStorage error:", error);
    }
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, navigate, location.pathname]);

  useEffect(() => {
    if (!isHydrated || !scopeReady) return;
    const controller = new AbortController();
    fetchProducts({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchProducts, isHydrated, scopeReady]);

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
    // Don't run until hydration is done and we have a real count from the server.
    // Before the first fetch completes totalProducts=0, which would incorrectly
    // reset a restored page (e.g. page 5) back to page 1.
    if (!isHydrated || totalProducts === 0) return;
    const totalPages = Math.max(1, Math.ceil(totalProducts / productsPerPage));
    if (currentPage > totalPages) {
      paginate(totalPages);
    }
  }, [totalProducts, currentPage, productsPerPage, isHydrated]);

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
      currentPage === 1 &&
      selectedCategories.length === ALL_CATEGORIES.length &&
      selectedTypes.length === ALL_TYPES.length;
    setSortConfig({ key: "sku", direction: "asc" });
    setFilterConfig([]);
    setCurrentPage(1);
    setSelectedCategories(ALL_CATEGORIES);
    setSelectedTypes(ALL_TYPES);
    try {
      localStorage.removeItem("sortConfig");
      localStorage.removeItem("filterConfig");
      localStorage.removeItem("currentPage");
      localStorage.removeItem("selectedCategories");
      localStorage.removeItem("selectedTypes");
    } catch (error) {
      console.warn("Failed to clear localStorage:", error);
    }
    if (isAlreadyDefaultState) {
      fetchProducts();
    }
  };

  const handleCategoryToggle = (cat: string) => {
    const next = selectedCategories.includes(cat)
      ? selectedCategories.filter((c) => c !== cat)
      : [...selectedCategories, cat];
    setSelectedCategories(next);
    setCurrentPage(1);
    try {
      localStorage.setItem("selectedCategories", JSON.stringify(next));
      localStorage.setItem("currentPage", "1");
    } catch (e) { /* ignore */ }
  };

  const handleTypeToggle = (type: string) => {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];
    setSelectedTypes(next);
    setCurrentPage(1);
    try {
      localStorage.setItem("selectedTypes", JSON.stringify(next));
      localStorage.setItem("currentPage", "1");
    } catch (e) { /* ignore */ }
  };

  const handleSelectAllTypes = () => {
    const next = selectedTypes.length === ALL_TYPES.length ? [] : ALL_TYPES;
    setSelectedTypes(next);
    setCurrentPage(1);
    try {
      if (next.length === 0) {
        localStorage.setItem("selectedTypes", JSON.stringify([]));
      } else {
        localStorage.removeItem("selectedTypes");
      }
      localStorage.setItem("currentPage", "1");
    } catch (e) { /* ignore */ }
  };

  const handleSelectAllCategories = () => {
    // Toggle: all selected → deselect all; anything else → select all
    const next = selectedCategories.length === ALL_CATEGORIES.length ? [] : ALL_CATEGORIES;
    setSelectedCategories(next);
    setCurrentPage(1);
    try {
      if (next.length === 0) {
        localStorage.setItem("selectedCategories", JSON.stringify([]));
      } else {
        localStorage.removeItem("selectedCategories");
      }
      localStorage.setItem("currentPage", "1");
    } catch (e) { /* ignore */ }
  };

  const canAddProduct =
    hasPermission("addProduct", "create") && hasMenuAccess("addProduct");

  const renderPills = (
    label: string,
    allOptions: string[],
    selected: string[],
    onToggle: (v: string) => void,
    onSelectAll: () => void,
    scheme: { border: string; bg: string; text: string; hoverBorder: string; hoverBg: string } = {
      border: "#2563eb", bg: "#dbeafe", text: "#1d4ed8",
      hoverBorder: "#1d4ed8", hoverBg: "#bfdbfe",
    }
  ) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
      <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 600, mr: 0.5, whiteSpace: "nowrap" }}>
        {label}
      </Typography>
      {[{ key: "__all__", label: "All", checked: selected.length === allOptions.length }, ...allOptions.map((o) => ({ key: o, label: o, checked: selected.includes(o) }))].map(({ key, label: pillLabel, checked }) => {
        const isAll = key === "__all__";
        const isIndeterminate = isAll && selected.length > 0 && selected.length < allOptions.length;
        const active = checked || isIndeterminate;
        return (
          <Box
            key={key}
            onClick={() => isAll ? onSelectAll() : onToggle(key)}
            sx={{
              display: "inline-flex", alignItems: "center", gap: 0.5,
              px: 1, py: 0.4, borderRadius: 5, cursor: "pointer", userSelect: "none",
              fontSize: 12, fontWeight: 600, border: "1.5px solid", transition: "all 0.12s",
              borderColor: active ? scheme.border : "#cbd5e1",
              bgcolor: active ? scheme.bg : "#f8fafc",
              color: active ? scheme.text : "#64748b",
              "&:hover": {
                borderColor: active ? scheme.hoverBorder : "#94a3b8",
                bgcolor: active ? scheme.hoverBg : "#f1f5f9",
              },
            }}
          >
            <Box sx={{ width: 12, height: 12, borderRadius: "3px", border: "1.5px solid", borderColor: active ? scheme.border : "#94a3b8", bgcolor: active ? scheme.border : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {isIndeterminate ? (
                <Box component="span" sx={{ width: 7, height: 1.5, bgcolor: "#fff", display: "block", borderRadius: 1 }} />
              ) : checked ? (
                <Box component="span" sx={{ width: 7, height: 5, borderLeft: "1.5px solid #fff", borderBottom: "1.5px solid #fff", transform: "rotate(-45deg) translateY(-1px)", display: "block" }} />
              ) : null}
            </Box>
            {pillLabel}
          </Box>
        );
      })}
    </Box>
  );

  return (
    <div>
      <Box mt={2} mb={1} px={2} display="flex" justifyContent="space-between" alignItems="flex-start" gap={2}>
        {/* Filter pill groups — stacked vertically */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          {renderPills("Category:", ALL_CATEGORIES, selectedCategories, handleCategoryToggle, handleSelectAllCategories)}
          {renderPills("Condition:", ALL_TYPES, selectedTypes, handleTypeToggle, handleSelectAllTypes, {
            border: "#7c3aed", bg: "#ede9fe", text: "#6d28d9",
            hoverBorder: "#6d28d9", hoverBg: "#ddd6fe",
          })}
        </Box>

        {/* Action buttons — fixed to the right */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ flexShrink: 0 }}>
          {canAddProduct && (
            <Button
              variant="contained"
              color="primary"
              size="large"
              style={{ fontWeight: 500, textTransform: "none", boxShadow: "none" }}
              onClick={() => navigate("/addProduct")}
            >
              Add Product
            </Button>
          )}
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

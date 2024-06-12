import axios from "axios";
import { useEffect, useState } from "react";
import ProductList from "../components/ProductList";
import { useLocation, useNavigate } from "react-router-dom";

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
  const [filterConfig, setFilterConfig] = useState<{
    key: string;
    value: string;
  }>({ key: "", value: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(20);

  // Constants
  const heading = "Products";

  // Fetch initial product list on component mount
  useEffect(() => {
    const savedProducts = localStorage.getItem("listOfProducts");
    const savedSortConfig = localStorage.getItem("sortConfig");
    const savedFilterConfig = localStorage.getItem("filterConfig");
    const savedCurrentPage = localStorage.getItem("currentPage");

    // Clear filters if navigated with the clearFilters state
    if (location.state?.clearFilters) {
      fetchProducts();
      setSortConfig({ key: "sku", direction: "asc" });
      setFilterConfig({ key: "", value: "" });
      setCurrentPage(1);
      localStorage.removeItem("sortConfig");
      localStorage.removeItem("filterConfig");
      localStorage.removeItem("currentPage");

      navigate(location.pathname, { replace: true, state: {} });
    }

    if (savedProducts) {
      setListOfProducts(JSON.parse(savedProducts));
    } else {
      fetchProducts();
    }

    if (savedSortConfig) {
      setSortConfig(JSON.parse(savedSortConfig));
    }

    if (savedFilterConfig) {
      setFilterConfig(JSON.parse(savedFilterConfig));
    }

    if (savedCurrentPage) {
      setCurrentPage(parseInt(savedCurrentPage, 10));
    }
  }, [location.state]);

  const fetchProducts = async () => {
    try {
      const response = await axios.get("http://localhost:3001/products");
      setListOfProducts(response.data);
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
    const newFilterConfig = { key: columnKey, value: e.target.value };
    setFilterConfig(newFilterConfig);
    localStorage.setItem("filterConfig", JSON.stringify(newFilterConfig));
    paginate(1);
  };

  const sortedAndFilteredProducts = listOfProducts
    .filter((product) => {
      if (filterConfig.key && filterConfig.value) {
        const productValue = product[filterConfig.key];
        return productValue
          ? productValue
              .toLowerCase()
              .includes(filterConfig.value.toLowerCase())
          : false;
      }
      return true;
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

  return (
    <div>
      <ProductList
        products={sortedAndFilteredProducts}
        heading={heading}
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

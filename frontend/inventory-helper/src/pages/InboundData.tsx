import axios from "axios";
import { useEffect, useState } from "react";
import InboundList from "../components/InboundList";
import { Typography, Box } from "@mui/material";
import { getApiUrl } from '../config/api';
import { useAuth } from "../context/AuthContext";

function InboundData() {
  const [listOfInbound, setListOfInbound] = useState<any[]>([]);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: string;
  }>({
    key: null,
    direction: "asc",
  });
  const [filterConfig, setFilterConfig] = useState<{
    sku: string;
    itemName: string;
    batch: string;
    vendorName: string;
  }>({
    sku: "",
    itemName: "",
    batch: "",
    vendorName: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(20);

  useEffect(() => {
    fetchInbound();
  }, []);

  const fetchInbound = async () => {
    try {
      const [inboundResponse] = await Promise.all([
        axios.get(getApiUrl('inbound')),
      ]);
      setListOfInbound(inboundResponse.data);
    } catch (error) {
      console.error("Fetch orders error:", error);
    }
  };

  const includesIgnoreCase = (value: any, query: string) => {
    if (!query) return true;
    if (value === null || value === undefined) return false;
    return value.toString().toLowerCase().includes(query.toLowerCase());
  };

  const sortedAndFilteredInbound = listOfInbound
    .filter((product) => {
      const vendorValue =
        product.vendorName || product.vendor || product.vendorInvoiceNumber;

      return (
        includesIgnoreCase(product.sku, filterConfig.sku) &&
        includesIgnoreCase(product.Product?.itemName, filterConfig.itemName) &&
        includesIgnoreCase(product.batch, filterConfig.batch) &&
        includesIgnoreCase(vendorValue, filterConfig.vendorName)
      );
    })
    .sort((a, b) => {
      if (sortConfig.key) {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        aValue = a[sortConfig.key];
        bValue = b[sortConfig.key];

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

  // Function to handle sorting
  const handleSort = (columnKey: string) => {
    let direction = "asc";
    if (sortConfig.key === columnKey && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key: columnKey, direction });
  };

  const handleFilterChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    columnKey: "sku" | "itemName" | "batch" | "vendorName"
  ) => {
    setFilterConfig((prev) => ({
      ...prev,
      [columnKey]: e.target.value,
    }));
    paginate(1);
  };
  const paginate = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  return (
    <div>
      <Box sx={{ mt: 4, mb: 3, px: 2 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 0 }}>
          Inbound Data
        </Typography>
      </Box>
      <InboundList
        products={sortedAndFilteredInbound}
        heading=""
        isAdmin={isAdmin}
        handleSort={handleSort}
        sortConfig={sortConfig}
        filterConfig={filterConfig}
        handleFilterChange={handleFilterChange}
        currentPage={currentPage}
        productsPerPage={productsPerPage}
        paginate={paginate}
        totalProducts={listOfInbound.length}
      ></InboundList>
    </div>
  );
}

export default InboundData;

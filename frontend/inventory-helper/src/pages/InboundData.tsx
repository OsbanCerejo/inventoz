import axios from "axios";
import { useEffect, useState } from "react";
import InboundList from "../components/InboundList";
import { Typography, Box } from "@mui/material";

function InboundData() {
  const [listOfInbound, setListOfInbound] = useState<any[]>([]);

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

  useEffect(() => {
    fetchInbound();
  }, []);

  const fetchInbound = async () => {
    try {
      const [inboundResponse] = await Promise.all([
        axios.get(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/inbound`),
      ]);
      setListOfInbound(inboundResponse.data);
    } catch (error) {
      console.error("Fetch orders error:", error);
    }
  };

  const sortedAndFilteredInbound = listOfInbound
    .filter((product) => {
      if (filterConfig.key && filterConfig.value) {
        if (filterConfig.key === "itemName") {
          const productValue = product.Product[filterConfig.key];
          return productValue
            ? productValue
                .toLowerCase()
                .includes(filterConfig.value.toLowerCase())
            : false;
        } else {
          const productValue = product[filterConfig.key];
          return productValue
            ? productValue
                .toLowerCase()
                .includes(filterConfig.value.toLowerCase())
            : false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (sortConfig.key) {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === "listed") {
          aValue = a.Product.listed;
          bValue = b.Product.listed;
        } else {
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
        }

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
    columnKey: string
  ) => {
    const newFilterConfig = { key: columnKey, value: e.target.value };
    setFilterConfig(newFilterConfig);
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

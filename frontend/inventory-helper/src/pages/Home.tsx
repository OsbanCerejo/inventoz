import axios from "axios";
import { useEffect, useState } from "react";
import ProductList from "../components/ProductList";

function Home() {
  // State Variables
  const [listOfProducts, setListOfProducts] = useState<any[]>([]);

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
    if (savedProducts) {
      setListOfProducts(JSON.parse(savedProducts));
    } else {
      fetchProducts();
    }
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get("http://localhost:3001/products");
      setListOfProducts(response.data);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  // // Function to handle search based on selected column and search string
  // const handleSearch = async () => {
  //   // TODO: Move this to Search.tsx eventually
  //   try {
  //     // Check if search string is provided
  //     if (searchString.trim() !== "") {
  //       const searchType = columnMap.has(selectedColumn)
  //         ? columnMap.get(selectedColumn)
  //         : "itemName";
  //       const response = await axios.get(
  //         "http://localhost:3001/products/search",
  //         {
  //           params: { searchString, searchType },
  //         }
  //       );
  //       setListOfProducts(response.data);
  //       // Save search state and results to local storage
  //       localStorage.setItem("searchString", searchString);
  //       localStorage.setItem("selectedColumn", selectedColumn);
  //       localStorage.setItem("listOfProducts", JSON.stringify(response.data));
  //     } else {
  //       // If search string is empty, fetch all products
  //       fetchProducts();
  //       // Clear search state and results from local storage
  //       localStorage.removeItem("searchString");
  //       localStorage.removeItem("selectedColumn");
  //       localStorage.removeItem("listOfProducts");
  //     }
  //   } catch (error) {
  //     console.error("Error searching products:", error);
  //   }
  // };

  // // Function to handle search on pressing Enter key
  // const handleKeypress = (e: any) => {
  //   //it triggers by pressing the enter key
  //   if (e.keyCode === 13) {
  //     handleSearch();
  //   }
  // };

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
    setFilterConfig({ key: columnKey, value: e.target.value });
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
        const aValue = a[sortConfig.key]?.toString().toLowerCase() ?? "";
        const bValue = b[sortConfig.key]?.toString().toLowerCase() ?? "";
        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
      }
      return 0;
    });

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  return (
    <div>
      {/* <Box alignItems="center" my={4} p={2}>
        <TextField
          style={{ width: "85%" }}
          label="Search Item Name"
          id="search"
          value={searchString}
          onChange={(event) => {
            setSearchString(event.target.value);
          }}
          onKeyDown={handleKeypress}
        />
        <Select
          value={selectedColumn}
          onChange={(event) => setSelectedColumn(event.target.value)}
          displayEmpty
          style={{ width: "15%" }}
        >
          <MenuItem value="" disabled>
            Search By
          </MenuItem>
          {columns.map((column, index) => (
            <MenuItem key={index} value={column}>
              {column}
            </MenuItem>
          ))}
        </Select>
        <Button variant="contained" color="success" onClick={handleSearch}>
          Search
        </Button>
      </Box> */}
      <ProductList
        products={sortedAndFilteredProducts}
        heading={heading}
        handleSort={handleSort}
        sortConfig={sortConfig}
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

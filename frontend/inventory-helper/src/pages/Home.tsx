import axios from "axios";
import { useEffect, useState } from "react";
import ProductList from "../components/ProductList";
import { TextField, Button, Box, MenuItem, Select } from "@mui/material";

function Home() {
  // State Variables
  const [listOfProducts, setListOfProducts] = useState([]);
  const [searchString, setSearchString] = useState("");
  const [selectedColumn, setSelectedColumn] = useState("");

  // Constants
  const heading = "Products";
  const columns = ["Item Name", "SKU", "Brand", "Location"];
  const columnMap = new Map([
    ["Item Name", "itemName"],
    ["SKU", "sku"],
    ["Brand", "brand"],
    ["Location", "location"],
  ]);

  // Fetch initial product list on component mount
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get("http://localhost:3001/products");
      setListOfProducts(response.data);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  // Function to handle search based on selected column and search string
  const handleSearch = async () => {
    // TODO: Move this to Search.tsx eventually
    try {
      // Check if search string is provided
      if (searchString.trim() !== "") {
        const searchType = columnMap.has(selectedColumn)
          ? columnMap.get(selectedColumn)
          : "itemName";
        const response = await axios.get(
          "http://localhost:3001/products/search",
          {
            params: { searchString, searchType },
          }
        );
        setListOfProducts(response.data);
      } else {
        // If search string is empty, fetch all products
        fetchProducts();
      }
    } catch (error) {
      console.error("Error searching products:", error);
    }
  };

  // Function to handle search on pressing Enter key
  const handleKeypress = (e: any) => {
    //it triggers by pressing the enter key
    if (e.keyCode === 13) {
      handleSearch();
    }
  };

  return (
    <div>
      <Box alignItems="center" my={4} p={2}>
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
      </Box>
      <ProductList products={listOfProducts} heading={heading}></ProductList>
    </div>
  );
}

export default Home;

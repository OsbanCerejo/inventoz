import { Box, TextField, Select, MenuItem, Button } from "@mui/material";
import axios from "axios";
import React, { useState } from "react";

function SephoraSearch() {
  // State Variables
  const [listOfProducts, setListOfProducts] = useState([]);
  const [searchString, setSearchString] = useState("");
  const [selectedColumn, setSelectedColumn] = useState("");

  // Constants
  const columns = ["Item Name", "Barcode"];
  const columnMap = new Map([
    ["Item Name", "itemName"],
    ["Barcode", "barcode"],
  ]);

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
          "http://localhost:3001/sephora/search",
          {
            params: { searchString, searchType },
          }
        );
        setListOfProducts(response.data);
        console.log("Sephora Search Results: ", response.data);
      }
      // else {
      //     // If search string is empty, fetch all products
      //     fetchProducts();
      //   }
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
    </div>
  );
}

export default SephoraSearch;

import { Box, TextField, Select, MenuItem, Button } from "@mui/material";
import axios from "axios";
import { useState } from "react";

interface SearchProps {
  columnMap: Map<string, string>;
  onSearch: (data: any) => void;
}

function Search({ columnMap, onSearch }: SearchProps) {
  const [searchString, setSearchString] = useState("");
  const [selectedColumn, setSelectedColumn] = useState("");

  const handleSearch = async () => {
    try {
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
        onSearch(response.data);
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
          {Array.from(columnMap.keys()).map((column, index) => (
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

export default Search;

//Eventually move the search functionality from Home.tsx to here

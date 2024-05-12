import axios from "axios";
import { useEffect, useState } from "react";
import ProductList from "../components/ProductList";
import { TextField, Button, Box, MenuItem, Select } from "@mui/material";

// export interface Products {
//   sku: string;
//   brand: string;
//   itemName: string;
//   quantity: number;
//   location: string;
//   sizeOz: number;
//   sizeMl: number;
//   strength: string;
//   shade: string;
//   formulation: string;
//   category: string;
//   type: string;
//   upc: number;
//   batch: string;
//   condition: string;
// }

function Home() {
  const [listOfProducts, setListOfProducts] = useState([]);
  const [searchString, setSearchString] = useState("");
  const [selectedColumn, setSelectedColumn] = useState("");
  let heading = "Products";
  const columns = ["Item Name", "SKU", "Brand", "Location"];
  const columnMap = new Map();
  columnMap.set("Item Name", "itemName");
  columnMap.set("SKU", "sku");
  columnMap.set("Brand", "brand");
  columnMap.set("Location", "location");

  useEffect(() => {
    // console.log("Called Useeffect");
    axios.get("http://localhost:3001/products").then((response) => {
      setListOfProducts(response.data);
    });
  }, []);

  const handleSearch = () => {
    // TODO: Move this to Search.tsx eventually
    console.log("Selected Column ", selectedColumn);
    console.log(columnMap.get(selectedColumn));
    if (searchString.length != 0) {
      axios
        .get("http://localhost:3001/products/search", {
          params: {
            searchString: searchString,
            searchType: columnMap.has(selectedColumn)
              ? columnMap.get(selectedColumn)
              : "itemName",
          },
        })
        .then((response) => {
          console.log("Response after search: ", response.data);
          setListOfProducts(response.data);
        });
    } else {
      // TODO: Fix this to reduce API GET calls and make it so empty string just resets the table state
      axios.get("http://localhost:3001/products").then((response) => {
        setListOfProducts(response.data);
      });
    }
  };
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

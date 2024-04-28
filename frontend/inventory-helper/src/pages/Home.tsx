import axios from "axios";
import { useEffect, useState } from "react";
import ProductList from "../components/ProductList";
import { TextField, Button, Box } from "@mui/material";

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
  const [searchQuery, setSearchQuery] = useState("");
  let heading = "Products";

  useEffect(() => {
    axios.get("http://localhost:3001/products").then((response) => {
      setListOfProducts(response.data);
    });
  }, []);

  const handleSearch = () => {
    // Move this to Search.tsx eventually
    console.log("Clicked Search ", searchQuery);
    if (searchQuery.length != 0) {
      axios
        .get(`http://localhost:3001/products/search/${searchQuery}`)
        .then((response) => {
          // console.log(response.data);
          setListOfProducts(response.data);
        });
    } else {
      // Fix this to reduce API GET calls and make it so empty string just resets the table state
      axios.get("http://localhost:3001/products").then((response) => {
        setListOfProducts(response.data);
      });
    }
  };

  return (
    <div>
      <Box alignItems="center" my={4} p={2}>
        <TextField
          fullWidth
          label="Search Item Name"
          id="fullWidth"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
          }}
        />
        <Button variant="contained" color="success" onClick={handleSearch}>
          Search
        </Button>
      </Box>
      <ProductList products={listOfProducts} heading={heading}></ProductList>
    </div>
  );
}

export default Home;

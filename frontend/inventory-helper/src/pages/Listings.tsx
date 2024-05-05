import { Box, TextField, Button } from "@mui/material";
import axios from "axios";
import { useEffect, useState } from "react";
import ProductList from "../components/ProductList";

function Listings() {
  const [listOfListings, setListOfListings] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  let heading = "Listings";
  useEffect(() => {
    axios.get("http://localhost:3001/listings").then((response) => {
      setListOfListings(response.data);
    });
  }, []);

  const handleSearch = () => {
    // TODO: Move this to Search.tsx eventually
    console.log("Clicked Search ", searchQuery);
    if (searchQuery.length != 0) {
      axios
        .get(`http://localhost:3001/listings/search/${searchQuery}`)
        .then((response) => {
          // console.log(response.data);
          setListOfListings(response.data);
        });
    } else {
      // TODO: Fix this to reduce API GET calls and make it so empty string just resets the table state
      axios.get("http://localhost:3001/listings").then((response) => {
        setListOfListings(response.data);
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
          fullWidth
          label="Search Item Name"
          id="fullWidth"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
          }}
          onKeyDown={handleKeypress}
        />
        <Button variant="contained" color="success" onClick={handleSearch}>
          Search
        </Button>
      </Box>
      <ProductList products={listOfListings} heading={heading}></ProductList>
    </div>
  );
}

export default Listings;

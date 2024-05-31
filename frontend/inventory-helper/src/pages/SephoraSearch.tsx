import {
  Box,
  TextField,
  Select,
  MenuItem,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useState } from "react";

function SephoraSearch() {
  // State Variables
  const [listOfProducts, setListOfProducts] = useState<any>(null);
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
        if (response.data.primaryProduct) {
          setListOfProducts(response.data);
        } else {
          setListOfProducts(null);
        }
        console.log("Sephora Search Results: ", response.data);
      } else {
        setListOfProducts(null);
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
      <p>3360372058878</p>
      <Grid container spacing={0}>
        <Grid item xs={12}>
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
        </Grid>
        {listOfProducts !== null && (
          <Grid item xs={12}>
            <Grid container spacing={0}>
              <Box sx={{ marginBottom: 2 }}>
                <Grid container spacing={1}>
                  <Grid item xs={12}>
                    <Card sx={{ display: "flex" }}>
                      <CardMedia
                        component="img"
                        sx={{ width: 150, objectFit: "contain" }}
                        image={
                          listOfProducts.alternateImages[0].image300 ||
                          listOfProducts.skuImages.image300
                        }
                        alt={listOfProducts.primaryProduct.displayName}
                      />
                      <CardContent
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          width: "100%",
                        }}
                      >
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography component="div" variant="h6">
                            {listOfProducts.primaryProduct.displayName}
                          </Typography>
                          <Typography>
                            ID: {listOfProducts.productId}
                          </Typography>
                          <Typography>Size: {listOfProducts.size}</Typography>
                          <Typography>
                            Title: {listOfProducts.seoTitle}
                          </Typography>
                          <Typography>
                            Description: {listOfProducts.seoMetaDescription}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            </Grid>
          </Grid>
        )}
      </Grid>
    </div>
  );
}

export default SephoraSearch;

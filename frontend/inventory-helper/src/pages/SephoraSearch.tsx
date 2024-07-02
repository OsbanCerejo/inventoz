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
import { useEffect, useState } from "react";

function SephoraSearch() {
  // State Variables
  const [returnedProduct, setReturnedProduct] = useState<any>(null);
  const [productDetails, setProductDetails] = useState<any>(null);
  const [searchString, setSearchString] = useState("");
  const [selectedColumn, setSelectedColumn] = useState("");

  useEffect(() => {
    console.log("Product details in useeffect: ", productDetails);
  }, [productDetails]);

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
          setReturnedProduct(response.data);
          const productId = response.data.productId;
          const skuId = response.data.skuId;
          setProductDetails(getProductDetails(productId, skuId));
          console.log("Product Details : ", productDetails);
        } else {
          setReturnedProduct(null);
        }
        console.log("Sephora Search Results: ", response.data);
      } else {
        setReturnedProduct(null);
      }
    } catch (error) {
      console.error("Error searching products:", error);
    }
  };

  const getProductDetails = async (productId: any, skuId: any) => {
    const responseProductDetails = await axios.get(
      "http://localhost:3001/sephora/getMoreDetails",
      {
        params: { productId, skuId },
      }
    );
    console.log("Product Details in function : ", responseProductDetails.data);
    setProductDetails(responseProductDetails.data);
    return responseProductDetails.data;
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
      <p>3605971618444</p>
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
        {returnedProduct !== null && (
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
                          returnedProduct.alternateImages[0].image300 ||
                          returnedProduct.skuImages.image300
                        }
                        alt={returnedProduct.primaryProduct.displayName}
                      />
                      <CardContent
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          width: "100%",
                        }}
                      >
                        <Box sx={{ flexGrow: 1 }}>
                          <Grid container spacing={0}>
                            <Grid item xs={12}>
                              <Typography component="div" variant="h6">
                                {returnedProduct.primaryProduct.displayName}
                              </Typography>
                            </Grid>
                            <Grid item xs={6} color={"green"}>
                              <Typography>
                                ID: {returnedProduct.productId}
                              </Typography>
                            </Grid>
                            <Grid item xs={6} color={"green"}>
                              <Typography>
                                SKU ID: {returnedProduct.skuId}
                              </Typography>
                            </Grid>
                            <Grid item xs={6} color={"blue"}>
                              <Typography>
                                Size: {returnedProduct.size}
                              </Typography>
                            </Grid>
                            <Grid item xs={6} color={"blue"}>
                              <Typography>
                                Price: {returnedProduct.listPrice}
                              </Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography>
                                <strong>Title: </strong>
                                <u>{returnedProduct.seoTitle}</u>
                              </Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography>
                                Description:{" "}
                                {returnedProduct.seoMetaDescription}
                              </Typography>
                            </Grid>
                            <Grid item xs={6} color={"orange"}>
                              <Typography>
                                Star Rating: {returnedProduct.starRatings}
                              </Typography>
                            </Grid>
                            <Grid item xs={6} color={"orange"}>
                              {productDetails &&
                                productDetails.productDetails && (
                                  <Typography>
                                    No. Of Reviews:
                                    {productDetails.productDetails.reviews}
                                  </Typography>
                                )}
                            </Grid>
                          </Grid>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12}>
                    <Card sx={{ display: "flex", padding: 4 }}>
                      {productDetails && productDetails.productDetails && (
                        <div
                          dangerouslySetInnerHTML={{
                            __html:
                              productDetails.productDetails.longDescription,
                          }}
                        />
                      )}
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

import React from "react";
import { Box, Grid, Typography } from "@mui/material";
import Barcode from "./Barcode";
import ScienceIcon from "@mui/icons-material/Science";
import CancelIcon from "@mui/icons-material/Cancel";

// Define the type for the 'product' prop
type ProductType = {
  itemName: string;
  brand: string;
  location: string;
  strength: string;
  condition: string;
  shade: string;
  sizeOz: string;
  sku: string;
  quantity: string;
};

type ProductDetailsType = {
  tester: boolean;
  discontinued: boolean;
};

// Utility function to dynamically adjust font size
const getFontSize = (text: string, maxWidth: number, initialSize: number) => {
  let size = initialSize;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (context) {
    context.font = `${size}px Arial`;
    while (context.measureText(text).width >= maxWidth) {
      size -= 1;
      context.font = `${size}px Arial`;
    }
  }
  return size;
};

// Use the defined type for the 'product' prop
const PrintableLabel = React.forwardRef<
  HTMLDivElement,
  { product: ProductType; productDetails: ProductDetailsType }
>(({ product, productDetails }, ref) => {
  const maxWidth = 6 * 96; // 6 inches in pixels at 96 DPI

  const brandFontSize = getFontSize(product.brand, maxWidth, 50);
  const itemNameFontSize = getFontSize(
    product.itemName,
    (maxWidth * 8) / 12,
    30
  );
  const locationFontSize = getFontSize(
    product.location,
    (maxWidth * 4) / 12,
    30
  );
  const sizeOzFontSize = getFontSize(product.sizeOz, maxWidth / 3, 25);
  const quantityFontSize = getFontSize(product.quantity, maxWidth / 3, 25);

  return (
    <Box
      ref={ref}
      style={{
        width: "6in",
        height: "4in",
        padding: "10px",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Grid container spacing={0} style={{ flex: "1 1 auto" }}>
        <Grid item xs={12}>
          <Typography
            variant="h3"
            align="center"
            style={{
              fontWeight: "bold",
              fontSize: brandFontSize,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            <u>{product.brand}</u>
          </Typography>
        </Grid>
        <Grid item xs={8}>
          <Typography
            variant="h4"
            align="left"
            style={{
              fontSize: itemNameFontSize,
              // whiteSpace: "nowrap",
            }}
          >
            {product.itemName}
            <br />
            {product.strength} &nbsp;
            {product.shade}
          </Typography>
        </Grid>
        <Grid item xs={4}>
          <Typography
            variant="h4"
            align="right"
            style={{
              fontSize: locationFontSize,
              whiteSpace: "nowrap",
            }}
          >
            [{product.location}]
          </Typography>
        </Grid>
        <Grid item xs={2}>
          {productDetails.tester && (
            <Box>
              <ScienceIcon sx={{ color: "red", fontSize: 30 }} />
              Tester
              <br></br>
              <br></br>
            </Box>
          )}

          {productDetails.discontinued && (
            <Box>
              <CancelIcon sx={{ color: "purple", fontSize: 30 }} />
              Discontinued
            </Box>
          )}
        </Grid>
        <Grid item xs={10}>
          <Box display="flex" justifyContent="center">
            <Barcode value={product.sku} />
          </Box>
        </Grid>
      </Grid>
      <Grid container spacing={0} style={{ marginTop: "auto" }}>
        <Grid item xs={4}>
          <Typography
            variant="h6"
            style={{
              textAlign: "left",
              fontSize: sizeOzFontSize,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {product.condition} : {product.sizeOz} oz
          </Typography>
        </Grid>
        <Grid item xs={4}>
          <Typography
            variant="subtitle1"
            style={{ textAlign: "left" }}
          ></Typography>
        </Grid>
        <Grid item xs={4}>
          <Typography
            variant="h6"
            style={{
              textAlign: "right",
              fontSize: quantityFontSize,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            pcs
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );
});

export default PrintableLabel;

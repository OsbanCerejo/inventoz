import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Paper,
  Tooltip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import SellIcon from "@mui/icons-material/Sell";
import ScienceIcon from "@mui/icons-material/Science";
import CancelIcon from "@mui/icons-material/Cancel";
import { toast } from "react-toastify";
import Barcode from "./Barcode";
import PrintableLabel from "./PrintableLabel";
import { useReactToPrint } from "react-to-print";

function Product() {
  let { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [productObject, setProductObject]: any = useState({});
  const [barcodeValue, setBarcodeValue] = useState(productObject.sku);
  const [productDetails, setProductDetails]: any = useState({});
  const [productListings, setProductListings]: any = useState({});
  const labelRef = useRef<HTMLDivElement>(null);
  const [restockDialogOpen, setRestockDialogOpen] = useState(false);
  const [restockQuantity, setRestockQuantity] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Reset states before fetching new data
        setProductObject({});
        setProductDetails({});
        setProductListings({});

        const { data: product } = await axios.get(
          `http://${import.meta.env.VITE_SERVER_IP}:${
            import.meta.env.VITE_SERVER_PORT
          }/products/byId/${id}?nocache=${Date.now()}`
        );
        setProductObject(product);
        setBarcodeValue(product.sku);
        const { data: details } = await axios.get(
          `http://${import.meta.env.VITE_SERVER_IP}:${
            import.meta.env.VITE_SERVER_PORT
          }/productDetails/bySku?nocache=${Date.now()}`,
          {
            params: { sku: product.sku },
          }
        );
        setProductDetails(details);
        const { data: listings } = await axios.get(
          `http://${import.meta.env.VITE_SERVER_IP}:${
            import.meta.env.VITE_SERVER_PORT
          }/listings/bySku?nocache=${Date.now()}`,
          {
            params: { sku: product.sku },
          }
        );
        setProductListings(listings);
      } catch (error) {
        console.error("Error fetching product data:", error);
      }
    };

    // If coming back from the edit page, update state instead of refetching
    if (location.state?.updatedProduct) {
      setProductObject(location.state.updatedProduct);
      setProductDetails(location.state.updatedDetails || {});
      setProductListings(location.state.updatedListings || {});
      setBarcodeValue(location.state.updatedProduct.sku);
    } else {
      fetchData(); // Fetch only if no updated product is passed
    }
  }, [id, location.state]);

  // Handle the edit button click and redirect with the product to edit page
  const handleEditOnClick = useCallback(() => {
    if (
      !productObject.verified ||
      window.confirm("This is a verified entry. Do you want to edit?")
    ) {
      navigate("/editProduct", {
        state: { productObject, productDetails, productListings },
      });
    }
  }, [navigate, productObject, productDetails, productListings]);

  // Function to handle product deletion with password confirmation
  const handleDeleteClick = useCallback(async () => {
    const passwordToDelete = prompt("Enter Password to delete");

    if (passwordToDelete === "1080") {
      try {
        await axios.delete(
          `http://${import.meta.env.VITE_SERVER_IP}:${
            import.meta.env.VITE_SERVER_PORT
          }/products/delete/${productObject.sku}`
        );
        toast.success("Deleted Successfully!", { position: "top-right" });
        await axios.post(
          `http://${import.meta.env.VITE_SERVER_IP}:${
            import.meta.env.VITE_SERVER_PORT
          }/logs/addLog`,
          {
            timestamp: new Date().toISOString(),
            type: "Delete Product",
            metaData: {
              productObject,
              productDetails,
            }, // Log the details of the deleted product
          }
        );
        navigate("/", { state: { clearFilters: true } });
      } catch (error) {
        console.error("Error deleting the product:", error);
        toast.error("Failed to delete the product.", { position: "top-right" });
      }
    } else {
      toast.error("Incorrect password. Please Try Again.", {
        position: "top-right",
      });
    }
  }, [navigate, productObject]);

  const handleInboundClick = useCallback(() => {
    navigate("/inbound", { state: { productObject } });
  }, [navigate, productObject]);

  const handleCopyBarcodeClick = useCallback(() => {
    const barcodeCanvas =
      document.querySelector<HTMLCanvasElement>(".barcode-canvas");

    if (barcodeCanvas) {
      barcodeCanvas.toBlob((blob) => {
        if (blob) {
          const item = new ClipboardItem({ "image/png": blob });
          navigator.clipboard.write([item]);
          toast.success("Barcode image copied to clipboard!", {
            position: "top-right",
          });
        } else {
          toast.error("Failed to copy the barcode image.", {
            position: "top-right",
          });
        }
      });
    } else {
      console.error("Barcode canvas not found.");
    }
  }, []);

  const handlePrintClick = useReactToPrint({
    content: () => labelRef.current,
    documentTitle: `Label-${productObject.sku}`,
  });

  const handleAddSimilar = () => {
    navigate("/addProduct", {
      state: {
        productObject: {
          ...productObject,
          sku: "", // Clear SKU for new product
          quantity: "", // Clear quantity for new product
          location: "", // Clear location for new product
        },
        productDetails,
      },
    });
  };

  const handleSalesClick = useCallback(() => {
    navigate("/sales", { state: { productObject } });
  }, [navigate, productObject]);

  const handleOutOfStockClick = useCallback(async () => {
    try {
      const response = await axios.post(
        `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/ebayAPI/updateQuantity`,
        {
          sku: productObject.sku,
          quantity: 0,
        }
      );

      if (response.data) {
        toast.success("Product marked as out of stock on eBay!", { position: "top-right" });
      }
    } catch (error) {
      console.error("Error marking product as out of stock:", error);
      toast.error("Failed to mark product as out of stock", { position: "top-right" });
    }
  }, [productObject.sku]);

  const handleRestockClick = useCallback(async () => {
    try {
      const response = await axios.post(
        `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/ebayAPI/updateQuantity`,
        {
          sku: productObject.sku,
          quantity: restockQuantity,
        }
      );

      if (response.data) {
        toast.success("Product quantity updated on eBay!", { position: "top-right" });
      }
    } catch (error) {
      console.error("Error updating product quantity on eBay:", error);
      toast.error("Failed to update product quantity on eBay", { position: "top-right" });
    }
  }, [productObject.sku, restockQuantity]);

  return (
    <div className="product-container">
      <Paper
        sx={{
          my: { xs: 1, md: 4 },
          p: { xs: 4, md: 4 },
          height: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Grid container spacing={0} sx={{ flex: 1, overflow: "auto" }}>
          <Grid item xs={4} sx={{ height: "100%" }}>
            <Box
              p={2}
              display="flex"
              justifyContent="center"
              sx={{ height: "100%", width: "100%" }}
            >
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "auto",
                  p: 2,
                }}
              >
                <CardContent
                  sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "auto",
                  }}
                >
                  <Typography variant="h6" gutterBottom align="center">
                    <strong>
                      <u>Product Details</u>
                    </strong>
                  </Typography>
                  <br></br>
                  {[
                    ["SKU", productObject.sku],
                    ["Brand", productObject.brand],
                    ["Item Name", productObject.itemName],
                    ["Strength", productObject.strength],
                    ["Shade / Variant", productObject.shade],
                    [
                      "Size",
                      `${productObject.sizeOz} oz. / ${productObject.sizeMl} ml`,
                    ],
                    ["Category", productObject.category],
                    ["Type", productObject.type],
                    ["Condition", productObject.condition],
                    ["Period After Opening (PAO)", productDetails.pao],
                    ["UPC", productObject.upc],
                  ].map(([label, value]) => (
                    <Box
                      key={label}
                      display="flex"
                      justifyContent="space-between"
                      py={1}
                    >
                      <Typography variant="body1" fontWeight="bold">
                        {label}:
                      </Typography>
                      <Typography variant="body1">{value}</Typography>
                    </Box>
                  ))}
                  <br></br>
                  {productDetails.tester && (
                    <Box>
                      <ScienceIcon sx={{ color: "red", fontSize: 40 }} />
                      <p>Tester</p>
                    </Box>
                  )}
                  {productDetails.discontinued && (
                    <Box>
                      <CancelIcon sx={{ color: "purple", fontSize: 40 }} />
                      <p>Discontinued</p>
                    </Box>
                  )}
                  <button onClick={handleAddSimilar}>Add Similar</button>
                </CardContent>
              </Card>
            </Box>
          </Grid>
          <Grid item xs={4} sx={{ height: "100%" }}>
            <Box
              p={2}
              display="flex"
              justifyContent="center"
              sx={{ height: "100%", width: "100%" }}
            >
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "auto",
                  mx: 4,
                  p: 2,
                }}
              >
                <CardContent
                  sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Typography variant="h6" gutterBottom align="center">
                    <strong>
                      <u>Warehouse Details</u>
                    </strong>
                  </Typography>
                  <br></br>
                  {[
                    ["Location", productObject.location],
                    ["Quantity Available", productObject.quantity],
                  ].map(([label, value]) => (
                    <Box
                      key={label}
                      display="flex"
                      justifyContent="space-between"
                      py={1}
                    >
                      <Typography variant="body1" fontWeight="bold">
                        {label}:
                      </Typography>
                      <Typography variant="body1">{value}</Typography>
                    </Box>
                  ))}
                  <strong>Listed Quantity</strong>
                  {productObject.listed && (
                    <>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        py={1}
                        style={{
                          backgroundColor: "#EE66A6",
                        }}
                      >
                        B4L: {productListings.ebayBuy4LessToday} <br />
                      </Box>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        py={1}
                        style={{
                          backgroundColor: "#FFEB55",
                        }}
                      >
                        OLL: {productListings.ebayOneLifeLuxuries4}
                        <br />
                      </Box>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        py={1}
                        style={{
                          backgroundColor: "#0071ce",
                        }}
                      >
                        Walmart: {productListings.walmartOneLifeLuxuries}
                        <br />
                      </Box>
                      <br />
                      <strong>Warehouse Location</strong>
                      <Box display="flex" justifyContent="space-between" py={1}>
                        {productObject.warehouseLocations}
                      </Box>
                    </>
                  )}
                  {!productObject.listed && (
                    <strong style={{ backgroundColor: "skyblue" }}>
                      NOT LISTED
                    </strong>
                  )}
                </CardContent>
              </Card>
            </Box>
          </Grid>
          <Grid item xs={4} sx={{ display: "flex", flexDirection: "column" }}>
            <Box
              border={1}
              sx={{
                flex: 0.8,
                display: "flex",
                flexDirection: "column",
                overflow: "auto",
              }}
            >
              <img src={productObject.image} height="auto" />
            </Box>

            <Box
              p={4}
              sx={{
                flex: 0.2,
                display: "flex",
                flexDirection: "column",
                cursor: "pointer",
              }}
            >
              <Barcode value={barcodeValue} />
            </Box>
          </Grid>
        </Grid>
        <Box mt={2} display="flex" justifyContent="center" gap={1}>
          <Button
            variant="contained"
            color="success"
            startIcon={<EditIcon />}
            onClick={handleEditOnClick}
          >
            Edit
          </Button>
          <Button
            variant="contained"
            startIcon={<SellIcon />}
            onClick={handlePrintClick}
          >
            Print Label
          </Button>
          <div style={{ display: "none" }}>
            <PrintableLabel
              ref={labelRef}
              product={productObject}
              productDetails={productDetails}
            />
          </div>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<WarehouseIcon />}
            onClick={handleInboundClick}
          >
            Inbound
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDeleteClick}
          >
            Delete
          </Button>
          <Button
            variant="contained"
            startIcon={<SellIcon />}
            onClick={handleSalesClick}
          >
            Sold
          </Button>
          <Button
            variant="contained"
            color="warning"
            startIcon={<SellIcon />}
            onClick={handleOutOfStockClick}
          >
            Out of Stock
          </Button>
          <Button
            variant="contained"
            color="info"
            startIcon={<WarehouseIcon />}
            onClick={() => setRestockDialogOpen(true)}
          >
            Restock
          </Button>
        </Box>
      </Paper>
      <Dialog
        open={restockDialogOpen}
        onClose={() => setRestockDialogOpen(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{"Restock Product"}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Quantity"
            type="number"
            fullWidth
            value={restockQuantity}
            onChange={(e) => setRestockQuantity(Number(e.target.value))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestockDialogOpen(false)}>Cancel</Button>
          <Button onClick={() => {
            handleRestockClick();
            setRestockDialogOpen(false);
          }}>Restock</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default Product;

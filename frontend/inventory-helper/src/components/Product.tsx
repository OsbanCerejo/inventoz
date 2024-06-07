import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
} from "@mui/material";
import { Container } from "@mui/system";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SellIcon from "@mui/icons-material/Sell";
import { toast } from "react-toastify";
import Barcode from "./Barcode";

function Product() {
  let { id } = useParams();
  const navigate = useNavigate();
  const [productObject, setProductObject]: any = useState({});
  const [barcodeValue, setBarcodeValue] = useState(productObject.sku);
  const [productDetails, setProductDetails]: any = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: product } = await axios.get(
          `http://localhost:3001/products/byId/${id}`
        );
        setProductObject(product);
        setBarcodeValue(product.sku);
        const { data: details } = await axios.get(
          "http://localhost:3001/productDetails/bySku",
          {
            params: { sku: product.sku },
          }
        );
        setProductDetails(details);
      } catch (error) {
        console.error("Error fetching product data:", error);
      }
    };

    fetchData();
  }, [id]);

  // Handle the edit button click and redirect with the product to edit page
  const handleEditOnClick = useCallback(() => {
    if (
      !productObject.verified ||
      window.confirm("This is a verified entry. Do you want to edit?")
    ) {
      navigate("/editProduct", { state: { productObject, productDetails } });
    }
  }, [navigate, productObject, productDetails]);

  // Function to handle product deletion with password confirmation
  const handleDeleteClick = useCallback(async () => {
    const passwordToDelete = prompt("Enter Password to delete");

    if (passwordToDelete === "1998") {
      try {
        await axios.delete(
          `http://localhost:3001/products/delete/${productObject.sku}`
        );
        toast.success("Deleted Successfully!", { position: "top-right" });
        navigate("/");
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

  const handleSalesClick = useCallback(() => {
    navigate("/sales", { state: { productObject } });
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

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={4} border={1}>
        {/* Red Box: Buttons */}

        {/* Yellow Box: Barcode */}
        <Grid item xs={12} md={6} border={1} borderColor="green">
          <Box border={1} p={2} display="flex" justifyContent="center">
            <Barcode value={barcodeValue} />
          </Box>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopyBarcodeClick}
            sx={{ mx: 1 }}
          >
            Copy
          </Button>
        </Grid>

        {/* Green Box: Product Details */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Product Details
              </Typography>
              {[
                ["SKU", productObject.sku],
                ["Brand", productObject.brand],
                ["Item Name", productObject.itemName],
                ["Strength", productObject.strength],
                ["Shade", productObject.shade],
                ["Quantity", productObject.quantity],
                ["Location", productObject.location],
                [
                  "Size",
                  `${productObject.sizeOz} oz. / ${productObject.sizeMl} ml`,
                ],
                ["Category", productObject.category],
                ["Type", productObject.type],
                ["Condition", productObject.condition],
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
            </CardContent>
          </Card>
        </Grid>

        {/* Blue Box: Space for Future Images */}
        <Grid item xs={12} md={6}>
          <Box
            border={1}
            p={2}
            height="100%"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Typography variant="body1" color="textSecondary">
              Future images of the product will be displayed here.
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} md={6} border={1} borderColor="red">
          <Box display="flex" justifyContent="space-between" mb={2}>
            <Button
              variant="contained"
              color="success"
              startIcon={<EditIcon />}
              onClick={handleEditOnClick}
              sx={{ mx: 1 }}
            >
              Edit
            </Button>
            <Button
              variant="contained"
              startIcon={<SellIcon />}
              onClick={handleSalesClick}
              sx={{ mx: 1 }}
            >
              Sales
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<WarehouseIcon />}
              onClick={handleInboundClick}
              sx={{ mx: 1 }}
            >
              Inbound
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteClick}
              sx={{ mx: 1 }}
            >
              Delete
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}

export default Product;

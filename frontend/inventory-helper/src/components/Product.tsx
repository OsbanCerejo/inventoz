import {
  Box,
  Button,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { Container } from "@mui/system";
import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import SellIcon from "@mui/icons-material/Sell";
import { toast } from "react-toastify";

function Product() {
  let { id } = useParams();
  const navigate = useNavigate();
  const [productObject, setProductObject]: any = useState({});

  useEffect(() => {
    axios.get(`http://localhost:3001/products/byId/${id}`).then((response) => {
      setProductObject(response.data);
    });
  }, []);

  // Handle the edit button click and redirect with the product to edit page
  const handleEditOnClick = () => {
    if (
      !productObject.verified ||
      confirm("This is a verified entry. Do you want to edit?")
    ) {
      navigate("/editProduct", { state: { productObject } });
    }
  };

  // Function to handle product deletion with password confirmation
  const handleDeleteClick = () => {
    // Prompt the user to enter the password for deletion
    const passwordToDelete = prompt("Enter Password to delete");

    // Check if the entered password is correct
    if (passwordToDelete === "1998") {
      console.log("Deleting...");

      // Make a DELETE request to the server to delete the product
      try {
        axios
          .delete(`http://localhost:3001/products/delete/${productObject.sku}`)
          .then(() => {
            toast.success("Deleted Succesfully!", {
              position: "top-right",
            });
            navigate("/");
          });
      } catch (error: any) {
        // Handle any errors that occur during the deletion request
        console.error("Error deleting the product:", error);

        // Show error notification
        toast.error("Failed to delete the product.", {
          position: "top-right",
        });
      }
    } else {
      // If the password is incorrect, show an error notification
      toast.error("Incorrect password. Please Try Again.", {
        position: "top-right",
      });
    }
  };

  const handleInboundClick = () => {
    navigate("/inbound", { state: { productObject } });
  };

  const handleSalesClick = () => {
    navigate("/sales", { state: { productObject } });
  };
  return (
    <Container>
      <Grid container border={1} spacing={0} justifyContent="center">
        <Grid item xs={8} border={1}>
          <Container>
            <TableContainer component={Paper}>
              <Table sx={{ minWidth: 650 }} aria-label="simple table">
                <TableHead>
                  <TableRow>
                    <TableCell>SKU</TableCell>
                    <TableCell align="right">{productObject.sku}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Brand</TableCell>
                    <TableCell align="right">{productObject.brand}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Item Name</TableCell>
                    <TableCell align="right">
                      {productObject.itemName}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Strength</TableCell>
                    <TableCell align="right">
                      {productObject.strength}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Shade</TableCell>
                    <TableCell align="right">{productObject.shade}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Quantity</TableCell>
                    <TableCell align="right">
                      {productObject.quantity}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Location</TableCell>
                    <TableCell align="right">
                      {productObject.location}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Size</TableCell>
                    <TableCell align="right">
                      {productObject.sizeOz} oz. / {productObject.sizeMl} ml
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">
                      {productObject.category}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">{productObject.type}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Condition</TableCell>
                    <TableCell align="right">
                      {productObject.condition}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody></TableBody>
              </Table>
            </TableContainer>
          </Container>
        </Grid>
        <Grid item xs={4} border={1}>
          <Grid item xs={12} border={1} m={1} p={1}>
            <Container>
              <Paper
                variant="outlined"
                sx={{ my: { xs: 2, md: 3 }, p: { xs: 1, md: 4 } }}
              >
                abc
              </Paper>
            </Container>
          </Grid>
        </Grid>
        {/* <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} aria-label="simple table">
            <TableHead>
              <TableRow>
                <TableCell>SKU</TableCell>
                <TableCell align="right">{productObject.sku}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Brand</TableCell>
                <TableCell align="right">{productObject.brand}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Item Name</TableCell>
                <TableCell align="right">{productObject.itemName}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Strength</TableCell>
                <TableCell align="right">{productObject.strength}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Shade</TableCell>
                <TableCell align="right">{productObject.shade}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Quantity</TableCell>
                <TableCell align="right">{productObject.quantity}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Location</TableCell>
                <TableCell align="right">{productObject.location}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Size</TableCell>
                <TableCell align="right">
                  {productObject.sizeOz} oz. / {productObject.sizeMl} ml
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Category</TableCell>
                <TableCell align="right">{productObject.category}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell align="right">{productObject.type}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>UPC</TableCell>
                <TableCell align="right">{productObject.upc}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Batch</TableCell>
                <TableCell align="right">{productObject.batch}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Condition</TableCell>
                <TableCell align="right">{productObject.condition}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody></TableBody>
          </Table>
        </TableContainer> */}
        <Box display="flex" alignItems="center">
          <Grid container spacing={0} justifyContent="center">
            <Grid item xs={3}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  p: 1,
                  m: 1,
                }}
              >
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<EditIcon />}
                  onClick={handleEditOnClick}
                >
                  Edit
                </Button>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  p: 1,
                  m: 1,
                }}
              >
                <Button
                  variant="contained"
                  startIcon={<SellIcon />}
                  onClick={handleSalesClick}
                >
                  Sales
                </Button>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  p: 1,
                  m: 1,
                }}
              >
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<WarehouseIcon />}
                  onClick={handleInboundClick}
                >
                  Inbound
                </Button>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  p: 1,
                  m: 1,
                }}
              >
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleDeleteClick}
                >
                  Delete
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Grid>
    </Container>
  );
}

export default Product;

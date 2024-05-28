import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
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
import Barcode from "./Barcode";

function Product() {
  let { id } = useParams();
  const navigate = useNavigate();
  const [productObject, setProductObject]: any = useState({});
  const [barcodeValue, setBarcodeValue] = useState(productObject.sku);

  useEffect(() => {
    axios.get(`http://localhost:3001/products/byId/${id}`).then((response) => {
      setProductObject(response.data);
      setBarcodeValue(response.data.sku);
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
    // <Container>
    //   <Grid container border={1} spacing={0} justifyContent="center">
    //     <Grid item xs={6} border={1}>
    //       <Container>
    //         <TableContainer component={Paper}>
    //           <Table sx={{ minWidth: 100 }} aria-label="simple table">
    //             <TableHead>
    //               <TableRow>
    //                 <TableCell>SKU</TableCell>
    //                 <TableCell align="right">{productObject.sku}</TableCell>
    //               </TableRow>
    //               <TableRow>
    //                 <TableCell>Brand</TableCell>
    //                 <TableCell align="right">{productObject.brand}</TableCell>
    //               </TableRow>
    //               <TableRow>
    //                 <TableCell>Item Name</TableCell>
    //                 <TableCell align="right">
    //                   {productObject.itemName}
    //                 </TableCell>
    //               </TableRow>
    //               <TableRow>
    //                 <TableCell>Strength</TableCell>
    //                 <TableCell align="right">
    //                   {productObject.strength}
    //                 </TableCell>
    //               </TableRow>
    //               <TableRow>
    //                 <TableCell>Shade</TableCell>
    //                 <TableCell align="right">{productObject.shade}</TableCell>
    //               </TableRow>
    //               <TableRow>
    //                 <TableCell>Quantity</TableCell>
    //                 <TableCell align="right">
    //                   {productObject.quantity}
    //                 </TableCell>
    //               </TableRow>
    //               <TableRow>
    //                 <TableCell>Location</TableCell>
    //                 <TableCell align="right">
    //                   {productObject.location}
    //                 </TableCell>
    //               </TableRow>
    //               <TableRow>
    //                 <TableCell>Size</TableCell>
    //                 <TableCell align="right">
    //                   {productObject.sizeOz} oz. / {productObject.sizeMl} ml
    //                 </TableCell>
    //               </TableRow>
    //               <TableRow>
    //                 <TableCell>Category</TableCell>
    //                 <TableCell align="right">
    //                   {productObject.category}
    //                 </TableCell>
    //               </TableRow>
    //               <TableRow>
    //                 <TableCell>Type</TableCell>
    //                 <TableCell align="right">{productObject.type}</TableCell>
    //               </TableRow>
    //               <TableRow>
    //                 <TableCell>Condition</TableCell>
    //                 <TableCell align="right">
    //                   {productObject.condition}
    //                 </TableCell>
    //               </TableRow>
    //             </TableHead>
    //             <TableBody></TableBody>
    //           </Table>
    //         </TableContainer>
    //       </Container>
    //     </Grid>
    //     <Grid item xs={6} border={1}>
    //       <Grid item xs={12} border={1} m={1} p={0}>
    //         <Container>
    //           <Barcode value={barcodeValue} />
    //         </Container>
    //       </Grid>
    //     </Grid>
    //     <Box display="flex" alignItems="center">
    //       <Grid container spacing={0} justifyContent="center">
    //         <Grid item xs={3}>
    //           <Box
    //             sx={{
    //               display: "flex",
    //               justifyContent: "center",
    //               p: 1,
    //               m: 1,
    //             }}
    //           >
    //             <Button
    //               variant="contained"
    //               color="success"
    //               startIcon={<EditIcon />}
    //               onClick={handleEditOnClick}
    //             >
    //               Edit
    //             </Button>
    //           </Box>
    //         </Grid>
    //         <Grid item xs={3}>
    //           <Box
    //             sx={{
    //               display: "flex",
    //               justifyContent: "center",
    //               p: 1,
    //               m: 1,
    //             }}
    //           >
    //             <Button
    //               variant="contained"
    //               startIcon={<SellIcon />}
    //               onClick={handleSalesClick}
    //             >
    //               Sales
    //             </Button>
    //           </Box>
    //         </Grid>
    //         <Grid item xs={3}>
    //           <Box
    //             sx={{
    //               display: "flex",
    //               justifyContent: "center",
    //               p: 1,
    //               m: 1,
    //             }}
    //           >
    //             <Button
    //               variant="contained"
    //               color="secondary"
    //               startIcon={<WarehouseIcon />}
    //               onClick={handleInboundClick}
    //             >
    //               Inbound
    //             </Button>
    //           </Box>
    //         </Grid>
    //         <Grid item xs={3}>
    //           <Box
    //             sx={{
    //               display: "flex",
    //               justifyContent: "center",
    //               p: 1,
    //               m: 1,
    //             }}
    //           >
    //             <Button
    //               variant="contained"
    //               color="error"
    //               startIcon={<DeleteIcon />}
    //               onClick={handleDeleteClick}
    //             >
    //               Delete
    //             </Button>
    //           </Box>
    //         </Grid>
    //       </Grid>
    //     </Box>
    //   </Grid>
    // </Container>

    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={4} border={1}>
        {/* Red Box: Buttons */}

        {/* Yellow Box: Barcode */}
        <Grid item xs={12} md={6} border={1} borderColor="green">
          <Box border={1} p={2} display="flex" justifyContent="center">
            <Barcode value={barcodeValue} />
          </Box>
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

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

function Product() {
  let { id } = useParams();
  const navigate = useNavigate();
  const [productObject, setProductObject]: any = useState({});
  useEffect(() => {
    axios.get(`http://localhost:3001/products/byId/${id}`).then((response) => {
      setProductObject(response.data);
    });
  }, []);

  const handleEditOnClick = () => {
    console.log("Sending Product Object", productObject);
    navigate("/editProduct", { state: { productObject } });
  };

  const handleDeleteClick = () => {
    console.log("Deleting...");
    axios.delete(`http://localhost:3001/products/delete/${productObject.sku}`);
    console.log("Deleted");
    navigate("/");
  };
  return (
    // <div>
    //   <div>SKU: {productObject.sku}</div>
    //   <div>{productObject.brand}</div>
    //   <div>{productObject.itemName}</div>
    //   <div>{productObject.category}</div>
    //   <div>{productObject.quantity}</div>
    //   <div>{productObject.location}</div>
    //   <div>{productObject.condition}</div>
    // </div>
    <Container>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>SKU</TableCell>
              <TableCell align="right">{productObject.sku}</TableCell>
              {/* <TableCell>
                <Button>Edit</Button>
              </TableCell> */}
            </TableRow>
            <TableRow>
              <TableCell>Brand</TableCell>
              <TableCell align="right">{productObject.brand}</TableCell>
              {/* <TableCell>
                <Button>Edit</Button>
              </TableCell> */}
            </TableRow>
            <TableRow>
              <TableCell>Item Name</TableCell>
              <TableCell align="right">{productObject.itemName}</TableCell>
              {/* <TableCell>
                <Button>Edit</Button>
              </TableCell> */}
            </TableRow>
            <TableRow>
              <TableCell>Strength</TableCell>
              <TableCell align="right">{productObject.strength}</TableCell>
              {/* <TableCell>
                <Button>Edit</Button>
              </TableCell> */}
            </TableRow>
            <TableRow>
              <TableCell>Shade</TableCell>
              <TableCell align="right">{productObject.shade}</TableCell>
              {/* <TableCell>
                <Button>Edit</Button>
              </TableCell> */}
            </TableRow>
            <TableRow>
              <TableCell>Quantity</TableCell>
              <TableCell align="right">{productObject.quantity}</TableCell>
              {/* <TableCell>
                <Button>Edit</Button>
              </TableCell> */}
            </TableRow>
            <TableRow>
              <TableCell>Location</TableCell>
              <TableCell align="right">{productObject.location}</TableCell>
              {/* <TableCell>
                <Button>Edit</Button>
              </TableCell> */}
            </TableRow>
            <TableRow>
              <TableCell>Size</TableCell>
              <TableCell align="right">
                {productObject.sizeOz} oz. / {productObject.sizeMl} ml
              </TableCell>
              {/* <TableCell>
                <Button>Edit</Button>
              </TableCell> */}
            </TableRow>
            <TableRow>
              <TableCell>Category</TableCell>
              <TableCell align="right">{productObject.category}</TableCell>
              {/* <TableCell>
                <Button>Edit</Button>
              </TableCell> */}
            </TableRow>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell align="right">{productObject.type}</TableCell>
              {/* <TableCell>
                <Button>Edit</Button>
              </TableCell> */}
            </TableRow>
            <TableRow>
              <TableCell>UPC</TableCell>
              <TableCell align="right">{productObject.upc}</TableCell>
              {/* <TableCell>
                <Button>Edit</Button>
              </TableCell> */}
            </TableRow>
            <TableRow>
              <TableCell>Batch</TableCell>
              <TableCell align="right">{productObject.batch}</TableCell>
              {/* <TableCell>
                <Button>Edit</Button>
              </TableCell> */}
            </TableRow>
            <TableRow>
              <TableCell>Condition</TableCell>
              <TableCell align="right">{productObject.condition}</TableCell>
              {/* <TableCell>
                <Button>Edit</Button>
              </TableCell> */}
            </TableRow>
          </TableHead>
          <TableBody></TableBody>
        </Table>
      </TableContainer>
      <Box display="flex" alignItems="center">
        <Grid container spacing={0} justifyContent="center">
          <Grid item xs={4}>
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
          <Grid item xs={4}>
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
      {/* <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="10vh"
      >
        <Button
          variant="contained"
          color="success"
          startIcon={<EditIcon />}
          onClick={handleEditOnClick}
        >
          Edit
        </Button>
        <Button variant="contained" color="error" startIcon={<DeleteIcon />}>
          Delete
        </Button>
      </Box> */}
    </Container>
  );
}

export default Product;

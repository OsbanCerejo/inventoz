import {
  Box,
  Button,
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
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="10vh"
      >
        <Button variant="contained" color="success" onClick={handleEditOnClick}>
          Edit
        </Button>
      </Box>

      {/* <Card sx={{ maxWidth: 345 }}>
        <CardActionArea>
          <CardMedia
            component="img"
            height="140"
            image=""
            alt="Product Image"
          />
          <CardContent>
            <Typography gutterBottom variant="h5" component="div">
              {productObject.sku}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {productObject.brand}
              <br></br>
              {productObject.itemName}
              <br></br>
              {productObject.category} {productObject.condition}
            </Typography>
          </CardContent>
        </CardActionArea>
        <CardActions>
          <Button size="small" color="primary">
            Edit
          </Button>
        </CardActions>
      </Card> */}
    </Container>
  );
}

export default Product;

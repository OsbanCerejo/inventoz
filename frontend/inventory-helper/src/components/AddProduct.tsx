import axios from "axios";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import Button from "@mui/material/Button";
import { TextField } from "@mui/material";

function AddProduct() {
  const initialValues = {
    sku: "",
    brand: "",
    itemName: "",
    quantity: "",
    location: "",
    sizeOz: "",
    sizeMl: "",
    strength: "",
    shade: "",
    formulation: "",
    category: "",
    type: "",
    upc: "",
    batch: "",
    condition: "",
  };

  const validationSchema = Yup.object().shape({
    sku: Yup.string().required("Please enter a valid SKU"),
    brand: Yup.string().required(),
    itemName: Yup.string().required(),
    quantity: Yup.string(),
    location: Yup.string(),
    sizeOz: Yup.string(),
    sizeMl: Yup.string(),
    strength: Yup.string(),
    shade: Yup.string(),
    formulation: Yup.string(),
    category: Yup.string().required(),
    type: Yup.string(),
    upc: Yup.string(),
    batch: Yup.string(),
    condition: Yup.string().required(),
  });

  const onSubmit = (data: any) => {
    console.log(data);
    axios.post("http://localhost:3001/products", data).then(() => {
      console.log("Product Inserted");
    });
  };
  return (
    <div>
      <Formik
        initialValues={initialValues}
        onSubmit={onSubmit}
        validationSchema={validationSchema}
      >
        <Form>
          <label>SKU</label>
          <ErrorMessage name="sku" component="span"></ErrorMessage>
          <TextField
            label="Enter SKU"
            variant="standard"
            id=""
            name="sku"
          ></TextField>
          <br></br>
          <ErrorMessage name="brand" component="span"></ErrorMessage>
          <label>Brand</label>
          <Field id="" name="brand" placeholder="Enter Brand"></Field>
          <br></br>
          <label>Item Name</label>
          <Field id="" name="itemName" placeholder="Enter Item Name"></Field>
          <br></br>
          <label>Quantity</label>
          <Field id="" name="quantity" placeholder="Enter Quantity"></Field>
          <br></br>
          <label>Location</label>
          <Field id="" name="location" placeholder="Enter Location"></Field>
          <br></br>
          <label>Size (oz)</label>
          <Field id="" name="sizeOz" placeholder=""></Field>
          <br></br>
          <label>Size (ml/gm)</label>
          <Field id="" name="sizeMl" placeholder=""></Field>
          <br></br>
          <label>Strength</label>
          <Field id="" name="strength" placeholder=""></Field>
          <br></br>
          <label>Shade</label>
          <Field id="" name="shade" placeholder=""></Field>
          <br></br>
          <label>Formulation</label>
          <Field id="" name="formulation" placeholder=""></Field>
          <br></br>
          <label>Category</label>
          <Field id="" name="category" placeholder=""></Field>
          <br></br>
          <label>Type</label>
          <Field id="" name="type" placeholder=""></Field>
          <br></br>
          <label>UPC</label>
          <Field id="" name="upc" placeholder=""></Field>
          <br></br>
          <label>Batch</label>
          <Field id="" name="batch" placeholder=""></Field>
          <br></br>
          <label>Condition</label>
          <Field id="" name="condition" placeholder=""></Field>
          <br></br>
          <Button variant="contained" type="submit">
            Add Product
          </Button>
        </Form>
      </Formik>
    </div>
  );
}

export default AddProduct;

import {
  Container,
  Paper,
  Box,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  Switch,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
} from "@mui/material";
import axios from "axios";
import * as Yup from "yup";
import { useLocation, useNavigate } from "react-router-dom";
import { useFormik } from "formik";
import skuData from "../../../data/skuData.json";

function EditProduct() {
  const location = useLocation();
  const navigate = useNavigate();

  const productObject = location.state.productObject;
  const formikInitialValues = {
    sku: "" + productObject.sku,
    brand: "" + productObject.brand,
    itemName: "" + productObject.itemName,
    quantity: "" + productObject.quantity,
    location: "" + productObject.location,
    sizeOz: "" + productObject.sizeOz,
    sizeMl: "" + productObject.sizeMl,
    strength: "" + productObject.strength,
    shade: "" + productObject.shade,
    formulation: "" + productObject.formulation,
    category: "" + productObject.category,
    type: "" + productObject.type,
    upc: "" + productObject.upc,
    batch: "" + productObject.batch,
    condition: "" + productObject.condition,
    verified: productObject.verified,
    listed: productObject.listed,
    final: productObject.final,
  };

  const formikValidationSchema = Yup.object().shape({
    sku: Yup.string().required("Please enter a valid SKU"),
    brand: Yup.string().required("Please enter a Brand"),
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
    condition: Yup.string(),
    verified: Yup.boolean(),
    listed: Yup.boolean(),
    final: Yup.boolean(),
  });

  const formik = useFormik({
    initialValues: formikInitialValues,
    validationSchema: formikValidationSchema,
    onSubmit: (data) => {
      console.log("Inside EditProduct OnSubmit: ", data);
      axios.put("http://localhost:3001/products", data).then((response) => {
        console.log("Product Updated to : ", response);
      });
      navigate("/");
    },
  });

  return (
    <div>
      <form onSubmit={formik.handleSubmit}>
        <Container component="main" maxWidth="sm" sx={{ mb: 4 }}>
          <Paper
            variant="outlined"
            sx={{ my: { xs: 3, md: 6 }, p: { xs: 2, md: 3 } }}
          >
            Verified
            <Switch
              id="verified"
              name="verified"
              checked={formik.values.verified}
              onChange={formik.handleChange}
              inputProps={{ "aria-label": "controlled" }}
            />
            Listed
            <Switch
              // checked={checked}
              id="listed"
              name="listed"
              checked={formik.values.listed}
              onChange={formik.handleChange}
              inputProps={{ "aria-label": "controlled" }}
            />
            Final
            <Switch
              // checked={checked}
              id="final"
              name="final"
              checked={formik.values.final}
              onChange={formik.handleChange}
              inputProps={{ "aria-label": "controlled" }}
            />
            <br></br>
            <Box m={2} pt={3}>
              SKU : {formik.values.sku}
            </Box>
            <Box m={2} pt={3}>
              <TextField
                fullWidth
                id="brand"
                name="brand"
                label="Brand"
                value={formik.values.brand}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.brand && Boolean(formik.errors.brand)}
                helperText={formik.touched.brand && formik.errors.brand}
              />
            </Box>
            <Box m={2} pt={3}>
              <TextField
                fullWidth
                id="itemName"
                name="itemName"
                label="Item Name"
                value={formik.values.itemName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.itemName && Boolean(formik.errors.itemName)
                }
                helperText={formik.touched.itemName && formik.errors.itemName}
              />
            </Box>
            <Box m={2} pt={3}>
              <TextField
                fullWidth
                id="strength"
                name="strength"
                label="Strength"
                value={formik.values.strength}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.strength && Boolean(formik.errors.strength)
                }
                helperText={formik.touched.strength && formik.errors.strength}
              />
            </Box>
            <Box m={2} pt={3}>
              <TextField
                fullWidth
                id="shade"
                name="shade"
                label="Shade"
                value={formik.values.shade}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.shade && Boolean(formik.errors.shade)}
                helperText={formik.touched.shade && formik.errors.shade}
              />
            </Box>
            <Box m={2} pt={3}>
              <TextField
                fullWidth
                id="quantity"
                name="quantity"
                label="Quantity"
                value={formik.values.quantity}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.quantity && Boolean(formik.errors.quantity)
                }
                helperText={formik.touched.quantity && formik.errors.quantity}
              />
            </Box>
            <Box m={2} pt={3}>
              <TextField
                fullWidth
                id="location"
                name="location"
                label="Location"
                value={formik.values.location}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.location && Boolean(formik.errors.location)
                }
                // helperText={formik.touched.location && formik.errors.location}
              />
            </Box>
            <Box m={2} pt={3}>
              <InputLabel id="categoryLabel">Category</InputLabel>
              <Select
                labelId="categoryLabel"
                id="category"
                name="category"
                fullWidth
                label="Category"
                value={formik.values.category}
                onChange={(event) => {
                  formik.setFieldValue("category", event.target.value);
                  console.log(event.target);
                }}
                input={<OutlinedInput label="Category" />}
              >
                {Object.entries(skuData.CATEGORY).map(([value, key]) => (
                  <MenuItem key={key} value={value}>
                    {value}
                  </MenuItem>
                ))}
              </Select>
            </Box>
            <Box m={2} pt={3}>
              <TextField
                fullWidth
                id="type"
                name="type"
                label="Type"
                value={formik.values.type}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.type && Boolean(formik.errors.type)}
                helperText={formik.touched.type && formik.errors.type}
              />
            </Box>
            <Box m={2} pt={3}>
              <TextField
                fullWidth
                id="upc"
                name="upc"
                label="UPC"
                value={formik.values.upc}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.upc && Boolean(formik.errors.upc)}
                helperText={formik.touched.upc && formik.errors.upc}
              />
            </Box>
            <Box m={2} pt={3}>
              <RadioGroup
                onChange={formik.handleChange}
                value={formik.values.condition}
              >
                <FormControlLabel
                  value="unboxed"
                  control={<Radio />}
                  label="Unboxed"
                  checked={formik.values.condition === "Unboxed"}
                  onChange={() => (formik.values.condition = "Unboxed")}
                />
                <FormControlLabel
                  value="unsealed"
                  control={<Radio />}
                  label="Sealed"
                  checked={formik.values.condition === "Sealed"}
                  onChange={() => (formik.values.condition = "Sealed")}
                />
                <FormControlLabel
                  value="sealed"
                  control={<Radio />}
                  label="Unsealed"
                  checked={formik.values.condition === "Unsealed"}
                  onChange={() => (formik.values.condition = "Unsealed")}
                />
              </RadioGroup>
            </Box>
            <Button color="success" variant="contained" fullWidth type="submit">
              Confirm Edit
            </Button>
          </Paper>
        </Container>
      </form>
    </div>
  );
}

export default EditProduct;

import axios from "axios";
import { useFormik } from "formik";
import * as Yup from "yup";
import Button from "@mui/material/Button";
import {
  Alert,
  Box,
  Container,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Switch,
  TextField,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import dayjs from "dayjs";
import skuData from "../../../data/skuData.json";

function AddProduct() {
  const navigate = useNavigate();
  const [productExists, setProductExists] = useState(false);
  const [generatedSku, setGeneratedSku] = useState("");
  const [skuPrefixCount, setskuPrefixCount] = useState(0);
  const today = new Date();
  const [newDate, setNewDate] = useState(dayjs(today.toLocaleString()));
  const [skuArray, setSkuArray] = useState([
    "*",
    "*",
    "*",
    "-",
    "*",
    "*",
    "-",
    "*",
    "*",
    "-",
    "0000",
  ]);

  const formikInitialValues = {
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
    condition: "Unboxed",
    verified: false,
    inbound: false,
    listed: false,
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
    condition: Yup.string().required(),
    verified: Yup.boolean(),
    inbound: Yup.boolean(),
    listed: Yup.boolean(),
  });

  // const onSubmit = (data: any) => {
  //   console.log(data);
  //   axios.post("http://localhost:3001/products", data).then(() => {
  //     console.log("Product Inserted");
  //   });
  // };

  const formik = useFormik({
    initialValues: formikInitialValues,
    validationSchema: formikValidationSchema,
    onSubmit: (data) => {
      console.log(data);
      axios.post("http://localhost:3001/products", data).then((response) => {
        console.log(response);
        if (response.data === "Already Exists") {
          console.log("Exists");
          setProductExists(true);
        } else if (response.data === "Created New") {
          console.log("New Product");
          setProductExists(false);
          navigate("/");
        }
      });
      if (formik.values.inbound) {
        console.log("Inside if Is inbound");
        const compositeInboundKey =
          data.sku +
          "-" +
          newDate.month() +
          "-" +
          newDate.date() +
          "-" +
          newDate.year();

        const inboundObject = {
          sku: data.sku,
          vendor: "temp vendor", // Implement vendor input field on toggle of inbound in add product
          quantity: data.quantity,
          date: newDate,
          compositeSku: compositeInboundKey,
          //TODO : ADd composite SKU field here
        };
        axios
          .post("http://localhost:3001/inbound", inboundObject)
          .then((response) => {
            console.log(response);
          });
      }
    },
  });

  // var jsonBrandObject = skuData.BRANDS;
  var dataBrandMap = new Map(Object.entries(skuData.BRANDS));
  var dataCategoryMap = new Map(Object.entries(skuData.CATEGORY));
  var brandMap = new Map();
  for (const brand of dataBrandMap) {
    brandMap.set(brand[0].toLowerCase(), brand[1]);
  }
  var categoryMap = new Map();
  for (const category of dataCategoryMap) {
    categoryMap.set(category[0].toLowerCase(), category[1]);
  }

  const generateSku = (fieldValue: string, factor: string) => {
    // console.log(skuBuilder);
    if (factor === "1") {
      if (brandMap.has(fieldValue)) {
        const brandForSku = brandMap.get(fieldValue);
        console.log("brandForSku", brandForSku);

        axios
          .get(`http://localhost:3001/products/findAndCount/${brandForSku}`)
          .then((response) => {
            setskuPrefixCount(response.data);
            skuArray[10] =
              "0".repeat(4 - response.data.toString().length) +
              response.data.toString();
            setGeneratedSku(skuArray.join(""));
          });

        skuArray[0] = brandForSku ? brandForSku.charAt(0) : "@";
        skuArray[1] = brandForSku ? brandForSku.charAt(1) : "@";
        skuArray[2] = brandForSku ? brandForSku.charAt(2) : "@";
      } else {
        skuArray[0] = "*";
        skuArray[1] = "*";
        skuArray[2] = "*";
      }
    } else if (factor === "2") {
      if (categoryMap.has(fieldValue)) {
        const categoryForSku = categoryMap.get(fieldValue);
        console.log("categoryForSku", categoryForSku);
        // skuArray[3] = categoryForSku ? categoryForSku.charAt(0) : "N";
        skuArray[4] = categoryForSku.charAt(0);
        skuArray[5] = categoryForSku.charAt(1);
      } else {
        skuArray[4] = "N";
        skuArray[5] = "A";
      }
    } else if (factor === "3") {
      if (fieldValue === "") {
        skuArray[7] = "N";
        skuArray[8] = "A";
      } else {
        const locationForSku = fieldValue.charAt(0).toUpperCase();
        skuArray[7] = "0";
        skuArray[8] = locationForSku;
      }
    } else {
    }

    setGeneratedSku(skuArray.join(""));
  };

  const handleSkuApprove = () => {
    console.log(generatedSku);
    formik.setFieldValue("sku", generatedSku);
  };

  return (
    <div>
      {productExists && (
        <Alert variant="filled" severity="error">
          Product Already Exists. Try Searching Item Name on Home Page.
        </Alert>
      )}
      <form onSubmit={formik.handleSubmit}>
        <Container component="main" maxWidth="sm" sx={{ mb: 4 }}>
          <Paper
            variant="outlined"
            sx={{ my: { xs: 3, md: 3 }, p: { xs: 1, md: 4 } }}
          >
            Verified
            <Switch
              // checked={checked}
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
            <br></br>
            Inbound
            <Switch
              // checked={checked}
              id="inbound"
              name="inbound"
              checked={formik.values.inbound}
              onChange={formik.handleChange}
              inputProps={{ "aria-label": "controlled" }}
            />
            <br></br>
            <label>Generated SKU : </label> {generatedSku}{" "}
            <Button style={{ float: "right" }} onClick={handleSkuApprove}>
              Approve
            </Button>
            <Box m={2} pt={3}>
              <TextField
                fullWidth
                id="sku"
                name="sku"
                label="SKU"
                value={formik.values.sku}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.sku && Boolean(formik.errors.sku)}
                helperText={formik.touched.sku && formik.errors.sku}
              />
            </Box>
            <Box m={2} pt={3}>
              <TextField
                fullWidth
                id="brand"
                name="brand"
                label="Brand"
                value={formik.values.brand}
                onChange={(event) => {
                  formik.setFieldValue("brand", event.currentTarget.value);
                  generateSku(event.currentTarget.value.toLowerCase(), "1");
                }}
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
                onChange={(event) => {
                  formik.setFieldValue(
                    "location",
                    event.currentTarget.value.toUpperCase()
                  );
                  generateSku(event.currentTarget.value, "3");
                }}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.location && Boolean(formik.errors.location)
                }
                helperText={formik.touched.location && formik.errors.location}
              />
            </Box>
            <Box m={2} pt={3}>
              <TextField
                fullWidth
                id="category"
                name="category"
                label="Category"
                value={formik.values.category}
                onChange={(event) => {
                  formik.setFieldValue("category", event.currentTarget.value);
                  generateSku(event.currentTarget.value.toLowerCase(), "2");
                }}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.category && Boolean(formik.errors.category)
                }
                helperText={formik.touched.category && formik.errors.category}
              />
            </Box>
            <Box m={2} pt={3}>
              <TextField
                fullWidth
                id="upc"
                name="upc"
                label="UPC Code"
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
            <Button color="primary" variant="contained" fullWidth type="submit">
              Submit
            </Button>
          </Paper>
        </Container>
      </form>
    </div>
  );
}

export default AddProduct;

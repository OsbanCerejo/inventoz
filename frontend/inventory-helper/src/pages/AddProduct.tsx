import axios from "axios";
import { useFormik } from "formik";
import * as Yup from "yup";
import Button from "@mui/material/Button";
import {
  Box,
  Container,
  FormControlLabel,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Switch,
  TextField,
} from "@mui/material";
import { useState } from "react";
import dayjs from "dayjs";
import skuData from "../../../data/skuData.json";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function AddProduct() {
  const [generatedSku, setGeneratedSku] = useState("");
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
    "U",
    "B",
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
    batch: "NA",
    condition: "Unboxed",
    verified: false,
    inbound: false,
    listed: false,
    final: false,
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
    final: Yup.boolean(),
  });

  const formik = useFormik({
    initialValues: formikInitialValues,
    validationSchema: formikValidationSchema,
    onSubmit: (data) => {
      console.log(data);
      axios.post("http://localhost:3001/products", data).then((response) => {
        console.log(response);
        if (response.data === "Already Exists") {
          console.log("Exists");
          toast.error("Product Already Exists!", {
            position: "top-right",
          });
        } else if (response.data === "Created New") {
          console.log("New Product");
          toast.success("Product Added!", {
            position: "top-right",
          });
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
          newDate.year() +
          "-" +
          data.batch;

        const inboundObject = {
          sku: data.sku,
          vendor: "temp vendor", // Implement vendor input field on toggle of inbound in add product
          quantity: data.quantity,
          date: newDate,
          batch: data.batch,
          compositeSku: compositeInboundKey,
          //TODO : ADd composite SKU field here
        };
        console.log("Inbound object is : ", inboundObject);
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
  var dataConditionMap = new Map(Object.entries(skuData.CONDITION));
  var brandMap = new Map();
  for (const brand of dataBrandMap) {
    brandMap.set(brand[0].toLowerCase(), brand[1]);
  }
  var categoryMap = new Map();
  for (const category of dataCategoryMap) {
    categoryMap.set(category[0].toLowerCase(), category[1]);
  }
  var conditionMap = new Map();
  for (const condition of dataConditionMap) {
    conditionMap.set(condition[0].toLowerCase(), condition[1]);
  }

  const generateSku = (fieldValue: string, factor: string) => {
    console.log("Generate SKU fieold value", fieldValue);
    if (factor === "1") {
      if (brandMap.has(fieldValue)) {
        const brandForSku = brandMap.get(fieldValue);
        console.log("brandForSku", brandForSku);

        axios
          .get(`http://localhost:3001/products/findAndCount/${brandForSku}`)
          .then((response) => {
            console.log(response.data);
            // let prev = 0;
            // response.data.forEach((row: any) => {
            //   console.log(parseInt(row.sku.split("-")[3]));
            // });
            skuArray[10] =
              "0".repeat(5 - response.data.toString().length) +
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
      if (categoryMap.has(fieldValue.toLowerCase())) {
        const categoryForSku = categoryMap.get(fieldValue.toLowerCase());
        console.log("categoryForSku", categoryForSku);
        // skuArray[3] = categoryForSku ? categoryForSku.charAt(0) : "N";
        skuArray[4] = categoryForSku.charAt(0);
        skuArray[5] = categoryForSku.charAt(1);
      } else {
        skuArray[4] = "N";
        skuArray[5] = "A";
      }
    } else if (factor === "4") {
      console.log("Inside factor 4 : ", fieldValue);
      if (fieldValue === "") {
        skuArray[7] = "N";
        skuArray[8] = "A";
      } else {
        const conditionForSku = conditionMap.get(fieldValue.toLowerCase());
        console.log("Condition for SKU :", conditionForSku);
        skuArray[7] = conditionForSku.charAt(0);
        skuArray[8] = conditionForSku.charAt(1);
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
      <form onSubmit={formik.handleSubmit}>
        <Container component="main" maxWidth="sm" sx={{ mb: 4 }}>
          <Paper
            variant="outlined"
            sx={{ my: { xs: 3, md: 3 }, p: { xs: 1, md: 4 } }}
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
              id="listed"
              name="listed"
              checked={formik.values.listed}
              onChange={formik.handleChange}
              inputProps={{ "aria-label": "controlled" }}
            />
            <br></br>
            Inbound
            <Switch
              id="inbound"
              name="inbound"
              checked={formik.values.inbound}
              onChange={formik.handleChange}
              inputProps={{ "aria-label": "controlled" }}
            />
            Final
            <Switch
              id="final"
              name="final"
              checked={formik.values.final}
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
              <InputLabel id="brandLabel">Brand</InputLabel>
              <Select
                labelId="brandLabel"
                id="brand"
                name="brand"
                fullWidth
                label="Brand"
                value={formik.values.brand}
                onChange={(event) => {
                  formik.setFieldValue("brand", event.target.value);
                  generateSku(event.target.value.toLowerCase(), "1");
                }}
                input={<OutlinedInput label="Brand" />}
              >
                {Object.entries(skuData.BRANDS).map(([value, key]) => (
                  <MenuItem key={key} value={value}>
                    {value}
                  </MenuItem>
                ))}
              </Select>
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
                helperText={formik.touched.location && formik.errors.location}
              />
            </Box>
            <Box m={2} pt={3}>
              <TextField
                fullWidth
                id="sizeOz"
                name="sizeOz"
                label="Size in Oz."
                value={formik.values.sizeOz}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.sizeOz && Boolean(formik.errors.sizeOz)}
                helperText={formik.touched.sizeOz && formik.errors.sizeOz}
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
                  generateSku(event.target.value, "2");
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
              {/* // Change the radio group buttons to dynamicallly */}
              <RadioGroup
                onChange={(event) => {
                  formik.handleChange;
                  generateSku(event.target.value, "4");
                }}
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
                  value="sealed"
                  control={<Radio />}
                  label="Sealed"
                  checked={formik.values.condition === "Sealed"}
                  onChange={() => (formik.values.condition = "Sealed")}
                />
                <FormControlLabel
                  value="unsealed"
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

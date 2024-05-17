import axios from "axios";
import { useFormik } from "formik";
import * as Yup from "yup";
import Button from "@mui/material/Button";
import {
  Box,
  Collapse,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import dayjs from "dayjs";
import skuData from "../../../data/skuData.json";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

function AddProduct() {
  const [generatedSku, setGeneratedSku] = useState("");
  const today = new Date();
  const [newDate, setNewDate] = useState(dayjs(today.toLocaleString()));
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  const toggleMoreDetails = () => {
    setShowMoreDetails(!showMoreDetails);
  };
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
    brand: Yup.string().required("Please select a Brand"),
    itemName: Yup.string().required("Please enter a Valid Item Name"),
    quantity: Yup.string(),
    location: Yup.string(),
    sizeOz: Yup.string(),
    sizeMl: Yup.string(),
    strength: Yup.string(),
    shade: Yup.string(),
    formulation: Yup.string(),
    category: Yup.string().required("Please select a Category"),
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
    onSubmit: (data, { resetForm }) => {
      console.log(data);
      formik.values.batch = formik.values.inbound ? formik.values.batch : "NA";
      axios.post("http://localhost:3001/products", data).then((response) => {
        console.log(response);
        if (response.data === "Already Exists") {
          console.log("Exists");
          toast.error("Product Already Exists!", {
            position: "top-right",
          });
        } else if (response.data === "Created New") {
          console.log("New Product");
          if (formik.values.inbound) {
            console.log("Inside if Is inbound");
            data.batch = data.batch.length === 0 ? "NA" : data.batch;
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
          toast.success("Product Added!", {
            position: "top-right",
          });
          resetForm();
        }
      });
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
        <Grid container spacing={0} justifyContent="center">
          <Grid item xs={3}>
            <Container>
              <Paper
                variant="outlined"
                sx={{ my: { xs: 2, md: 3 }, p: { xs: 1, md: 4 } }}
              >
                <Grid container spacing={0} justifyContent="center">
                  <Grid item xs={12} display="flex" justifyContent="center">
                    <b>Generated SKU</b>
                  </Grid>
                  <Grid item xs={12} display="flex" justifyContent="center">
                    {generatedSku}{" "}
                  </Grid>
                  <Grid
                    item
                    xs={12}
                    p={2}
                    display="flex"
                    justifyContent="center"
                  >
                    <Button
                      variant="outlined"
                      style={{ float: "right" }}
                      onClick={handleSkuApprove}
                    >
                      Approve
                    </Button>
                  </Grid>
                </Grid>
              </Paper>
            </Container>
          </Grid>
          <Grid item xs={6}>
            <Container component="main" maxWidth="sm" sx={{ mb: 4 }}>
              <Paper
                variant="outlined"
                sx={{ my: { xs: 3, md: 3 }, p: { xs: 1, md: 3 } }}
              >
                <Grid container spacing={0} justifyContent="center">
                  <Grid item xs={12}>
                    <Box m={2}>
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
                  </Grid>

                  <Grid item xs={12}>
                    <Box m={2}>
                      <FormControl
                        fullWidth
                        variant="outlined"
                        error={
                          formik.touched.brand && Boolean(formik.errors.brand)
                        }
                      >
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
                          {Object.entries(skuData.BRANDS).map(
                            ([value, key]) => (
                              <MenuItem key={key} value={value}>
                                {value}
                              </MenuItem>
                            )
                          )}
                        </Select>
                        <FormHelperText>
                          {formik.touched.brand && formik.errors.brand}
                        </FormHelperText>
                      </FormControl>
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Box m={2}>
                      <TextField
                        fullWidth
                        id="itemName"
                        name="itemName"
                        label="Item Name"
                        value={formik.values.itemName}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={
                          formik.touched.itemName &&
                          Boolean(formik.errors.itemName)
                        }
                        helperText={
                          formik.touched.itemName && formik.errors.itemName
                        }
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Box m={2}>
                      <TextField
                        fullWidth
                        id="strength"
                        name="strength"
                        label="Strength"
                        value={formik.values.strength}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={
                          formik.touched.strength &&
                          Boolean(formik.errors.strength)
                        }
                        helperText={
                          formik.touched.strength && formik.errors.strength
                        }
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Box m={2}>
                      <TextField
                        fullWidth
                        id="shade"
                        name="shade"
                        label="Shade"
                        value={formik.values.shade}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={
                          formik.touched.shade && Boolean(formik.errors.shade)
                        }
                        helperText={formik.touched.shade && formik.errors.shade}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Grid container spacing={0}>
                      <Grid item xs={6}>
                        <Box m={2}>
                          <TextField
                            fullWidth
                            id="quantity"
                            name="quantity"
                            label="Quantity"
                            value={formik.values.quantity}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            error={
                              formik.touched.quantity &&
                              Boolean(formik.errors.quantity)
                            }
                            helperText={
                              formik.touched.quantity && formik.errors.quantity
                            }
                          />
                        </Box>
                        <Box m={2}>
                          <TextField
                            fullWidth
                            id="location"
                            name="location"
                            label="Location"
                            value={formik.values.location}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            error={
                              formik.touched.location &&
                              Boolean(formik.errors.location)
                            }
                            helperText={
                              formik.touched.location && formik.errors.location
                            }
                          />
                        </Box>
                        <Box m={2}>
                          <TextField
                            fullWidth
                            id="sizeOz"
                            name="sizeOz"
                            label="Size in Oz."
                            value={formik.values.sizeOz}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            error={
                              formik.touched.sizeOz &&
                              Boolean(formik.errors.sizeOz)
                            }
                            helperText={
                              formik.touched.sizeOz && formik.errors.sizeOz
                            }
                          />
                        </Box>
                      </Grid>
                      <Grid item xs={6} display="flex" justifyContent="center">
                        <Paper
                          variant="outlined"
                          sx={{ my: { xs: 1 }, p: { xs: 1 } }}
                        >
                          <Box m={2}>
                            <p>Packaging Condition :</p>
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
                                onChange={() =>
                                  (formik.values.condition = "Unboxed")
                                }
                              />
                              <FormControlLabel
                                value="sealed"
                                control={<Radio />}
                                label="Sealed"
                                checked={formik.values.condition === "Sealed"}
                                onChange={() =>
                                  (formik.values.condition = "Sealed")
                                }
                              />
                              <FormControlLabel
                                value="unsealed"
                                control={<Radio />}
                                label="Unsealed"
                                checked={formik.values.condition === "Unsealed"}
                                onChange={() =>
                                  (formik.values.condition = "Unsealed")
                                }
                              />
                            </RadioGroup>
                          </Box>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Grid>
                  <Grid item xs={12}>
                    <Box m={2}>
                      <FormControl
                        fullWidth
                        variant="outlined"
                        error={
                          formik.touched.category &&
                          Boolean(formik.errors.category)
                        }
                      >
                        <InputLabel id="categoryLabel">Category</InputLabel>
                        <Select
                          labelId="categoryLabel"
                          id="category"
                          name="category"
                          fullWidth
                          label="Category"
                          value={formik.values.category}
                          onChange={(event) => {
                            formik.setFieldValue(
                              "category",
                              event.target.value
                            );
                            generateSku(event.target.value, "2");
                          }}
                          input={<OutlinedInput label="Category" />}
                        >
                          {Object.entries(skuData.CATEGORY).map(
                            ([value, key]) => (
                              <MenuItem key={key} value={value}>
                                {value}
                              </MenuItem>
                            )
                          )}
                        </Select>
                        <FormHelperText>
                          {formik.touched.category && formik.errors.category}
                        </FormHelperText>
                      </FormControl>
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Box m={2}>
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
                  </Grid>
                </Grid>

                <Divider sx={{ borderColor: "gray", borderWidth: 1 }}></Divider>

                <Grid container spacing={0} justifyContent="center">
                  <Grid item xs={12}>
                    <Box m={1}>
                      <Typography
                        onClick={toggleMoreDetails}
                        variant="h6"
                        component="div"
                        sx={{ cursor: "pointer" }}
                      >
                        <IconButton size="small">
                          {showMoreDetails ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </IconButton>
                        More Details
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    {showMoreDetails && (
                      <Collapse in={showMoreDetails}>
                        <Grid container spacing={0}>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField fullWidth />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField fullWidth />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField fullWidth />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField fullWidth />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField fullWidth />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField fullWidth />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField fullWidth />
                            </Box>
                          </Grid>
                        </Grid>
                      </Collapse>
                    )}
                  </Grid>
                </Grid>
                <Divider sx={{ borderColor: "gray", borderWidth: 1 }}></Divider>
                <Grid item xs={12} m={1} display="flex" justifyContent="center">
                  <Button color="primary" variant="contained" type="submit">
                    Submit
                  </Button>
                </Grid>
              </Paper>
            </Container>
          </Grid>
          <Grid item xs={3}>
            <Container>
              <Paper
                variant="outlined"
                sx={{ my: { xs: 3, md: 3 }, p: { xs: 1, md: 4 } }}
              >
                <Grid container spacing={0} justifyContent="center">
                  <Grid
                    item
                    xs={12}
                    p={1}
                    display="flex"
                    justifyContent="center"
                  >
                    <b>Product Status</b>
                  </Grid>
                  <Grid item xs={6}>
                    Verified
                  </Grid>
                  <Grid item xs={6}>
                    <Switch
                      id="verified"
                      name="verified"
                      checked={formik.values.verified}
                      onChange={formik.handleChange}
                      inputProps={{ "aria-label": "controlled" }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    Listed
                  </Grid>
                  <Grid item xs={6}>
                    <Switch
                      id="listed"
                      name="listed"
                      checked={formik.values.listed}
                      onChange={formik.handleChange}
                      inputProps={{ "aria-label": "controlled" }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    Inbound
                  </Grid>
                  <Grid item xs={6}>
                    <Switch
                      id="inbound"
                      name="inbound"
                      checked={formik.values.inbound}
                      onChange={formik.handleChange}
                      inputProps={{ "aria-label": "controlled" }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    Final
                  </Grid>
                  <Grid item xs={6}>
                    <Switch
                      id="final"
                      name="final"
                      checked={formik.values.final}
                      onChange={formik.handleChange}
                      inputProps={{ "aria-label": "controlled" }}
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Container>
            {formik.values.inbound && (
              <Container>
                <Paper
                  variant="outlined"
                  sx={{ my: { xs: 3, md: 3 }, p: { xs: 1, md: 4 } }}
                >
                  <Grid container spacing={0} justifyContent="center">
                    <Grid item xs={12} display="flex" justifyContent="center">
                      <b>Inbound Details</b>
                    </Grid>
                    <Grid item xs={12}>
                      <Box pt={4}>
                        <TextField
                          fullWidth
                          id="batch"
                          name="batch"
                          label="Batch Code"
                          value={formik.values.batch}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          error={
                            formik.touched.batch && Boolean(formik.errors.batch)
                          }
                          helperText={
                            formik.touched.batch && formik.errors.batch
                          }
                        />
                      </Box>
                    </Grid>
                    <Grid item xs={12}>
                      <Box m={-3} pt={6}>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                          <DemoContainer components={["DatePicker"]}>
                            <DatePicker
                              label="Inbound Date"
                              value={newDate}
                              onChange={(event) => {
                                if (event) {
                                  setNewDate(event);
                                  formik.setFieldValue("date", newDate);
                                }
                              }}
                            />
                          </DemoContainer>
                        </LocalizationProvider>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Container>
            )}
          </Grid>
        </Grid>
      </form>
    </div>
  );
}

export default AddProduct;

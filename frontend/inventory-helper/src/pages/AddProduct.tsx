import axios from "axios";
import { useFormik } from "formik";
import * as Yup from "yup";
import Button from "@mui/material/Button";
import {
  Box,
  Checkbox,
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
import countriesData from "../../../data/countries.json";

function AddProduct() {
  const [generatedSku, setGeneratedSku] = useState("");
  const today = new Date();
  const [newDate, setNewDate] = useState(dayjs(today.toLocaleString()));
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  const toggleMoreDetails = () => {
    setShowMoreDetails(!showMoreDetails);
  };
  const [skuArray] = useState([
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
    vendor: "",
    // New fields from ProductDetails
    description: "",
    setOf: "",
    scentNotes: "",
    sizetype: "",
    activeIngredients: "",
    pao: "",
    skinType: "",
    mainPurpose: "",
    bodyArea: "",
    countryOfManufacture: "",
    gender: "",
    seo: {},
    ingredientDesc: "",
    discontinued: false,
    tester: false,
    isHazmat: false,
    isLimitedEdition: false,
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
    vendor: Yup.string(),
    // Product Details Fields
    description: Yup.string(),
    setOf: Yup.string(),
    scentNotes: Yup.string(),
    sizetype: Yup.string(),
    activeIngredients: Yup.string(),
    pao: Yup.string(),
    skinType: Yup.string(),
    mainPurpose: Yup.string(),
    bodyArea: Yup.string(),
    countryOfManufacture: Yup.string(),
    gender: Yup.string(),
    seo: Yup.object(),
    ingredientDesc: Yup.string(),
    discontinued: Yup.boolean(),
    tester: Yup.boolean(),
    isHazmat: Yup.boolean(),
    isLimitedEdition: Yup.boolean(),
  });

  const formik = useFormik({
    initialValues: formikInitialValues,
    validationSchema: formikValidationSchema,
    onSubmit: async (data, { resetForm }) => {
      // Set the batch value to "NA" if inbound is false
      formik.values.batch = formik.values.inbound ? formik.values.batch : "NA";

      console.log("Product Data :::::::  ", data);

      try {
        // Attempt to add the new product into Products table
        const addProductresponse = await axios.post(
          "http://localhost:3001/products",
          data
        );
        console.log("Level 1 OnSubmit");

        // Handle response for product creation
        if (addProductresponse.data === "Already Exists") {
          toast.error("Product Already Exists!", { position: "top-right" });
        } else if (addProductresponse.data === "Created New") {
          // Handle Product Details Insertion
          const addProductDetailsresponse = await axios.post(
            "http://localhost:3001/productDetails/addProductDetails",
            data
          );
          console.log("Product Details Response : ", addProductDetailsresponse);

          // Handle inbound logic if inbound is true
          if (formik.values.inbound) {
            data.batch = data.batch.length === 0 ? "NA" : data.batch;
            // Creation of composite key for Inbound Table
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
              vendor: data.vendor,
              quantity: data.quantity,
              date: newDate,
              batch: data.batch,
              compositeSku: compositeInboundKey,
            };

            // Add the product to Inbound table along with the new composite Inbound key
            const inboundResponse = await axios.post(
              "http://localhost:3001/inbound",
              inboundObject
            );
            console.log(inboundResponse);
          }

          // Fetch the brand object and update nextNumber
          const brandResponse = await axios.get(
            "http://localhost:3001/brands",
            {
              params: { brandName: data.brand },
            }
          );
          const brandObjectOnSubmit = brandResponse.data[0];
          brandObjectOnSubmit.nextNumber =
            parseInt(brandObjectOnSubmit.nextNumber) + 1;

          // Update the brand table with the next number for future
          await axios.put("http://localhost:3001/brands", brandObjectOnSubmit);
          toast.success("Product Added!", { position: "top-right" });
          resetForm();
        }
      } catch (error) {
        console.error("Error during form submission:", error);
      }
    },
  });

  // Function to convert an object to a Map with lowercase keys
  const createJsonDataMap = (data: any) => {
    const map = new Map();
    for (const [key, value] of Object.entries(data)) {
      map.set(key.toLowerCase(), value);
    }
    return map;
  };

  // Convert skuData.BRANDS, skuData.CATEGORY, and skuData.CONDITION to maps with lowercase keys
  const brandMap = createJsonDataMap(skuData.BRANDS);
  const categoryMap = createJsonDataMap(skuData.CATEGORY);
  const conditionMap = createJsonDataMap(skuData.CONDITION);

  const generateSku = async (fieldValue: string, factor: string) => {
    // Check if the factor is "1" to process brand-related SKU generation
    if (factor === "1") {
      // Check if the brand exists in the brandMap
      if (brandMap.has(fieldValue)) {
        const brandForSku = brandMap.get(fieldValue);
        console.log("Level 1: Brand found for SKU - ", brandForSku);
        // Fetch the brand object from the server
        const brandResponse = await axios.get("http://localhost:3001/brands", {
          params: { brandName: fieldValue },
        });
        const brandObject = brandResponse.data[0];
        console.log("Level 2: Brand object - ", brandObject);

        // If the nextNumber is not set, fetch the product count and update it
        if (brandObject.nextNumber.length === 0) {
          const productResponse = await axios.get(
            `http://localhost:3001/products/findAndCount/${brandForSku}`
          );
          console.log("Level 3: Product count - ", productResponse.data);
          // Update the brand object's nextNumber with the product count
          brandObject.nextNumber = productResponse.data.toString();
          await axios.put("http://localhost:3001/brands", brandObject);
          console.log("Level 4");
        }
        // Set the 10th position of the SKU with the formatted nextNumber
        skuArray[10] =
          "0".repeat(5 - brandObject.nextNumber.toString().length) +
          brandObject.nextNumber.toString();
        setGeneratedSku(skuArray.join(""));
        // Set the first three characters of the SKU based on the brand initials
        skuArray[0] = brandForSku ? brandForSku.charAt(0) : "@";
        skuArray[1] = brandForSku ? brandForSku.charAt(1) : "@";
        skuArray[2] = brandForSku ? brandForSku.charAt(2) : "@";
      } else {
        // If the brand is not found, set the first three characters of SKU to "*"
        console.log("Brand not found for SKU");
        skuArray.fill("*", 0, 3);
      }
      // Check if the factor is "2" to process category-related SKU generation
    } else if (factor === "2") {
      if (categoryMap.has(fieldValue.toLowerCase())) {
        const categoryForSku =
          categoryMap.get(fieldValue.toLowerCase()) || "NA";
        console.log("Category for SKU:", categoryForSku);
        // Set the 4th and 5th position of the SKU based on the category initials
        skuArray[4] = categoryForSku.charAt(0);
        skuArray[5] = categoryForSku.charAt(1);
      }
      // Check if the factor is "4" to process condition-related SKU generation
    } else if (factor === "4") {
      const conditionForSku =
        fieldValue === "" ? "NA" : conditionMap.get(fieldValue.toLowerCase());
      // Set the 7th and 8th position of the SKU based on the condition initials
      skuArray[7] = conditionForSku.charAt(0);
      skuArray[8] = conditionForSku.charAt(1);
    }
    // Update the generated SKU with the final skuArray
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
                  {formik.values.category === "Fragrance" && (
                    <Grid item xs={12}>
                      <Box m={2}>
                        <FormControl
                          fullWidth
                          variant="outlined"
                          error={
                            formik.touched.strength &&
                            Boolean(formik.errors.strength)
                          }
                        >
                          <InputLabel id="strengthLabel">Strength</InputLabel>
                          <Select
                            labelId="strengthLabel"
                            id="strength"
                            name="strength"
                            fullWidth
                            label="Strength"
                            value={formik.values.strength}
                            onChange={(event) => {
                              formik.setFieldValue(
                                "strength",
                                event.target.value
                              );
                            }}
                            input={<OutlinedInput label="strength" />}
                          >
                            {Object.entries(skuData.STRENGTH).map(
                              ([value, key]) => (
                                <MenuItem key={key} value={value}>
                                  {value}
                                </MenuItem>
                              )
                            )}
                          </Select>
                          <FormHelperText>
                            {formik.touched.strength && formik.errors.strength}
                          </FormHelperText>
                        </FormControl>
                      </Box>
                    </Grid>
                  )}
                  <Grid item xs={12}>
                    <Box m={2}>
                      <TextField
                        fullWidth
                        id="shade"
                        name="shade"
                        label="Shade / Variant"
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
                              name="condition"
                              onChange={(event) => {
                                formik.handleChange(event);
                                generateSku(event.target.value, "4");
                              }}
                              value={formik.values.condition}
                            >
                              <FormControlLabel
                                value="unboxed"
                                control={<Radio />}
                                label="Unboxed"
                              />
                              <FormControlLabel
                                value="sealed"
                                control={<Radio />}
                                label="Sealed"
                              />
                              <FormControlLabel
                                value="unsealed"
                                control={<Radio />}
                                label="Unsealed"
                              />
                            </RadioGroup>
                          </Box>
                        </Paper>
                      </Grid>
                    </Grid>
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
                              <TextField
                                fullWidth
                                id="type"
                                name="type"
                                label="Type"
                                value={formik.values.type}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={
                                  formik.touched.type &&
                                  Boolean(formik.errors.type)
                                }
                                helperText={
                                  formik.touched.type && formik.errors.type
                                }
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField
                                fullWidth
                                id="formulation"
                                name="formulation"
                                label="Formulation"
                                value={formik.values.formulation}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={
                                  formik.touched.formulation &&
                                  Boolean(formik.errors.formulation)
                                }
                                helperText={
                                  formik.touched.formulation &&
                                  formik.errors.formulation
                                }
                              />
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
                                error={
                                  formik.touched.upc &&
                                  Boolean(formik.errors.upc)
                                }
                                helperText={
                                  formik.touched.upc && formik.errors.upc
                                }
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField
                                fullWidth
                                id="description"
                                name="description"
                                label="Description"
                                value={formik.values.description}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={
                                  formik.touched.description &&
                                  Boolean(formik.errors.description)
                                }
                                helperText={
                                  formik.touched.description &&
                                  formik.errors.description
                                }
                                multiline
                                rows={4}
                                // maxRows={10}
                                variant="outlined"
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField
                                fullWidth
                                id="setOf"
                                name="setOf"
                                label="Set Of / Lot of"
                                value={formik.values.setOf}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={
                                  formik.touched.setOf &&
                                  Boolean(formik.errors.setOf)
                                }
                                helperText={
                                  formik.touched.setOf && formik.errors.setOf
                                }
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField
                                fullWidth
                                id="scentNotes"
                                name="scentNotes"
                                label="Scent Notes"
                                value={formik.values.scentNotes}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={
                                  formik.touched.scentNotes &&
                                  Boolean(formik.errors.scentNotes)
                                }
                                helperText={
                                  formik.touched.scentNotes &&
                                  formik.errors.scentNotes
                                }
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField
                                fullWidth
                                id="sizetype"
                                name="sizetype"
                                label="Size Type // dropdown"
                                value={formik.values.sizetype}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={
                                  formik.touched.sizetype &&
                                  Boolean(formik.errors.sizetype)
                                }
                                helperText={
                                  formik.touched.sizetype &&
                                  formik.errors.sizetype
                                }
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField
                                fullWidth
                                id="activeIngredients"
                                name="activeIngredients"
                                label="Active Ingredients"
                                value={formik.values.activeIngredients}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={
                                  formik.touched.activeIngredients &&
                                  Boolean(formik.errors.activeIngredients)
                                }
                                helperText={
                                  formik.touched.activeIngredients &&
                                  formik.errors.activeIngredients
                                }
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField
                                fullWidth
                                id="pao"
                                name="pao"
                                label="Period After Opening (PAO)"
                                value={formik.values.pao}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={
                                  formik.touched.pao &&
                                  Boolean(formik.errors.pao)
                                }
                                helperText={
                                  formik.touched.pao && formik.errors.pao
                                }
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField
                                fullWidth
                                id="skinType"
                                name="skinType"
                                label="Skin Type"
                                value={formik.values.skinType}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={
                                  formik.touched.skinType &&
                                  Boolean(formik.errors.skinType)
                                }
                                helperText={
                                  formik.touched.skinType &&
                                  formik.errors.skinType
                                }
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField
                                fullWidth
                                id="mainPurpose"
                                name="mainPurpose"
                                label="Main Purpose / Suggested Usage"
                                value={formik.values.mainPurpose}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={
                                  formik.touched.mainPurpose &&
                                  Boolean(formik.errors.mainPurpose)
                                }
                                helperText={
                                  formik.touched.mainPurpose &&
                                  formik.errors.mainPurpose
                                }
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField
                                fullWidth
                                id="bodyArea"
                                name="bodyArea"
                                label="Body Area"
                                value={formik.values.bodyArea}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={
                                  formik.touched.bodyArea &&
                                  Boolean(formik.errors.bodyArea)
                                }
                                helperText={
                                  formik.touched.bodyArea &&
                                  formik.errors.bodyArea
                                }
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <FormControl
                                fullWidth
                                error={
                                  formik.touched.gender &&
                                  Boolean(formik.errors.gender)
                                }
                              >
                                <InputLabel id="country-label">
                                  Country
                                </InputLabel>
                                <Select
                                  labelId="country-label"
                                  id="country"
                                  name="country"
                                  value={formik.values.countryOfManufacture}
                                  onChange={(event) => {
                                    formik.setFieldValue(
                                      "countryOfManufacture",
                                      event.target.value
                                    );
                                  }}
                                  onBlur={formik.handleBlur}
                                  label="Country"
                                >
                                  <MenuItem value="">
                                    <em>None</em>
                                  </MenuItem>
                                  {countriesData.map((country: any) => (
                                    <MenuItem
                                      key={country.code}
                                      value={country.name}
                                    >
                                      {country.name}
                                    </MenuItem>
                                  ))}
                                </Select>
                                {formik.touched.gender &&
                                  formik.errors.gender && (
                                    <FormHelperText>
                                      {formik.errors.gender}
                                    </FormHelperText>
                                  )}
                              </FormControl>
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <FormControl
                                fullWidth
                                error={
                                  formik.touched.gender &&
                                  Boolean(formik.errors.gender)
                                }
                              >
                                <InputLabel id="gender-label">
                                  Gender
                                </InputLabel>
                                <Select
                                  labelId="gender-label"
                                  id="gender"
                                  name="gender"
                                  value={formik.values.gender}
                                  onChange={formik.handleChange}
                                  onBlur={formik.handleBlur}
                                  label="Gender"
                                >
                                  <MenuItem value="">
                                    <em>None</em>
                                  </MenuItem>
                                  <MenuItem value="Male">Male</MenuItem>
                                  <MenuItem value="Female">Female</MenuItem>
                                  <MenuItem value="Unisex">Unisex</MenuItem>
                                </Select>
                                {formik.touched.gender &&
                                  formik.errors.gender && (
                                    <FormHelperText>
                                      {formik.errors.gender}
                                    </FormHelperText>
                                  )}
                              </FormControl>
                            </Box>
                          </Grid>
                          <Grid item xs={6}>
                            <Box m={2}>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    id="discontinued"
                                    name="discontinued"
                                    checked={formik.values.discontinued}
                                    onChange={formik.handleChange}
                                    color="primary"
                                  />
                                }
                                label="Discontinued"
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={6}>
                            <Box m={2}>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    id="tester"
                                    name="tester"
                                    checked={formik.values.tester}
                                    onChange={formik.handleChange}
                                    color="primary"
                                  />
                                }
                                label="Tester"
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={6}>
                            <Box m={2}>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    id="isLimitedEdition"
                                    name="isLimitedEdition"
                                    checked={formik.values.isLimitedEdition}
                                    onChange={formik.handleChange}
                                    color="primary"
                                  />
                                }
                                label="Limited Edition"
                              />
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
                      <Box pt={4}>
                        <TextField
                          fullWidth
                          id="vendor"
                          name="vendor"
                          label="Vendor Name"
                          value={formik.values.vendor}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          error={
                            formik.touched.vendor &&
                            Boolean(formik.errors.vendor)
                          }
                          helperText={
                            formik.touched.vendor && formik.errors.vendor
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

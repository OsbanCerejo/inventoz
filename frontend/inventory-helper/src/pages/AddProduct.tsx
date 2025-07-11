import axios from "axios";
import { useFormik } from "formik";
import * as Yup from "yup";
import Button from "@mui/material/Button";
import {
  Box,
  Checkbox,
  Chip,
  Collapse,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
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
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import skuData from "../data/skuData.json";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import countriesData from "../data/countries.json";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function AddProduct() {
  const location = useLocation();
  const { user } = useAuth();
  const { productObject, productDetails } = location.state || {};
  const [generatedSku, setGeneratedSku] = useState("");
  const today = new Date();
  const [newDate, setNewDate] = useState(dayjs(today.toLocaleString()));
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState<string>("");

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
    brand: productObject?.brand || "",
    itemName: productObject?.itemName || "",
    quantity: "",
    location: "",
    sizeOz: productObject?.sizeOz || "",
    sizeMl: productObject?.sizeMl || "",
    strength: productObject?.strength || "",
    shade: productObject?.shade || "",
    formulation: productObject?.formulation || "",
    category: productObject?.category || "",
    type: productObject?.type || "",
    upc: "",
    batch: "NA",
    condition: productObject?.condition || "Unsealed",
    verified: false,
    inbound: false,
    listed: false,
    final: false,
    image: "",
    vendor: productObject?.vendor || "",
    description: productDetails?.description || "",
    setOf: productDetails?.setOf || "",
    scentNotes: productDetails?.scentNotes || "",
    sizeType: productDetails?.sizeType || "",
    activeIngredients: productDetails?.activeIngredients || "",
    pao: productDetails?.pao || "",
    skinType: productDetails?.skinType || "",
    mainPurpose: productDetails?.mainPurpose || "",
    bodyArea: productDetails?.bodyArea || "",
    countryOfManufacture: productDetails?.countryOfManufacture || "",
    gender: productDetails?.gender || "",
    seo: productDetails?.seo || {},
    ingredientDesc: productDetails?.ingredientDesc || "",
    discontinued: productDetails?.discontinued || false,
    tester: productDetails?.tester || false,
    isHazmat: productDetails?.isHazmat || false,
    isLimitedEdition: productDetails?.isLimitedEdition || false,
    //Listings
    buy4lesstoday: "",
    onelifeluxuries: "",
    walmart: "",
    //Warehouse Locations
    warehouseLocations: "",
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
    image: Yup.string(),
    vendor: Yup.string(),
    // Product Details Fields
    description: Yup.string(),
    setOf: Yup.string(),
    scentNotes: Yup.string(),
    sizeType: Yup.string(),
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
    //Listings
    buy4lesstoday: Yup.string(),
    onelifeluxuries: Yup.string(),
    walmart: Yup.string(),
    //Warehouse Locations
    warehouseLocations: Yup.string(),
  });

  const formik = useFormik({
    initialValues: formikInitialValues,
    validationSchema: formikValidationSchema,
    onSubmit: async (data, { resetForm }) => {
      // Set the batch value to "NA" if inbound is false
      if (!formik.values.inbound) {
        data.batch = "NA";
      }

      try {
        const addProductresponse = await axios.post(
          `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/products`,
          data
        );

        if (addProductresponse.data === "Created New") {
          // Log the product creation
          await axios.post(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/logs/addLog`, {
            timestamp: new Date().toISOString(),
            type: "Product",
            action: "create",
            entityType: "product",
            entityId: data.sku,
            userId: user?.id?.toString(),
            changes: [{
              sku: data.sku,
              changes: []
            }],
            newState: data,
            metaData: {
              message: "New product created",
              inbound: data.inbound,
              batch: data.batch
            }
          });

          // Handle Product Details Insertion
          const addProductDetailsresponse = await axios.post(
            `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/productDetails/addProductDetails`,
            data
          );
          console.log("Product Details Response : ", addProductDetailsresponse);

          // Log product details creation
          await axios.post(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/logs/addLog`, {
            timestamp: new Date().toISOString(),
            type: "Product",
            action: "create",
            entityType: "product_details",
            entityId: data.sku,
            userId: user?.id?.toString(),
            changes: [{
              sku: data.sku,
              changes: []
            }],
            newState: data,
            metaData: {
              message: "New product details created"
            }
          });

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
              `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/inbound`,
              inboundObject
            );
            console.log(inboundResponse);

            // Log inbound creation
            await axios.post(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/logs/addLog`, {
              timestamp: new Date().toISOString(),
              type: "Product",
              action: "create",
              entityType: "inbound",
              entityId: compositeInboundKey,
              userId: user?.id?.toString(),
              changes: [{
                sku: data.sku,
                changes: []
              }],
              newState: inboundObject,
              metaData: {
                message: "New inbound record created",
                sku: data.sku,
                batch: data.batch
              }
            });
          }
          // Handle Listed Logic
          if (formik.values.listed) {
            const listingsObject = {
              sku: data.sku,
              ebayBuy4LessToday: data.buy4lesstoday,
              ebayOneLifeLuxuries4: data.onelifeluxuries,
              walmartOneLifeLuxuries: data.walmart,
            };
            console.log("LISTINGS OBJECT: ", listingsObject);
            const listingsResponse = await axios.post(
              `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/listings`,
              listingsObject
            );
            console.log(listingsResponse);
          }

          // Fetch the brand object and update nextNumber
          const brandResponse = await axios.get(
            `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/brands`,
            {
              params: { brandName: data.brand },
            }
          );
          const brandObjectOnSubmit = brandResponse.data[0];
          brandObjectOnSubmit.nextNumber =
            parseInt(brandObjectOnSubmit.nextNumber) + 1;

          // Update the brand table with the next number for future
          await axios.put(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/brands`, brandObjectOnSubmit);

          toast.success("Product Added Successfully!", { position: "top-right" });
          resetForm();
        } else {
          toast.error("Product Already Exists!", { position: "top-right" });
        }
      } catch (error) {
        console.error("Error adding product:", error);
        toast.error("Failed to add product", { position: "top-right" });
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
        const brandResponse = await axios.get(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/brands`, {
          params: { brandName: fieldValue },
        });
        const brandObject = brandResponse.data[0];
        console.log("Level 2: Brand object - ", brandObject);

        // If the nextNumber is not set, fetch the product count and update it
        if (brandObject.nextNumber.length === 0) {
          const productResponse = await axios.get(
            `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/products/findAndCount/${brandForSku}`
          );
          console.log("Level 3: Product count - ", productResponse.data);
          // Update the brand object's nextNumber with the product count
          brandObject.nextNumber = productResponse.data.toString();
          await axios.put(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/brands`, brandObject);
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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
    }
  };

  useEffect(() => {
    if (
      formik.values.brand &&
      formik.values.category &&
      formik.values.condition
    ) {
      console.log("Value in use effect", formik.values.brand);
      generateSku(formik.values.brand.toLowerCase(), "1");
      generateSku(formik.values.category.toLowerCase(), "2");
      generateSku(formik.values.condition.toLowerCase(), "4");
    }
  }, [formik.values.brand, formik.values.category, formik.values.condition]);

  const handleAddLocation = () => {
    if (currentInput.trim() !== "" && !tags.includes(currentInput.trim())) {
      const updatedTags = [...tags, currentInput.trim()];
      setTags(updatedTags); // Update tags state
      formik.setFieldValue("warehouseLocations", updatedTags.join(", ")); // Update formik value
      setCurrentInput(""); // Clear the input field
    }
  };

  const handleDelete = (tagToDelete: string) => {
    const updatedTags = tags.filter((tag) => tag !== tagToDelete);
    setTags(updatedTags); // Update tags state
    formik.setFieldValue("warehouseLocations", updatedTags.join(", ")); // Update formik value
  };

  return (
    <div>
      <Box sx={{ mt: 4, mb: 3, px: 2 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 0 }}>
          Add Product
        </Typography>
      </Box>
      
      <form onSubmit={formik.handleSubmit} onKeyDown={handleKeyDown}>
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
                            ([value], index) => (
                              <MenuItem key={index} value={value}>
                                {value}
                              </MenuItem>
                            )
                          )}
                        </Select>
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
                            ([value], index) => (
                              <MenuItem key={index} value={value}>
                                {value}
                              </MenuItem>
                            )
                          )}
                        </Select>
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
                              ([value], index) => (
                                <MenuItem key={index} value={value}>
                                  {value}
                                </MenuItem>
                              )
                            )}
                          </Select>
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
                            id="sizeOz"
                            name="sizeOz"
                            label="Size (Oz.)"
                            style={{ width: "50%", padding: 1 }}
                            value={formik.values.sizeOz}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            error={
                              formik.touched.sizeOz &&
                              Boolean(formik.errors.sizeOz)
                            }
                          />
                          <TextField
                            id="sizeMl"
                            name="sizeMl"
                            label="Size (ml/g)"
                            style={{ width: "50%", padding: 1 }}
                            value={formik.values.sizeMl}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            error={
                              formik.touched.sizeMl &&
                              Boolean(formik.errors.sizeMl)
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
                                value="Unsealed"
                                control={<Radio />}
                                label="Unsealed"
                              />
                              <FormControlLabel
                                value="Unboxed"
                                control={<Radio />}
                                label="Unboxed"
                              />
                              <FormControlLabel
                                value="Sealed"
                                control={<Radio />}
                                label="Sealed"
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
                                id="image"
                                name="image"
                                label="Image URL"
                                value={formik.values.image}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                error={
                                  formik.touched.image &&
                                  Boolean(formik.errors.image)
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
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box
                              display="flex"
                              alignItems="center"
                              gap={2}
                              m={2}
                            >
                              <TextField
                                fullWidth
                                id="warehouseLocationInput"
                                name="warehouseLocationInput"
                                label="Add Warehouse Location"
                                placeholder="Enter location (e.g., A-12)"
                                value={currentInput}
                                onChange={(e) =>
                                  setCurrentInput(e.target.value)
                                }
                              />
                              <Button
                                variant="contained"
                                color="primary"
                                onClick={handleAddLocation}
                              >
                                Add Location
                              </Button>
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <Box display="flex" flexWrap="wrap" gap={1}>
                                {tags.map((tag, index) => (
                                  <Chip
                                    key={index}
                                    label={tag}
                                    onDelete={() => handleDelete(tag)}
                                    color="primary"
                                  />
                                ))}
                              </Box>
                            </Box>
                          </Grid>
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
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <FormControl
                                fullWidth
                                variant="outlined"
                                error={
                                  formik.touched.sizeType &&
                                  Boolean(formik.errors.sizeType)
                                }
                              >
                                <InputLabel id="sizeTypeLabel">
                                  Size Type
                                </InputLabel>
                                <Select
                                  labelId="sizeTypeLabel"
                                  id="sizeType"
                                  name="sizeType"
                                  fullWidth
                                  label="Size Type"
                                  value={formik.values.sizeType}
                                  onChange={(event) => {
                                    formik.setFieldValue(
                                      "sizeType",
                                      event.target.value
                                    );
                                  }}
                                  input={<OutlinedInput label="sizeType" />}
                                >
                                  {Object.entries(skuData.SIZE).map(
                                    ([value], index) => (
                                      <MenuItem key={index} value={value}>
                                        {value}
                                      </MenuItem>
                                    )
                                  )}
                                </Select>
                              </FormControl>
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
            {formik.values.listed && (
              <Container>
                <Paper
                  variant="outlined"
                  sx={{ my: { xs: 3, md: 3 }, p: { xs: 1, md: 4 } }}
                >
                  <Grid container spacing={0} justifyContent="center">
                    <Grid item xs={12} display="flex" justifyContent="center">
                      <b>Listing Allocation</b>
                    </Grid>
                    <Grid item xs={12}>
                      <Box pt={4}>
                        <TextField
                          fullWidth
                          id="buy4lesstoday"
                          name="buy4lesstoday"
                          label="Buy4LessToday"
                          value={formik.values.buy4lesstoday}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                        />
                      </Box>
                    </Grid>
                    <Grid item xs={12}>
                      <Box pt={4}>
                        <TextField
                          fullWidth
                          id="onelifeluxuries"
                          name="onelifeluxuries"
                          label="OneLifeLuxuries"
                          value={formik.values.onelifeluxuries}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                        />
                      </Box>
                    </Grid>
                    <Grid item xs={12}>
                      <Box pt={4}>
                        <TextField
                          fullWidth
                          id="walmart"
                          name="walmart"
                          label="Walmart"
                          value={formik.values.walmart}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                        />
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

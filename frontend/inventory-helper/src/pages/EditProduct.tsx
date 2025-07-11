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
  Checkbox,
  Collapse,
  Divider,
  FormControl,
  FormHelperText,
  Grid,
  IconButton,
  Typography,
  Chip,
} from "@mui/material";
import axios from "axios";
import * as Yup from "yup";
import { useLocation, useNavigate } from "react-router-dom";
import { useFormik } from "formik";
import skuData from "../../data/skuData.json";
import { useCallback, useEffect, useMemo, useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import countriesData from "../../data/countries.json";
import { isEqual } from "lodash";
import { useAuth } from "../context/AuthContext";

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
  alternativeSku: Yup.string(),
  //Listings
  buy4lesstoday: Yup.string(),
  onelifeluxuries: Yup.string(),
  walmart: Yup.string(),
  //Warehouse Locations
  warehouseLocations: Yup.string(),
});

interface ChangeRecord {
  field: string;
  oldValue: any;
  newValue: any;
}

interface ListingsObject {
  sku: string;
  ebayBuy4LessToday: string;
  ebayOneLifeLuxuries4: string;
  walmartOneLifeLuxuries: string;
  [key: string]: string;
}

function EditProduct() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const productObject = location.state.productObject;
  const productDetails = location.state.productDetails || {};
  const productListings = location.state.productListings || {};

  const [isLocked, setIsLocked] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const [tags, setTags] = useState<string[]>([]); // State for tags
  const [currentInput, setCurrentInput] = useState<string>("");

  const formikInitialValues = useMemo(
    () => ({
      sku: "" + productObject.sku,
      alternativeSku: "" + (productObject.alternativeSku || ""),
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
      batch: "NA" + productObject.batch,
      condition: "" + productObject.condition,
      verified: productObject.verified,
      inbound: productObject.inbound,
      listed: productObject.listed,
      final: productObject.final,
      image: "" + productObject.image,
      vendor: "",
      // New fields from ProductDetails
      description: productDetails.description || "",
      setOf: productDetails.setOf || "",
      scentNotes: productDetails.scentNotes || "",
      sizeType: productDetails.sizeType || "",
      activeIngredients: productDetails.activeIngredients || "",
      pao: productDetails.pao || "",
      skinType: productDetails.skinType || "",
      mainPurpose: productDetails.mainPurpose || "",
      bodyArea: productDetails.bodyArea || "",
      countryOfManufacture: productDetails.countryOfManufacture || "",
      gender: productDetails.gender || "",
      seo: productDetails.seo || {},
      ingredientDesc: productDetails.ingredientDesc || "",
      discontinued: productDetails.discontinued || false,
      tester: productDetails.tester || false,
      isHazmat: productDetails.isHazmat || false,
      isLimitedEdition: productDetails.isLimitedEdition || false,
      //Listings
      buy4lesstoday: productListings.ebayBuy4LessToday || "",
      onelifeluxuries: productListings.ebayOneLifeLuxuries4 || "",
      walmart: productListings.walmartOneLifeLuxuries || "",
      //Warehouse Locatins
      warehouseLocations: productObject.warehouseLocations || "",
    }),
    [productObject, productDetails]
  );

  const toggleMoreDetails = useCallback(() => {
    setShowMoreDetails((prev) => !prev);
  }, []);

  const formik = useFormik({
    initialValues: formikInitialValues,
    validationSchema: formikValidationSchema,
    onSubmit: (data) => {
      const productChanges = getChangedFields(data, formikInitialValues);
      console.log("CHANGES : ", productChanges)

      const listingsObject: ListingsObject = {
        sku: data.sku,
        ebayBuy4LessToday: data.buy4lesstoday,
        ebayOneLifeLuxuries4: data.onelifeluxuries,
        walmartOneLifeLuxuries: data.walmart,
      };

      axios
        .all([
          axios.put(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/products`, data),
          axios.put(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/productDetails`, data),
          axios.put(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/listings`, listingsObject),
        ])
        .then(
          axios.spread((productsRes, productDetailsRes, listingsRes) => {
            console.log("Product Updated to: ", productsRes);
            console.log("Product Details Updated to: ", productDetailsRes);
            
            // Log product details changes
            if (Object.keys(productChanges).length > 0) {
              const changesArray: ChangeRecord[] = Object.entries(productChanges).map(([field, value]) => ({
                field,
                oldValue: formikInitialValues[field as keyof typeof formikInitialValues],
                newValue: value
              }));

              axios.post(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/logs/addLog`, {
                timestamp: new Date().toISOString(),
                type: "Product",
                action: "update",
                entityType: "product_details",
                entityId: data.sku,
                userId: user?.id?.toString(),
                changes: [{
                  sku: data.sku,
                  changes: changesArray
                }],
                previousState: formikInitialValues,
                newState: data,
                metaData: {
                  message: "Product details updated",
                  updatedFields: Object.keys(productChanges)
                }
              });
            }

            // Log listings changes if any
            const listingsChangesArray: ChangeRecord[] = [];
            Object.keys(listingsObject).forEach(key => {
              if (listingsObject[key] !== productListings[key]) {
                listingsChangesArray.push({
                  field: key,
                  oldValue: productListings[key] || '',
                  newValue: listingsObject[key]
                });
              }
            });

            if (listingsChangesArray.length > 0) {
              axios.post(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/logs/addLog`, {
                timestamp: new Date().toISOString(),
                type: "Product",
                action: "update",
                entityType: "listings",
                entityId: data.sku,
                userId: user?.id?.toString(),
                changes: [{
                  sku: data.sku,
                  changes: listingsChangesArray
                }],
                previousState: productListings,
                newState: listingsObject,
                metaData: {
                  message: "Product listings updated",
                  updatedFields: listingsChangesArray.map(change => change.field)
                }
              });
            }

            navigate(`/products/${data.sku}`, {
              state: {
                updatedProduct: productsRes.data, 
                updatedDetails: productDetailsRes.data,
                updatedListings: listingsRes.data,
              },
            });
          })
        )
        .catch((error) => {
          console.error("There was an error updating the product: ", error);
        });
    },
  });

  function getChangedFields(data: any, initialValues: any) {
    return Object.keys(data).reduce((acc, key) => {
      if (!isEqual(data[key], initialValues[key])) {
        acc[key] = {
          sku: data.sku,
          oldValue: initialValues[key],
          newValue: data[key],
        };
      }
      return acc;
    }, {} as Record<string, { sku: string; oldValue: any; newValue: any }>);
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
    }
  };

  const handleUnlock = () => {
    if (password === "1234") {
      setIsLocked(false);
      setError(false);
    } else {
      setError(true);
    }
  };

  useEffect(() => {
    if (formikInitialValues.warehouseLocations) {
      setTags(
        formikInitialValues.warehouseLocations
          .split(", ")
          .map((tag: string) => tag.trim())
      );
    }
  }, [formikInitialValues.warehouseLocations]);

  const handleAddLocation = () => {
    if (currentInput.trim() !== "" && !tags.includes(currentInput.trim())) {
      const updatedTags = [...tags, currentInput.trim()];
      setTags(updatedTags);
      formik.setFieldValue("warehouseLocations", updatedTags.join(", "));
      setCurrentInput(""); // Clear input field
    }
  };

  const handleDeleteLocation = (tagToDelete: string) => {
    const updatedTags = tags.filter((tag) => tag !== tagToDelete);
    setTags(updatedTags);
    formik.setFieldValue("warehouseLocations", updatedTags.join(", "));
  };

  return (
    <div>
      <Box sx={{ mt: 4, mb: 3, px: 2 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 0 }}>
          Edit Product
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
                <strong>{productObject.sku}</strong>
              </Paper>
              <Paper
                variant="outlined"
                sx={{ my: { xs: 2, md: 3 }, p: { xs: 1, md: 4 } }}
              >
                <TextField
                  fullWidth
                  id="alternativeSku"
                  name="alternativeSku"
                  label="Alternative SKU (for eBay API)"
                  value={formik.values.alternativeSku}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={
                    formik.touched.alternativeSku &&
                    Boolean(formik.errors.alternativeSku)
                  }
                  helperText={
                    formik.touched.alternativeSku && 
                    typeof formik.errors.alternativeSku === 'string' 
                      ? formik.errors.alternativeSku 
                      : ''
                  }
                />
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
                              ([value], index) => (
                                <MenuItem key={index} value={value}>
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
                          {isLocked && (
                            <Box
                              display="flex"
                              alignItems="center"
                              gap={1}
                              mb={2}
                            >
                              <TextField
                                type="password"
                                label="Enter Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                error={error}
                                helperText={error ? "Incorrect password" : ""}
                              />
                              <Button
                                variant="contained"
                                onClick={handleUnlock}
                              >
                                Unlock
                              </Button>
                            </Box>
                          )}
                          <TextField
                            fullWidth
                            id="location"
                            name="location"
                            label="Location"
                            value={formik.values.location}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            disabled={isLocked}
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
                            style={{ width: "50%", padding: 1 }}
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
                            helperText={
                              formik.touched.sizeMl && formik.errors.sizeMl
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
                              onChange={formik.handleChange}
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
                                helperText={
                                  formik.touched.upc && formik.errors.upc
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
                                    onDelete={() => handleDeleteLocation(tag)}
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
            {formik.values.listed && (
              <Container>
                <Paper
                  variant="outlined"
                  sx={{ my: { xs: 3, md: 3 }, p: { xs: 1, md: 4 } }}
                >
                  <Grid container spacing={0} justifyContent="center">
                    <Grid item xs={12} display="flex" justifyContent="center">
                      <b>Listings Details</b>
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

export default EditProduct;

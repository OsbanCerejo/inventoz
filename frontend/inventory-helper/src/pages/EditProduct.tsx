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
import skuData from "../data/skuData.json";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import countriesData from "../data/countries.json";
import { isEqual } from "lodash";
import { useAuth } from "../context/AuthContext";
import PermissionGuard from "../components/PermissionGuard";
import { getApiUrl } from "../config/api";
import { invalidateProductsCache } from "../utils/productCache";
import FragranceNotesEditor from "../components/Products/FragranceNotesEditor";
import { toast } from "react-toastify";

type BrandRecord = {
  id: number;
  brand: string;
  abbreviation: string;
  nextNumber: number;
  productCount?: number;
};

const HBA_CONDITION_OPTIONS = ["Unboxed", "Sealed", "Damaged", "Old Batch"];

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
  dupeOf: Yup.string(),
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
  // Low Stock Tracking
  trackQuantity: Yup.boolean(),
  minimumQuantity: Yup.number().nullable(),
  hbaEnabled: Yup.boolean(),
  hbaQuantity: Yup.number().nullable(),
  hbaPrice: Yup.number().nullable(),
  hbaMoq: Yup.number().integer().min(1).nullable(),
  hbaStepCount: Yup.number().integer().min(1).nullable(),
  hbaCondition: Yup.string(),
  hbaNewArrival: Yup.boolean(),
});

interface ChangeRecord {
  field: string;
  oldValue: any;
  newValue: any;
}

interface ListingsObject {
  sku: string;
  ebayBuy4LessToday: number;
  ebayOneLifeLuxuries4: number;
  walmartOneLifeLuxuries: number;
  [key: string]: string | number;
}

const DATA_ENTRY_FIELD_LABELS: Record<string, string> = {
  image: 'Image URL', brand: 'Brand', itemName: 'Item Name',
  alternativeSku: 'Alternative SKU', upc: 'UPC Code', location: 'Location',
  sizeOz: 'Size (oz)', sizeMl: 'Size (ml)', strength: 'Strength',
  shade: 'Shade', category: 'Category', type: 'Type',
  formulation: 'Formulation', batch: 'Batch', verified: 'Verified', listed: 'Listed',
  fragranceNotes: 'Fragrance Notes',
};
const DATA_ENTRY_BOOLEAN_FIELDS = new Set(['verified', 'listed']);

function EditProduct() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasPermission, isLoading: authLoading } = useAuth();
  const fragranceNotesRef = useRef<{ top: {id:number;name:string}[]; middle: {id:number;name:string}[]; base: {id:number;name:string}[] }>({ top: [], middle: [], base: [] });

  // Data Entry mode — users with dataEntry but not full edit
  const isDataEntryMode = !authLoading && hasPermission('products', 'dataEntry') && user?.role !== 'admin';
  const [dataEntryFields, setDataEntryFields] = useState<string[]>([]);
  const [dataEntryValues, setDataEntryValues] = useState<Record<string, any>>({});
  const [dataEntrySaving, setDataEntrySaving] = useState(false);
  const [dataEntryConfigLoaded, setDataEntryConfigLoaded] = useState(false);

  useEffect(() => {
    if (!isDataEntryMode) return;
    axios.get(getApiUrl('products/data-entry/config')).then(res => {
      const fields: string[] = res.data.enabledFields || [];
      setDataEntryFields(fields);
      const initial: Record<string, any> = {};
      fields.forEach(f => { if (f !== 'fragranceNotes') initial[f] = (location.state?.productObject?.[f] ?? ''); });
      setDataEntryValues(initial);
      setDataEntryConfigLoaded(true);
    }).catch(() => setDataEntryConfigLoaded(true));
  }, [isDataEntryMode]);

  const [brands, setBrands] = useState<BrandRecord[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const productObject = location.state.productObject;
  const productDetails = location.state.productDetails || {};
  const productListings = location.state.productListings || {};

  const [isLocked, setIsLocked] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const [tags, setTags] = useState<string[]>([]); // State for tags
  const [currentInput, setCurrentInput] = useState<string>("");

  const [vendorPrices, setVendorPrices] = useState<any[]>([]);
  const [averagePrice, setAveragePrice] = useState<number | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<any | null>(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  const canViewPricing = !authLoading && hasPermission("pricing", "view");
  const canViewHbaListing =
    !authLoading &&
    (user?.role === "admin" ||
      hasPermission("hbaListing", "view") ||
      hasPermission("hbaListing", "edit"));
  const canEditHbaListing =
    !authLoading &&
    (user?.role === "admin" || hasPermission("hbaListing", "edit"));

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
      dupeOf: productDetails.dupeOf || "",
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
      // Low Stock Tracking (Admin only)
      trackQuantity: productObject.trackQuantity || false,
      minimumQuantity: productObject.minimumQuantity || "",
      hbaEnabled: productObject.hbaEnabled || false,
      hbaQuantity: productObject.hbaQuantity || "",
      hbaPrice: productObject.hbaPrice || "",
      hbaMoq: productObject.hbaMoq || 1,
      hbaStepCount: productObject.hbaStepCount || 1,
      hbaCondition: productObject.hbaCondition || "",
      hbaNewArrival: productObject.hbaNewArrival || false,
    }),
    [productObject, productDetails]
  );

  const loadVendorPrices = useCallback(async () => {
    if (!canViewPricing) return;

    try {
      setLoadingPrices(true);
      setPricesError(null);

      const response = await axios.get(
        getApiUrl(`product-vendor-prices/${productObject.sku}`)
      );
      const data = response.data || {};

      setVendorPrices(data.vendorPrices || []);

      const avg = data.averagePrice;
      if (avg === null || avg === undefined) {
        setAveragePrice(null);
      } else if (typeof avg === "number") {
        setAveragePrice(avg);
      } else {
        const parsed = Number(avg);
        setAveragePrice(Number.isNaN(parsed) ? null : parsed);
      }
    } catch (error) {
      console.error("Error fetching vendor prices:", error);
      setPricesError("Failed to load pricing data");
    } finally {
      setLoadingPrices(false);
    }
  }, [canViewPricing, productObject.sku]);

  useEffect(() => {
    loadVendorPrices();
  }, [loadVendorPrices]);

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        setBrandsLoading(true);
        const response = await axios.get(getApiUrl("brands"));
        const rows = Array.isArray(response.data) ? response.data : [];
        setBrands(rows);
      } catch (error) {
        console.error("Failed to fetch brands:", error);
      } finally {
        setBrandsLoading(false);
      }
    };

    fetchBrands();
  }, []);

  const availableBrands = useMemo(() => {
    const normalizedCurrentBrand = String(formikInitialValues.brand || "").trim();
    const hasCurrentBrand = brands.some(
      (brand) => String(brand.brand || "").trim().toLowerCase() === normalizedCurrentBrand.toLowerCase()
    );
    const combined = hasCurrentBrand
      ? brands
      : [
          ...brands,
          {
            id: -1,
            brand: normalizedCurrentBrand,
            abbreviation: "",
            nextNumber: 1,
          },
        ];

    return combined
      .filter((brand) => String(brand.brand || "").trim())
      .sort((a, b) => String(a.brand || "").localeCompare(String(b.brand || "")));
  }, [brands, formikInitialValues.brand]);

  const formik = useFormik({
    initialValues: formikInitialValues,
    validationSchema: formikValidationSchema,
    onSubmit: (data) => {
      const productChanges = getChangedFields(data, formikInitialValues);
      // console.log("CHANGES : ", productChanges)

      const listingsObject: ListingsObject = {
        sku: data.sku,
        ebayBuy4LessToday: data.buy4lesstoday === "" ? 0 : Number(data.buy4lesstoday),
        ebayOneLifeLuxuries4: data.onelifeluxuries === "" ? 0 : Number(data.onelifeluxuries),
        walmartOneLifeLuxuries: data.walmart === "" ? 0 : Number(data.walmart),
      };

      // Save fragrance notes if Fragrance category
      if (data.category === 'Fragrance') {
        const fn = fragranceNotesRef.current;
        axios.put(getApiUrl(`fragrance-notes/product/${data.sku}`), {
          top: fn.top.map(n => n.name),
          middle: fn.middle.map(n => n.name),
          base: fn.base.map(n => n.name),
        }).catch(() => {});
      }

      axios
        .all([
          axios.put(getApiUrl('products'), data),
          axios.put(getApiUrl('productDetails'), data),
          axios.put(getApiUrl('listings'), listingsObject),
        ])
        .then(
          axios.spread((productsRes, productDetailsRes, listingsRes) => {
            // console.log("Product Updated to: ", productsRes);
            // console.log("Product Details Updated to: ", productDetailsRes);
            
            // Log product details changes
            if (Object.keys(productChanges).length > 0) {
              const changesArray: ChangeRecord[] = Object.entries(productChanges).map(([field, value]) => ({
                field,
                oldValue: formikInitialValues[field as keyof typeof formikInitialValues],
                newValue: value
              }));

              axios.post(getApiUrl('logs/addLog'), {
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
              axios.post(getApiUrl('logs/addLog'), {
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

            invalidateProductsCache();
            navigate(`/products/${data.sku}`, {
              replace: true,
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

  // ── Data Entry mode early return (all hooks above are already called) ────────
  if (isDataEntryMode) {
    if (!dataEntryConfigLoaded) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <Typography>Loading...</Typography>
        </Box>
      );
    }
    if (dataEntryFields.length === 0) {
      return (
        <Box sx={{ maxWidth: 600, mx: 'auto', mt: 6, px: 2 }}>
          <Typography color="warning.main">No fields have been configured for data entry. Please contact an admin.</Typography>
        </Box>
      );
    }
    const handleDataEntrySubmit = async () => {
      setDataEntrySaving(true);
      try {
        await axios.put(getApiUrl('products/data-entry'), { sku: productObject.sku, ...dataEntryValues });
        if (productObject.category === 'Fragrance') {
          const fn = fragranceNotesRef.current;
          await axios.put(getApiUrl(`fragrance-notes/product/${productObject.sku}`), {
            top: fn.top.map(n => n.name),
            middle: fn.middle.map(n => n.name),
            base: fn.base.map(n => n.name),
          }).catch(() => {});
        }
        toast.success('Saved successfully');
        navigate(`/products/${productObject.sku}`);
      } catch {
        toast.error('Save failed. Please try again.');
        console.error('Data entry save failed');
      } finally {
        setDataEntrySaving(false);
      }
    };

    const deKV = ({ label, value }: { label: string; value?: any }) =>
      value == null || value === '' || value === 'undefined' || value === 'null' ? null : (
        <Box display="flex" alignItems="baseline" py={0.75} gap={1} sx={{ borderBottom: '1px solid #f8fafc', '&:last-child': { borderBottom: 'none' } }}>
          <Typography sx={{ fontSize: 13, color: '#64748b', fontWeight: 600, flexShrink: 0, width: 140 }}>{label}</Typography>
          <Typography sx={{ fontSize: 13, color: '#0f172a', wordBreak: 'break-word' }}>{String(value)}</Typography>
        </Box>
      );

    return (
      <Box sx={{ maxWidth: 1100, mx: 'auto', mt: 4, px: 2, pb: 6 }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>Edit Product</Typography>
            <Typography sx={{ fontFamily: 'Consolas, monospace', fontSize: 13, color: '#64748b', mt: 0.25 }}>{productObject.sku}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, alignItems: 'start' }}>
          {/* Left — read-only product details */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Image */}
            {productObject.image && (
              <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#374151' }}>Image</Typography>
                </Box>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                  <img src={productObject.image} alt="" style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 8 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                </Box>
              </Paper>
            )}

            {/* Product Details */}
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#374151' }}>Product Details</Typography>
              </Box>
              <Box sx={{ px: 2.5, py: 1.5 }}>
                {deKV({ label: 'SKU', value: productObject.sku })}
                {deKV({ label: 'Condition', value: productObject.condition })}
                {deKV({ label: 'Brand', value: productObject.brand })}
                {deKV({ label: 'Item Name', value: productObject.itemName })}
                {deKV({ label: 'Category', value: productObject.category })}
                {deKV({ label: 'Type', value: productObject.type })}
                {deKV({ label: 'Strength', value: productObject.strength })}
                {deKV({ label: 'Shade', value: productObject.shade })}
                {deKV({ label: 'Formulation', value: productObject.formulation })}
                {deKV({ label: 'Size (oz)', value: productObject.sizeOz })}
                {deKV({ label: 'Size (ml)', value: productObject.sizeMl })}
                {deKV({ label: 'UPC', value: productObject.upc })}
                {deKV({ label: 'Alt SKU', value: productObject.alternativeSku })}
                {deKV({ label: 'Location', value: productObject.location })}
                {deKV({ label: 'Batch', value: productObject.batch })}
                {deKV({ label: 'Quantity', value: productObject.quantity })}
                {deKV({ label: 'Verified', value: productObject.verified ? 'Yes' : 'No' })}
                {deKV({ label: 'Listed', value: productObject.listed ? 'Yes' : 'No' })}
                {productObject.retailPrice != null && deKV({ label: 'Retail Price', value: `$${Number(productObject.retailPrice).toFixed(2)}` })}
                {productDetails.dupeOf && deKV({ label: 'Dupe / Clone Of', value: productDetails.dupeOf })}
              </Box>
            </Paper>
          </Box>

          {/* Right — editable data entry fields */}
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#374151' }}>Fields to Fill</Typography>
            </Box>
            <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {dataEntryFields.map(field => {
                if (field === 'fragranceNotes') {
                  if (productObject.category !== 'Fragrance') return null;
                  return (
                    <Box key={field}>
                      <FragranceNotesEditor
                        sku={productObject.sku}
                        onChange={(notes) => { fragranceNotesRef.current = notes; }}
                      />
                    </Box>
                  );
                }
                if (DATA_ENTRY_BOOLEAN_FIELDS.has(field)) {
                  return (
                    <Box key={field} sx={{ display: 'flex', alignItems: 'center' }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(dataEntryValues[field])}
                            onChange={e => setDataEntryValues(prev => ({ ...prev, [field]: e.target.checked }))}
                          />
                        }
                        label={DATA_ENTRY_FIELD_LABELS[field] ?? field}
                      />
                    </Box>
                  );
                }
                return (
                  <Box key={field}>
                    <TextField
                      fullWidth
                      size="small"
                      label={DATA_ENTRY_FIELD_LABELS[field] ?? field}
                      value={dataEntryValues[field] ?? ''}
                      onChange={e => setDataEntryValues(prev => ({ ...prev, [field]: e.target.value }))}
                      InputProps={field === 'image' && dataEntryValues.image ? {
                        endAdornment: (
                          <Box sx={{ width: 32, height: 32, flexShrink: 0, ml: 0.5 }}>
                            <img src={dataEntryValues.image} alt="" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          </Box>
                        ),
                      } : undefined}
                    />
                  </Box>
                );
              })}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 1 }}>
                <Button variant="outlined" onClick={() => navigate(-1)} sx={{ textTransform: 'none' }}>Cancel</Button>
                <Button variant="contained" onClick={handleDataEntrySubmit} disabled={dataEntrySaving} sx={{ textTransform: 'none', fontWeight: 600 }}>
                  {dataEntrySaving ? 'Saving...' : 'Save'}
                </Button>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>
    );
  }

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

  const handleAddNewPrice = () => {
    if (!canViewPricing) return;

    setEditingPrice({
      id: null,
      sku: productObject.sku,
      vendorInvoiceNumber: "",
      vendorName: "",
      price: "",
      quantity: 1,
      notes: "",
      isActive: true,
    });
    setIsEditingExisting(false);
  };

  const handleEditPrice = (price: any) => {
    if (!canViewPricing) return;

    setEditingPrice({
      ...price,
      price: price.price ?? "",
      quantity: price.quantity ?? 1,
      notes: price.notes || "",
    });
    setIsEditingExisting(true);
  };

  const handleCancelEdit = () => {
    setEditingPrice(null);
    setIsEditingExisting(false);
  };

  const handleSavePrice = async () => {
    if (!canViewPricing || !editingPrice) return;

    try {
      setLoadingPrices(true);
      setPricesError(null);

      const payload = {
        sku: productObject.sku,
        vendorInvoiceNumber: editingPrice.vendorInvoiceNumber || editingPrice.vendor || "",
        vendorName: editingPrice.vendorName || "",
        price: editingPrice.price,
        quantity: editingPrice.quantity ?? 1,
        notes: editingPrice.notes,
        isActive:
          editingPrice.isActive === undefined ? true : editingPrice.isActive,
      };

      if (isEditingExisting && editingPrice.id) {
        await axios.put(
          getApiUrl(`product-vendor-prices/${editingPrice.id}`),
          payload
        );
      } else {
        await axios.post(getApiUrl("product-vendor-prices"), payload);
      }

      setEditingPrice(null);
      setIsEditingExisting(false);
      await loadVendorPrices();
    } catch (error) {
      console.error("Error saving vendor price:", error);
      setPricesError("Failed to save vendor price");
    } finally {
      setLoadingPrices(false);
    }
  };

  const handleDeletePrice = async (id: number) => {
    if (!canViewPricing) return;

    try {
      setLoadingPrices(true);
      setPricesError(null);

      await axios.delete(getApiUrl(`product-vendor-prices/${id}`));
      await loadVendorPrices();
    } catch (error) {
      console.error("Error deleting vendor price:", error);
      setPricesError("Failed to delete vendor price");
    } finally {
      setLoadingPrices(false);
    }
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
              {formik.values.category === "Fragrance" && (
                <Paper variant="outlined" sx={{ my: 1, p: 2 }}>
                  <FragranceNotesEditor
                    sku={productObject.sku}
                    onChange={(notes) => { fragranceNotesRef.current = notes; }}
                  />
                </Paper>
              )}
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
                          disabled={brandsLoading}
                          input={<OutlinedInput label="Brand" />}
                        >
                          {availableBrands.map((brand) => (
                            <MenuItem key={`${brand.id}-${brand.brand}`} value={brand.brand}>
                              {brand.brand}
                            </MenuItem>
                          ))}
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
                          {formik.values.category === "Fragrance" && (
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField
                                fullWidth
                                id="dupeOf"
                                name="dupeOf"
                                label="Dupe / Clone Of (Smells Like)"
                                placeholder="e.g. Armani Code, Chanel No.5"
                                value={formik.values.dupeOf}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                multiline
                                rows={2}
                                variant="outlined"
                              />
                            </Box>
                          </Grid>
                          )}
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
                  {user?.role === 'admin' && (
                    <>
                      <Grid item xs={6}>
                        Track Quantity
                      </Grid>
                      <Grid item xs={6}>
                        <Switch
                          id="trackQuantity"
                          name="trackQuantity"
                          checked={formik.values.trackQuantity}
                          onChange={formik.handleChange}
                          inputProps={{ "aria-label": "controlled" }}
                        />
                      </Grid>
                      {formik.values.trackQuantity && (
                        <Grid item xs={12}>
                          <Box m={2}>
                            <TextField
                              fullWidth
                              id="minimumQuantity"
                              name="minimumQuantity"
                              label="Minimum Quantity"
                              type="number"
                              value={formik.values.minimumQuantity}
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                              error={
                                formik.touched.minimumQuantity &&
                                Boolean(formik.errors.minimumQuantity)
                              }
                              helperText={
                                formik.touched.minimumQuantity && typeof formik.errors.minimumQuantity === "string"
                                  ? formik.errors.minimumQuantity
                                  : ""
                              }
                            />
                          </Box>
                        </Grid>
                      )}
                    </>
                  )}
                  {canViewHbaListing && (
                    <>
                      <Grid item xs={6}>
                        HBA
                      </Grid>
                      <Grid item xs={6}>
                        <Switch
                          id="hbaEnabled"
                          name="hbaEnabled"
                          checked={formik.values.hbaEnabled}
                          onChange={formik.handleChange}
                          disabled={!canEditHbaListing}
                          inputProps={{ "aria-label": "controlled" }}
                        />
                      </Grid>
                      {formik.values.hbaEnabled && (
                        <>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField
                                fullWidth
                                id="hbaQuantity"
                                name="hbaQuantity"
                                label="HBA Quantity"
                                type="number"
                                value={formik.values.hbaQuantity}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                disabled={!canEditHbaListing}
                                error={
                                  formik.touched.hbaQuantity &&
                                  Boolean(formik.errors.hbaQuantity)
                                }
                                helperText={
                                  formik.touched.hbaQuantity && typeof formik.errors.hbaQuantity === "string"
                                    ? formik.errors.hbaQuantity
                                    : ""
                                }
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField
                                fullWidth
                                id="hbaPrice"
                                name="hbaPrice"
                                label="HBA Price"
                                type="number"
                                value={formik.values.hbaPrice}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                disabled={!canEditHbaListing}
                                error={
                                  formik.touched.hbaPrice &&
                                  Boolean(formik.errors.hbaPrice)
                                }
                                helperText={
                                  formik.touched.hbaPrice && typeof formik.errors.hbaPrice === "string"
                                    ? formik.errors.hbaPrice
                                    : ""
                                }
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField
                                fullWidth
                                id="hbaMoq"
                                name="hbaMoq"
                                label="HBA MOQ"
                                type="number"
                                value={formik.values.hbaMoq}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                disabled={!canEditHbaListing}
                                inputProps={{ min: 1, step: 1 }}
                                error={
                                  formik.touched.hbaMoq &&
                                  Boolean(formik.errors.hbaMoq)
                                }
                                helperText={
                                  formik.touched.hbaMoq && typeof formik.errors.hbaMoq === "string"
                                    ? formik.errors.hbaMoq
                                    : ""
                                }
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField
                                fullWidth
                                id="hbaStepCount"
                                name="hbaStepCount"
                                label="HBA Step Count"
                                type="number"
                                value={formik.values.hbaStepCount}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                disabled={!canEditHbaListing}
                                inputProps={{ min: 1, step: 1 }}
                                error={
                                  formik.touched.hbaStepCount &&
                                  Boolean(formik.errors.hbaStepCount)
                                }
                                helperText={
                                  formik.touched.hbaStepCount && typeof formik.errors.hbaStepCount === "string"
                                    ? formik.errors.hbaStepCount
                                    : ""
                                }
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <TextField
                                select
                                fullWidth
                                id="hbaCondition"
                                name="hbaCondition"
                                label="HBA Condition"
                                value={formik.values.hbaCondition}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                disabled={!canEditHbaListing}
                                helperText={`SKU condition: ${formik.values.condition || "N/A"}`}
                              >
                                <MenuItem value="">Use SKU condition</MenuItem>
                                {HBA_CONDITION_OPTIONS.map((condition) => (
                                  <MenuItem key={condition} value={condition}>
                                    {condition}
                                  </MenuItem>
                                ))}
                              </TextField>
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box m={2}>
                              <FormControlLabel
                                control={
                                  <Switch
                                    id="hbaNewArrival"
                                    name="hbaNewArrival"
                                    checked={formik.values.hbaNewArrival}
                                    onChange={formik.handleChange}
                                    disabled={!canEditHbaListing}
                                  />
                                }
                                label="New Arrival"
                              />
                            </Box>
                          </Grid>
                        </>
                      )}
                    </>
                  )}
                </Grid>
              </Paper>
            </Container>
            <PermissionGuard resource="pricing" action="view" showError={false}>
              <Container>
                <Paper
                  variant="outlined"
                  sx={{ my: { xs: 3, md: 3 }, p: { xs: 1, md: 4 } }}
                >
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={1}
                  >
                    <Typography variant="subtitle1">Pricing</Typography>
                    {averagePrice !== null && (
                      <Typography variant="body2" color="text.secondary">
                        Average price: ${averagePrice.toFixed(2)}
                      </Typography>
                    )}
                  </Box>
                  {pricesError && (
                    <Typography variant="body2" color="error" mb={1}>
                      {pricesError}
                    </Typography>
                  )}
                  {loadingPrices && (
                    <Typography variant="body2" color="text.secondary">
                      Loading pricing...
                    </Typography>
                  )}
                  {!loadingPrices && vendorPrices.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No vendor prices recorded.
                    </Typography>
                  )}
                  {!loadingPrices && vendorPrices.length > 0 && (
                    <Box mt={1}>
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: 13,
                        }}
                      >
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left", padding: 4 }}>
                              Vendor Name
                            </th>
                            <th style={{ textAlign: "left", padding: 4 }}>
                              Invoice #
                            </th>
                            <th style={{ textAlign: "right", padding: 4 }}>
                              Price
                            </th>
                            <th style={{ textAlign: "right", padding: 4 }}>
                              Qty
                            </th>
                            <th style={{ textAlign: "center", padding: 4 }}>
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {vendorPrices.map((price: any) => {
                            const name =
                              price.vendorName ||
                              price.vendor ||
                              "Unknown vendor";
                            const invoice = price.vendorInvoiceNumber || "";
                            const qty = price.quantity ?? 1;

                            return (
                              <tr key={price.id}>
                                <td style={{ padding: 4 }}>{name}</td>
                                <td style={{ padding: 4 }}>{invoice}</td>
                                <td
                                  style={{
                                    padding: 4,
                                    textAlign: "right",
                                  }}
                                >
                                  ${parseFloat(price.price).toFixed(2)}
                                </td>
                                <td
                                  style={{
                                    padding: 4,
                                    textAlign: "right",
                                  }}
                                >
                                  {qty}
                                </td>
                                <td
                                  style={{
                                    padding: 2,
                                    textAlign: "center",
                                  }}
                                >
                                  <Box
                                    display="flex"
                                    justifyContent="center"
                                    alignItems="center"
                                    gap={0.25}
                                  >
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={() => handleEditPrice(price)}
                                      sx={{ p: 0.25 }}
                                    >
                                      <EditIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() =>
                                        handleDeletePrice(price.id)
                                      }
                                      sx={{ p: 0.25 }}
                                    >
                                      <DeleteIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                  </Box>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </Box>
                  )}
                  {editingPrice && (
                    <Box mt={2}>
                      <Typography variant="subtitle2" gutterBottom>
                        {isEditingExisting ? "Edit Vendor Price" : "Add Vendor Price"}
                      </Typography>
                      <Box display="flex" flexDirection="column" gap={2}>
                        <TextField
                          fullWidth
                          id="editingVendorInvoiceNumber"
                          label="Vendor Invoice Number"
                          value={editingPrice.vendorInvoiceNumber || editingPrice.vendor || ""}
                          onChange={(e) =>
                            setEditingPrice({
                              ...editingPrice,
                              vendorInvoiceNumber: e.target.value,
                            })
                          }
                        />
                        <TextField
                          fullWidth
                          id="editingVendorName"
                          label="Vendor Name"
                          value={editingPrice.vendorName || ""}
                          onChange={(e) =>
                            setEditingPrice({
                              ...editingPrice,
                              vendorName: e.target.value,
                            })
                          }
                        />
                        <TextField
                          fullWidth
                          id="editingPrice"
                          label="Unit Price"
                          type="number"
                          value={editingPrice.price ?? ""}
                          onChange={(e) =>
                            setEditingPrice({
                              ...editingPrice,
                              price: e.target.value,
                            })
                          }
                        />
                        <TextField
                          fullWidth
                          id="editingQuantity"
                          label="Quantity Purchased"
                          type="number"
                          inputProps={{ min: 1 }}
                          value={editingPrice.quantity ?? 1}
                          onChange={(e) =>
                            setEditingPrice({
                              ...editingPrice,
                              quantity: parseInt(e.target.value, 10) || 1,
                            })
                          }
                        />
                        <TextField
                          fullWidth
                          id="editingNotes"
                          label="Notes"
                          multiline
                          minRows={2}
                          value={editingPrice.notes || ""}
                          onChange={(e) =>
                            setEditingPrice({
                              ...editingPrice,
                              notes: e.target.value,
                            })
                          }
                        />
                        <Box display="flex" justifyContent="flex-end" gap={1}>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="contained"
                            size="small"
                            onClick={handleSavePrice}
                          >
                            Save
                          </Button>
                        </Box>
                      </Box>
                    </Box>
                  )}
                  <Box mt={2}>
                    <Button
                      variant="outlined"
                      fullWidth
                      size="small"
                      onClick={handleAddNewPrice}
                    >
                      Add Vendor Price
                    </Button>
                  </Box>
                </Paper>
              </Container>
            </PermissionGuard>
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

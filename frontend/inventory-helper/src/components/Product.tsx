import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  Paper,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import SellIcon from "@mui/icons-material/Sell";
import ScienceIcon from "@mui/icons-material/Science";
import CancelIcon from "@mui/icons-material/Cancel";
import { toast } from "react-toastify";
import Barcode from "./Barcode";
import PrintableLabel from "./PrintableLabel";
import { useReactToPrint } from "react-to-print";
import { useAuth } from "../context/AuthContext";
import { getApiUrl } from "../config/api";
import { invalidateProductsCache } from "../utils/productCache";

function Product() {
  let { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [productObject, setProductObject]: any = useState({});
  const [barcodeValue, setBarcodeValue] = useState(productObject.sku);
  const [productDetails, setProductDetails]: any = useState({});
  const [productListings, setProductListings]: any = useState({});
  const labelRef = useRef<HTMLDivElement>(null);
  const [restockDialogOpen, setRestockDialogOpen] = useState(false);
  const [restockQuantity, setRestockQuantity] = useState<number>(0);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [updatePrice, setUpdatePrice] = useState<number>(0);
  const isAdmin = user?.role === "admin";

  const [vendorPrices, setVendorPrices] = useState<any[]>([]);
  const [averagePrice, setAveragePrice] = useState<number | null>(null);
  const [inboundHistory, setInboundHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Reset states before fetching new data
        setProductObject({});
        setProductDetails({});
        setProductListings({});

        const { data: product } = await axios.get(
          getApiUrl(`products/byId/${id}?nocache=${Date.now()}`)
        );
        setProductObject(product);
        setBarcodeValue(product.sku);
        const { data: details } = await axios.get(
          getApiUrl(`productDetails/bySku?nocache=${Date.now()}`),
          {
            params: { sku: product.sku },
          }
        );
        setProductDetails(details);

        try {
          const { data: listings } = await axios.get(
            getApiUrl(`listings/bySku?nocache=${Date.now()}`),
            {
              params: { sku: product.sku },
            }
          );
          setProductListings(listings);
        } catch (listingsError: any) {
          if (listingsError?.response?.status !== 404) {
            console.error("Error fetching product listings:", listingsError);
          }
          setProductListings({});
        }

      } catch (error) {
        console.error("Error fetching product data:", error);
      }
    };

    // If coming back from the edit page, update state instead of refetching
    if (location.state?.updatedProduct) {
      setProductObject(location.state.updatedProduct);
      setProductDetails(location.state.updatedDetails || {});
      setProductListings(location.state.updatedListings || {});
      setBarcodeValue(location.state.updatedProduct.sku);
    } else {
      fetchData(); // Fetch only if no updated product is passed
    }
  }, [id, location.state]);

  // Separate effect for pricing + inbound history.
  // Kept separate so it re-fires when auth finishes loading (user was null on first render).
  useEffect(() => {
    const sku = productObject.sku;
    if (!sku || !user) return;

    // Inbound history — visible to all authenticated users
    axios
      .get(getApiUrl(`inbound/bySku/${sku}`))
      .then(({ data }) => setInboundHistory(data || []))
      .catch((err) => console.error("Error fetching inbound history:", err));

    // Vendor pricing — admin only
    if (user.role === "admin") {
      axios
        .get(getApiUrl(`product-vendor-prices/${sku}`))
        .then(({ data: pricingData }) => {
          setVendorPrices(pricingData.vendorPrices || []);
          const avg = pricingData.averagePrice;
          setAveragePrice(avg !== null && avg !== undefined ? Number(avg) : null);
        })
        .catch((err) => console.error("Error fetching vendor prices:", err));
    }
  }, [productObject.sku, user]);

  // Handle the edit button click and redirect with the product to edit page
  const handleEditOnClick = useCallback(() => {
    if (
      !productObject.verified ||
      window.confirm("This is a verified entry. Do you want to edit?")
    ) {
      navigate("/editProduct", {
        state: { productObject, productDetails, productListings },
      });
    }
  }, [navigate, productObject, productDetails, productListings]);

  // Function to handle product deletion with password confirmation
  const handleDeleteClick = useCallback(async () => {
    const passwordToDelete = prompt("Enter Password to delete");

    if (passwordToDelete === "1080") {
      try {
        await axios.delete(
          getApiUrl(`products/delete/${productObject.sku}`)
        );
        invalidateProductsCache();
        toast.success("Deleted Successfully!", { position: "top-right" });
        navigate("/", { state: { clearFilters: true } });
      } catch (error) {
        console.error("Error deleting the product:", error);
        toast.error("Failed to delete the product.", { position: "top-right" });
      }
    } else {
      toast.error("Incorrect password. Please Try Again.", {
        position: "top-right",
      });
    }
  }, [navigate, productObject, user]);

  const handleInboundClick = useCallback(() => {
    navigate("/inbound", { state: { productObject } });
  }, [navigate, productObject]);

  const handlePrintClick = useReactToPrint({
    content: () => labelRef.current,
    documentTitle: `Label-${productObject.sku}`,
  });

  const handleAddSimilar = () => {
    navigate("/addProduct", {
      state: {
        productObject: {
          ...productObject,
          sku: "", // Clear SKU for new product
          quantity: "", // Clear quantity for new product
          location: "", // Clear location for new product
        },
        productDetails,
      },
    });
  };

  const handleSalesClick = useCallback(() => {
    navigate("/sales", { state: { productObject } });
  }, [navigate, productObject]);

  const handleOutOfStockClick = useCallback(async () => {
    try {
      const response = await axios.post(
        getApiUrl(`ebayAPI/updateQuantity`),
        {
          sku: productObject.sku,
          quantity: 0,
        }
      );

      if (response.data) {
        toast.success("Product marked as out of stock on eBay!", { position: "top-right" });
      }
    } catch (error) {
      console.error("Error marking product as out of stock:", error);
      toast.error("Failed to mark product as out of stock", { position: "top-right" });
    }
  }, [productObject.sku]);

  const handleRestockClick = useCallback(async () => {
    try {
      const response = await axios.post(
        getApiUrl(`ebayAPI/updateQuantity`),
        {
          sku: productObject.sku,
          quantity: restockQuantity,
        }
      );

      if (response.data) {
        toast.success("Product quantity updated on eBay!", { position: "top-right" });
      }
    } catch (error) {
      console.error("Error updating product quantity on eBay:", error);
      toast.error("Failed to update product quantity on eBay", { position: "top-right" });
    }
  }, [productObject.sku, restockQuantity]);

  const handlePriceUpdateClick = useCallback(async () => {
    try {
      const response = await axios.post(
        getApiUrl(`ebayAPI/updatePrice`),
        {
          sku: productObject.sku,
          price: updatePrice,
        }
      );

      if (response.data) {
        toast.success("Product price updated on eBay!", { position: "top-right" });
      }
    } catch (error) {
      console.error("Error updating product price on eBay:", error);
      toast.error("Failed to update product price on eBay", { position: "top-right" });
    }
  }, [productObject.sku, updatePrice]);

  return (
    <div className="product-container">
      <Paper
        sx={{
          my: { xs: 1, md: 4 },
          p: { xs: 4, md: 4 },
          height: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Grid container spacing={0} sx={{ flex: 1, overflow: "auto" }}>
          <Grid item xs={4} sx={{ height: "100%" }}>
            <Box
              p={2}
              display="flex"
              justifyContent="center"
              sx={{ height: "100%", width: "100%" }}
            >
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "auto",
                  p: 2,
                }}
              >
                <CardContent
                  sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "auto",
                  }}
                >
                  <Typography variant="h6" gutterBottom align="center">
                    <strong>
                      <u>Product Details</u>
                    </strong>
                  </Typography>
                  <br></br>
                  {[
                    ["SKU", productObject.sku],
                    ["Brand", productObject.brand],
                    ["Item Name", productObject.itemName],
                    ["Strength", productObject.strength],
                    ["Shade / Variant", productObject.shade],
                    [
                      "Size",
                      `${productObject.sizeOz} oz. / ${productObject.sizeMl} ml`,
                    ],
                    ["Category", productObject.category],
                    ["Type", productObject.type],
                    ["Condition", productObject.condition],
                    ["Period After Opening (PAO)", productDetails.pao],
                    ["UPC", productObject.upc],
                  ].map(([label, value]) => (
                    <Box
                      key={label}
                      display="flex"
                      justifyContent="space-between"
                      py={1}
                    >
                      <Typography variant="body1" fontWeight="bold">
                        {label}:
                      </Typography>
                      <Typography variant="body1">{value}</Typography>
                    </Box>
                  ))}
                  <br></br>
                  {productDetails.tester && (
                    <Box>
                      <ScienceIcon sx={{ color: "red", fontSize: 40 }} />
                      <p>Tester</p>
                    </Box>
                  )}
                  {productDetails.discontinued && (
                    <Box>
                      <CancelIcon sx={{ color: "purple", fontSize: 40 }} />
                      <p>Discontinued</p>
                    </Box>
                  )}
                  <button onClick={handleAddSimilar}>Add Similar</button>
                </CardContent>
              </Card>
            </Box>
          </Grid>
          <Grid item xs={4} sx={{ height: "100%" }}>
            <Box
              p={2}
              display="flex"
              justifyContent="center"
              sx={{ height: "100%", width: "100%" }}
            >
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "auto",
                  mx: 4,
                  p: 2,
                }}
              >
                <CardContent
                  sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Typography variant="h6" gutterBottom align="center">
                    <strong>
                      <u>Warehouse Details</u>
                    </strong>
                  </Typography>
                  <br />
                  {[
                    ["Location", productObject.location],
                    ["Quantity Available", productObject.quantity],
                  ].map(([label, value]) => (
                    <Box
                      key={label}
                      display="flex"
                      justifyContent="space-between"
                      py={1}
                    >
                      <Typography variant="body1" fontWeight="bold">
                        {label}:
                      </Typography>
                      <Typography variant="body1">{value}</Typography>
                    </Box>
                  ))}
                  <Typography variant="body1" fontWeight="bold">Warehouse Location</Typography>
                  <Box display="flex" justifyContent="space-between" py={1}>
                    <Typography variant="body1">{productObject.warehouseLocations || "—"}</Typography>
                  </Box>

                  {/* Vendor Pricing — admin only, fixed height scrollable */}
                  {user?.role === "admin" && (
                    <>
                      <Divider sx={{ my: 1.5 }} />
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          Vendor Pricing
                        </Typography>
                        {averagePrice !== null && (
                          <Typography variant="body2" color="text.secondary">
                            Avg cost: ${averagePrice.toFixed(2)}
                          </Typography>
                        )}
                      </Box>
                      <Box
                        sx={{
                          height: 120,
                          overflowY: "auto",
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 1,
                          p: 1,
                          bgcolor: "background.paper",
                        }}
                      >
                        {vendorPrices.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            No vendor prices recorded.
                          </Typography>
                        ) : (
                          <table
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                              fontSize: 13,
                            }}
                          >
                            <thead>
                              <tr>
                                <th
                                  style={{ textAlign: "left", padding: 4 }}
                                >
                                  Vendor Name
                                </th>
                                <th
                                  style={{ textAlign: "left", padding: 4 }}
                                >
                                  Invoice #
                                </th>
                                <th
                                  style={{ textAlign: "right", padding: 4 }}
                                >
                                  Price
                                </th>
                                <th
                                  style={{ textAlign: "right", padding: 4 }}
                                >
                                  Qty
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {vendorPrices.map((vp: any) => {
                                const name =
                                  vp.vendorName ||
                                  vp.vendor ||
                                  "Unknown vendor";
                                const invoice = vp.vendorInvoiceNumber || "";
                                const qty = vp.quantity ?? 1;

                                return (
                                  <tr key={vp.id}>
                                    <td style={{ padding: 4 }}>{name}</td>
                                    <td style={{ padding: 4 }}>{invoice}</td>
                                    <td
                                      style={{
                                        padding: 4,
                                        textAlign: "right",
                                      }}
                                    >
                                      ${parseFloat(vp.price).toFixed(2)}
                                    </td>
                                    <td
                                      style={{
                                        padding: 4,
                                        textAlign: "right",
                                      }}
                                    >
                                      {qty}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </Box>
                    </>
                  )}

                  {/* Inbound History — fixed height scrollable */}
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="subtitle2" fontWeight="bold" mb={0.5}>
                    Inbound History
                  </Typography>
                  <Box
                    sx={{
                      height: 120,
                      overflowY: "auto",
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      p: 1,
                      bgcolor: "background.paper",
                    }}
                  >
                    {inboundHistory.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No inbound records found.
                      </Typography>
                    ) : (
                      inboundHistory.map((record: any) => (
                        <Box key={record.compositeSku} py={0.25}>
                          {(() => {
                            const name =
                              record.vendorName ||
                              record.vendor ||
                              "Unknown vendor";
                            const invoice =
                              record.vendorInvoiceNumber || "";
                            const vendorDisplay = invoice
                              ? `${name} (Invoice: ${invoice})`
                              : name;
                            return (
                              <Typography variant="body2">
                                {vendorDisplay} — Qty: {record.quantity} —{" "}
                                {record.date
                                  ? new Date(record.date).toLocaleDateString("en-US", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    })
                                  : "No date"}
                              </Typography>
                            );
                          })()}
                        </Box>
                      ))
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Grid>
          <Grid item xs={4} sx={{ display: "flex", flexDirection: "column" }}>
            <Box
              border={1}
              sx={{
                flex: 0.8,
                display: "flex",
                flexDirection: "column",
                overflow: "auto",
              }}
            >
              <img src={productObject.image} height="auto" />
            </Box>

            <Box
              p={4}
              sx={{
                flex: 0.2,
                display: "flex",
                flexDirection: "column",
                cursor: "pointer",
              }}
            >
              <Barcode value={barcodeValue} />
            </Box>
          </Grid>
        </Grid>
        <Box mt={2} display="flex" justifyContent="center" gap={1}>
          <Button
            variant="contained"
            color="success"
            startIcon={<EditIcon />}
            onClick={handleEditOnClick}
          >
            Edit
          </Button>
          <Button
            variant="contained"
            startIcon={<SellIcon />}
            onClick={handlePrintClick}
          >
            Print Label
          </Button>
          <div style={{ display: "none" }}>
            <PrintableLabel
              ref={labelRef}
              product={productObject}
              productDetails={productDetails}
            />
          </div>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<WarehouseIcon />}
            onClick={handleInboundClick}
          >
            Inbound
          </Button>
          {isAdmin && (
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteClick}
            >
              Delete
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<SellIcon />}
            onClick={handleSalesClick}
          >
            Sold
          </Button>
          {isAdmin && (
            <Button
              variant="contained"
              color="warning"
              startIcon={<SellIcon />}
              onClick={handleOutOfStockClick}
            >
              Out of Stock
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="contained"
              color="info"
              startIcon={<WarehouseIcon />}
              onClick={() => setRestockDialogOpen(true)}
            >
              Restock
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<EditIcon />}
              onClick={() => setPriceDialogOpen(true)}
            >
              Update Price
            </Button>
          )}
        </Box>
      </Paper>
      {isAdmin && (
        <Dialog
          open={restockDialogOpen}
          onClose={() => setRestockDialogOpen(false)}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">{"Restock Product"}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              id="name"
              label="Quantity"
              type="number"
              fullWidth
              value={restockQuantity}
              onChange={(e) => setRestockQuantity(Number(e.target.value))}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRestockDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              handleRestockClick();
              setRestockDialogOpen(false);
            }}>Restock</Button>
          </DialogActions>
        </Dialog>
      )}
      {isAdmin && (
        <Dialog
          open={priceDialogOpen}
          onClose={() => setPriceDialogOpen(false)}
          aria-labelledby="price-dialog-title"
          aria-describedby="price-dialog-description"
        >
          <DialogTitle id="price-dialog-title">{"Update Product Price"}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              id="price"
              label="Price"
              type="number"
              fullWidth
              value={updatePrice}
              onChange={(e) => setUpdatePrice(Number(e.target.value))}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPriceDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              handlePriceUpdateClick();
              setPriceDialogOpen(false);
            }}>Update</Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}

export default Product;

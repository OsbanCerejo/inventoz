import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Home from "./pages/Home";
import Products from "./pages/Products";
import AddProduct from "./pages/AddProduct";
import Product from "./components/Product";
import NavBar from "./components/NavBar";
import EditProduct from "./pages/EditProduct";
import { Search } from "@mui/icons-material";
import Sales from "./pages/Sales";
import HbaOrders from "./pages/HbaOrders";
import HbaAnalytics from "./pages/HbaAnalytics";
import InboundProduct from "./pages/InboundProduct";
import InboundData from "./pages/InboundData";
import { ToastContainer } from "react-toastify";
import AllOrders from "./pages/AllOrders";
import "./App.css";
import PackingMode from "./pages/PackingMode";
import EbayApi from "./pages/EbayApi";
import Whatnot from "./pages/Whatnot";
import WhatnotFulfillment from "./pages/WhatnotFulfillment";
import TikTokFulfillment from "./pages/TikTokFulfillment";
// import WhatnotAnalytics from "./pages/WhatnotAnalytics"; // hidden — superseded by WhatnotFulfillmentAnalytics
import WhatnotFulfillmentAnalytics from "./pages/WhatnotFulfillmentAnalytics";
import TikTokFulfillmentAnalytics from "./pages/TikTokFulfillmentAnalytics";
import SortingAnalytics from "./pages/SortingAnalytics";
import WalmartIntegration from "./pages/WalmartIntegration";
import WalmartOrders from "./pages/WalmartOrders";
import WalmartProductCatalog from "./pages/WalmartProductCatalog";
import PriceList from "./pages/PriceList";
import PriceScanner from "./pages/PriceScanner";
import Users from "./pages/Users";
import BarcodeScan from "./pages/BarcodeScan";
import PackingAnalytics from "./pages/PackingAnalytics";
import LabelGenerator from "./pages/LabelGenerator";
import Tickets from "./pages/Tickets";
import CustomerService from "./pages/CustomerService";
import InvoiceTracker from "./pages/InvoiceTracker";
import Login from "./pages/Login";
import LowStock from "./pages/LowStock";
import Brands from "./pages/Brands";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleBasedHome from "./components/RoleBasedHome";
import { useAuth } from "./context/AuthContext";
import { CircularProgress, Box, Alert, Button, Collapse, Stack } from "@mui/material";
import { getServerUrl } from "./config/api";

const FRONTEND_BUILD_ID = import.meta.env.VITE_APP_BUILD_ID || "development";
const UPDATE_DISMISS_KEY = "dismissed_update_build_id";

function BuildUpdateBanner() {
  const { isAuthenticated } = useAuth();
  const [availableBuildId, setAvailableBuildId] = useState<string | null>(null);

  const dismissedBuildId = useMemo(
    () => window.sessionStorage.getItem(UPDATE_DISMISS_KEY),
    [availableBuildId]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setAvailableBuildId(null);
      return;
    }

    let cancelled = false;

    const checkForUpdates = async () => {
      try {
        const response = await axios.get(`${getServerUrl()}/meta/version`, {
          timeout: 5000,
        });
        const remoteBuildId = String(response.data?.buildId || "").trim();
        if (!remoteBuildId || cancelled) return;

        if (remoteBuildId !== FRONTEND_BUILD_ID && remoteBuildId !== dismissedBuildId) {
          setAvailableBuildId(remoteBuildId);
        } else if (remoteBuildId === FRONTEND_BUILD_ID) {
          setAvailableBuildId(null);
        }
      } catch (error) {
        console.error("Failed to check for build updates:", error);
      }
    };

    checkForUpdates();
    const intervalId = window.setInterval(checkForUpdates, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, dismissedBuildId]);

  if (!isAuthenticated || !availableBuildId) {
    return null;
  }

  return (
    <Collapse in={!!availableBuildId}>
      <Box sx={{ px: 2, pt: 2 }}>
        <Alert
          severity="info"
          sx={{ alignItems: "center" }}
          action={
            <Stack direction="row" spacing={1}>
              <Button
                color="inherit"
                size="small"
                variant="outlined"
                onClick={() => {
                  window.sessionStorage.setItem(UPDATE_DISMISS_KEY, availableBuildId);
                  setAvailableBuildId(null);
                }}
              >
                Dismiss
              </Button>
              <Button
                color="inherit"
                size="small"
                variant="contained"
                onClick={() => window.location.reload()}
              >
                Refresh Now
              </Button>
            </Stack>
          }
        >
          A new update has been installed. Finish your current task, save your work, then refresh to load the latest version.
        </Alert>
      </Box>
    </Collapse>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading spinner while permissions are being fetched
  if (isLoading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div className="app-container">
      <Router>
        {isAuthenticated && <NavBar />}
        <BuildUpdateBanner />
        <div className="main-content">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <RoleBasedHome>
                    <Home />
                  </RoleBasedHome>
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ProtectedRoute resource="products" action="view" menuItem="products">
                  <Products />
                </ProtectedRoute>
              }
            />
            <Route
              path="/addProduct"
              element={
                <ProtectedRoute resource="addProduct" action="create" menuItem="addProduct">
                  <AddProduct />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products/:id"
              element={
                <ProtectedRoute resource="products" action="view" menuItem="products">
                  <Product />
                </ProtectedRoute>
              }
            />
            <Route
              path="/editProduct"
              element={
                <ProtectedRoute resource="products" action="edit" menuItem="products">
                  <EditProduct />
                </ProtectedRoute>
              }
            />
            <Route
              path="/search"
              element={
                <ProtectedRoute resource="products" action="view" menuItem="products">
                  <Search />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inbound"
              element={
                <ProtectedRoute resource="inbound" action="create" menuItem="inbound">
                  <InboundProduct />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inbound/showAll"
              element={
                <ProtectedRoute resource="inbound" action="view" menuItem="inbound">
                  <InboundData />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales"
              element={
                <ProtectedRoute resource="sales" action="view" menuItem="sales">
                  <Sales />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/showAll"
              element={
                <ProtectedRoute resource="orders" action="view" menuItem="orders">
                  <AllOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/packingMode"
              element={
                <ProtectedRoute resource="packing" action="view" menuItem="packing">
                  <PackingMode />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ebayAPI"
              element={
                <ProtectedRoute resource="ebay" action="view" menuItem="orders">
                  <EbayApi />
                </ProtectedRoute>
              }
            />
            <Route
              path="/whatnot"
              element={
                <ProtectedRoute resource="whatnot" action="view" menuItem="whatnot">
                  <Whatnot />
                </ProtectedRoute>
              }
            />
            <Route
              path="/whatnot-fulfillment"
              element={
                <ProtectedRoute resource="whatnotFulfillment" action="view" menuItem="whatnotFulfillment">
                  <WhatnotFulfillment />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tiktok-fulfillment"
              element={
                <ProtectedRoute resource="tiktokFulfillment" action="view" menuItem="tiktokFulfillment">
                  <TikTokFulfillment />
                </ProtectedRoute>
              }
            />
            {/* /whatnot-analytics hidden — superseded by /whatnot-fulfillment-analytics */}
            <Route
              path="/whatnot-fulfillment-analytics"
              element={
                <ProtectedRoute resource="whatnotAnalytics" action="view" menuItem="whatnotAnalytics">
                  <WhatnotFulfillmentAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tiktok-fulfillment-analytics"
              element={
                <ProtectedRoute resource="tiktokAnalytics" action="view" menuItem="tiktokAnalytics">
                  <TikTokFulfillmentAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sorting-analytics"
              element={
                <ProtectedRoute resource="sortingAnalytics" action="view" menuItem="sortingAnalytics">
                  <SortingAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/walmart-product-catalog"
              element={
                <ProtectedRoute
                  resource="walmartIntegration"
                  action="view"
                  menuItem="walmartIntegration"
                >
                  <WalmartProductCatalog />
                </ProtectedRoute>
              }
            />
            <Route
              path="/walmart-integration"
              element={
                <ProtectedRoute
                  resource="walmartIntegration"
                  action="view"
                  menuItem="walmartIntegration"
                >
                  <WalmartIntegration />
                </ProtectedRoute>
              }
            />
            <Route
              path="/walmart-orders"
              element={
                <ProtectedRoute resource="walmartOrders" action="view" menuItem="walmartOrders">
                  <WalmartOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/price-list"
              element={
                <ProtectedRoute resource="pricelist" action="view" menuItem="pricelist">
                  <PriceList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/price-scanner"
              element={
                <ProtectedRoute resource="priceScanner" action="view" menuItem="priceScanner">
                  <PriceScanner />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hba-orders"
              element={
                <ProtectedRoute resource="hbaOrders" action="view" menuItem="hbaOrders">
                  <HbaOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hba-analytics"
              element={
                <ProtectedRoute resource="hbaAnalytics" action="view" menuItem="hbaAnalytics">
                  <HbaAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute resource="users" action="view" menuItem="users">
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path="/barcode-scan"
              element={
                <ProtectedRoute menuItem="barcodeScan">
                  <BarcodeScan />
                </ProtectedRoute>
              }
            />
            <Route
              path="/packing-analytics"
              element={
                <ProtectedRoute resource="packingAnalytics" action="view" menuItem="packingAnalytics">
                  <PackingAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/low-stock"
              element={
                <ProtectedRoute resource="lowStock" action="view" menuItem="lowStock">
                  <LowStock />
                </ProtectedRoute>
              }
            />
            <Route
              path="/label-generator"
              element={
                <ProtectedRoute resource="labelGenerator" action="view" menuItem="labelGenerator">
                  <LabelGenerator />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tickets"
              element={
                <ProtectedRoute resource="tickets" action="view" menuItem="tickets">
                  <Tickets />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customer-service"
              element={
                <ProtectedRoute resource="customerService" action="view" menuItem="customerService">
                  <CustomerService />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoice-tracker"
              element={
                <ProtectedRoute resource="invoiceTracker" action="view" menuItem="invoiceTracker">
                  <InvoiceTracker />
                </ProtectedRoute>
              }
            />
            <Route
              path="/brands"
              element={
                <ProtectedRoute resource="brands" action="view" menuItem="brands">
                  <Brands />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </Router>
      <ToastContainer />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

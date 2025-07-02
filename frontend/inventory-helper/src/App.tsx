import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Products from "./pages/Products";
import AddProduct from "./pages/AddProduct";
import Product from "./components/Product";
import NavBar from "./components/NavBar";
import EditProduct from "./pages/EditProduct";
import { Search } from "@mui/icons-material";
import Sales from "./pages/Sales";
import InboundProduct from "./pages/InboundProduct";
import InboundData from "./pages/InboundData";
import { ToastContainer } from "react-toastify";
import AllOrders from "./pages/AllOrders";
import "./App.css";
import PackingMode from "./pages/PackingMode";
import EbayApi from "./pages/EbayApi";
import Whatnot from "./pages/Whatnot";
import PriceList from "./pages/PriceList";
import EmployeeInformation from "./pages/EmployeeInformation";
import Users from "./pages/Users";
import Login from "./pages/Login";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleBasedHome from "./components/RoleBasedHome";
import { useAuth } from "./context/AuthContext";
import { CircularProgress, Box } from "@mui/material";

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
                <ProtectedRoute resource="addProduct" action="create" menuItem="products">
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
                <ProtectedRoute menuItem="inbound">
                  <InboundData />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales"
              element={
                <ProtectedRoute resource="sales" action="view" menuItem="orders">
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
              path="/price-list"
              element={
                <ProtectedRoute resource="pricelist" action="view" menuItem="pricelist">
                  <PriceList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee-info"
              element={
                <ProtectedRoute resource="employeeInfo" action="view" menuItem="employeeInfo">
                  <EmployeeInformation />
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

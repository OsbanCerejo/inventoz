import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
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
import { useAuth } from "./context/AuthContext";

function AppContent() {
  const { isAuthenticated } = useAuth();

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
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/addProduct"
              element={
                <ProtectedRoute>
                  <AddProduct />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products/:id"
              element={
                <ProtectedRoute>
                  <Product />
                </ProtectedRoute>
              }
            />
            <Route
              path="/editProduct"
              element={
                <ProtectedRoute>
                  <EditProduct />
                </ProtectedRoute>
              }
            />
            <Route
              path="/search"
              element={
                <ProtectedRoute>
                  <Search />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inbound"
              element={
                <ProtectedRoute>
                  <InboundProduct />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inbound/showAll"
              element={
                <ProtectedRoute>
                  <InboundData />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales"
              element={
                <ProtectedRoute>
                  <Sales />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/showAll"
              element={
                <ProtectedRoute>
                  <AllOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/packingMode"
              element={
                <ProtectedRoute>
                  <PackingMode />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ebayAPI"
              element={
                <ProtectedRoute>
                  <EbayApi />
                </ProtectedRoute>
              }
            />
            <Route
              path="/whatnot"
              element={
                <ProtectedRoute>
                  <Whatnot />
                </ProtectedRoute>
              }
            />
            <Route
              path="/price-list"
              element={
                <ProtectedRoute>
                  <PriceList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee-info"
              element={
                <ProtectedRoute>
                  <EmployeeInformation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
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

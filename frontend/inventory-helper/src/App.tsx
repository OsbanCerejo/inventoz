import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import Home from "./pages/Home";
import AddProduct from "./pages/AddProduct";
import Product from "./components/Product";
import NavBar from "./components/NavBar";
import EditProduct from "./pages/EditProduct";
import { Search } from "@mui/icons-material";
import Sales from "./pages/Sales";
import Listings from "./pages/Listings";
import InboundProduct from "./pages/InboundProduct";
import InboundData from "./pages/InboundData";
import { ToastContainer } from "react-toastify";
import AllOrders from "./pages/AllOrders";
import SephoraSearch from "./pages/SephoraSearch";
import "./App.css";

function App() {
  return (
    <div className="app-container">
      <Router>
        <NavBar />
        <div className="main-content">
          <Routes>
            <Route path="/" Component={Home}></Route>
            <Route path="/addProduct" Component={AddProduct}></Route>
            <Route path="/products/:id" Component={Product}></Route>
            <Route path="/editProduct" Component={EditProduct}></Route>
            <Route path="/search" Component={Search}></Route>
            <Route path="/inbound" Component={InboundProduct}></Route>
            <Route path="/inbound/showAll" Component={InboundData}></Route>
            <Route path="/sales" Component={Sales}></Route>
            <Route path="/listings" Component={Listings}></Route>
            <Route path="/orders/showAll" Component={AllOrders}></Route>
            <Route path="/sephoraSearch" Component={SephoraSearch}></Route>
          </Routes>
        </div>
      </Router>
      <ToastContainer />
    </div>
  );
}

export default App;

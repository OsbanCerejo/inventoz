import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import Home from "./pages/Home";
import AddProduct from "./pages/AddProduct";
import Product from "./components/Product";
import { Container } from "@mui/system";
import NavBar from "./components/NavBar";
import EditProduct from "./pages/EditProduct";
import { Search } from "@mui/icons-material";
import Inbound from "./pages/Inbound";
import Sales from "./pages/Sales";
import Listings from "./pages/Listings";

function App() {
  return (
    <Container>
      <Router>
        <NavBar></NavBar>
        <Routes>
          <Route path="/" Component={Home}></Route>
          <Route path="/addProduct" Component={AddProduct}></Route>
          <Route path="/products/:id" Component={Product}></Route>
          <Route path="/editProduct" Component={EditProduct}></Route>
          <Route path="/search/:query" Component={Search}></Route>
          <Route path="/inbound" Component={Inbound}></Route>
          <Route path="/sales" Component={Sales}></Route>
          <Route path="/listings" Component={Listings}></Route>
        </Routes>
      </Router>
    </Container>
  );
}

export default App;

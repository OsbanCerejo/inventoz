import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import Home from "./pages/Home";
import AddProduct from "./pages/AddProduct";
import Product from "./components/Product";
import { Container } from "@mui/system";
import NavBar from "./components/NavBar";
import EditProduct from "./pages/EditProduct";
import { Search } from "@mui/icons-material";

function App() {
  return (
    <Container>
      <Router>
        <NavBar></NavBar>
        {/* <Link to="/">Home</Link>
        <br></br>
        <Link to="/addProduct">Add product</Link>
        <br></br>
        <br></br> */}
        <Routes>
          <Route path="/" Component={Home}></Route>
          <Route path="/addProduct" Component={AddProduct}></Route>
          <Route path="/products/:id" Component={Product}></Route>
          <Route path="/editProduct" Component={EditProduct}></Route>
          <Route path="/search/:query" Component={Search}></Route>
        </Routes>
      </Router>
    </Container>
  );
}

export default App;

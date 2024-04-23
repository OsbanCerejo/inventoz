import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import Home from "./pages/Home";
import AddProduct from "./components/AddProduct";
import Product from "./components/Product";

function App() {
  return (
    <div>
      <Router>
        <Link to="/">Home</Link>
        <br></br>
        <Link to="/addProduct">Add product</Link>
        <Routes>
          <Route path="/" Component={Home}></Route>
          <Route path="/addProduct" Component={AddProduct}></Route>
          <Route path="/products/:id" Component={Product}></Route>
        </Routes>
      </Router>
    </div>
  );
}

export default App;

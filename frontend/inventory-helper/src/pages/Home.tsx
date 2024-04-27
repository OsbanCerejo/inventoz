import axios from "axios";
import { useEffect, useState } from "react";
import ProductList from "../components/ProductList";

// export interface Products {
//   sku: string;
//   brand: string;
//   itemName: string;
//   quantity: number;
//   location: string;
//   sizeOz: number;
//   sizeMl: number;
//   strength: string;
//   shade: string;
//   formulation: string;
//   category: string;
//   type: string;
//   upc: number;
//   batch: string;
//   condition: string;
// }

function Home() {
  const [listOfProducts, setListOfProducts] = useState([]);
  let heading = "Products";

  useEffect(() => {
    axios.get("http://localhost:3001/products").then((response) => {
      setListOfProducts(response.data);
    });
  }, []);
  return (
    <div>
      <br></br>
      <form className="form-inline">
        <input
          className="form-control mr-sm-2"
          type="text"
          placeholder="Search"
          aria-label="Search"
          name="search"
        />
        <button className="btn btn-outline-success my-2 my-sm-0" type="submit">
          Search
        </button>
      </form>
      <ProductList products={listOfProducts} heading={heading}></ProductList>z
    </div>
  );
}

export default Home;

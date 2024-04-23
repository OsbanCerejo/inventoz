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
  // const [listVisible, setListVisibility] = useState(false);
  // const [buttonText, setButtonText] = useState("Show List");
  const [listOfProducts, setListOfProducts] = useState([]);
  let heading = "Products";

  // const onClickButton = () => {
  //   if (listVisible) {
  //     setListVisibility(false);
  //     setButtonText("Show List");
  //   } else {
  //     setListVisibility(true);
  //     setButtonText("Hide List");
  //   }
  // };

  //   const handleSelectProduct = (product: string) => {
  //     console.log(product);
  //   };

  useEffect(() => {
    axios.get("http://localhost:3001/products").then((response) => {
      // console.log(response.data);
      setListOfProducts(response.data);
    });
  }, []);
  return (
    <div>
      {/* <Button onClick={onClickButton}>{buttonText}</Button>
    {listVisible && (
      <ListGroup
        products={listOfProducts}
        heading={heading}
        onSelectProduct={handleSelectProduct}
      ></ListGroup>
    )} */}
      {/* <nav className="navbar navbar-expand-lg bg-body-tertiary">
      <div className="container-fluid">
        <a className="navbar-brand" href="#">
          Navbar
        </a>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarSupportedContent"
          aria-controls="navbarSupportedContent"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarSupportedContent">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <a className="nav-link active" aria-current="page">
                Home
              </a>
            </li>
            <li className="nav-item">
              <button className="nav-link active" onClick={onClickButton}>
                Products
              </button>
            </li>
          </ul>
          <form className="d-flex" role="search">
            <input
              className="form-control me-2"
              type="search"
              placeholder="Search"
              aria-label="Search"
            ></input>
            <button className="btn btn-outline-success" type="submit">
              Search
            </button>
          </form>
        </div>
      </div>
    </nav> */}

      <ProductList products={listOfProducts} heading={heading}></ProductList>
    </div>
  );
}

export default Home;

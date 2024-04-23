import axios from "axios";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

function Product() {
  let { id } = useParams();
  const [productObject, setProductObject]: any = useState({});
  useEffect(() => {
    axios.get(`http://localhost:3001/products/byId/${id}`).then((response) => {
      setProductObject(response.data);
    });
  }, []);
  return (
    <div>
      <div>{productObject.sku}</div>
      <div>{productObject.brand}</div>
      <div>{productObject.itemName}</div>
      <div>{productObject.category}</div>
      <div>{productObject.quantity}</div>
      <div>{productObject.location}</div>
      <div>{productObject.condition}</div>
    </div>
  );
}

export default Product;

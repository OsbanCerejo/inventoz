import { useNavigate } from "react-router-dom";
// export interface Product {
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

interface Props {
  products: any[];
  heading: string;
}

function ProductList({ products, heading }: Props) {
  // const [selectedIndex, setSelectedIndex] = useState(-1);
  const navigate = useNavigate();

  // console.log(products);
  const handleSelect = (product: any) => {
    console.log("Inside handleSelect in product list component");
    console.log(product);
    navigate(`/products/${product.sku}`);
  };
  return (
    <>
      <h1>{heading}</h1>
      {products.length === 0 && <p>No item found</p>}
      <table className="table table-bordered table-hover" border={2}>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">SKU</th>
            <th scope="col">Brand</th>
            <th scope="col">Item Name</th>
            <th scope="col">Shade/Variant</th>
            <th scope="col">Location</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => (
            <tr
              key={index}
              onClick={() => {
                // setSelectedIndex(index);
                handleSelect(product);
              }}
            >
              <th scope="row">{index + 1}</th>
              <td style={{ width: "12%" }}>{product.sku}</td>
              <td>{product.brand}</td>
              <td>{product.itemName}</td>
              <td>{product.shade}</td>
              <td>{product.location}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default ProductList;

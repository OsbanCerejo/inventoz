import { useNavigate } from "react-router-dom";
import { ArrowDropUp, ArrowDropDown, Sort } from "@mui/icons-material";
import Pagination from "./Pagination";

interface Props {
  products: any[];
  heading: string;
  handleSort: (columnKey: string) => void;
  sortConfig: { key: string | null; direction: string };
  handleFilterChange: (
    e: React.ChangeEvent<HTMLInputElement>,
    columnKey: string
  ) => void;
  currentPage: number;
  productsPerPage: number;
  paginate: (pageNumber: number) => void;
  totalProducts: number;
}

function ProductList({
  products,
  heading,
  handleSort,
  sortConfig,
  handleFilterChange,
  currentPage,
  productsPerPage,
  paginate,
  totalProducts,
}: Props) {
  const navigate = useNavigate();

  const handleSelect = (product: any) => {
    navigate(`/products/${product.sku}`);
  };

  const getSortIcon = (columnKey: string) => {
    if (sortConfig.key === columnKey) {
      return sortConfig.direction === "asc" ? (
        <ArrowDropUp />
      ) : (
        <ArrowDropDown />
      );
    } else {
      return <Sort />;
    }
  };

  // Calculate index of the last product on the current page
  const indexOfLastProduct = currentPage * productsPerPage;
  // Calculate index of the first product on the current page
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  // Get the current products to display on the current page
  const currentProducts = products.slice(
    indexOfFirstProduct,
    indexOfLastProduct
  );

  return (
    <>
      <h1>{heading}</h1>
      <br></br>
      <Pagination
        productsPerPage={productsPerPage}
        totalProducts={products.length}
        paginate={paginate}
        currentPage={currentPage}
      />
      {products.length === 0 && <p>No item found</p>}
      <div>
        <table className="table table-bordered table-hover" border={1}>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col" onClick={() => handleSort("sku")}>
                {getSortIcon("sku")} SKU
                <br></br>
                <input
                  type="text"
                  width="15%"
                  onChange={(e) => handleFilterChange(e, "brand")}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th scope="col" onClick={() => handleSort("brand")}>
                {getSortIcon("brand")} Brand
                <br></br>
                <input
                  type="text"
                  onChange={(e) => handleFilterChange(e, "brand")}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th scope="col" onClick={() => handleSort("itemName")}>
                {getSortIcon("itemName")} Item Name
                <br></br>
                <input
                  type="text"
                  onChange={(e) => handleFilterChange(e, "itemName")}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th scope="col">Size</th>
              <th scope="col">Shade / Variant</th>
              <th scope="col" onClick={() => handleSort("location")}>
                {getSortIcon("brlocationand")} Location
                <br></br>
                <input
                  type="text"
                  onChange={(e) => handleFilterChange(e, "location")}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th scope="col">Quantity Verified</th>
              <th scope="col" onClick={() => handleSort("listed")}>
                {getSortIcon("listed")}Listed
              </th>
              {/* <th scope="col">Final</th> */}
            </tr>
          </thead>
          <tbody>
            {currentProducts.map((product, index) => (
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
                <td>{product.sizeOz}</td>
                <td>{product.shade}</td>
                <td>{product.location}</td>
                <td
                  style={{
                    backgroundColor: product.verified ? "#B2FF59" : "#FF5252",
                    width: "5%",
                  }}
                >
                  {product.verified ? "Yes" : "No"}
                </td>
                <td
                  style={{
                    backgroundColor: product.listed ? "#B2FF59" : "#FF5252",
                    width: "10%",
                  }}
                >
                  {product.listed ? "Yes" : "No"}
                </td>
                {/* <td
                style={{
                  backgroundColor: product.final ? "#B2FF59" : "#FF5252",
                  width: "5%",
                }}
              >
                {product.final ? "Yes" : "No"}
              </td> */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default ProductList;

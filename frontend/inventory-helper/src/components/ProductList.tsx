import { useNavigate } from "react-router-dom";
import { ArrowDropUp, ArrowDropDown, Sort } from "@mui/icons-material";
import Pagination from "./Pagination";

interface Props {
  products: any[];
  heading: string;
  handleSort: (columnKey: string) => void;
  sortConfig: { key: string | null; direction: string };
  filterConfig: { key: string; value: string };
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
  filterConfig,
  handleFilterChange,
  currentPage,
  productsPerPage,
  paginate,
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
                  value={filterConfig.key === "sku" ? filterConfig.value : ""}
                  onChange={(e) => handleFilterChange(e, "sku")}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th scope="col" onClick={() => handleSort("brand")}>
                {getSortIcon("brand")} Brand
                <br></br>
                <input
                  type="text"
                  value={filterConfig.key === "brand" ? filterConfig.value : ""}
                  onChange={(e) => handleFilterChange(e, "brand")}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th scope="col" onClick={() => handleSort("itemName")}>
                {getSortIcon("itemName")} Item Name
                <br></br>
                <input
                  type="text"
                  value={
                    filterConfig.key === "itemName" ? filterConfig.value : ""
                  }
                  onChange={(e) => handleFilterChange(e, "itemName")}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th scope="col">Size</th>
              <th scope="col" onClick={() => handleSort("shade")}>
                {getSortIcon("shade")} Variant
                <br></br>
                <input
                  type="text"
                  style={{ width: "100%" }}
                  value={filterConfig.key === "shade" ? filterConfig.value : ""}
                  onChange={(e) => handleFilterChange(e, "shade")}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th scope="col" onClick={() => handleSort("location")}>
                {getSortIcon("location")} Location
                <br></br>
                <input
                  type="text"
                  style={{ width: "100%" }}
                  value={
                    filterConfig.key === "location" ? filterConfig.value : ""
                  }
                  onChange={(e) => handleFilterChange(e, "location")}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th scope="col" onClick={() => handleSort("quantity")}>
                {getSortIcon("location")} Quantity
              </th>
              <th scope="col" onClick={() => handleSort("listed")}>
                {getSortIcon("listed")} Listed
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
                <td style={{ width: "5%" }}>{product.sizeOz}</td>
                <td style={{ width: "8%" }}>{product.shade}</td>
                <td style={{ width: "8%" }}>{product.location}</td>
                <td
                  style={{
                    backgroundColor: product.verified ? "#B2FF59" : "#FF5252",
                    width: "7%",
                  }}
                >
                  {product.quantity}
                </td>
                <td
                  style={{
                    backgroundColor: product.listed ? "#B2FF59" : "#FF5252",
                    width: "7%",
                  }}
                >
                  {product.listed ? "Yes" : "No"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default ProductList;

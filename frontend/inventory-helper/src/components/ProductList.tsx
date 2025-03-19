import { useNavigate } from "react-router-dom";
import {
  ArrowDropUp,
  ArrowDropDown,
  Sort,
  ContentCopy,
} from "@mui/icons-material";
import Pagination from "./Pagination";
import { IconButton } from "@mui/material";
import { toast } from "react-toastify";

interface Props {
  products: any[];
  heading: string;
  handleSort: (columnKey: string) => void;
  sortConfig: { key: string | null; direction: string };
  filterConfig: { key: string; value: string }[];
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

  const copyToClipboard = (sku: string) => {
    // Create a temporary textarea element
    const textArea = document.createElement("textarea");
    textArea.value = sku;
    textArea.style.position = "fixed"; // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0"; // Make it invisible
  
    // Append the textarea to the document body
    document.body.appendChild(textArea);
  
    // Select and copy the text
    textArea.focus();
    textArea.select();
  
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        toast.success("SKU Copied!", { position: "top-right", autoClose: 1000 });
      } else {
        toast.error("Failed to copy SKU", { position: "top-right", autoClose: 1000 });
      }
    } catch (err) {
      toast.error("Failed to copy SKU", { position: "top-right", autoClose: 1000 });
      console.error("Copy failed:", err);
    }
  
    // Clean up: remove the textarea from the document
    document.body.removeChild(textArea);
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

  const getFilterValue = (columnKey: string) => {
    const filter = filterConfig.find((f) => f.key === columnKey);
    return filter ? filter.value : "";
  };

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
        UPC:{" "}
        <input
          type="text"
          value={getFilterValue("upc")}
          onChange={(e) => handleFilterChange(e, "upc")}
          onClick={(e) => e.stopPropagation()}
        />
        <table className="table table-bordered table-hover" border={1}>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col" onClick={() => handleSort("sku")}>
                {getSortIcon("sku")} SKU
                <br></br>
                <input
                  type="text"
                  value={getFilterValue("sku")}
                  onChange={(e) => handleFilterChange(e, "sku")}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th scope="col" onClick={() => handleSort("brand")}>
                {getSortIcon("brand")} Brand
                <br></br>
                <input
                  type="text"
                  value={getFilterValue("brand")}
                  onChange={(e) => handleFilterChange(e, "brand")}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th scope="col" onClick={() => handleSort("itemName")}>
                {getSortIcon("itemName")} Item Name
                <br></br>
                <input
                  type="text"
                  value={getFilterValue("itemName")}
                  onChange={(e) => handleFilterChange(e, "itemName")}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th scope="col">
                Size{" "}
                <input
                  type="text"
                  style={{ width: "100%" }}
                  value={getFilterValue("sizeOz")}
                  onChange={(e) => handleFilterChange(e, "sizeOz")}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th scope="col">Strength</th>
              <th scope="col" onClick={() => handleSort("shade")}>
                {getSortIcon("shade")} Variant
                <br></br>
                <input
                  type="text"
                  style={{ width: "100%" }}
                  value={getFilterValue("shade")}
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
                  value={getFilterValue("location")}
                  onChange={(e) => handleFilterChange(e, "location")}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th scope="col" onClick={() => handleSort("quantity")}>
                {getSortIcon("quantity")} QTY
              </th>
              {/* <th scope="col" onClick={() => handleSort("listed")}>
                {getSortIcon("listed")} Listed
              </th> */}
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
                <th scope="row">
                  {index + 1}
                  <img src={product.image} height="100" />
                </th>
                <td style={{ width: "12%" }}>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(product.sku);
                    }}
                  >
                    <ContentCopy />
                  </IconButton>
                  {product.sku}
                </td>
                <td style={{ width: "8%" }}>{product.brand}</td>
                <td>{product.itemName}</td>
                <td style={{ width: "5%" }}>{product.sizeOz}</td>
                <td>{product.strength}</td>
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
                {/* <td
                  style={{
                    backgroundColor: product.listed ? "#B2FF59" : "#FF5252",
                    width: "7%",
                  }}
                >
                  {product.listed ? "Yes" : "No"}
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

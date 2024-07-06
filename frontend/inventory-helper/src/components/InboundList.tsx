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

  const copyToClipboard = (sku: string) => {
    navigator.clipboard.writeText(sku);
    toast.success("SKU Copied!", { position: "top-right", autoClose: 1000 });
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

  const formatDate = (dateString: string) => {
    const options = {
      year: "numeric" as const,
      month: "long" as const,
      day: "numeric" as const,
    };
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, options);
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
              {/* <th scope="col" onClick={() => handleSort("brand")}>
                {getSortIcon("brand")} Brand
                <br></br>
                <input
                  type="text"
                  value={filterConfig.key === "brand" ? filterConfig.value : ""}
                  onChange={(e) => handleFilterChange(e, "brand")}
                  onClick={(e) => e.stopPropagation()}
                />
              </th> */}
              <th scope="col">
                Item Name
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
              <th scope="col" onClick={() => handleSort("date")}>
                {getSortIcon("date")} Date
              </th>
              <th scope="col" onClick={() => handleSort("batch")}>
                {getSortIcon("batch")} Batch
                <br></br>
                <input
                  type="text"
                  style={{ width: "100%" }}
                  value={filterConfig.key === "batch" ? filterConfig.value : ""}
                  onChange={(e) => handleFilterChange(e, "batch")}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th scope="col">
                Location
                <br></br>
                {/* <input
                  type="text"
                  style={{ width: "100%" }}
                  value={
                    filterConfig.key === "location" ? filterConfig.value : ""
                  }
                  onChange={(e) => handleFilterChange(e, "location")}
                  onClick={(e) => e.stopPropagation()}
                /> */}
              </th>
              <th scope="col" onClick={() => handleSort("quantity")}>
                {getSortIcon("quantity")} Quantity
              </th>
              <th scope="col" onClick={() => handleSort("listed")}>
                {getSortIcon("listed")} Listed
              </th>
              {/* <th scope="col">Final</th> */}
            </tr>
          </thead>
          <tbody>
            {currentProducts.map((combinedItem, index) => (
              <tr
                key={index}
                onClick={() => {
                  // setSelectedIndex(index);
                  handleSelect(combinedItem);
                }}
              >
                <th scope="row">{index + 1}</th>
                <td style={{ width: "12%" }}>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(combinedItem.sku);
                    }}
                  >
                    <ContentCopy />
                  </IconButton>
                  {combinedItem.sku}
                </td>
                <td>{combinedItem.Product.itemName}</td>
                <td>{formatDate(combinedItem.date)}</td>
                <td style={{ width: "8%" }}>{combinedItem.batch}</td>
                <td style={{ width: "8%" }}>{combinedItem.Product.location}</td>
                <td
                  style={{
                    width: "7%",
                  }}
                >
                  {combinedItem.quantity}
                </td>
                <td
                  style={{
                    backgroundColor: combinedItem.listed
                      ? "#B2FF59"
                      : "#FF5252",
                    width: "7%",
                  }}
                >
                  {combinedItem.listed ? "Yes" : "No"}
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

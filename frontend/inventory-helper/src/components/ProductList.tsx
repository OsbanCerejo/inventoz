import { useNavigate } from "react-router-dom";
import {
  ArrowDropUp,
  ArrowDropDown,
  Sort,
  ContentCopy,
  Science,
  QrCode2,
} from "@mui/icons-material";
import Pagination from "./Pagination";
import { IconButton, Box, TextField, InputAdornment, Typography } from "@mui/material";
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
  handleSort,
  sortConfig,
  filterConfig,
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

  const copyToClipboard = (sku: string) => {
    const onSuccess = () =>
      toast.success("SKU Copied!", { position: "top-right", autoClose: 1000 });
    const onFailure = (err?: unknown) => {
      toast.error("Failed to copy SKU", { position: "top-right", autoClose: 1000 });
      if (err) {
        console.error("Copy failed:", err);
      }
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(sku).then(onSuccess).catch(() => {
        // Fallback for older/insecure contexts
        const textArea = document.createElement("textarea");
        textArea.value = sku;
        textArea.style.position = "fixed";
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          const successful = document.execCommand("copy");
          successful ? onSuccess() : onFailure();
        } catch (err) {
          onFailure(err);
        } finally {
          document.body.removeChild(textArea);
        }
      });
      return;
    }

    const textArea = document.createElement("textarea");
    textArea.value = sku;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand("copy");
      successful ? onSuccess() : onFailure();
    } catch (err) {
      onFailure(err);
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const indexOfFirstProduct = (currentPage - 1) * productsPerPage;
  const currentProducts = products;
  const showingFrom = totalProducts === 0 ? 0 : indexOfFirstProduct + 1;
  const showingTo = indexOfFirstProduct + currentProducts.length;

  const getFilterValue = (columnKey: string) => {
    const filter = filterConfig.find((f) => f.key === columnKey);
    return filter ? filter.value : "";
  };

  const renderFilterInput = (columnKey: string, placeholder = "Filter...") => (
    <input
      type="text"
      placeholder={placeholder}
      value={getFilterValue(columnKey)}
      onChange={(e) => handleFilterChange(e, columnKey)}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "100%",
        height: 30,
        borderRadius: 6,
        border: "1px solid #cbd5e1",
        background: "#ffffff",
        padding: "0 8px",
        fontSize: 13,
        color: "#1e293b",
      }}
    />
  );

  return (
    <>
      {products.length === 0 && <p>No item found</p>}
      <div>
        <Box sx={{ mb: 1 }}>
          <Box
            sx={{
              px: 1.25,
              py: 0.75,
              border: "1px solid #e2e8f0",
              borderRadius: 1.5,
              bgcolor: "#ffffff",
              display: "flex",
              alignItems: "center",
              gap: 1,
              width: "100%",
              maxWidth: 320,
            }}
          >
            <QrCode2 sx={{ color: "#2563eb", fontSize: 18 }} />
            <TextField
              size="small"
              fullWidth
              placeholder="Search by UPC..."
              value={getFilterValue("upc")}
              onChange={(e) => handleFilterChange(e, "upc")}
              onClick={(e) => e.stopPropagation()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 600 }}>
                      UPC
                    </Typography>
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "#fff",
                  borderRadius: 1,
                },
              }}
            />
          </Box>
        </Box>
        <Box
          sx={{
            border: "1px solid #dbe2ea",
            borderRadius: 2,
            overflow: "hidden",
            bgcolor: "#fff",
          }}
        >
          <Box sx={{ overflowX: "auto", maxHeight: "70vh" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
                minWidth: 1120,
              }}
            >
              <thead>
                <tr>
                  <th style={{ position: "sticky", top: 0, zIndex: 3, background: "#f8fafc", borderBottom: "1px solid #dbe2ea", borderRight: "1px solid #e5eaf1", textAlign: "left", padding: "12px 10px", fontSize: 14, fontWeight: 700, color: "#1e293b", width: 60 }}>#</th>
                  <th onClick={() => handleSort("sku")} style={{ cursor: "pointer", position: "sticky", top: 0, zIndex: 3, background: "#f8fafc", borderBottom: "1px solid #dbe2ea", borderRight: "1px solid #e5eaf1", textAlign: "left", padding: "12px 10px", fontSize: 14, fontWeight: 700, color: "#1e293b", width: 230 }}>{getSortIcon("sku")} SKU</th>
                  <th onClick={() => handleSort("brand")} style={{ cursor: "pointer", position: "sticky", top: 0, zIndex: 3, background: "#f8fafc", borderBottom: "1px solid #dbe2ea", borderRight: "1px solid #e5eaf1", textAlign: "left", padding: "12px 10px", fontSize: 14, fontWeight: 700, color: "#1e293b", width: 170 }}>{getSortIcon("brand")} Brand</th>
                  <th onClick={() => handleSort("itemName")} style={{ cursor: "pointer", position: "sticky", top: 0, zIndex: 3, background: "#f8fafc", borderBottom: "1px solid #dbe2ea", borderRight: "1px solid #e5eaf1", textAlign: "left", padding: "12px 10px", fontSize: 14, fontWeight: 700, color: "#1e293b", minWidth: 280 }}>{getSortIcon("itemName")} Item Name</th>
                  <th style={{ position: "sticky", top: 0, zIndex: 3, background: "#f8fafc", borderBottom: "1px solid #dbe2ea", borderRight: "1px solid #e5eaf1", textAlign: "left", padding: "12px 10px", fontSize: 14, fontWeight: 700, color: "#1e293b", width: 105 }}>Size</th>
                  <th style={{ position: "sticky", top: 0, zIndex: 3, background: "#f8fafc", borderBottom: "1px solid #dbe2ea", borderRight: "1px solid #e5eaf1", textAlign: "left", padding: "12px 10px", fontSize: 14, fontWeight: 700, color: "#1e293b", width: 170 }}>Strength</th>
                  <th onClick={() => handleSort("shade")} style={{ cursor: "pointer", position: "sticky", top: 0, zIndex: 3, background: "#f8fafc", borderBottom: "1px solid #dbe2ea", borderRight: "1px solid #e5eaf1", textAlign: "left", padding: "12px 10px", fontSize: 14, fontWeight: 700, color: "#1e293b", width: 150 }}>{getSortIcon("shade")} Variant</th>
                  <th onClick={() => handleSort("location")} style={{ cursor: "pointer", position: "sticky", top: 0, zIndex: 3, background: "#f8fafc", borderBottom: "1px solid #dbe2ea", borderRight: "1px solid #e5eaf1", textAlign: "left", padding: "12px 10px", fontSize: 14, fontWeight: 700, color: "#1e293b", width: 150 }}>{getSortIcon("location")} Location</th>
                  <th onClick={() => handleSort("quantity")} style={{ cursor: "pointer", position: "sticky", top: 0, zIndex: 3, background: "#f8fafc", borderBottom: "1px solid #dbe2ea", textAlign: "left", padding: "12px 10px", fontSize: 14, fontWeight: 700, color: "#1e293b", width: 110 }}>{getSortIcon("quantity")} QTY</th>
                </tr>
                <tr>
                  <th style={{ position: "sticky", top: 46, zIndex: 2, background: "#ffffff", borderBottom: "1px solid #e7edf5", borderRight: "1px solid #eef2f7", padding: "8px 10px" }} />
                  <th style={{ position: "sticky", top: 46, zIndex: 2, background: "#ffffff", borderBottom: "1px solid #e7edf5", borderRight: "1px solid #eef2f7", padding: "8px 10px" }}>{renderFilterInput("sku")}</th>
                  <th style={{ position: "sticky", top: 46, zIndex: 2, background: "#ffffff", borderBottom: "1px solid #e7edf5", borderRight: "1px solid #eef2f7", padding: "8px 10px" }}>{renderFilterInput("brand")}</th>
                  <th style={{ position: "sticky", top: 46, zIndex: 2, background: "#ffffff", borderBottom: "1px solid #e7edf5", borderRight: "1px solid #eef2f7", padding: "8px 10px" }}>{renderFilterInput("itemName")}</th>
                  <th style={{ position: "sticky", top: 46, zIndex: 2, background: "#ffffff", borderBottom: "1px solid #e7edf5", borderRight: "1px solid #eef2f7", padding: "8px 10px" }}>{renderFilterInput("sizeOz")}</th>
                  <th style={{ position: "sticky", top: 46, zIndex: 2, background: "#ffffff", borderBottom: "1px solid #e7edf5", borderRight: "1px solid #eef2f7", padding: "8px 10px" }}>{renderFilterInput("strength")}</th>
                  <th style={{ position: "sticky", top: 46, zIndex: 2, background: "#ffffff", borderBottom: "1px solid #e7edf5", borderRight: "1px solid #eef2f7", padding: "8px 10px" }}>{renderFilterInput("shade")}</th>
                  <th style={{ position: "sticky", top: 46, zIndex: 2, background: "#ffffff", borderBottom: "1px solid #e7edf5", borderRight: "1px solid #eef2f7", padding: "8px 10px" }}>{renderFilterInput("location")}</th>
                  <th style={{ position: "sticky", top: 46, zIndex: 2, background: "#ffffff", borderBottom: "1px solid #e7edf5", padding: "8px 10px" }} />
                </tr>
              </thead>
              <tbody>
                {currentProducts.map((product, index) => {
                  const displayIndex = indexOfFirstProduct + index + 1;
                  const isVerified =
                    product.verified === true ||
                    product.verified === 1 ||
                    product.verified === "1";
                  const qtyBadge = isVerified
                    ? { bg: "#B2FF59", border: "#86efac", color: "#166534" }
                    : { bg: "#FF5252", border: "#fca5a5", color: "#991b1b" };

                  return (
                    <tr
                      key={product.sku || index}
                      onClick={() => handleSelect(product)}
                      style={{
                        cursor: "pointer",
                        background: index % 2 === 0 ? "#ffffff" : "#f8fafc",
                      }}
                    >
                      <td style={{ padding: "10px", borderBottom: "1px solid #edf2f7", borderRight: "1px solid #eef2f7", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 700, color: "#334155", marginBottom: product.image ? 6 : 0 }}>{displayIndex}</div>
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.itemName || "product image"}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                            style={{ width: 70, height: 70, objectFit: "contain", borderRadius: 8, background: "#fff" }}
                          />
                        ) : null}
                      </td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #edf2f7", borderRight: "1px solid #eef2f7", fontFamily: "Consolas, monospace", fontSize: 14, color: "#0f172a", whiteSpace: "nowrap" }}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(product.sku);
                          }}
                          sx={{ mr: 0.5 }}
                        >
                          <ContentCopy fontSize="small" />
                        </IconButton>
                        {product.sku}
                      </td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #edf2f7", borderRight: "1px solid #eef2f7", color: "#0f172a", fontSize: 14 }}>{product.brand}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #edf2f7", borderRight: "1px solid #eef2f7", color: "#0f172a", fontSize: 14 }}>
                        {product.itemName}
                        {product.ProductDetail?.tester && (
                          <Science sx={{ color: "#dc2626", fontSize: 18, ml: 1, verticalAlign: "middle" }} />
                        )}
                      </td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #edf2f7", borderRight: "1px solid #eef2f7", color: "#0f172a", fontSize: 14 }}>{product.sizeOz} Oz</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #edf2f7", borderRight: "1px solid #eef2f7", color: "#0f172a", fontSize: 14 }}>{product.strength || "-"}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #edf2f7", borderRight: "1px solid #eef2f7", color: "#0f172a", fontSize: 14 }}>{product.shade || "-"}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #edf2f7", borderRight: "1px solid #eef2f7", color: "#0f172a", fontSize: 14 }}>{product.location || "-"}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #edf2f7" }}>
                        <span
                          style={{
                            display: "inline-block",
                            minWidth: 54,
                            textAlign: "center",
                            borderRadius: 999,
                            padding: "5px 10px",
                            background: qtyBadge.bg,
                            border: `1px solid ${qtyBadge.border}`,
                            color: qtyBadge.color,
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          {product.quantity}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>
        </Box>
        <Box sx={{ mt: 1, color: "#64748b", fontSize: 13, textAlign: "center" }}>
          Showing {showingFrom}-{showingTo} of {totalProducts}
        </Box>
        <Box sx={{ display: "flex", justifyContent: "center", mt: 1.5 }}>
          <Pagination
            productsPerPage={productsPerPage}
            totalProducts={totalProducts}
            paginate={paginate}
            currentPage={currentPage}
          />
        </Box>
      </div>
    </>
  );
}

export default ProductList;

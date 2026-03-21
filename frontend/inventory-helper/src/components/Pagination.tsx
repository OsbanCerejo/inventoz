import React from "react";

interface PaginationProps {
  productsPerPage: number;
  totalProducts: number;
  paginate: (pageNumber: number) => void;
  currentPage: number;
}

const Pagination: React.FC<PaginationProps> = ({
  productsPerPage,
  totalProducts,
  paginate,
  currentPage,
}) => {
  const pageNumbers: number[] = [];
  const maxPageNumbersDisplay = 10;
  const totalPages = Math.ceil(totalProducts / productsPerPage);

  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  const indexOfLastPageNumber = Math.min(
    currentPage + Math.floor(maxPageNumbersDisplay / 2),
    pageNumbers.length
  );
  const indexOfFirstPageNumber = Math.max(
    0,
    indexOfLastPageNumber - maxPageNumbersDisplay + 1
  );

  const renderPageNumbers = pageNumbers
    .slice(indexOfFirstPageNumber, indexOfLastPageNumber)
    .map((number) => (
      <li key={number}>
        <button
          onClick={() => paginate(number)}
          style={{
            minWidth: 36,
            height: 36,
            borderRadius: 999,
            border: currentPage === number ? "1px solid #1d4ed8" : "1px solid #d1d5db",
            background: currentPage === number ? "#2563eb" : "#ffffff",
            color: currentPage === number ? "#ffffff" : "#334155",
            fontWeight: currentPage === number ? 700 : 500,
            fontSize: 14,
            padding: "0 10px",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          {number}
        </button>
      </li>
    ));

  return (
    <nav style={{ marginBottom: 12 }}>
      <ul
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          listStyle: "none",
          margin: 0,
          padding: 0,
          flexWrap: "wrap",
        }}
      >
        <li>
          <button
            onClick={() => paginate(1)}
            disabled={currentPage === 1}
            style={{
              height: 36,
              borderRadius: 999,
              border: "1px solid #d1d5db",
              background: "#ffffff",
              color: "#334155",
              fontWeight: 500,
              fontSize: 14,
              padding: "0 12px",
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
              opacity: currentPage === 1 ? 0.45 : 1,
            }}
          >
            First
          </button>
        </li>
        <li>
          <button
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              height: 36,
              borderRadius: 999,
              border: "1px solid #d1d5db",
              background: "#ffffff",
              color: "#334155",
              fontWeight: 500,
              fontSize: 14,
              padding: "0 12px",
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
              opacity: currentPage === 1 ? 0.45 : 1,
            }}
          >
            Previous
          </button>
        </li>
        {renderPageNumbers}
        <li>
          <button
            onClick={() => paginate(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{
              height: 36,
              borderRadius: 999,
              border: "1px solid #d1d5db",
              background: "#ffffff",
              color: "#334155",
              fontWeight: 500,
              fontSize: 14,
              padding: "0 12px",
              cursor: currentPage === totalPages ? "not-allowed" : "pointer",
              opacity: currentPage === totalPages ? 0.45 : 1,
            }}
          >
            Next
          </button>
        </li>
        <li>
          <button
            onClick={() => paginate(totalPages)}
            disabled={currentPage === totalPages}
            style={{
              height: 36,
              borderRadius: 999,
              border: "1px solid #d1d5db",
              background: "#ffffff",
              color: "#334155",
              fontWeight: 500,
              fontSize: 14,
              padding: "0 12px",
              cursor: currentPage === totalPages ? "not-allowed" : "pointer",
              opacity: currentPage === totalPages ? 0.45 : 1,
            }}
          >
            Last
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default Pagination;

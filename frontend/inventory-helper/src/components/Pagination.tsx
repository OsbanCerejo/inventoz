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
  const maxPageNumbersDisplay = 5; // Change this value to adjust the number of pages displayed

  for (let i = 1; i <= Math.ceil(totalProducts / productsPerPage); i++) {
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
      <li
        key={number}
        className={`page-item ${currentPage === number ? "active" : ""}`}
      >
        <a onClick={() => paginate(number)} className="page-link">
          {number}
        </a>
      </li>
    ));

  return (
    <nav>
      <ul className="pagination">
        <li className="page-item">
          <button
            onClick={() => paginate(1)}
            disabled={currentPage === 1}
            className="page-link"
          >
            First
          </button>
        </li>
        <li className="page-item">
          <button
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
            className="page-link"
          >
            Previous
          </button>
        </li>
        {renderPageNumbers}
        <li className="page-item">
          <button
            onClick={() => paginate(currentPage + 1)}
            disabled={
              currentPage === Math.ceil(totalProducts / productsPerPage)
            }
            className="page-link"
          >
            Next
          </button>
        </li>
        <li className="page-item">
          <button
            onClick={() => paginate(Math.ceil(totalProducts / productsPerPage))}
            disabled={
              currentPage === Math.ceil(totalProducts / productsPerPage)
            }
            className="page-link"
          >
            Last
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default Pagination;

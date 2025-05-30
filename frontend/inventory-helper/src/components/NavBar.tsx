import { useState } from "react";
import { useNavigate } from "react-router-dom";

function NavBar() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const toggleNavbar = () => {
    setIsOpen(!isOpen);
  };

  const handleHomeClick = () => {
    navigate("/", { state: { clearFilters: true } });
  };

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-light bg-light">
        <a className="navbar-brand" href="/">
          Inventoz
        </a>
        <button className="navbar-toggler" type="button" onClick={toggleNavbar}>
          <span className="navbar-toggler-icon"></span>
        </button>

        <div
          className={`collapse navbar-collapse ${isOpen ? "show" : ""}`}
          id="navbarSupportedContent"
        >
          <ul className="navbar-nav mr-auto">
            <li className="nav-item active">
              <a
                className="nav-link"
                onClick={handleHomeClick}
                style={{ cursor: "pointer" }}
              >
                Home
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="/addProduct">
                Add Product
              </a>
            </li>
            {/* <li className="nav-item">
              <a className="nav-link" href="/listings">
                Listings
              </a>
            </li> */}
            <li className="nav-item">
              <a className="nav-link" href="/inbound/showAll">
                Inbound
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="/orders/showAll">
                Orders
              </a>
            </li>
            {/* <li className="nav-item">
              <a className="nav-link" href="/sephoraSearch">
                Sephora
              </a>
            </li> */}
            <li className="nav-item">
              <a className="nav-link" href="/orders/packingMode">
                Packing
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="/priceListParser">
                PriceList
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="/price-list">
                PriceList(New)
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="/ebayAPI">
                EbayAPI
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="/whatnot">
                Whatnot
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="/employee-info">
                Employee Info
              </a>
            </li>
          </ul>
        </div>
      </nav>
    </div>
  );
}

export default NavBar;

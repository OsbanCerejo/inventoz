import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function NavBar() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const toggleNavbar = () => {
    setIsOpen(!isOpen);
  };

  const handleHomeClick = () => {
    navigate("/", { state: { clearFilters: true } });
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-light bg-light">
        <Link className="navbar-brand" to="/">
          Inventoz
        </Link>
        <button className="navbar-toggler" type="button" onClick={toggleNavbar}>
          <span className="navbar-toggler-icon"></span>
        </button>

        <div
          className={`collapse navbar-collapse ${isOpen ? "show" : ""}`}
          id="navbarSupportedContent"
        >
          <ul className="navbar-nav mr-auto">
            <li className="nav-item active">
              <button
                className="nav-link btnk"
                onClick={handleHomeClick}
                style={{ cursor: "pointer", background: "none", border: "none" }}
              >
                Products
              </button>
            </li>
            {/* <li className="nav-item">
              <a className="nav-link" href="/listings">
                Listings
              </a>
            </li> */}
            <li className="nav-item">
              <Link className="nav-link" to="/inbound/showAll">
                Inbound
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/orders/showAll">
                Orders
              </Link>
            </li>
            {/* <li className="nav-item">
              <a className="nav-link" href="/sephoraSearch">
                Sephora
              </a>
            </li> */}
            <li className="nav-item">
              <Link className="nav-link" to="/orders/packingMode">
                Packing
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/price-list">
                PriceList
              </Link>
            </li>
            {/* <li className="nav-item">
              <Link className="nav-link" to="/ebayAPI">
                EbayAPI
              </Link>
            </li> */}
            <li className="nav-item">
              <Link className="nav-link" to="/whatnot">
                Whatnot
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/employee-info">
                Employee Info
              </Link>
            </li>
          </ul>
          {user && (
            <div className="navbar-nav ml-auto">
              <span className="nav-item nav-link">
                {user.username} ({user.role})
              </span>
              <button
                className="btn btn-outline-danger"
                onClick={handleLogout}
                style={{ marginLeft: "10px" }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}

export default NavBar;

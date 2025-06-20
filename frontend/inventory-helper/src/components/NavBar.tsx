import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function NavBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const toggleNavbar = () => {
    setIsOpen(!isOpen);
  };

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
  };

  const handleHomeClick = () => {
    navigate("/", { state: { clearFilters: true } });
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
    setShowUserMenu(false);
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
              <div className="nav-item dropdown">
                <button
                  className="btn btn-link nav-link dropdown-toggle"
                  onClick={toggleUserMenu}
                  style={{ 
                    background: "none", 
                    border: "none", 
                    padding: "0.5rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                  }}
                >
                  <svg 
                    width="20" 
                    height="20" 
                    fill="currentColor" 
                    viewBox="0 0 16 16"
                  >
                    <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
                  </svg>
                </button>
                {showUserMenu && (
                  <div 
                    className="dropdown-menu show" 
                    style={{
                      position: "absolute",
                      right: "0",
                      top: "100%",
                      zIndex: 1000,
                      minWidth: "200px"
                    }}
                  >
                    <div className="dropdown-item-text">
                      <strong>{user.username}</strong>
                      <br />
                      <small className="text-muted">{user.role}</small>
                    </div>
                    <div className="dropdown-divider"></div>
                    <button
                      className="dropdown-item"
                      onClick={handleLogout}
                      style={{ 
                        background: "none", 
                        border: "none", 
                        width: "100%", 
                        textAlign: "left",
                        padding: "0.5rem 1rem",
                        color: "#dc3545"
                      }}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>
      {/* Overlay to close dropdown when clicking outside */}
      {showUserMenu && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </div>
  );
}

export default NavBar;

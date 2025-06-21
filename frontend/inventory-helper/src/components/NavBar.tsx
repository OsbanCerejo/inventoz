import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { People as PeopleIcon } from '@mui/icons-material';

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
    console.log('Logout button clicked!');
    logout();
    navigate("/login");
    setShowUserMenu(false);
  };
  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-light bg-light" style={{ position: "relative" }}>
        {/* Role Watermark */}
        {/* {user && (
          <div style={{
            position: "absolute",
            top: "50%",
            right: "200px",
            transform: "translateY(-50%)",
            fontSize: "16px",
            color: "#fd7e14",
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: "2px",
            pointerEvents: "none",
            zIndex: 0,
            opacity: 0.7
          }}>
            {user.role}
          </div>
        )} */}
        
        <Link className="navbar-brand" to="/" style={{ position: "relative", zIndex: 1 }}>
          Inventoz
        </Link>
        <button className="navbar-toggler" type="button" onClick={toggleNavbar}>
          <span className="navbar-toggler-icon"></span>
        </button>

        <div
          className={`collapse navbar-collapse ${isOpen ? "show" : ""}`}
          id="navbarSupportedContent"
          style={{ position: "relative", zIndex: 1 }}
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
            <div className="navbar-nav ml-auto" style={{ position: "relative", zIndex: 9999 }}>
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
                      zIndex: 9999,
                      minWidth: "220px",
                      padding: "0",
                      margin: "0",
                      border: "1px solid #dee2e6",
                      borderRadius: "6px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      backgroundColor: "#fff"
                    }}
                  >
                    <div className="dropdown-item-text">
                      <div style={{ 
                        padding: "12px 16px"
                      }}>
                        <div style={{ 
                          fontWeight: "600", 
                          fontSize: "15px", 
                          color: "#212529",
                          marginBottom: "4px",
                          lineHeight: "1.2"
                        }}>
                          {user.name || user.username}
                        </div>
                        <div style={{ 
                          fontSize: "13px", 
                          color: "#6c757d",
                          lineHeight: "1.2"
                        }}>
                          {user.name && (
                            <div style={{ marginBottom: "2px" }}>
                              {user.username}
                            </div>
                          )}
                          <div style={{ 
                            textTransform: "capitalize",
                            fontWeight: "500"
                          }}>
                            {user.role}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="dropdown-divider"></div>
                    {user.role === 'admin' && (
                      <>
                        <Link
                          className="dropdown-item"
                          to="/users"
                          onClick={() => setShowUserMenu(false)}
                          style={{ 
                            background: "none", 
                            border: "none", 
                            width: "100%", 
                            textAlign: "left",
                            padding: "8px 16px",
                            textDecoration: "none",
                            color: "#212529",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "14px",
                            transition: "background-color 0.15s ease-in-out"
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f8f9fa"}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                        >
                          <PeopleIcon sx={{ fontSize: 16 }} />
                          Users
                        </Link>
                        <div className="dropdown-divider" style={{ margin: "0" }}></div>
                      </>
                    )}
                    <button
                      className="dropdown-item"
                      onClick={handleLogout}
                      style={{ 
                        background: "none", 
                        border: "none", 
                        width: "100%", 
                        textAlign: "left",
                        padding: "8px 16px",
                        color: "#dc3545",
                        fontSize: "14px",
                        cursor: "pointer",
                        transition: "background-color 0.15s ease-in-out"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f8f9fa"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
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
      {/* {showUserMenu && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9998
          }}
          onClick={() => setShowUserMenu(false)}
        />
      )} */}
    </div>
  );
}

export default NavBar;

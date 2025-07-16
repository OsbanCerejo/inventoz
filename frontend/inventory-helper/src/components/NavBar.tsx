import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { People as PeopleIcon } from '@mui/icons-material';

function NavBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();
  const { user, logout, hasMenuAccess, isLoading } = useAuth();

  const toggleNavbar = () => {
    setIsOpen(!isOpen);
  };

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
  };

  const handleHomeClick = () => {
    // Navigate to products page
    navigate('/products', { state: { clearFilters: true } });
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
    setShowUserMenu(false);
  };

  // Menu items configuration
  const menuItems = [
    { key: 'products', label: 'Products', path: '/products', onClick: handleHomeClick, isButton: true },
    { key: 'inbound', label: 'Inbound', path: '/inbound/showAll' },
    { key: 'orders', label: 'Orders', path: '/orders/showAll' },
    { key: 'packing', label: 'Packing', path: '/orders/packingMode' },
    { key: 'pricelist', label: 'PriceList', path: '/price-list' },
    { key: 'whatnot', label: 'Whatnot', path: '/whatnot' },
    { key: 'employeeInfo', label: 'Employees', path: '/employee-info' }
  ];

  // If still loading permissions, show minimal navbar
  if (isLoading) {
    return (
      <div>
        <nav className="navbar navbar-expand-lg navbar-light bg-light" style={{ position: "relative" }}>
          <div className="navbar-brand" style={{ position: "relative", zIndex: 1 }}>
            Inventoz
          </div>
          <div style={{ marginLeft: 'auto', padding: '0.5rem 1rem' }}>
            Loading...
          </div>
        </nav>
      </div>
    );
  }

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-light bg-light" style={{ position: "relative" }}>
        {/* Role Watermark */}
        {user && (
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
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
        )}
        
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
            {menuItems.map((item) => {
              // Check if user has access to this menu item
              if (!hasMenuAccess(item.key)) {
                return null;
              }

              return (
                <li key={item.key} className="nav-item">
                  {item.isButton ? (
                    <button
                      className="nav-link btnk"
                      onClick={item.onClick}
                      style={{ cursor: "pointer", background: "none", border: "none" }}
                    >
                      {item.label}
                    </button>
                  ) : (
                    <Link className="nav-link" to={item.path}>
                      {item.label}
                    </Link>
                  )}
                </li>
              );
            })}
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
                        </div>
                      </div>
                    </div>
                    <div className="dropdown-divider" style={{ margin: "0" }}></div>
                    {hasMenuAccess('users') && (
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
                            padding: "12px 16px",
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
                        padding: "12px 16px",
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
    </div>
  );
}

export default NavBar;

import { useEffect, useRef, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { People as PeopleIcon } from '@mui/icons-material';

function NavBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<"analytics" | "tools" | "walmart" | "user" | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasMenuAccess, isLoading, isAuthenticated } = useAuth();
  const analyticsRef = useRef<HTMLLIElement | null>(null);
  const toolsRef = useRef<HTMLLIElement | null>(null);
  const walmartRef = useRef<HTMLLIElement | null>(null);
  const userRef = useRef<HTMLDivElement | null>(null);

  const toggleNavbar = () => {
    setIsOpen(!isOpen);
  };

  const toggleDropdown = (dropdown: "analytics" | "tools" | "walmart" | "user") => {
    setActiveDropdown((prev) => (prev === dropdown ? null : dropdown));
  };

  useEffect(() => {
    setActiveDropdown(null);
  }, [location.pathname]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        analyticsRef.current?.contains(target) ||
        toolsRef.current?.contains(target) ||
        walmartRef.current?.contains(target) ||
        userRef.current?.contains(target)
      ) {
        return;
      }
      setActiveDropdown(null);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveDropdown(null);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const handleHomeClick = () => {
    // Navigate to products page
    navigate('/products', { state: { clearFilters: true } });
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
    setActiveDropdown(null);
  };

  // Menu items configuration
  const menuItems = [
    { key: 'products', label: 'Products', path: '/products', onClick: handleHomeClick, isButton: true },
    { key: 'orders', label: 'Orders', path: '/orders/showAll' },
    { key: 'hbaOrders', label: 'HBA Orders', path: '/hba-orders' },
    { key: 'packing', label: 'Packing', path: '/orders/packingMode' },
    { key: 'pricelist', label: 'PriceList', path: '/price-list' },
    { key: 'barcodeScan', label: 'Barcode Scan', path: '/barcode-scan' }
  ];

  const collapsedKeys = ['packing', 'pricelist', 'barcodeScan'];

  const analyticsItems = [
    { key: 'whatnotAnalytics', label: 'Whatnot Fulfillment Analytics', path: '/whatnot-fulfillment-analytics' },
    { key: 'tiktokAnalytics', label: 'TikTok Fulfillment Analytics', path: '/tiktok-fulfillment-analytics' },
    { key: 'hbaAnalytics', label: 'HBA Analytics', path: '/hba-analytics' },
    { key: 'sortingAnalytics', label: 'Sorting Analytics', path: '/sorting-analytics' },
    { key: 'packingAnalytics', label: 'Packing Analytics', path: '/packing-analytics' },
    { key: 'operationsCost', label: 'Operations Cost', path: '/operations-cost' },
  ];

  const toolsItems = [
    { key: 'customer-service-tool', permissionKey: 'customerService', label: 'Customer Service', path: '/customer-service' },
    { key: 'tickets-tool', permissionKey: 'tickets', label: 'Tickets', path: '/tickets' },
    { key: 'invoice-tracker-tool', permissionKey: 'invoiceTracker', label: 'Invoice Tracker', path: '/invoice-tracker' },
    { key: 'sales-tool', permissionKey: 'sales', label: 'Sales Tracker', path: '/sales' },
    { key: 'price-scanner-tool', permissionKey: 'priceScanner', label: 'Price Scanner', path: '/price-scanner' },
    { key: 'whatnot-fulfillment-tool', permissionKey: 'whatnotFulfillment', label: 'Whatnot Fulfillment', path: '/whatnot-fulfillment' },
    { key: 'tiktok-fulfillment-tool', permissionKey: 'tiktokFulfillment', label: 'TikTok Fulfillment', path: '/tiktok-fulfillment' },
    { key: 'label-generator-tool', permissionKey: 'labelGenerator', label: 'Label Generator', path: '/label-generator' },
    { key: 'brands-tool', permissionKey: 'brands', label: 'Brands', path: '/brands' },
    { key: 'settings-tool', permissionKey: 'settings', label: 'Settings', path: '/settings' },
    { key: 'sku-merge-tool', permissionKey: 'skuMerge', label: 'SKU Merge', path: '/sku-merge' },
    { key: 'packing-tool', permissionKey: 'packing', label: 'Packing', path: '/orders/packingMode' },
    { key: 'pricelist-tool', permissionKey: 'pricelist', label: 'PriceList', path: '/price-list' },
    { key: 'lowstock-tool', permissionKey: 'lowStock', label: 'Low Stock', path: '/low-stock' },
    { key: 'barcode-tool', permissionKey: 'barcodeScan', label: 'Barcode Scan', path: '/barcode-scan' },
  ];

  const walmartItems: { key: string; label: string; path: string }[] = [];

  const visibleAnalyticsItems = analyticsItems.filter((item) => hasMenuAccess(item.key));
  const visibleToolsItems = toolsItems.filter((item) =>
    hasMenuAccess((item as { permissionKey?: string }).permissionKey || item.key)
  );
  const visibleWalmartItems = walmartItems.filter((item) => hasMenuAccess(item.key));
  const isPathActive = (path: string) =>
    location.pathname === path ||
    (path !== "/" && location.pathname.startsWith(path));

  const navLinkBase = {
    cursor: "pointer",
    background: "none",
    border: "none",
    color: "#334155",
    padding: "0.9rem 0.75rem 0.8rem",
    margin: "0 0.15rem",
    fontSize: "15px",
    fontWeight: 500,
    borderBottom: "2px solid transparent",
    lineHeight: 1.2,
    textDecoration: "none",
    transition: "color 0.15s ease, border-color 0.15s ease",
  };
  const dropdownCardStyle = {
    position: "absolute",
    top: "100%",
    zIndex: 1300,
    minWidth: "220px",
    padding: "0.35rem 0",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
    backgroundColor: "#fff",
    opacity: 1,
    pointerEvents: "auto",
  };

  // If still loading permissions, show minimal navbar
  if (isLoading) {
    return (
      <div>
        <nav
          className="navbar navbar-expand-lg navbar-light"
          style={{
            position: "relative",
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div className="navbar-brand" style={{ position: "relative", zIndex: 1, fontWeight: 700, color: "#0f172a" }}>
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
      <nav
        className="navbar navbar-expand-lg navbar-light"
        style={{
          position: "relative",
          zIndex: 1200,
          isolation: "isolate",
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          boxShadow: "0 1px 0 rgba(15,23,42,0.03)",
          minHeight: "64px",
        }}
      >
        <Link
          className="navbar-brand"
          to="/"
          style={{
            position: "relative",
            zIndex: 1,
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: "0.2px",
            marginRight: "1.25rem",
          }}
        >
          Inventoz
        </Link>
        <button className="navbar-toggler" type="button" onClick={toggleNavbar}>
          <span className="navbar-toggler-icon"></span>
        </button>

        <div
          className={`collapse navbar-collapse ${isOpen ? "show" : ""}`}
          id="navbarSupportedContent"
          style={{ position: "relative", zIndex: 1201, flexGrow: 1 }}
        >
          <ul
            className="navbar-nav mr-auto"
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              rowGap: "0.1rem",
            }}
          >
            {menuItems.map((item) => {
              // Check if user has access to this menu item
              if (!hasMenuAccess(item.key)) {
                return null;
              }
              // Move selected sections into Tools dropdown
              if (collapsedKeys.includes(item.key)) {
                return null;
              }

              return (
                <li key={item.key} className="nav-item">
                  {item.isButton ? (
                    <button
                      className="nav-link btnk"
                      onClick={item.onClick}
                      style={{
                        ...navLinkBase,
                        color: isPathActive(item.path) ? "#0f172a" : "#334155",
                        borderBottomColor: isPathActive(item.path) ? "#0f172a" : "transparent",
                      }}
                    >
                      {item.label}
                    </button>
                  ) : (
                    <Link
                      className="nav-link"
                      to={item.path}
                      style={{
                        ...navLinkBase,
                        color: isPathActive(item.path) ? "#0f172a" : "#334155",
                        borderBottomColor: isPathActive(item.path) ? "#0f172a" : "transparent",
                      }}
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              );
            })}
            {visibleAnalyticsItems.length > 0 && (
              <li className="nav-item dropdown" style={{ position: "relative" }} ref={analyticsRef}>
                <button
                  className="btn btn-link nav-link dropdown-toggle"
                  onClick={() => toggleDropdown("analytics")}
                  style={{
                    ...navLinkBase,
                    color: activeDropdown === "analytics" ? "#0f172a" : "#334155",
                    borderBottomColor: activeDropdown === "analytics" ? "#0f172a" : "transparent",
                  }}
                >
                  Analytics
                </button>
                {activeDropdown === "analytics" && (
                  <div
                    className="dropdown-menu show"
                    style={{
                      left: "0",
                      ...dropdownCardStyle,
                    }}
                  >
                    {visibleAnalyticsItems.map((item) => (
                      <Link
                        key={item.key}
                        className="dropdown-item"
                        to={item.path}
                        onClick={() => setActiveDropdown(null)}
                        style={{
                          padding: "9px 14px",
                          textDecoration: "none",
                          color: "#334155",
                          display: "block",
                          fontSize: "14px",
                          fontWeight: 500,
                        }}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            )}
            {visibleWalmartItems.length > 0 && (
              <li className="nav-item dropdown" style={{ position: "relative" }} ref={walmartRef}>
                <button
                  className="btn btn-link nav-link dropdown-toggle"
                  onClick={() => toggleDropdown("walmart")}
                  style={{
                    ...navLinkBase,
                    color:
                      activeDropdown === "walmart" || visibleWalmartItems.some((item) => isPathActive(item.path))
                        ? "#0f172a"
                        : "#334155",
                    borderBottomColor:
                      activeDropdown === "walmart" || visibleWalmartItems.some((item) => isPathActive(item.path))
                        ? "#0f172a"
                        : "transparent",
                  }}
                >
                  Walmart
                </button>
                {activeDropdown === "walmart" && (
                  <div
                    className="dropdown-menu show"
                    style={{
                      left: "0",
                      ...dropdownCardStyle,
                    }}
                  >
                    {visibleWalmartItems.map((item) => (
                      <Link
                        key={item.path}
                        className="dropdown-item"
                        to={item.path}
                        style={{
                          display: "block",
                          padding: "0.65rem 0.9rem",
                          color: isPathActive(item.path) ? "#0f172a" : "#334155",
                          backgroundColor: isPathActive(item.path) ? "#f8fafc" : "transparent",
                          textDecoration: "none",
                          fontWeight: isPathActive(item.path) ? 600 : 500,
                        }}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            )}
            {visibleToolsItems.length > 0 && (
              <li className="nav-item dropdown" style={{ position: "relative" }} ref={toolsRef}>
                <button
                  className="btn btn-link nav-link dropdown-toggle"
                  onClick={() => toggleDropdown("tools")}
                  style={{
                    ...navLinkBase,
                    color: activeDropdown === "tools" ? "#0f172a" : "#334155",
                    borderBottomColor: activeDropdown === "tools" ? "#0f172a" : "transparent",
                  }}
                >
                  Tools
                </button>
                {activeDropdown === "tools" && (
                  <div
                    className="dropdown-menu show"
                    style={{
                      right: "0",
                      ...dropdownCardStyle,
                    }}
                  >
                    {visibleToolsItems.map((item) => {
                      return (
                        <Link
                          key={item.key}
                          className="dropdown-item"
                          to={item.path}
                          onClick={() => setActiveDropdown(null)}
                          style={{
                            padding: "9px 14px",
                            textDecoration: "none",
                            color: "#334155",
                            display: "block",
                            fontSize: "14px",
                            fontWeight: 500,
                          }}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </li>
            )}
          </ul>
        </div>
        {user && (
          <div
            className="navbar-nav ml-auto"
            style={{
              position: "relative",
              zIndex: 1202,
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              marginLeft: "auto",
            }}
            ref={userRef}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#f59e0b",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                padding: "0.25rem 0.4rem",
                marginRight: "0.15rem",
                whiteSpace: "nowrap",
              }}
            >
              {user.role}
            </div>
            <div className="nav-item dropdown">
              <button
                className="btn btn-link nav-link dropdown-toggle"
                onClick={() => toggleDropdown("user")}
                style={{ 
                  ...navLinkBase,
                  borderBottomColor: activeDropdown === "user" ? "#0f172a" : "transparent",
                  padding: "0.6rem 0.75rem 0.55rem",
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
              {activeDropdown === "user" && (
                <div 
                  className="dropdown-menu show" 
                  style={{
                    right: "0",
                    ...dropdownCardStyle,
                    minWidth: "240px",
                    padding: "0",
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
                        onClick={() => setActiveDropdown(null)}
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
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f8fafc"}
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
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f8fafc"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}

export default NavBar;

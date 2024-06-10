import { useState } from "react";

function NavBar() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleNavbar = () => {
    setIsOpen(!isOpen);
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
              <a className="nav-link" href="/">
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
            <li className="nav-item">
              <a className="nav-link" href="/sephoraSearch">
                Sephora
              </a>
            </li>
          </ul>
        </div>
      </nav>
    </div>
  );
}

export default NavBar;

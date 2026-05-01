const state = {
  products: [],
  filteredProducts: [],
  cart: loadCart(),
  view: "catalog",
  sortKey: "",
  sortDirection: "asc",
};

const apiBaseUrl = String(window.HBA_CONFIG?.apiBaseUrl || "").replace(/\/$/, "");

const elements = {
  search: document.getElementById("catalog-search"),
  availabilityFilter: document.getElementById("availability-filter"),
  catalogView: document.getElementById("catalog-view"),
  cartView: document.getElementById("cart-view"),
  checkoutView: document.getElementById("checkout-view"),
  catalogBody: document.getElementById("catalog-body"),
  catalogEmpty: document.getElementById("catalog-empty"),
  cartEmpty: document.getElementById("cart-empty"),
  cartTableBody: document.getElementById("cart-table-body"),
  checkoutTableBody: document.getElementById("checkout-table-body"),
  cartSummaryButton: document.getElementById("cart-summary-button"),
  cartSummaryLines: document.getElementById("cart-summary-lines"),
  cartSummaryPrice: document.getElementById("cart-summary-price"),
  cartTotalLines: document.getElementById("cart-total-lines"),
  cartTotalUnits: document.getElementById("cart-total-units"),
  cartTotalPrice: document.getElementById("cart-total-price"),
  checkoutTotalLines: document.getElementById("checkout-total-lines"),
  checkoutTotalUnits: document.getElementById("checkout-total-units"),
  checkoutTotalPrice: document.getElementById("checkout-total-price"),
  backToProductsButton: document.getElementById("back-to-products-button"),
  clearCartButton: document.getElementById("clear-cart-button"),
  completeOrderButton: document.getElementById("complete-order-button"),
  checkoutBackButton: document.getElementById("checkout-back-button"),
  checkoutForm: document.getElementById("checkout-form"),
  submitOrderButton: document.getElementById("submit-order-button"),
  checkoutMessage: document.getElementById("checkout-message"),
  salesPersonSelect: document.getElementById("customer-salesPerson"),
  catalogRowTemplate: document.getElementById("catalog-row-template"),
  cartRowTemplate: document.getElementById("cart-row-template"),
  sortButtons: document.querySelectorAll(".sort-button"),
  sortIndicators: document.querySelectorAll(".sort-indicator"),
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const fallbackImage =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
      <rect width="80" height="80" fill="#f6f6f6"/>
      <text x="50%" y="48%" text-anchor="middle" fill="#666" font-family="Arial, sans-serif" font-size="16">HBA</text>
    </svg>
  `);

async function fetchCatalog() {
  const response = await fetch(`${apiBaseUrl}/products/hba/public-catalog`);
  if (!response.ok) {
    throw new Error(`Failed to load catalog (${response.status})`);
  }
  return response.json();
}

async function submitOrder(payload) {
  const response = await fetch(`${apiBaseUrl}/products/hba/submit-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Failed to submit order (${response.status})`);
  }

  return data;
}

function loadCart() {
  try {
    const raw = localStorage.getItem("hbaCart");
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.error("Failed to load HBA cart from storage:", error);
    return {};
  }
}

function persistCart() {
  localStorage.setItem("hbaCart", JSON.stringify(state.cart));
}

function sanitizeQuantity(rawValue, maxQuantity) {
  if (rawValue === "" || rawValue === null || rawValue === undefined) {
    return 0;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.floor(parsed), Math.max(0, Number(maxQuantity || 0)));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchHaystack(product) {
  return normalizeText([product.sku, product.upc, product.brand, product.itemName].join(" "));
}

function matchesRobustSearch(product, searchValue) {
  if (!searchValue) return true;
  const haystack = buildSearchHaystack(product);
  const terms = normalizeText(searchValue).split(" ").filter(Boolean);
  if (terms.length === 0) return true;
  return terms.every((term) => haystack.includes(term));
}

function getCartSummary() {
  return Object.values(state.cart).reduce(
    (summary, line) => {
      summary.totalUnits += line.quantity;
      summary.totalPrice += line.quantity * line.hbaPrice;
      summary.lineCount += 1;
      return summary;
    },
    { totalUnits: 0, totalPrice: 0, lineCount: 0 }
  );
}

function updateCartForProduct(product, rawQuantity) {
  const quantity = sanitizeQuantity(rawQuantity, product.hbaQuantity);

  if (quantity === 0) {
    delete state.cart[product.sku];
  } else {
    state.cart[product.sku] = {
      sku: product.sku,
      upc: product.upc,
      brand: product.brand,
      itemName: product.itemName,
      quantity,
      hbaPrice: Number(product.hbaPrice || 0),
    };
  }

  persistCart();
  renderAll();
}

function applySort(rows) {
  if (!state.sortKey) return rows;

  const direction = state.sortDirection === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const aValue = a[state.sortKey];
    const bValue = b[state.sortKey];

    if (state.sortKey === "hbaQuantity" || state.sortKey === "hbaPrice") {
      return (Number(aValue || 0) - Number(bValue || 0)) * direction;
    }

    return String(aValue || "").localeCompare(String(bValue || ""), undefined, {
      sensitivity: "base",
      numeric: true,
    }) * direction;
  });
}

function applyFilters() {
  const searchValue = elements.search.value.trim();
  const availability = elements.availabilityFilter.value;

  const rows = state.products.filter((product) => {
    const matchesSearch = matchesRobustSearch(product, searchValue);
    const matchesAvailability =
      availability === "all" ||
      (availability === "in-stock" && product.inStock) ||
      (availability === "sold-out" && !product.inStock);

    return matchesSearch && matchesAvailability;
  });

  state.filteredProducts = applySort(rows);
  renderCatalog();
  renderSortIndicators();
}

function renderSortIndicators() {
  elements.sortIndicators.forEach((indicator) => {
    const key = indicator.dataset.indicatorFor;
    if (key !== state.sortKey) {
      indicator.textContent = "";
      return;
    }
    indicator.textContent = state.sortDirection === "asc" ? "▲" : "▼";
  });
}

function renderCatalog() {
  elements.catalogBody.innerHTML = "";

  if (state.filteredProducts.length === 0) {
    elements.catalogEmpty.classList.remove("hidden");
    return;
  }

  elements.catalogEmpty.classList.add("hidden");

  for (const product of state.filteredProducts) {
    const fragment = elements.catalogRowTemplate.content.cloneNode(true);
    const rowImage = fragment.querySelector(".table-image");
    const skuCell = fragment.querySelector(".sku-cell");
    const upcCell = fragment.querySelector(".upc-cell");
    const brandCell = fragment.querySelector(".brand-cell");
    const nameCell = fragment.querySelector(".name-cell");
    const availableCell = fragment.querySelector(".available-cell");
    const priceCell = fragment.querySelector(".price-cell");
    const qtyInput = fragment.querySelector(".row-qty-input");

    rowImage.src = product.image || fallbackImage;
    rowImage.alt = product.itemName;
    skuCell.textContent = product.sku;
    upcCell.textContent = product.upc || "";
    brandCell.textContent = product.brand;
    nameCell.textContent = product.itemName;
    availableCell.textContent = String(product.hbaQuantity ?? 0);
    priceCell.textContent = currencyFormatter.format(Number(product.hbaPrice || 0));
    qtyInput.max = String(product.hbaQuantity || 0);
    qtyInput.disabled = !product.inStock;

    const existingLine = state.cart[product.sku];
    qtyInput.value = existingLine ? String(existingLine.quantity) : "";

    const commitValue = () => updateCartForProduct(product, qtyInput.value);
    qtyInput.addEventListener("blur", commitValue);
    qtyInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        qtyInput.blur();
      }
    });

    elements.catalogBody.appendChild(fragment);
  }
}

function renderOrderTable(targetBody, editable) {
  targetBody.innerHTML = "";
  const lines = Object.values(state.cart);

  for (const line of lines) {
    const fragment = elements.cartRowTemplate.content.cloneNode(true);
    const skuCell = fragment.querySelector(".sku-cell");
    const upcCell = fragment.querySelector(".upc-cell");
    const brandCell = fragment.querySelector(".brand-cell");
    const nameCell = fragment.querySelector(".name-cell");
    const priceCell = fragment.querySelector(".price-cell");
    const qtyInput = fragment.querySelector(".cart-row-qty-input");
    const totalCell = fragment.querySelector(".line-total-cell");

    skuCell.textContent = line.sku;
    upcCell.textContent = line.upc || "";
    brandCell.textContent = line.brand;
    nameCell.textContent = line.itemName;
    priceCell.textContent = currencyFormatter.format(line.hbaPrice);
    qtyInput.value = String(line.quantity);
    totalCell.textContent = currencyFormatter.format(line.quantity * line.hbaPrice);

    const currentProduct = state.products.find((product) => product.sku === line.sku);
    qtyInput.max = String(currentProduct?.hbaQuantity || 0);
    qtyInput.disabled = !editable;

    if (editable) {
      qtyInput.addEventListener("blur", () => {
        updateCartForProduct(currentProduct || line, qtyInput.value);
      });
      qtyInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          qtyInput.blur();
        }
      });
    }

    targetBody.appendChild(fragment);
  }
}

function renderCartView() {
  const lines = Object.values(state.cart);
  if (lines.length === 0) {
    elements.cartEmpty.classList.remove("hidden");
  } else {
    elements.cartEmpty.classList.add("hidden");
  }

  renderOrderTable(elements.cartTableBody, true);
}

function renderCheckoutView() {
  renderOrderTable(elements.checkoutTableBody, false);
}

function renderCartSummary() {
  const summary = getCartSummary();
  elements.cartSummaryLines.textContent = `${summary.lineCount} SKU${summary.lineCount === 1 ? "" : "s"}`;
  elements.cartSummaryPrice.textContent = currencyFormatter.format(summary.totalPrice);
  elements.cartTotalLines.textContent = String(summary.lineCount);
  elements.cartTotalUnits.textContent = String(summary.totalUnits);
  elements.cartTotalPrice.textContent = currencyFormatter.format(summary.totalPrice);
  elements.checkoutTotalLines.textContent = String(summary.lineCount);
  elements.checkoutTotalUnits.textContent = String(summary.totalUnits);
  elements.checkoutTotalPrice.textContent = currencyFormatter.format(summary.totalPrice);
}

function renderView() {
  elements.catalogView.classList.toggle("hidden", state.view !== "catalog");
  elements.cartView.classList.toggle("hidden", state.view !== "cart");
  elements.checkoutView.classList.toggle("hidden", state.view !== "checkout");
}

function renderAll() {
  renderCatalog();
  renderCartView();
  renderCheckoutView();
  renderCartSummary();
  renderView();
}

function clearCart() {
  state.cart = {};
  persistCart();
  renderAll();
}

function populateSalesPeople() {
  const salesPeople = Array.isArray(window.HBA_CONFIG?.salesPeople) && window.HBA_CONFIG.salesPeople.length > 0
    ? window.HBA_CONFIG.salesPeople
    : ["General Sales"];

  salesPeople.forEach((person) => {
    const option = document.createElement("option");
    option.value = person;
    option.textContent = person;
    elements.salesPersonSelect.appendChild(option);
  });
}

function getCheckoutFormData() {
  const formData = new FormData(elements.checkoutForm);
  return Object.fromEntries(formData.entries());
}

async function handleCheckoutSubmit(event) {
  event.preventDefault();
  elements.checkoutMessage.textContent = "";
  elements.checkoutMessage.className = "checkout-message";
  elements.submitOrderButton.disabled = true;
  elements.submitOrderButton.textContent = "Submitting...";

  try {
    const customer = getCheckoutFormData();
    const items = Object.values(state.cart).map((line) => ({
      sku: line.sku,
      upc: line.upc,
      brand: line.brand,
      itemName: line.itemName,
      quantity: line.quantity,
      price: line.hbaPrice,
    }));

    await submitOrder({ customer, items });
    clearCart();
    elements.checkoutForm.reset();
    state.view = "catalog";
    elements.checkoutMessage.textContent = "Order submitted successfully.";
    elements.checkoutMessage.classList.add("success");
    renderAll();
  } catch (error) {
    console.error(error);
    elements.checkoutMessage.textContent = error.message || "Failed to submit order.";
    elements.checkoutMessage.classList.add("error");
  } finally {
    elements.submitOrderButton.disabled = false;
    elements.submitOrderButton.textContent = "Place Order";
  }
}

function wireEvents() {
  elements.search.addEventListener("input", applyFilters);
  elements.availabilityFilter.addEventListener("change", applyFilters);
  elements.cartSummaryButton.addEventListener("click", () => {
    state.view = "cart";
    renderView();
  });
  elements.backToProductsButton.addEventListener("click", () => {
    state.view = "catalog";
    renderView();
  });
  elements.clearCartButton.addEventListener("click", clearCart);
  elements.completeOrderButton.addEventListener("click", () => {
    state.view = "checkout";
    renderView();
  });
  elements.checkoutBackButton.addEventListener("click", () => {
    state.view = "cart";
    renderView();
  });
  elements.checkoutForm.addEventListener("submit", handleCheckoutSubmit);

  elements.sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.sortKey;
      if (!key) return;

      if (state.sortKey === key) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDirection = "asc";
      }

      applyFilters();
    });
  });
}

async function init() {
  populateSalesPeople();
  wireEvents();
  renderCartSummary();
  renderView();

  try {
    state.products = await fetchCatalog();
    state.filteredProducts = [...state.products];
    applyFilters();
    renderCartView();
    renderCheckoutView();
    renderCartSummary();
  } catch (error) {
    console.error(error);
    elements.catalogEmpty.classList.remove("hidden");
    elements.catalogEmpty.textContent =
      "Unable to load catalog. Make sure the backend is running and at least one SKU has HBA enabled.";
  }
}

init();

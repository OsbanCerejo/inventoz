const state = {
  products: [],
  filteredProducts: [],
  cart: loadCart(),
};

const apiBaseUrl = String(window.HBA_CONFIG?.apiBaseUrl || "").replace(/\/$/, "");

const elements = {
  search: document.getElementById("catalog-search"),
  availabilityFilter: document.getElementById("availability-filter"),
  grid: document.getElementById("catalog-grid"),
  empty: document.getElementById("catalog-empty"),
  visibleSkuCount: document.getElementById("visible-sku-count"),
  inStockCount: document.getElementById("in-stock-count"),
  cartItems: document.getElementById("cart-items"),
  cartLineCount: document.getElementById("cart-line-count"),
  cartTotalUnits: document.getElementById("cart-total-units"),
  cartTotalPrice: document.getElementById("cart-total-price"),
  copyOrderButton: document.getElementById("copy-order-button"),
  productCardTemplate: document.getElementById("product-card-template"),
  cartItemTemplate: document.getElementById("cart-item-template"),
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const fallbackImage =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <rect width="320" height="320" rx="28" fill="#f2ece1"/>
      <text x="50%" y="48%" text-anchor="middle" fill="#71563d" font-family="Georgia, serif" font-size="34">HBA</text>
      <text x="50%" y="60%" text-anchor="middle" fill="#9a7f61" font-family="Arial, sans-serif" font-size="16">No image</text>
    </svg>
  `);

async function fetchCatalog() {
  const response = await fetch(`${apiBaseUrl}/products/hba/public-catalog`);
  if (!response.ok) {
    throw new Error(`Failed to load catalog (${response.status})`);
  }

  return response.json();
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
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.floor(parsed), Math.max(0, Number(maxQuantity || 0)));
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

function applyFilters() {
  const searchValue = elements.search.value.trim().toLowerCase();
  const availability = elements.availabilityFilter.value;

  state.filteredProducts = state.products.filter((product) => {
    const matchesSearch =
      !searchValue ||
      product.sku.toLowerCase().includes(searchValue) ||
      product.brand.toLowerCase().includes(searchValue) ||
      product.itemName.toLowerCase().includes(searchValue);

    const matchesAvailability =
      availability === "all" ||
      (availability === "in-stock" && product.inStock) ||
      (availability === "sold-out" && !product.inStock);

    return matchesSearch && matchesAvailability;
  });

  renderCatalog();
}

function renderCatalog() {
  elements.grid.innerHTML = "";

  elements.visibleSkuCount.textContent = String(state.products.length);
  elements.inStockCount.textContent = String(
    state.products.filter((product) => product.inStock).length
  );

  if (state.filteredProducts.length === 0) {
    elements.empty.classList.remove("hidden");
    return;
  }

  elements.empty.classList.add("hidden");

  for (const product of state.filteredProducts) {
    const fragment = elements.productCardTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".product-card");
    const image = fragment.querySelector(".card-image");
    const brandPill = fragment.querySelector(".brand-pill");
    const stockPill = fragment.querySelector(".stock-pill");
    const name = fragment.querySelector(".product-name");
    const sku = fragment.querySelector(".product-sku");
    const postedQty = fragment.querySelector(".posted-qty");
    const unitPrice = fragment.querySelector(".unit-price");
    const quantityInput = fragment.querySelector(".quantity-input");
    const addButton = fragment.querySelector(".add-button");

    image.src = product.image || fallbackImage;
    image.alt = product.itemName;
    brandPill.textContent = product.brand;
    stockPill.textContent = product.inStock ? "In Stock" : "Sold Out";
    stockPill.classList.add(product.inStock ? "in-stock" : "sold-out");
    name.textContent = product.itemName;
    sku.textContent = product.sku;
    postedQty.textContent = String(product.hbaQuantity ?? 0);
    unitPrice.textContent = currencyFormatter.format(Number(product.hbaPrice || 0));
    quantityInput.max = String(product.hbaQuantity || 0);
    quantityInput.disabled = !product.inStock;
    addButton.disabled = !product.inStock;

    const existingLine = state.cart[product.sku];
    if (existingLine) {
      quantityInput.value = String(existingLine.quantity);
      addButton.textContent = "Update";
    }

    addButton.addEventListener("click", () => {
      const quantity = sanitizeQuantity(quantityInput.value, product.hbaQuantity);

      if (quantity === 0) {
        delete state.cart[product.sku];
      } else {
        state.cart[product.sku] = {
          sku: product.sku,
          brand: product.brand,
          itemName: product.itemName,
          quantity,
          hbaPrice: Number(product.hbaPrice || 0),
        };
      }

      persistCart();
      renderCatalog();
      renderCart();
    });

    card.dataset.sku = product.sku;
    elements.grid.appendChild(fragment);
  }
}

function renderCart() {
  elements.cartItems.innerHTML = "";

  const lines = Object.values(state.cart);
  const summary = getCartSummary();

  elements.cartLineCount.textContent = `${summary.lineCount} line${summary.lineCount === 1 ? "" : "s"}`;
  elements.cartTotalUnits.textContent = String(summary.totalUnits);
  elements.cartTotalPrice.textContent = currencyFormatter.format(summary.totalPrice);

  if (lines.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<h2>Your cart is empty</h2><p>Add any HBA-enabled product to start building a draft order.</p>";
    elements.cartItems.appendChild(empty);
    return;
  }

  for (const line of lines) {
    const fragment = elements.cartItemTemplate.content.cloneNode(true);
    const name = fragment.querySelector(".cart-item-name");
    const meta = fragment.querySelector(".cart-item-meta");
    const qtyInput = fragment.querySelector(".cart-item-qty");
    const total = fragment.querySelector(".cart-item-total");

    name.textContent = line.itemName;
    meta.textContent = `${line.sku} • ${currencyFormatter.format(line.hbaPrice)} each`;
    qtyInput.value = String(line.quantity);
    total.textContent = currencyFormatter.format(line.quantity * line.hbaPrice);

    const currentProduct = state.products.find((product) => product.sku === line.sku);
    qtyInput.max = String(currentProduct?.hbaQuantity || 0);

    qtyInput.addEventListener("change", () => {
      const quantity = sanitizeQuantity(qtyInput.value, currentProduct?.hbaQuantity || 0);
      if (quantity === 0) {
        delete state.cart[line.sku];
      } else {
        state.cart[line.sku].quantity = quantity;
      }

      persistCart();
      renderCatalog();
      renderCart();
    });

    elements.cartItems.appendChild(fragment);
  }
}

async function copyOrderSummary() {
  const lines = Object.values(state.cart);
  if (lines.length === 0) return;

  const summary = getCartSummary();
  const text = [
    "HBA Order Draft",
    "",
    ...lines.map((line) => `${line.sku} | ${line.itemName} | Qty ${line.quantity} | ${currencyFormatter.format(line.hbaPrice)} each | ${currencyFormatter.format(line.quantity * line.hbaPrice)}`),
    "",
    `Total Units: ${summary.totalUnits}`,
    `Estimated Total: ${currencyFormatter.format(summary.totalPrice)}`,
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    elements.copyOrderButton.textContent = "Copied";
    window.setTimeout(() => {
      elements.copyOrderButton.textContent = "Copy Order Summary";
    }, 1400);
  } catch (error) {
    console.error("Failed to copy order summary:", error);
    alert(text);
  }
}

function wireEvents() {
  elements.search.addEventListener("input", applyFilters);
  elements.availabilityFilter.addEventListener("change", applyFilters);
  elements.copyOrderButton.addEventListener("click", copyOrderSummary);
}

async function init() {
  wireEvents();
  renderCart();

  try {
    state.products = await fetchCatalog();
    state.filteredProducts = [...state.products];
    renderCatalog();
  } catch (error) {
    console.error(error);
    elements.grid.innerHTML = "";
    elements.empty.classList.remove("hidden");
    elements.empty.innerHTML = `
      <h2>Unable to load catalog</h2>
      <p>Make sure the backend is running and at least one SKU has HBA enabled.</p>
    `;
  }
}

init();

const state = {
  products: [],
  filteredProducts: [],
  cart: loadCart(),
  view: "catalog",
  successRedirectTimeoutId: null,
  selectedCategories: new Set(["all"]),
  itemCategoryFilters: {
    tester: false,
    discontinued: false,
  },
  sortKey: "",
  sortDirection: "asc",
  eventsWired: false,
};

const apiBaseUrl = String(window.HBA_CONFIG?.apiBaseUrl || "").replace(/\/$/, "");

const elements = {
  search: document.getElementById("catalog-search"),
  categoryFilterCheckboxes: document.getElementById("category-filter-checkboxes"),
  itemCategoryTesterCheckbox: document.getElementById("item-category-tester-checkbox"),
  itemCategoryDiscontinuedCheckbox: document.getElementById("item-category-discontinued-checkbox"),
  catalogView: document.getElementById("catalog-view"),
  cartView: document.getElementById("cart-view"),
  checkoutView: document.getElementById("checkout-view"),
  catalogBody: document.getElementById("catalog-body"),
  catalogEmpty: document.getElementById("catalog-empty"),
  cartEmpty: document.getElementById("cart-empty"),
  cartTableBody: document.getElementById("cart-table-body"),
  checkoutTableBody: document.getElementById("checkout-table-body"),
  cartSummaryButton: document.getElementById("cart-summary-button"),
  clearCartHeaderButton: document.getElementById("clear-cart-header-button"),
  cartSummaryLines: document.getElementById("cart-summary-lines"),
  cartSummaryPrice: document.getElementById("cart-summary-price"),
  cartTotalLines: document.getElementById("cart-total-lines"),
  cartTotalUnits: document.getElementById("cart-total-units"),
  cartTotalPrice: document.getElementById("cart-total-price"),
  checkoutTotalLines: document.getElementById("checkout-total-lines"),
  checkoutTotalUnits: document.getElementById("checkout-total-units"),
  checkoutTotalPrice: document.getElementById("checkout-total-price"),
  backToProductsButton: document.getElementById("back-to-products-button"),
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

const preferredCategoryOrder = ["All", "Perfumes", "Cosmetics", "Skincare", "Home", "Other"];

const categoryDisplayMap = new Map([
  ["fragrance", "Perfumes"],
  ["fragrances", "Perfumes"],
  ["perfume", "Perfumes"],
  ["perfumes", "Perfumes"],
  ["cosmetic", "Cosmetics"],
  ["cosmetics", "Cosmetics"],
  ["skincare", "Skincare"],
  ["skin care", "Skincare"],
  ["home", "Home"],
  ["other", "Other"],
]);

async function fetchCatalog() {
  const response = await fetch(`${apiBaseUrl}/products/hba/public-catalog`);
  if (!response.ok) {
    throw new Error(`Failed to load catalog (${response.status})`);
  }
  return response.json();
}

async function fetchSiteConfig() {
  const response = await fetch(`${apiBaseUrl}/products/hba/site-config`);
  if (!response.ok) {
    throw new Error(`Failed to load site config (${response.status})`);
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

  const rawBody = await response.text();
  let data = {};
  try {
    data = rawBody ? JSON.parse(rawBody) : {};
  } catch (error) {
    data = {};
  }

  if (!response.ok) {
    const fallbackMessage = rawBody ? rawBody.slice(0, 240) : `Failed to submit order (${response.status})`;
    throw new Error(data.error || data.details || fallbackMessage);
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

function formatNumericSize(value, unit) {
  if (value === null || value === undefined || value === "") return "";
  const numericValue = Number(value);
  if (Number.isFinite(numericValue) && numericValue > 0) {
    return `${numericValue} ${unit}`;
  }
  return String(value).trim();
}

function formatSizeDisplay(sizeOz, sizeMl) {
  const sizeOzLabel = formatNumericSize(sizeOz, "oz");
  const sizeMlLabel = formatNumericSize(sizeMl, "ml");

  if (sizeOzLabel && sizeMlLabel) {
    return `${sizeOzLabel} / ${sizeMlLabel}`;
  }

  return sizeOzLabel || sizeMlLabel;
}

function buildItemMeta(productOrLine) {
  const sizeLabel = formatSizeDisplay(productOrLine.sizeOz, productOrLine.sizeMl);
  const strengthLabel = String(productOrLine.strength || "").trim();
  const isFragrance = normalizeCategoryLabel(productOrLine.category) === "Perfumes";

  return {
    sizeLabel,
    strengthLabel,
    showTesterBadge: isFragrance && Boolean(productOrLine.tester),
  };
}

function buildGoogleSearchQuery(productOrLine) {
  const upc = String(productOrLine.upc || "").trim();
  if (upc) {
    return upc;
  }

  return [productOrLine.itemName, formatSizeDisplay(productOrLine.sizeOz, productOrLine.sizeMl), productOrLine.strength]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
}

function renderItemNameCell(cell, productOrLine) {
  const primary = document.createElement("div");
  primary.className = "item-name-primary";

  const metaInfo = buildItemMeta(productOrLine);
  const titleText = document.createElement("span");
  titleText.className = "item-name-text";
  titleText.textContent =
    [productOrLine.itemName || "", metaInfo.strengthLabel, metaInfo.sizeLabel]
      .filter(Boolean)
      .join(" ");
  primary.appendChild(titleText);

  if (metaInfo.showTesterBadge) {
    const badge = document.createElement("span");
    badge.className = "tester-badge";
    badge.textContent = "Tester";
    primary.appendChild(badge);
  }

  cell.appendChild(primary);
}
function buildSearchHaystack(product) {
  return normalizeText(
    [product.upc, product.brand, product.itemName, formatSizeDisplay(product.sizeOz, product.sizeMl), product.strength].join(" ")
  );
}

function matchesRobustSearch(product, searchValue) {
  if (!searchValue) return true;
  const haystack = buildSearchHaystack(product);
  const terms = normalizeText(searchValue).split(" ").filter(Boolean);
  if (terms.length === 0) return true;
  return terms.every((term) => haystack.includes(term));
}

function normalizeCategoryLabel(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  return categoryDisplayMap.get(normalized) || normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getAvailableCategories() {
  const categories = new Set();
  for (const product of state.products) {
    const normalized = normalizeCategoryLabel(product.category);
    if (normalized) {
      categories.add(normalized);
    }
  }

  const orderedCategories = preferredCategoryOrder.filter(
    (category) => category === "All" || categories.has(category)
  );

  const remainingCategories = Array.from(categories)
    .filter((category) => !preferredCategoryOrder.includes(category))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  return ["all", ...orderedCategories.filter((category) => category !== "All"), ...remainingCategories];
}

function renderCategoryFilters() {
  elements.categoryFilterCheckboxes.innerHTML = "";

  for (const category of getAvailableCategories()) {
    const label = document.createElement("label");
    label.className = "checkbox-filter-option";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = category;
    input.checked = state.selectedCategories.has(category);

    input.addEventListener("change", () => {
      if (category === "all") {
        state.selectedCategories = new Set(["all"]);
      } else {
        const nextSelected = new Set(state.selectedCategories);
        nextSelected.delete("all");

        if (input.checked) {
          nextSelected.add(category);
        } else {
          nextSelected.delete(category);
        }

        state.selectedCategories =
          nextSelected.size === 0 ? new Set(["all"]) : nextSelected;
      }

      renderCategoryFilters();
      applyFilters();
    });

    const text = document.createElement("span");
    text.textContent = category === "all" ? "All" : category;

    label.appendChild(input);
    label.appendChild(text);
    elements.categoryFilterCheckboxes.appendChild(label);
  }
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

function formatLineTotal(quantity, price) {
  const sanitizedQuantity = Number(quantity || 0);
  if (!sanitizedQuantity || sanitizedQuantity <= 0) {
    return "";
  }

  return currencyFormatter.format(sanitizedQuantity * Number(price || 0));
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
      category: product.category,
      sizeOz: product.sizeOz,
      sizeMl: product.sizeMl,
      strength: product.strength,
      tester: Boolean(product.tester),
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
  const selectedCategories = state.selectedCategories;
  const includeTester = state.itemCategoryFilters.tester;
  const includeDiscontinued = state.itemCategoryFilters.discontinued;

  const rows = state.products.filter((product) => {
    const matchesSearch = matchesRobustSearch(product, searchValue);
    const matchesCategory =
      selectedCategories.has("all") ||
      selectedCategories.has(normalizeCategoryLabel(product.category));
    const isTester = Boolean(product.tester);
    const isDiscontinued = Boolean(product.discontinued);
    const matchesItemCategory =
      (!includeTester && !includeDiscontinued) ||
      (includeTester && isTester) ||
      (includeDiscontinued && isDiscontinued);

    return matchesSearch && matchesCategory && matchesItemCategory;
  });

  state.filteredProducts = applySort(rows);
  renderCategoryFilters();
  renderCatalog();
  renderSortIndicators();
}

function renderSortIndicators() {
  elements.sortIndicators.forEach((indicator) => {
    const key = indicator.dataset.indicatorFor;
    if (key !== state.sortKey) {
      indicator.textContent = "⇅";
      indicator.style.color = "#b5b5b5";
      return;
    }
    indicator.textContent = state.sortDirection === "asc" ? "↑" : "↓";
    indicator.style.color = "#666";
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
    const imageSearchButton = fragment.querySelector(".image-search-button");
    const upcCell = fragment.querySelector(".upc-cell");
    const brandCell = fragment.querySelector(".brand-cell");
    const nameCell = fragment.querySelector(".name-cell");
    const availableCell = fragment.querySelector(".available-cell");
    const priceCell = fragment.querySelector(".price-cell");
    const qtyInput = fragment.querySelector(".row-qty-input");
    const subtotalCell = fragment.querySelector(".line-total-cell");

    imageSearchButton.addEventListener("click", () => {
      const query = buildGoogleSearchQuery(product);
      if (!query) return;
      const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    });
    upcCell.textContent = product.upc || "";
    brandCell.textContent = product.brand;
    renderItemNameCell(nameCell, product);
    availableCell.textContent = String(product.hbaQuantity ?? 0);
    priceCell.textContent = currencyFormatter.format(Number(product.hbaPrice || 0));
    qtyInput.max = String(product.hbaQuantity || 0);
    qtyInput.disabled = !product.inStock;

    const existingLine = state.cart[product.sku];
    qtyInput.value = existingLine ? String(existingLine.quantity) : "";
    subtotalCell.textContent = formatLineTotal(existingLine?.quantity || 0, product.hbaPrice);

    const commitValue = () => updateCartForProduct(product, qtyInput.value);
    qtyInput.addEventListener("input", () => {
      const previewQuantity = sanitizeQuantity(qtyInput.value, product.hbaQuantity);
      subtotalCell.textContent = formatLineTotal(previewQuantity, product.hbaPrice);
    });
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
    const upcCell = fragment.querySelector(".upc-cell");
    const brandCell = fragment.querySelector(".brand-cell");
    const nameCell = fragment.querySelector(".name-cell");
    const priceCell = fragment.querySelector(".price-cell");
    const qtyInput = fragment.querySelector(".cart-row-qty-input");
    const totalCell = fragment.querySelector(".line-total-cell");

    upcCell.textContent = line.upc || "";
    brandCell.textContent = line.brand;
    renderItemNameCell(nameCell, line);
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

function clearSuccessRedirectTimeout() {
  if (state.successRedirectTimeoutId) {
    clearTimeout(state.successRedirectTimeoutId);
    state.successRedirectTimeoutId = null;
  }
}

function populateSalesPeople(salesPeople) {
  const values = Array.isArray(salesPeople) && salesPeople.length > 0 ? salesPeople : ["General Sales"];

  values.forEach((person) => {
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

    const result = await submitOrder({ customer, items });
    clearSuccessRedirectTimeout();
    clearCart();
    elements.checkoutForm.reset();
    state.view = "checkout";
    elements.checkoutMessage.textContent = `Thank you. Your order has been sent successfully. We will reach out to you at ${customer.email} with your invoice and payment details.${result.orderNumber ? ` Reference: ${result.orderNumber}.` : ""}`;
    elements.checkoutMessage.classList.add("success");
    renderAll();

    state.successRedirectTimeoutId = window.setTimeout(() => {
      state.successRedirectTimeoutId = null;
      state.view = "catalog";
      renderAll();
    }, 10000);
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
  if (state.eventsWired) return;
  state.eventsWired = true;

  elements.search.addEventListener("input", applyFilters);
  elements.itemCategoryTesterCheckbox.addEventListener("change", () => {
    state.itemCategoryFilters.tester = elements.itemCategoryTesterCheckbox.checked;
    applyFilters();
  });
  elements.itemCategoryDiscontinuedCheckbox.addEventListener("change", () => {
    state.itemCategoryFilters.discontinued = elements.itemCategoryDiscontinuedCheckbox.checked;
    applyFilters();
  });
  elements.cartSummaryButton.addEventListener("click", () => {
    clearSuccessRedirectTimeout();
    state.view = "cart";
    renderView();
  });
  elements.clearCartHeaderButton.addEventListener("click", clearCart);
  elements.backToProductsButton.addEventListener("click", () => {
    clearSuccessRedirectTimeout();
    state.view = "catalog";
    renderView();
  });
  elements.completeOrderButton.addEventListener("click", () => {
    clearSuccessRedirectTimeout();
    state.view = "checkout";
    renderView();
  });
  elements.checkoutBackButton.addEventListener("click", () => {
    clearSuccessRedirectTimeout();
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
  try {
    const siteConfig = await fetchSiteConfig();
    populateSalesPeople(siteConfig.salesPeople);
    wireEvents();
    renderCartSummary();
    renderView();
    state.products = await fetchCatalog();
    state.filteredProducts = [...state.products];
    applyFilters();
    renderCartView();
    renderCheckoutView();
    renderCartSummary();
  } catch (error) {
    console.error(error);
    if (elements.salesPersonSelect.options.length <= 1) {
      populateSalesPeople(["General Sales"]);
    }
    wireEvents();
    renderCartSummary();
    renderView();
    elements.catalogEmpty.classList.remove("hidden");
    elements.catalogEmpty.textContent =
      "Unable to load catalog. Make sure the backend is running and at least one SKU has HBA enabled.";
  }
}

init();


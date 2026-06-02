const state = {
  products: [],
  filteredProducts: [],
  cart: loadCart(),
  view: "catalog",
  successRedirectTimeoutId: null,
  selectedCategory: "all",
  selectedBrand: "all",
  selectedSizeType: "all",
  showNewArrivalsOnly: false,
  sortKey: "",
  sortDirection: "asc",
  eventsWired: false,
};

const apiBaseUrl = String(window.HBA_CONFIG?.apiBaseUrl || "").replace(/\/$/, "");
const minimumOrderTotal = 500;

const elements = {
  search: document.getElementById("catalog-search"),
  homeLogoButton: document.getElementById("home-logo-button"),
  categoryFilter: document.getElementById("category-filter"),
  brandFilter: document.getElementById("brand-filter"),
  sizeTypeFilter: document.getElementById("size-type-filter"),
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
  mobileCartBar: document.getElementById("mobile-cart-bar"),
  mobileCartUnits: document.getElementById("mobile-cart-units"),
  mobileCartPrice: document.getElementById("mobile-cart-price"),
  cartTotalLines: document.getElementById("cart-total-lines"),
  cartTotalUnits: document.getElementById("cart-total-units"),
  cartTotalPrice: document.getElementById("cart-total-price"),
  cartMinimumMessage: document.getElementById("cart-minimum-message"),
  checkoutTotalLines: document.getElementById("checkout-total-lines"),
  checkoutTotalUnits: document.getElementById("checkout-total-units"),
  checkoutTotalPrice: document.getElementById("checkout-total-price"),
  checkoutMinimumMessage: document.getElementById("checkout-minimum-message"),
  backToProductsButton: document.getElementById("back-to-products-button"),
  completeOrderButton: document.getElementById("complete-order-button"),
  checkoutBackButton: document.getElementById("checkout-back-button"),
  checkoutForm: document.getElementById("checkout-form"),
  submitOrderButton: document.getElementById("submit-order-button"),
  checkoutMessage: document.getElementById("checkout-message"),
  salesPersonSelect: document.getElementById("customer-salesPerson"),
  newArrivalsButton: document.getElementById("new-arrivals-button"),
  catalogRowTemplate: document.getElementById("catalog-row-template"),
  cartRowTemplate: document.getElementById("cart-row-template"),
  sortButtons: document.querySelectorAll(".sort-button"),
  sortIndicators: document.querySelectorAll(".sort-indicator"),
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const tracking = {
  visitorId: getOrCreateStorageId("hbaVisitorId"),
  sessionId: getOrCreateSessionId(),
  searchDebounceId: null,
};

function getOrCreateStorageId(key) {
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const next = `hba_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(key, next);
    return next;
  } catch (error) {
    return `hba_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  }
}

function getOrCreateSessionId() {
  try {
    const existing = sessionStorage.getItem("hbaSessionId");
    if (existing) return existing;
    const next = `hbas_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    sessionStorage.setItem("hbaSessionId", next);
    return next;
  } catch (error) {
    return `hbas_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  }
}

function getBrowserName() {
  const ua = navigator.userAgent || "";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\//i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  if (/Firefox\//i.test(ua)) return "Firefox";
  return "Unknown";
}

function getOsName() {
  const ua = navigator.userAgent || "";
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Android/i.test(ua)) return "Android";
  if (/(iPhone|iPad|iOS)/i.test(ua)) return "iOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}

function getDeviceType() {
  const ua = navigator.userAgent || "";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobile|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

function getTrackingCart() {
  const lines = Object.values(state.cart);
  const summary = getCartSummary();
  return {
    totalSkus: summary.lineCount,
    totalUnits: summary.totalUnits,
    totalPrice: summary.totalPrice,
    items: lines.map((line) => ({
      sku: line.sku,
      brand: line.brand,
      itemName: line.itemName,
      quantity: line.quantity,
      hbaPrice: line.hbaPrice,
    })),
  };
}

function trackEvent(eventType, details = {}) {
  const payload = {
    visitorId: tracking.visitorId,
    sessionId: tracking.sessionId,
    eventType,
    pageUrl: window.location.href,
    landingPage: window.location.href,
    referrer: document.referrer || "",
    device: {
      deviceType: getDeviceType(),
      browser: getBrowserName(),
      os: getOsName(),
      screenWidth: window.screen?.width || null,
      screenHeight: window.screen?.height || null,
    },
    cart: getTrackingCart(),
    ...details,
  };

  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(`${apiBaseUrl}/hba-analytics/track`, blob);
      return;
    }
  } catch (error) {
    // Fall back to fetch below.
  }

  fetch(`${apiBaseUrl}/hba-analytics/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

function trackSearchUsed() {
  const searchTerm = elements.search.value.trim();
  if (!searchTerm) return;
  window.clearTimeout(tracking.searchDebounceId);
  tracking.searchDebounceId = window.setTimeout(() => {
    trackEvent("search_used", { searchTerm });
  }, 700);
}

function applyMobileLabels(row, labels) {
  Object.entries(labels).forEach(([selector, label]) => {
    const cell = row.querySelector(selector);
    if (cell) {
      cell.dataset.label = label;
    }
  });
}

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

function getHbaMoq(productOrLine) {
  const parsed = Number(productOrLine?.hbaMoq || 1);
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1;
}

function getHbaStepCount(productOrLine) {
  const parsed = Number(productOrLine?.hbaStepCount || 1);
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1;
}

function isValidHbaQuantity(quantity, productOrLine) {
  const parsedQuantity = Number(quantity || 0);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) return true;
  const moq = getHbaMoq(productOrLine);
  const stepCount = getHbaStepCount(productOrLine);
  return parsedQuantity >= moq && (parsedQuantity - moq) % stepCount === 0;
}

function sanitizeQuantity(rawValue, maxQuantity, productOrLine = {}) {
  if (rawValue === "" || rawValue === null || rawValue === undefined) {
    return 0;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  const max = Math.max(0, Math.floor(Number(maxQuantity || 0)));
  const moq = getHbaMoq(productOrLine);
  const stepCount = getHbaStepCount(productOrLine);
  const floored = Math.min(Math.floor(parsed), max);

  if (floored < moq) {
    return 0;
  }

  const stepsAboveMoq = Math.floor((floored - moq) / stepCount);
  return moq + stepsAboveMoq * stepCount;
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
  const shadeLabel = String(productOrLine.shade || "").trim();
  const hbaConditionLabel = String(productOrLine.hbaCondition || "").trim();
  const isFragrance = normalizeCategoryLabel(productOrLine.category) === "Perfumes";

  return {
    sizeLabel,
    strengthLabel,
    shadeLabel,
    showTesterBadge: isFragrance && Boolean(productOrLine.tester),
    conditionBadgeLabel: hbaConditionLabel,
  };
}

function buildGoogleSearchQuery(productOrLine) {
  const upc = String(productOrLine.upc || "").trim();
  if (upc) {
    return upc;
  }

  return [productOrLine.itemName, productOrLine.shade, productOrLine.strength, formatSizeDisplay(productOrLine.sizeOz, productOrLine.sizeMl)]
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
    [productOrLine.itemName || "", metaInfo.shadeLabel, metaInfo.strengthLabel, metaInfo.sizeLabel]
      .filter(Boolean)
      .join(" ");
  primary.appendChild(titleText);

  if (metaInfo.showTesterBadge) {
    const badge = document.createElement("span");
    badge.className = "tester-badge";
    badge.textContent = "Tester";
    primary.appendChild(badge);
  }

  if (metaInfo.conditionBadgeLabel) {
    const badge = document.createElement("span");
    badge.className = "condition-badge";
    badge.textContent = metaInfo.conditionBadgeLabel;
    primary.appendChild(badge);
  }

  const stepCount = getHbaStepCount(productOrLine);
  if (stepCount > 1) {
    const incrementLabel = document.createElement("span");
    incrementLabel.className = "increment-label";
    incrementLabel.textContent = `(Increments of ${stepCount} pieces)`;
    primary.appendChild(incrementLabel);
  }

  cell.appendChild(primary);
}
function buildSearchHaystack(product) {
  return normalizeText(
    [
      product.upc,
      product.brand,
      getHbaTypeLabel(product),
      product.itemName,
      product.shade,
      product.strength,
      formatSizeDisplay(product.sizeOz, product.sizeMl),
    ].join(" ")
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

function getHbaTypeLabel(product) {
  const normalizedCategory = normalizeCategoryLabel(product?.category);
  if (normalizedCategory === "Skincare" || normalizedCategory === "Cosmetics") {
    return "Skincare & Cosmetics";
  }

  return String(product?.sizeType || "").trim();
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

function getAvailableSizeTypes() {
  return Array.from(
    new Set(
      state.products
        .map((product) => getHbaTypeLabel(product))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
}

function getAvailableBrands() {
  return Array.from(
    new Set(
      state.products
        .map((product) => String(product.brand || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
}

function renderBrandFilter() {
  if (!elements.brandFilter) return;

  const options = getAvailableBrands();
  const currentValue = String(state.selectedBrand || "all").trim() || "all";
  elements.brandFilter.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All";
  elements.brandFilter.appendChild(allOption);

  for (const brand of options) {
    const option = document.createElement("option");
    option.value = brand;
    option.textContent = brand;
    elements.brandFilter.appendChild(option);
  }

  const availableValues = new Set(["all", ...options]);
  elements.brandFilter.value = availableValues.has(currentValue) ? currentValue : "all";
  state.selectedBrand = elements.brandFilter.value;
}

function renderSizeTypeFilter() {
  if (!elements.sizeTypeFilter) return;

  const options = getAvailableSizeTypes();
  const currentValue = String(state.selectedSizeType || "all").trim() || "all";
  elements.sizeTypeFilter.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All";
  elements.sizeTypeFilter.appendChild(allOption);

  for (const sizeType of options) {
    const option = document.createElement("option");
    option.value = sizeType;
    option.textContent = sizeType;
    elements.sizeTypeFilter.appendChild(option);
  }

  const availableValues = new Set(["all", ...options]);
  elements.sizeTypeFilter.value = availableValues.has(currentValue) ? currentValue : "all";
  state.selectedSizeType = elements.sizeTypeFilter.value;
}

function renderCategoryFilter() {
  if (!elements.categoryFilter) return;

  const options = getAvailableCategories();
  const currentValue = String(state.selectedCategory || "all").trim() || "all";
  elements.categoryFilter.innerHTML = "";

  for (const category of options) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category === "all" ? "All" : category;
    elements.categoryFilter.appendChild(option);
  }

  const availableValues = new Set(options);
  elements.categoryFilter.value = availableValues.has(currentValue) ? currentValue : "all";
  state.selectedCategory = elements.categoryFilter.value;
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

function getMinimumOrderMessage(summary) {
  if (summary.lineCount === 0) {
    return "Add items to your cart to checkout.";
  }
  if (summary.totalPrice >= minimumOrderTotal) {
    return "";
  }

  const remaining = minimumOrderTotal - summary.totalPrice;
  return `Minimum order amount is ${currencyFormatter.format(minimumOrderTotal)}. Add ${currencyFormatter.format(remaining)} more to checkout.`;
}

function formatLineTotal(quantity, price) {
  const sanitizedQuantity = Number(quantity || 0);
  if (!sanitizedQuantity || sanitizedQuantity <= 0) {
    return "";
  }

  return currencyFormatter.format(sanitizedQuantity * Number(price || 0));
}

function updateCartForProduct(product, rawQuantity) {
  const previousQuantity = Number(state.cart[product.sku]?.quantity || 0);
  const quantity = sanitizeQuantity(rawQuantity, product.hbaQuantity, product);

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
      shade: product.shade,
      condition: product.condition,
      hbaCondition: product.hbaCondition,
      hbaNewArrival: Boolean(product.hbaNewArrival),
      hbaMoq: getHbaMoq(product),
      hbaStepCount: getHbaStepCount(product),
      sizeType: String(product.sizeType || "").trim(),
      hbaType: getHbaTypeLabel(product),
      tester: Boolean(product.tester),
      quantity,
      hbaPrice: Number(product.hbaPrice || 0),
    };
  }

  persistCart();
  renderAll();
  if (previousQuantity === 0 && quantity === 0) {
    return;
  }
  trackEvent(
    quantity === 0
      ? "cart_line_removed"
      : previousQuantity > 0
        ? "cart_line_updated"
        : "cart_line_added",
    {
      sku: product.sku,
      brand: product.brand,
      itemName: product.itemName,
      quantity,
      metadata: {
        previousQuantity,
        hbaMoq: getHbaMoq(product),
        hbaStepCount: getHbaStepCount(product),
      },
    }
  );
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
  const selectedCategory = String(state.selectedCategory || "all").trim() || "all";
  const selectedBrand = String(state.selectedBrand || "all").trim() || "all";
  const selectedSizeType = String(state.selectedSizeType || "all").trim() || "all";
  const showNewArrivalsOnly = state.showNewArrivalsOnly;

  const rows = state.products.filter((product) => {
    const matchesSearch = matchesRobustSearch(product, searchValue);
    const matchesNewArrival = !showNewArrivalsOnly || Boolean(product.hbaNewArrival);
    const matchesCategory =
      selectedCategory === "all" ||
      selectedCategory === normalizeCategoryLabel(product.category);
    const productBrand = String(product.brand || "").trim();
    const matchesBrand =
      selectedBrand === "all" || productBrand === selectedBrand;
    const productSizeType = getHbaTypeLabel(product);
    const matchesSizeType =
      selectedSizeType === "all" || productSizeType === selectedSizeType;

    return matchesSearch && matchesNewArrival && matchesCategory && matchesBrand && matchesSizeType;
  });

  state.filteredProducts = applySort(rows);
  renderCategoryFilter();
  renderBrandFilter();
  renderSizeTypeFilter();
  renderCatalog();
  renderSortIndicators();
  renderNewArrivalsButton();
}

function renderNewArrivalsButton() {
  elements.newArrivalsButton.textContent = state.showNewArrivalsOnly ? "All Products" : "New Arrivals";
  elements.newArrivalsButton.classList.toggle("active", state.showNewArrivalsOnly);
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
    applyMobileLabels(fragment, {
      ".upc-cell": "UPC",
      ".type-cell": "Type",
      ".brand-cell": "Brand",
      ".available-cell": "Available",
      ".price-cell": "Price",
      ".qty-cell": "Qty",
      ".line-total-cell": "Subtotal",
    });
    const imageSearchButton = fragment.querySelector(".image-search-button");
    const upcCell = fragment.querySelector(".upc-cell");
    const typeCell = fragment.querySelector(".type-cell");
    const brandCell = fragment.querySelector(".brand-cell");
    const nameCell = fragment.querySelector(".name-cell");
    const availableCell = fragment.querySelector(".available-cell");
    const priceCell = fragment.querySelector(".price-cell");
    const qtyInput = fragment.querySelector(".row-qty-input");
    const subtotalCell = fragment.querySelector(".line-total-cell");

    imageSearchButton.addEventListener("click", () => {
      const query = buildGoogleSearchQuery(product);
      if (!query) return;
      trackEvent("product_image_search_clicked", {
        sku: product.sku,
        brand: product.brand,
        itemName: product.itemName,
        metadata: { query },
      });
      const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    });
    upcCell.textContent = product.upc || "";
    typeCell.textContent = getHbaTypeLabel(product);
    brandCell.textContent = product.brand;
    renderItemNameCell(nameCell, product);
    availableCell.textContent = String(product.hbaQuantity ?? 0);
    priceCell.textContent = currencyFormatter.format(Number(product.hbaPrice || 0));
    qtyInput.max = String(product.hbaQuantity || 0);
    qtyInput.min = String(getHbaMoq(product));
    qtyInput.step = String(getHbaStepCount(product));
    qtyInput.disabled = !product.inStock;

    const existingLine = state.cart[product.sku];
    qtyInput.value = existingLine ? String(existingLine.quantity) : "";
    subtotalCell.textContent = formatLineTotal(existingLine?.quantity || 0, product.hbaPrice);

    const commitValue = () => updateCartForProduct(product, qtyInput.value);
    qtyInput.addEventListener("input", () => {
      const previewQuantity = sanitizeQuantity(qtyInput.value, product.hbaQuantity, product);
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
    applyMobileLabels(fragment, {
      ".upc-cell": "UPC",
      ".brand-cell": "Brand",
      ".price-cell": "Price",
      ".qty-cell": "Qty",
      ".line-total-cell": "Total",
    });
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
    qtyInput.min = String(getHbaMoq(currentProduct || line));
    qtyInput.step = String(getHbaStepCount(currentProduct || line));
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
  const invalidLine = Object.values(state.cart).find((line) => !isValidHbaQuantity(line.quantity, line));
  const invalidLineMessage = invalidLine
    ? `Quantity for SKU ${invalidLine.sku} must start at ${getHbaMoq(invalidLine)} and increase by ${getHbaStepCount(invalidLine)}.`
    : "";
  elements.cartSummaryLines.textContent = `${summary.totalUnits} pc${summary.totalUnits === 1 ? "" : "s"}`;
  elements.cartSummaryPrice.textContent = currencyFormatter.format(summary.totalPrice);
  elements.mobileCartUnits.textContent = `${summary.totalUnits} pc${summary.totalUnits === 1 ? "" : "s"}`;
  elements.mobileCartPrice.textContent = currencyFormatter.format(summary.totalPrice);
  elements.mobileCartBar.classList.toggle("hidden", summary.lineCount === 0 || state.view !== "catalog");
  elements.cartTotalLines.textContent = String(summary.lineCount);
  elements.cartTotalUnits.textContent = String(summary.totalUnits);
  elements.cartTotalPrice.textContent = currencyFormatter.format(summary.totalPrice);
  elements.checkoutTotalLines.textContent = String(summary.lineCount);
  elements.checkoutTotalUnits.textContent = String(summary.totalUnits);
  elements.checkoutTotalPrice.textContent = currencyFormatter.format(summary.totalPrice);

  const minimumMessage = invalidLineMessage || getMinimumOrderMessage(summary);
  elements.cartMinimumMessage.textContent = minimumMessage;
  elements.cartMinimumMessage.classList.toggle("hidden", !minimumMessage);
  elements.checkoutMinimumMessage.textContent = minimumMessage;
  elements.checkoutMinimumMessage.classList.toggle("hidden", !minimumMessage);
  elements.completeOrderButton.disabled = Boolean(minimumMessage);
  elements.submitOrderButton.disabled = Boolean(minimumMessage);
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

function clearCart(shouldTrack = true) {
  state.cart = {};
  persistCart();
  renderAll();
  if (shouldTrack) {
    trackEvent("cart_cleared");
  }
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

  const minimumMessage = getMinimumOrderMessage(getCartSummary());
  if (minimumMessage) {
    elements.checkoutMessage.textContent = minimumMessage;
    elements.checkoutMessage.classList.add("error");
    renderCartSummary();
    return;
  }

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
    trackEvent("order_submitted", {
      metadata: {
        orderNumber: result.orderNumber || "",
        salesPerson: customer.salesPerson || "",
      },
    });
    clearSuccessRedirectTimeout();
    clearCart(false);
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
    trackEvent("submit_failed", {
      metadata: {
        message: error.message || "Failed to submit order.",
      },
    });
  } finally {
    elements.submitOrderButton.disabled = false;
    elements.submitOrderButton.textContent = "Place Order";
    renderCartSummary();
  }
}

function wireEvents() {
  if (state.eventsWired) return;
  state.eventsWired = true;

  elements.search.addEventListener("input", applyFilters);
  elements.search.addEventListener("input", trackSearchUsed);
  elements.homeLogoButton.addEventListener("click", () => {
    clearSuccessRedirectTimeout();
    state.view = "catalog";
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  elements.categoryFilter.addEventListener("change", () => {
    state.selectedCategory = elements.categoryFilter.value || "all";
    applyFilters();
    trackEvent("filter_changed", { metadata: { filter: "category", value: state.selectedCategory } });
  });
  elements.brandFilter.addEventListener("change", () => {
    state.selectedBrand = elements.brandFilter.value || "all";
    applyFilters();
    trackEvent("filter_changed", { metadata: { filter: "brand", value: state.selectedBrand } });
  });
  elements.sizeTypeFilter.addEventListener("change", () => {
    state.selectedSizeType = elements.sizeTypeFilter.value || "all";
    applyFilters();
    trackEvent("filter_changed", { metadata: { filter: "type", value: state.selectedSizeType } });
  });
  elements.cartSummaryButton.addEventListener("click", () => {
    clearSuccessRedirectTimeout();
    state.view = "cart";
    renderAll();
    trackEvent("cart_viewed");
  });
  elements.mobileCartBar.addEventListener("click", () => {
    clearSuccessRedirectTimeout();
    state.view = "cart";
    renderAll();
    trackEvent("cart_viewed");
  });
  elements.clearCartHeaderButton.addEventListener("click", clearCart);
  elements.backToProductsButton.addEventListener("click", () => {
    clearSuccessRedirectTimeout();
    state.view = "catalog";
    renderView();
  });
  elements.completeOrderButton.addEventListener("click", () => {
    const minimumMessage = getMinimumOrderMessage(getCartSummary());
    if (minimumMessage) {
      elements.cartMinimumMessage.textContent = minimumMessage;
      elements.cartMinimumMessage.classList.remove("hidden");
      return;
    }

    clearSuccessRedirectTimeout();
    state.view = "checkout";
    renderView();
    trackEvent("checkout_started");
  });
  elements.checkoutBackButton.addEventListener("click", () => {
    clearSuccessRedirectTimeout();
    state.view = "cart";
    renderView();
  });
  elements.checkoutForm.addEventListener("submit", handleCheckoutSubmit);
  elements.newArrivalsButton.addEventListener("click", () => {
    state.showNewArrivalsOnly = !state.showNewArrivalsOnly;
    applyFilters();
    trackEvent("new_arrivals_toggled", { metadata: { active: state.showNewArrivalsOnly } });
  });

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
      trackEvent("sort_changed", {
        metadata: { sortKey: state.sortKey, sortDirection: state.sortDirection },
      });
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
    renderNewArrivalsButton();
    applyFilters();
    renderCartView();
    renderCheckoutView();
    renderCartSummary();
    trackEvent("catalog_loaded", { metadata: { productCount: state.products.length } });
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


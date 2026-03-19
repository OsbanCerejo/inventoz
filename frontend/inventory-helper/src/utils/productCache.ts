export const PRODUCTS_CACHE_KEY = "listOfProducts";
export const PRODUCTS_CACHE_TIMESTAMP_KEY = "listOfProductsTimestamp";

export const invalidateProductsCache = () => {
  try {
    localStorage.removeItem(PRODUCTS_CACHE_KEY);
    localStorage.removeItem(PRODUCTS_CACHE_TIMESTAMP_KEY);
  } catch (error) {
    console.warn("Failed to invalidate products cache:", error);
  }
};


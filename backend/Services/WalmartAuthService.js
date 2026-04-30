const axios = require("axios");

const DEFAULT_BASE_URL = process.env.WALMART_API_BASE_URL || "https://marketplace.walmartapis.com";
const DEFAULT_TOKEN_URL = process.env.WALMART_TOKEN_URL || `${DEFAULT_BASE_URL}/v3/token`;
const DEFAULT_SERVICE_NAME = process.env.WALMART_SERVICE_NAME || "Walmart Marketplace";
const REQUEST_TIMEOUT_MS = Number(process.env.WALMART_REQUEST_TIMEOUT_MS || 30000);
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

let cachedToken = null;
let cachedTokenExpiresAt = 0;
let inflightTokenPromise = null;

const sanitizeBaseUrl = (url) => String(url || DEFAULT_BASE_URL).replace(/\/+$/, "");
const stripWrappingQuotes = (value) => String(value || "").trim().replace(/^['"]|['"]$/g, "");

const getCredentials = () => ({
  clientId: stripWrappingQuotes(process.env.WALMART_CLIENT_ID || ""),
  clientSecret: stripWrappingQuotes(process.env.WALMART_CLIENT_SECRET || ""),
  tokenUrl: stripWrappingQuotes(process.env.WALMART_TOKEN_URL || DEFAULT_TOKEN_URL),
  market: stripWrappingQuotes(process.env.WALMART_MARKET || "US").toUpperCase(),
  baseUrl: sanitizeBaseUrl(process.env.WALMART_API_BASE_URL || DEFAULT_BASE_URL),
  serviceName: stripWrappingQuotes(process.env.WALMART_SERVICE_NAME || DEFAULT_SERVICE_NAME),
});

const getClientIdHint = () => {
  const { clientId } = getCredentials();
  if (!clientId) return null;
  if (clientId.length <= 8) return clientId;
  return `${clientId.slice(0, 4)}...${clientId.slice(-4)}`;
};

const hasCredentials = () => {
  const { clientId, clientSecret } = getCredentials();
  return Boolean(clientId && clientSecret);
};

const resetCachedToken = () => {
  cachedToken = null;
  cachedTokenExpiresAt = 0;
  inflightTokenPromise = null;
};

const fetchAccessToken = async () => {
  const { clientId, clientSecret, tokenUrl, serviceName } = getCredentials();
  if (!clientId || !clientSecret) {
    throw new Error("Missing Walmart API credentials. Set WALMART_CLIENT_ID and WALMART_CLIENT_SECRET.");
  }

  const encodedCredentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const params = new URLSearchParams({ grant_type: "client_credentials" });
  const response = await axios.post(tokenUrl, params.toString(), {
    headers: {
      Authorization: `Basic ${encodedCredentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "WM_QOS.CORRELATION_ID": require("crypto").randomUUID(),
      "WM_SVC.NAME": serviceName,
    },
    timeout: REQUEST_TIMEOUT_MS,
  });

  const accessToken = response?.data?.access_token;
  const expiresInSeconds = Number(response?.data?.expires_in || 900);
  if (!accessToken) {
    throw new Error("Walmart token response did not include access_token.");
  }

  cachedToken = accessToken;
  cachedTokenExpiresAt = Date.now() + expiresInSeconds * 1000 - TOKEN_EXPIRY_BUFFER_MS;
  return accessToken;
};

const getAccessToken = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh && cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }

  if (inflightTokenPromise) {
    return inflightTokenPromise;
  }

  inflightTokenPromise = fetchAccessToken().finally(() => {
    inflightTokenPromise = null;
  });

  return inflightTokenPromise;
};

module.exports = {
  getAccessToken,
  resetCachedToken,
  hasCredentials,
  getCredentials,
  getClientIdHint,
  sanitizeBaseUrl,
  REQUEST_TIMEOUT_MS,
};

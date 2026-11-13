const crypto = require('crypto');
const axios = require('axios');

const BASE_URL = 'https://open-api.tiktokglobalshop.com';
const AUTH_BASE_URL = 'https://auth.tiktok-shops.com';
const APP_KEY = process.env.TIKTOK_APP_KEY;
const APP_SECRET = process.env.TIKTOK_APP_SECRET;

// TikTok Shop API v2 signing:
// sign_input = APP_SECRET + path + sorted(key+value for params excluding sign and access_token) + body + APP_SECRET
// sign = HMAC-SHA256(key=APP_SECRET, message=sign_input), lowercase hex
function buildSign(path, params, body, secret) {
  const sortedKeys = Object.keys(params)
    .filter(k => k !== 'sign' && k !== 'access_token')
    .sort();

  let input = secret + path;
  for (const key of sortedKeys) {
    input += key + params[key];
  }
  if (body && body !== '{}' && body !== '') {
    input += body;
  }
  input += secret;

  return crypto.createHmac('sha256', secret).update(input).digest('hex');
}

// Generic signed request to TikTok Shop Open API
// access_token and sign are added AFTER the signature is computed (not included in signing)
async function request(method, path, accessToken, shopCipher = null, queryParams = {}, body = null) {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const params = {
    app_key: APP_KEY,
    timestamp,
    ...queryParams,
  };

  if (shopCipher) {
    params.shop_cipher = shopCipher;
  }

  const bodyStr = body ? JSON.stringify(body) : '';
  params.sign = buildSign(path, params, bodyStr, APP_SECRET);

  // access_token is added after signing
  params.access_token = accessToken;

  const url = `${BASE_URL}${path}`;

  let response;
  try {
    response = await axios({
      method,
      url,
      params,
      data: body || undefined,
      headers: {
        'Content-Type': 'application/json',
        'x-tts-access-token': accessToken,
      },
      timeout: 15000,
    });
  } catch (axiosErr) {
    // Axios throws on non-2xx — extract TikTok's error body if present
    const tiktokBody = axiosErr.response?.data;
    const httpStatus = axiosErr.response?.status;
    const msg = tiktokBody
      ? `TikTok HTTP ${httpStatus} (code ${tiktokBody.code}): ${tiktokBody.message || JSON.stringify(tiktokBody)}`
      : `TikTok HTTP ${httpStatus}: ${axiosErr.message}`;
    const err = new Error(msg);
    err.tiktokCode = tiktokBody?.code;
    err.tiktokData = tiktokBody;
    err.httpStatus = httpStatus;
    throw err;
  }

  if (response.data.code !== 0) {
    const err = new Error(`TikTok API error (${response.data.code}): ${response.data.message}`);
    err.tiktokCode = response.data.code;
    err.tiktokData = response.data;
    throw err;
  }

  return response.data.data;
}

// Exchange auth code for tokens
// TikTok v2: GET with query params, no signing, no access_token
async function exchangeCode(code) {
  const response = await axios.get(
    `${AUTH_BASE_URL}/api/v2/token/get`,
    {
      params: {
        app_key: APP_KEY,
        app_secret: APP_SECRET,
        auth_code: code,
        grant_type: 'authorized_code',
      },
      timeout: 15000,
    }
  );

  if (response.data.code !== 0) {
    throw new Error(`TikTok token exchange failed (${response.data.code}): ${response.data.message}`);
  }
  return response.data.data;
}

// Refresh access token
async function refreshToken(refreshTok) {
  const response = await axios.get(
    `${AUTH_BASE_URL}/api/v2/token/refresh`,
    {
      params: {
        app_key: APP_KEY,
        app_secret: APP_SECRET,
        refresh_token: refreshTok,
        grant_type: 'refresh_token',
      },
      timeout: 15000,
    }
  );

  if (response.data.code !== 0) {
    throw new Error(`TikTok token refresh failed (${response.data.code}): ${response.data.message}`);
  }
  return response.data.data;
}

// Get list of authorized shops — returns shops[].{ id, cipher, name, region, code, seller_type }
async function getAuthorizedShops(accessToken) {
  return request('GET', '/authorization/202309/shops', accessToken);
}

// Search products (POST, shop-scoped via shop_cipher) — uses 202502 version
// page_size and page_token go in query params, not body, for 202502
async function searchProducts(accessToken, shopCipher, pageToken = null) {
  const queryParams = { page_size: 20 };
  if (pageToken) queryParams.page_token = pageToken;
  return request('POST', '/product/202502/products/search', accessToken, shopCipher, queryParams, null);
}

// Get product detail including SKUs and warehouse IDs — 202502 only covers search POST; detail GET uses 202309
async function getProduct(accessToken, shopCipher, productId) {
  return request('GET', `/product/202309/products/${productId}`, accessToken, shopCipher);
}

// Search inventory for a list of SKU IDs
async function getInventory(accessToken, shopCipher, skuIds) {
  return request('POST', '/fulfillment/202309/inventory/search', accessToken, shopCipher, {}, { sku_id_list: skuIds });
}

// Update inventory quantity via Partial Edit Product — POST /product/202509/products/{product_id}/partial_edit
async function updateInventory(accessToken, shopCipher, productId, skuId, warehouseId, quantity) {
  const inventoryEntry = warehouseId
    ? { warehouse_id: warehouseId, quantity }
    : { quantity };
  return request('POST', `/product/202509/products/${productId}/partial_edit`, accessToken, shopCipher, {}, {
    skus: [{ id: skuId, inventory: [inventoryEntry] }],
  });
}

// Search orders by status
async function getOrders(accessToken, shopCipher, orderStatus, createTimeGte = null) {
  const body = { order_status: orderStatus, page_size: 50 };
  if (createTimeGte) body.create_time_gte = Math.floor(createTimeGte / 1000);
  return request('POST', '/order/202309/orders/search', accessToken, shopCipher, {}, body);
}

// Get order detail
async function getOrder(accessToken, shopCipher, orderId) {
  return request('GET', `/order/202309/orders/${orderId}`, accessToken, shopCipher);
}

module.exports = {
  request,
  exchangeCode,
  refreshToken,
  getAuthorizedShops,
  searchProducts,
  getProduct,
  getInventory,
  updateInventory,
  getOrders,
  getOrder,
  buildSign,
};

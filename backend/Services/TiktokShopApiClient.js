const crypto = require('crypto');
const axios = require('axios');

const BASE_URL = 'https://open-api.tiktokglobalshop.com';
const APP_KEY = process.env.TIKTOK_APP_KEY;
const APP_SECRET = process.env.TIKTOK_APP_SECRET;

function buildSign(params, body, secret) {
  // TikTok HMAC-SHA256 signing: sorted param keys + body
  const sortedKeys = Object.keys(params).sort();
  let input = '';
  for (const key of sortedKeys) {
    input += key + params[key];
  }
  if (body && typeof body === 'string' && body !== '{}' && body !== '') {
    input = input + body;
  }
  input = secret + input + secret;
  return crypto.createHmac('sha256', secret).update(input).digest('hex');
}

async function request(method, path, accessToken, queryParams = {}, body = null) {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const params = {
    app_key: APP_KEY,
    timestamp,
    access_token: accessToken,
    ...queryParams,
  };

  const bodyStr = body ? JSON.stringify(body) : '';
  params.sign = buildSign(params, bodyStr, APP_SECRET);

  const url = `${BASE_URL}${path}`;

  const response = await axios({
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

  if (response.data.code !== 0) {
    const err = new Error(`TikTok API error: ${response.data.message}`);
    err.tiktokCode = response.data.code;
    err.tiktokData = response.data;
    throw err;
  }

  return response.data.data;
}

const AUTH_BASE_URL = 'https://auth.tiktok-shops.com';

// Exchange auth code for tokens (uses auth.tiktok-shops.com, no HMAC signing)
async function exchangeCode(code) {
  const response = await axios.post(
    `${AUTH_BASE_URL}/api/v2/token/get`,
    {
      app_key: APP_KEY,
      app_secret: APP_SECRET,
      auth_code: code,
      grant_type: 'authorized_code',
    },
    { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
  );

  if (response.data.code !== 0) {
    throw new Error(`TikTok token exchange failed (${response.data.code}): ${response.data.message}`);
  }
  return response.data.data;
}

// Refresh access token
async function refreshToken(refreshTok) {
  const response = await axios.post(
    `${AUTH_BASE_URL}/api/v2/token/refresh`,
    {
      app_key: APP_KEY,
      app_secret: APP_SECRET,
      refresh_token: refreshTok,
      grant_type: 'refresh_token',
    },
    { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
  );

  if (response.data.code !== 0) {
    throw new Error(`TikTok token refresh failed (${response.data.code}): ${response.data.message}`);
  }
  return response.data.data;
}

// Get authorized shops for this token
async function getAuthorizedShops(accessToken) {
  return request('GET', '/api/v2/seller/global_shop', accessToken);
}

// Search products
async function searchProducts(accessToken, shopId, pageToken = null) {
  const query = { shop_id: shopId, page_size: 20 };
  if (pageToken) query.page_token = pageToken;
  return request('GET', '/api/products/search', accessToken, query);
}

// Get product detail (includes SKUs + warehouse IDs)
async function getProduct(accessToken, shopId, productId) {
  return request('GET', `/api/products/${productId}`, accessToken, { shop_id: shopId });
}

// Get inventory for a list of SKU IDs
async function getInventory(accessToken, shopId, skuIds) {
  return request('POST', '/api/fulfillment/inventory/search', accessToken,
    { shop_id: shopId },
    { sku_id_list: skuIds }
  );
}

// Update inventory (absolute quantity)
async function updateInventory(accessToken, shopId, skuId, warehouseId, quantity) {
  return request('POST', '/api/fulfillment/inventory/update', accessToken,
    { shop_id: shopId },
    {
      product_id: null,
      skus: [{
        id: skuId,
        inventory: [{ warehouse_id: warehouseId, quantity }],
      }],
    }
  );
}

// Get orders by status
async function getOrders(accessToken, shopId, orderStatus, createTimeGte = null) {
  const query = { shop_id: shopId, order_status: orderStatus, page_size: 50 };
  if (createTimeGte) query.create_time_gte = Math.floor(createTimeGte / 1000);
  return request('GET', '/api/orders/search', accessToken, query);
}

// Get order detail
async function getOrder(accessToken, shopId, orderId) {
  return request('GET', `/api/orders/${orderId}`, accessToken, { shop_id: shopId });
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

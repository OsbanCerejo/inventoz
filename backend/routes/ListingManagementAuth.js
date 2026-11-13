const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { LmTiktokCredential } = require('../models');
const tiktokApi = require('../Services/TiktokShopApiClient');

const APP_KEY = process.env.TIKTOK_APP_KEY;
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI ||
  'https://inventoz-frontend.lprpnx.easypanel.host/listing-management/auth/tiktok/callback';

// GET /listing-management/auth/tiktok
// Returns the TikTok OAuth authorization URL for the frontend to redirect to
router.get('/tiktok', auth, (req, res) => {
  const state = Buffer.from(JSON.stringify({ userId: req.user.id, ts: Date.now() })).toString('base64');
  const url = `https://services.tiktokshop.com/open/authorize?app_key=${APP_KEY}&state=${state}`;
  res.json({ url, state });
});

// GET /listing-management/auth/tiktok/callback
// Called by TikTok after the seller authorizes. Exchanges code for tokens.
router.get('/tiktok/callback', auth, async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'Missing auth code from TikTok' });
    }

    const tokenData = await tiktokApi.exchangeCode(code);
    console.log('TikTok token data keys:', Object.keys(tokenData || {}));

    // Handle expiry: values are in seconds
    const accessExpireIn = tokenData.access_token_expire_in || tokenData.expires_in || 86400;
    const refreshExpireIn = tokenData.refresh_token_expire_in || 2592000;
    const accessExpiry = new Date(Date.now() + (accessExpireIn > 1e9 ? accessExpireIn : accessExpireIn * 1000));
    const refreshExpiry = new Date(Date.now() + (refreshExpireIn > 1e9 ? refreshExpireIn : refreshExpireIn * 1000));

    // Fetch authorized shops to get the shop cipher (required for all API calls)
    let shopId = 'unknown';
    let shopName = 'unknown';
    let shopCipher = null;

    try {
      const shopsData = await tiktokApi.getAuthorizedShops(tokenData.access_token);
      console.log('TikTok authorized shops:', JSON.stringify(shopsData));
      const shops = shopsData?.shops || shopsData?.list || [];
      if (shops.length > 0) {
        shopId = shops[0].id || shops[0].shop_id || 'unknown';
        shopName = shops[0].name || shops[0].shop_name || shopId;
        shopCipher = shops[0].cipher || shops[0].shop_cipher || null;
      }
    } catch (shopErr) {
      console.error('Failed to fetch authorized shops (cipher unavailable):', shopErr.message);
      // Fall back to token data fields
      const firstShop = Array.isArray(tokenData.shops) && tokenData.shops.length > 0 ? tokenData.shops[0] : null;
      shopId = firstShop?.shop_id || tokenData.open_id || tokenData.seller_id || 'unknown';
      shopName = firstShop?.shop_name || tokenData.seller_name || shopId;
    }

    await LmTiktokCredential.upsert({
      shopId,
      shopName,
      shopCipher,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      accessTokenExpiry: accessExpiry,
      refreshTokenExpiry: refreshExpiry,
      isActive: true,
      lastHealthCheck: new Date(),
    });

    res.json({ success: true, shopId, shopName, shopCipher: !!shopCipher });
  } catch (err) {
    console.error('TikTok OAuth callback error:', err.message);
    if (err.response?.data) console.error('TikTok response:', JSON.stringify(err.response.data));
    res.status(500).json({ error: err.message });
  }
});

// POST /listing-management/auth/tiktok/refresh-cipher
// Re-fetches shop cipher for all active credentials that are missing it
router.post('/tiktok/refresh-cipher', auth, async (req, res) => {
  try {
    const creds = await LmTiktokCredential.findAll({ where: { isActive: true } });
    const results = [];

    for (const cred of creds) {
      try {
        const shopsData = await tiktokApi.getAuthorizedShops(cred.accessToken);
        const shops = shopsData?.shops || shopsData?.list || [];
        if (shops.length > 0) {
          const cipher = shops[0].cipher || shops[0].shop_cipher || null;
          const id = shops[0].id || shops[0].shop_id || cred.shopId;
          const name = shops[0].name || shops[0].shop_name || cred.shopName;
          await cred.update({ shopCipher: cipher, shopId: id, shopName: name, lastHealthCheck: new Date() });
          results.push({ shopId: cred.shopId, cipher: !!cipher, name });
        }
      } catch (err) {
        console.error(`refresh-cipher failed for shop ${cred.shopId}:`, err.message);
        results.push({ shopId: cred.shopId, error: err.message });
      }
    }

    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /listing-management/auth/status
// Returns connected shops
router.get('/status', auth, async (req, res) => {
  try {
    const creds = await LmTiktokCredential.findAll({
      attributes: ['id', 'shopId', 'shopName', 'isActive', 'accessTokenExpiry', 'refreshTokenExpiry', 'lastHealthCheck'],
      order: [['createdAt', 'DESC']],
    });
    res.json(creds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /listing-management/auth/tiktok/:shopId
// Disconnect a shop
router.delete('/tiktok/:shopId', auth, async (req, res) => {
  try {
    await LmTiktokCredential.update({ isActive: false }, { where: { shopId: req.params.shopId } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

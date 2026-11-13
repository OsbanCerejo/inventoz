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
    // tokenData response varies: may have shops[] array or top-level open_id
    console.log('TikTok token data keys:', Object.keys(tokenData || {}));

    // Handle expiry: TikTok returns seconds; some versions return milliseconds
    const accessExpireIn = tokenData.access_token_expire_in || tokenData.expires_in || 86400;
    const refreshExpireIn = tokenData.refresh_token_expire_in || 2592000;
    // If value looks like milliseconds (> 1e9), treat as ms; otherwise seconds
    const accessExpiry = new Date(Date.now() + (accessExpireIn > 1e9 ? accessExpireIn : accessExpireIn * 1000));
    const refreshExpiry = new Date(Date.now() + (refreshExpireIn > 1e9 ? refreshExpireIn : refreshExpireIn * 1000));

    // TikTok v2 response: shops[] array holds shop_id and shop_name; fall back to open_id
    const firstShop = Array.isArray(tokenData.shops) && tokenData.shops.length > 0 ? tokenData.shops[0] : null;
    const shopId = firstShop?.shop_id || tokenData.open_id || tokenData.seller_id || 'unknown';
    const shopName = firstShop?.shop_name || tokenData.seller_name || shopId;

    await LmTiktokCredential.upsert({
      shopId,
      shopName,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      accessTokenExpiry: accessExpiry,
      refreshTokenExpiry: refreshExpiry,
      isActive: true,
      lastHealthCheck: new Date(),
    });

    res.json({ success: true, shopId, shopName });
  } catch (err) {
    console.error('TikTok OAuth callback error:', err.message);
    if (err.response?.data) console.error('TikTok response:', JSON.stringify(err.response.data));
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

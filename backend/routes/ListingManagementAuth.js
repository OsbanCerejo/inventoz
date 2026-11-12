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

    const tokenData = await tiktokApi.exchangeCode(code, REDIRECT_URI);
    // tokenData: { access_token, refresh_token, access_token_expire_in, refresh_token_expire_in, open_id, seller_name, seller_base_region, ... }

    const accessExpiry = new Date(Date.now() + (tokenData.access_token_expire_in || 86400) * 1000);
    const refreshExpiry = new Date(Date.now() + (tokenData.refresh_token_expire_in || 2592000) * 1000);

    // TikTok uses open_id as shop identifier in v2
    const shopId = tokenData.open_id || tokenData.seller_id || 'unknown';
    const shopName = tokenData.seller_name || shopId;

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
    console.error('TikTok OAuth callback error:', err);
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

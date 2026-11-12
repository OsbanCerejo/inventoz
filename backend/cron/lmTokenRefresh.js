const { LmTiktokCredential } = require('../models');
const tiktokApi = require('../Services/TiktokShopApiClient');
const { Op } = require('sequelize');

async function refreshExpiringTokens() {
  try {
    // Find tokens expiring within 2 hours
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const creds = await LmTiktokCredential.findAll({
      where: {
        isActive: true,
        accessTokenExpiry: { [Op.lte]: soon },
      },
    });

    if (creds.length === 0) return;

    console.log(`[lmTokenRefresh] Refreshing ${creds.length} token(s)`);

    for (const cred of creds) {
      try {
        const refreshed = await tiktokApi.refreshToken(cred.refreshToken);
        const accessExpiry = new Date(Date.now() + (refreshed.access_token_expire_in || 86400) * 1000);
        const refreshExpiry = new Date(Date.now() + (refreshed.refresh_token_expire_in || 2592000) * 1000);
        await cred.update({
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token,
          accessTokenExpiry: accessExpiry,
          refreshTokenExpiry: refreshExpiry,
          lastHealthCheck: new Date(),
        });
        console.log(`[lmTokenRefresh] Refreshed token for shop ${cred.shopId}`);
      } catch (err) {
        console.error(`[lmTokenRefresh] Failed to refresh token for shop ${cred.shopId}:`, err.message);
        await cred.update({ lastHealthCheck: new Date() });
      }
    }
  } catch (err) {
    console.error('[lmTokenRefresh] Error:', err.message);
  }
}

module.exports = { refreshExpiringTokens };

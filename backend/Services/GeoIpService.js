const axios = require("axios");
const { isPrivateIp } = require("../utils/requestContext");

const LOOKUP_TIMEOUT_MS = Number(process.env.GEOIP_TIMEOUT_MS || 2500);
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

const toNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getCached = (ip) => {
  const row = cache.get(ip);
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    cache.delete(ip);
    return null;
  }
  return row.value;
};

const setCached = (ip, value) => {
  cache.set(ip, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

const lookupWithIpApiCo = async (ip) => {
  const response = await axios.get(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
    timeout: LOOKUP_TIMEOUT_MS,
  });
  const data = response.data || {};
  return {
    country: data.country_name || data.country || null,
    region: data.region || null,
    city: data.city || null,
    lat: toNumberOrNull(data.latitude),
    lng: toNumberOrNull(data.longitude),
    source: "ipapi.co",
  };
};

const fallbackUnknown = () => ({
  country: null,
  region: null,
  city: null,
  lat: null,
  lng: null,
  source: "unknown",
});

class GeoIpService {
  static async lookup(ipAddress) {
    const ip = String(ipAddress || "").trim();
    if (!ip || isPrivateIp(ip)) {
      return {
        country: "Local Network",
        region: null,
        city: "Private IP",
        lat: null,
        lng: null,
        source: "private_ip",
      };
    }

    const cached = getCached(ip);
    if (cached) return cached;

    try {
      const geo = await lookupWithIpApiCo(ip);
      setCached(ip, geo);
      return geo;
    } catch (error) {
      const fallback = fallbackUnknown();
      setCached(ip, fallback);
      return fallback;
    }
  }
}

module.exports = GeoIpService;


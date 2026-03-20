const jwt = require("jsonwebtoken");

const isProduction = process.env.NODE_ENV === "production";

const requireEnvInProduction = (key, fallback = "") => {
  const value = process.env[key];
  if (value) return value;
  if (isProduction) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return fallback;
};

const ACCESS_SECRET = () => requireEnvInProduction("JWT_SECRET", "your-secret-key");
const REFRESH_SECRET = () => requireEnvInProduction("JWT_REFRESH_SECRET", "your-refresh-secret-key");
const ACCESS_EXPIRES_IN = () => process.env.JWT_EXPIRES_IN || "30m";
const REFRESH_EXPIRES_IN = () => process.env.JWT_REFRESH_EXPIRES_IN || "14d";

const parseCookies = (cookieHeader = "") => {
  return String(cookieHeader || "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((acc, entry) => {
      const idx = entry.indexOf("=");
      if (idx === -1) return acc;
      const key = decodeURIComponent(entry.slice(0, idx).trim());
      const value = decodeURIComponent(entry.slice(idx + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
};

const createAccessToken = (user) =>
  jwt.sign(
    { id: user.id, tokenVersion: Number(user.tokenVersion || 0), type: "access" },
    ACCESS_SECRET(),
    { expiresIn: ACCESS_EXPIRES_IN() }
  );

const createRefreshToken = (user) =>
  jwt.sign(
    { id: user.id, tokenVersion: Number(user.tokenVersion || 0), type: "refresh" },
    REFRESH_SECRET(),
    { expiresIn: REFRESH_EXPIRES_IN() }
  );

const verifyAccessToken = (token) => jwt.verify(token, ACCESS_SECRET());
const verifyRefreshToken = (token) => jwt.verify(token, REFRESH_SECRET());

const decodeExpiryToMs = (expiresInRaw, fallbackMs) => {
  if (!expiresInRaw) return fallbackMs;
  const value = String(expiresInRaw).trim();
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) return numeric * 1000;
  const match = value.match(/^(\d+)\s*([smhd])$/i);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === "s") return amount * 1000;
  if (unit === "m") return amount * 60 * 1000;
  if (unit === "h") return amount * 60 * 60 * 1000;
  if (unit === "d") return amount * 24 * 60 * 60 * 1000;
  return fallbackMs;
};

const refreshCookieName = "refreshToken";
const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/auth",
  maxAge: decodeExpiryToMs(REFRESH_EXPIRES_IN(), 14 * 24 * 60 * 60 * 1000),
});

module.exports = {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  parseCookies,
  refreshCookieName,
  refreshCookieOptions,
  ACCESS_EXPIRES_IN,
  REFRESH_EXPIRES_IN,
};

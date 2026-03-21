const normalizeIp = (rawIp = "") => {
  const value = String(rawIp || "").trim();
  if (!value) return "";
  if (value.startsWith("::ffff:")) return value.replace("::ffff:", "");
  return value;
};

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = String(forwarded).split(",")[0].trim();
    const normalized = normalizeIp(first);
    if (normalized) return normalized;
  }

  return (
    normalizeIp(req.ip) ||
    normalizeIp(req.socket?.remoteAddress) ||
    normalizeIp(req.connection?.remoteAddress) ||
    ""
  );
};

const isPrivateIp = (ip = "") => {
  if (!ip) return true;
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
};

const getDeviceNameFromUserAgent = (userAgentRaw = "") => {
  const userAgent = String(userAgentRaw || "");
  if (!userAgent) return "Unknown device";

  let os = "Unknown OS";
  if (/Windows NT/i.test(userAgent)) os = "Windows";
  else if (/Mac OS X/i.test(userAgent)) os = "macOS";
  else if (/Android/i.test(userAgent)) os = "Android";
  else if (/(iPhone|iPad|iOS)/i.test(userAgent)) os = "iOS";
  else if (/Linux/i.test(userAgent)) os = "Linux";

  let browser = "Unknown Browser";
  if (/Edg\//i.test(userAgent)) browser = "Edge";
  else if (/OPR\//i.test(userAgent)) browser = "Opera";
  else if (/Chrome\//i.test(userAgent)) browser = "Chrome";
  else if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) browser = "Safari";
  else if (/Firefox\//i.test(userAgent)) browser = "Firefox";

  return `${os} / ${browser}`;
};

module.exports = {
  getClientIp,
  isPrivateIp,
  getDeviceNameFromUserAgent,
};


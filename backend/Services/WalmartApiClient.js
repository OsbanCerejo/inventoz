const axios = require("axios");
const crypto = require("crypto");
const WalmartAuthService = require("./WalmartAuthService");

const createCorrelationId = () => crypto.randomUUID();

const createHeaders = async ({ accessToken, correlationId } = {}) => {
  const token = accessToken || (await WalmartAuthService.getAccessToken());
  const { serviceName } = WalmartAuthService.getCredentials();
  const channelType = String(process.env.WALMART_CONSUMER_CHANNEL_TYPE || "").trim();
  const headers = {
    Accept: "application/json",
    "WM_SEC.ACCESS_TOKEN": token,
    "WM_QOS.CORRELATION_ID": correlationId || createCorrelationId(),
    "WM_SVC.NAME": serviceName || "Walmart Marketplace",
  };
  if (channelType) {
    headers["WM_CONSUMER.CHANNEL.TYPE"] = channelType;
  }
  return headers;
};

const buildUrl = (requestPath) => {
  const { baseUrl } = WalmartAuthService.getCredentials();
  if (/^https?:\/\//i.test(requestPath)) return requestPath;
  return `${baseUrl}${requestPath.startsWith("/") ? requestPath : `/${requestPath}`}`;
};

const request = async ({ method = "GET", path, headers = {}, params, data, timeout } = {}) => {
  const url = buildUrl(path);
  let requestHeaders = { ...(await createHeaders()), ...headers };

  try {
    return await axios({
      method,
      url,
      headers: requestHeaders,
      params,
      data,
      timeout: timeout || WalmartAuthService.REQUEST_TIMEOUT_MS,
    });
  } catch (error) {
    if (error?.response?.status !== 401) {
      throw error;
    }

    WalmartAuthService.resetCachedToken();
    requestHeaders = {
      ...(await createHeaders({
        accessToken: await WalmartAuthService.getAccessToken({ forceRefresh: true }),
      })),
      ...headers,
    };
    return axios({
      method,
      url,
      headers: requestHeaders,
      params,
      data,
      timeout: timeout || WalmartAuthService.REQUEST_TIMEOUT_MS,
    });
  }
};

module.exports = {
  request,
  createCorrelationId,
};

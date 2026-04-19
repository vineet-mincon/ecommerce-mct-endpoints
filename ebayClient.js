const axios = require("axios");
const { XMLBuilder, XMLParser } = require("fast-xml-parser");

let tokenCache = null;

async function getAccessToken() {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;
  const refreshToken = process.env.EBAY_REFRESH_TOKEN;

  if (!appId || !certId || !refreshToken) {
    throw new Error("Missing EBAY_APP_ID, EBAY_CERT_ID, or EBAY_REFRESH_TOKEN");
  }

  const scope = process.env.EBAY_SCOPES ?? "https://api.ebay.com/oauth/api_scope";
  const basic = Buffer.from(`${appId}:${certId}`).toString("base64");

  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("refresh_token", refreshToken);
  params.set("scope", scope);

  const resp = await axios.post(
    "https://api.ebay.com/identity/v1/oauth2/token",
    params.toString(),
    {
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const token = resp.data.access_token;
  const expiresIn = resp.data.expires_in ?? 7200;
  tokenCache = { token, expiresAt: Date.now() + (expiresIn - 60) * 1000 };
  return token;
}

async function callEbayApi(method, path, body) {
  const token = await getAccessToken();
  const resp = await axios.request({
    method,
    url: `https://api.ebay.com${path}`,
    data: body,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    validateStatus: () => true,
  });
  return { status: resp.status, data: resp.data };
}

async function callEbayTradingApi(callName, params = {}) {
  const token = await getAccessToken();
  const rootName = `${callName}Request`;
  const requestObj = {
    [rootName]: {
      "@_xmlns": "urn:ebay:apis:eBLBaseComponents",
      RequesterCredentials: { eBayAuthToken: token },
      ...params,
    },
  };

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: false,
    suppressEmptyNode: false,
  });
  const xmlBody = '<?xml version="1.0" encoding="utf-8"?>\n' + builder.build(requestObj);

  const resp = await axios.post("https://api.ebay.com/ws/api.dll", xmlBody, {
    headers: {
      "X-EBAY-API-SITEID": "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
      "X-EBAY-API-CALL-NAME": callName,
      "X-EBAY-API-IAF-TOKEN": token,
      "Content-Type": "text/xml",
    },
    responseType: "text",
    transformResponse: (x) => x,
    validateStatus: () => true,
  });

  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: true,
    trimValues: true,
  });
  const parsed = parser.parse(resp.data);
  const unwrapped =
    parsed && typeof parsed === "object" && `${callName}Response` in parsed
      ? parsed[`${callName}Response`]
      : parsed;

  return { status: resp.status, data: unwrapped };
}

module.exports = { callEbayApi, callEbayTradingApi };

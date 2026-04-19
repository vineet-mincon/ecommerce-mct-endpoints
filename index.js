require("dotenv").config();

const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const { callEbayApi, callEbayTradingApi } = require("./ebayClient");

const app = express();
app.use(express.json());

// ─── Swagger setup ────────────────────────────────────────────────────────────

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "ecommerce-mct-endpoints",
      version: "1.0.0",
      description: "eBay REST & Trading API proxy with Swagger docs",
    },
    servers: [{ url: process.env.BASE_URL || "https://delightful-fulfillment-production-dc1d.up.railway.app" }],
  },
  apis: ["./index.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Returns 200 OK when the service is running.
 *     tags: [Utility]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "ecommerce-mct-endpoints", timestamp: new Date().toISOString() });
});

/**
 * @openapi
 * /openapi.json:
 *   get:
 *     summary: OpenAPI spec (JSON)
 *     description: Returns the raw OpenAPI 3.0 specification as JSON.
 *     tags: [Utility]
 *     responses:
 *       200:
 *         description: OpenAPI spec
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
app.get("/openapi.json", (req, res) => {
  res.json(swaggerSpec);
});

/**
 * @openapi
 * /docs:
 *   get:
 *     summary: Swagger UI
 *     description: Interactive API documentation powered by Swagger UI.
 *     tags: [Utility]
 *     responses:
 *       200:
 *         description: HTML page
 */
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @openapi
 * /ebay:
 *   post:
 *     summary: eBay REST API proxy
 *     description: >
 *       Proxies any eBay REST API call. The server automatically obtains and
 *       caches an OAuth access token using EBAY_APP_ID, EBAY_CERT_ID, and
 *       EBAY_REFRESH_TOKEN. The token is refreshed transparently when it expires.
 *     tags: [eBay]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [method, path]
 *             properties:
 *               method:
 *                 type: string
 *                 enum: [GET, POST, PUT, DELETE]
 *                 description: HTTP method to use when calling the eBay API.
 *                 example: GET
 *               path:
 *                 type: string
 *                 description: eBay API path starting with "/" (appended to https://api.ebay.com).
 *                 example: /sell/account/v1/privilege
 *               body:
 *                 type: object
 *                 description: Optional JSON request body for POST/PUT requests.
 *                 additionalProperties: true
 *     responses:
 *       200:
 *         description: Response forwarded from eBay
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   description: HTTP status code returned by eBay.
 *                   example: 200
 *                 data:
 *                   type: object
 *                   description: Parsed JSON body returned by eBay.
 *                   additionalProperties: true
 *       400:
 *         description: Missing or invalid request fields
 *       500:
 *         description: Internal error or eBay unreachable
 */
app.post("/ebay", async (req, res) => {
  const { method, path, body } = req.body;

  if (!method || !path) {
    return res.status(400).json({ error: "method and path are required" });
  }
  if (!["GET", "POST", "PUT", "DELETE"].includes(method.toUpperCase())) {
    return res.status(400).json({ error: "method must be GET, POST, PUT, or DELETE" });
  }
  if (!path.startsWith("/")) {
    return res.status(400).json({ error: "path must start with /" });
  }

  try {
    const result = await callEbayApi(method.toUpperCase(), path, body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /ebay-trading:
 *   post:
 *     summary: eBay Trading API proxy (XML/SOAP)
 *     description: >
 *       Proxies any eBay Trading API (XML SOAP) call. The server builds the XML
 *       envelope automatically — the root element becomes {callName}Request with
 *       xmlns="urn:ebay:apis:eBLBaseComponents". RequesterCredentials are injected
 *       automatically using the cached OAuth token. The XML response is parsed and
 *       unwrapped from the {callName}Response envelope before being returned as JSON.
 *     tags: [eBay]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [callName]
 *             properties:
 *               callName:
 *                 type: string
 *                 description: Trading API call name (e.g. GetMyeBaySelling, GetOrders, AddFixedPriceItem).
 *                 example: GetMyeBaySelling
 *               params:
 *                 type: object
 *                 description: >
 *                   Request body fields as a nested object matching the Trading API XML schema.
 *                   These are serialized as XML child elements of the root request element.
 *                 additionalProperties: true
 *                 example:
 *                   ActiveList:
 *                     Include: true
 *                     Pagination:
 *                       EntriesPerPage: 200
 *                       PageNumber: 1
 *                   DetailLevel: ReturnAll
 *     responses:
 *       200:
 *         description: Parsed Trading API response (unwrapped from the XML envelope)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   description: HTTP status code returned by eBay.
 *                   example: 200
 *                 data:
 *                   type: object
 *                   description: Parsed XML response body (unwrapped from {callName}Response).
 *                   additionalProperties: true
 *       400:
 *         description: Missing or invalid request fields
 *       500:
 *         description: Internal error or eBay unreachable
 */
app.post("/ebay-trading", async (req, res) => {
  const { callName, params } = req.body;

  if (!callName) {
    return res.status(400).json({ error: "callName is required" });
  }

  try {
    const result = await callEbayTradingApi(callName, params ?? {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /amazon/orders:
 *   post:
 *     summary: Amazon orders (coming soon)
 *     description: Proxy for Amazon orders API. Not yet implemented.
 *     tags: [Amazon]
 *     responses:
 *       501:
 *         description: Not implemented
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: coming soon
 */
app.post("/amazon/orders", (req, res) => {
  res.status(501).json({ message: "coming soon" });
});

/**
 * @openapi
 * /amazon/listings:
 *   post:
 *     summary: Amazon listings (coming soon)
 *     description: Proxy for Amazon listings API. Not yet implemented.
 *     tags: [Amazon]
 *     responses:
 *       501:
 *         description: Not implemented
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: coming soon
 */
app.post("/amazon/listings", (req, res) => {
  res.status(501).json({ message: "coming soon" });
});

/**
 * @openapi
 * /sync/orders-to-zoho:
 *   post:
 *     summary: Sync orders to Zoho (coming soon)
 *     description: Syncs orders from marketplace channels into Zoho Books/Inventory. Not yet implemented.
 *     tags: [Sync]
 *     responses:
 *       501:
 *         description: Not implemented
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: coming soon
 */
app.post("/sync/orders-to-zoho", (req, res) => {
  res.status(501).json({ message: "coming soon" });
});

// ─── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/docs`);
});

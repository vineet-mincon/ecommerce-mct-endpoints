require("dotenv").config();

const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { z } = require("zod");
const { callEbayApi, callEbayTradingApi } = require("./ebayClient");

// ─── MCP Server ───────────────────────────────────────────────────────────────

const mcpServer = new McpServer({
  name: "ecommerce-mct-endpoints",
  version: "1.0.0",
});

mcpServer.registerTool(
  "ebay_api",
  {
    title: "eBay API Proxy",
    description: "Call any eBay REST API endpoint. Uses a cached OAuth token auto-refreshed from EBAY_REFRESH_TOKEN.",
    inputSchema: z.object({
      method: z.enum(["GET", "POST", "PUT", "DELETE"]),
      path: z.string().regex(/^\//, "path must start with /"),
      body: z.record(z.unknown()).optional(),
    }),
  },
  async ({ method, path, body }) => {
    const result = await callEbayApi(method, path, body);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

mcpServer.registerTool(
  "ebay_trading_api",
  {
    title: "eBay Trading API Proxy",
    description: "Call any eBay Trading API (XML SOAP) operation. XML envelope is built automatically.",
    inputSchema: z.object({
      callName: z.string().min(1),
      params: z.record(z.unknown()).optional(),
    }),
  },
  async ({ callName, params }) => {
    const result = await callEbayTradingApi(callName, params ?? {});
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

mcpServer.registerTool(
  "amazon_orders",
  {
    title: "Amazon Orders (coming soon)",
    description: "Proxy for Amazon orders API. Not yet implemented.",
    inputSchema: z.object({}),
  },
  async () => {
    return { content: [{ type: "text", text: "coming soon" }] };
  }
);

mcpServer.registerTool(
  "amazon_listings",
  {
    title: "Amazon Listings (coming soon)",
    description: "Proxy for Amazon listings API. Not yet implemented.",
    inputSchema: z.object({}),
  },
  async () => {
    return { content: [{ type: "text", text: "coming soon" }] };
  }
);

// ─── Tool Manifest ────────────────────────────────────────────────────────────

const TOOLS = {
  ebay: ["ebay_api", "ebay_trading_api"],
  amazon: ["amazon_orders", "amazon_listings"],
};

const TOOLS_COUNT = Object.values(TOOLS).reduce((n, arr) => n + arr.length, 0);

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// ─── Swagger setup ────────────────────────────────────────────────────────────

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "ecommerce-mct-endpoints",
      version: "1.0.0",
      description: "eBay REST & Trading API proxy with MCP protocol support and Swagger docs",
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
 *     description: Returns service status including registered MCP tool count.
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
 *                 service:
 *                   type: string
 *                   example: ecommerce-mct-endpoints
 *                 tools_count:
 *                   type: integer
 *                   example: 4
 *                 tools:
 *                   type: object
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "ecommerce-mct-endpoints",
    tools_count: TOOLS_COUNT,
    tools: TOOLS,
    timestamp: new Date().toISOString(),
  });
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
 * /mcp:
 *   get:
 *     summary: MCP status
 *     description: Confirms the MCP Streamable HTTP transport is running.
 *     tags: [MCP]
 *     responses:
 *       200:
 *         description: MCP is up
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: ecommerce-mct-endpoints MCP is up. Use POST /mcp (Streamable HTTP).
 *   post:
 *     summary: MCP Streamable HTTP transport
 *     description: >
 *       MCP protocol endpoint (Streamable HTTP transport). Send JSON-RPC 2.0
 *       messages to invoke registered tools: ebay_api, ebay_trading_api,
 *       amazon_orders, amazon_listings.
 *     tags: [MCP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: JSON-RPC 2.0 message
 *             properties:
 *               jsonrpc:
 *                 type: string
 *                 example: "2.0"
 *               method:
 *                 type: string
 *                 example: tools/call
 *               params:
 *                 type: object
 *               id:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: JSON-RPC 2.0 response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
app.get("/mcp", (req, res) => {
  res.status(200).send("ecommerce-mct-endpoints MCP is up. Use POST /mcp (Streamable HTTP).");
});

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => transport.close());
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

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
 *                   example: 200
 *                 data:
 *                   type: object
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
 *                 description: Request body fields as a nested object matching the Trading API XML schema.
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
 *                   example: 200
 *                 data:
 *                   type: object
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

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`ecommerce-mct-endpoints running on port ${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/docs`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});

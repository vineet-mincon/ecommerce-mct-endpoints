export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "ecommerce-mct-endpoints",
    version: "1.0.0",
    description: "eBay REST & Trading API proxy with MCP protocol support",
  },
  servers: [
    {
      url: process.env.BASE_URL ?? "https://delightful-fulfillment-production-dc1d.up.railway.app",
    },
  ],
  tags: [
    { name: "Utility", description: "Health, docs, and spec endpoints" },
    { name: "MCP", description: "MCP Streamable HTTP transport" },
    { name: "eBay", description: "eBay REST and Trading API proxies" },
    { name: "Amazon", description: "Amazon API proxies (coming soon)" },
    { name: "Sync", description: "Cross-platform sync operations (coming soon)" },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        description: "Returns service status including registered MCP tool count.",
        tags: ["Utility"],
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    server: { type: "string", example: "ecommerce-mct-endpoints" },
                    version: { type: "string", example: "1.0.0" },
                    tools_count: { type: "integer", example: 4 },
                    tools: { type: "object" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/openapi.json": {
      get: {
        summary: "OpenAPI spec (JSON)",
        description: "Returns the raw OpenAPI 3.0 specification as JSON.",
        tags: ["Utility"],
        responses: {
          "200": { description: "OpenAPI spec", content: { "application/json": { schema: { type: "object" } } } },
        },
      },
    },
    "/docs": {
      get: {
        summary: "Swagger UI",
        description: "Interactive API documentation.",
        tags: ["Utility"],
        responses: { "200": { description: "HTML page" } },
      },
    },
    "/mcp": {
      get: {
        summary: "MCP status",
        description: "Confirms the MCP Streamable HTTP transport is running.",
        tags: ["MCP"],
        responses: { "200": { description: "MCP is up", content: { "text/plain": { schema: { type: "string" } } } } },
      },
      post: {
        summary: "MCP Streamable HTTP transport",
        description: "Send JSON-RPC 2.0 messages to invoke registered MCP tools.",
        tags: ["MCP"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  jsonrpc: { type: "string", example: "2.0" },
                  method: { type: "string", example: "tools/call" },
                  params: { type: "object" },
                  id: { type: "integer", example: 1 },
                },
              },
            },
          },
        },
        responses: { "200": { description: "JSON-RPC 2.0 response" } },
      },
    },
    "/ebay": {
      post: {
        summary: "eBay REST API proxy",
        description: "Proxies any eBay REST API call using a cached OAuth token.",
        tags: ["eBay"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["method", "path"],
                properties: {
                  method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"], example: "GET" },
                  path: { type: "string", example: "/sell/account/v1/privilege" },
                  body: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Response forwarded from eBay" },
          "400": { description: "Missing or invalid request fields" },
          "500": { description: "Internal error or eBay unreachable" },
        },
      },
    },
    "/ebay-trading": {
      post: {
        summary: "eBay Trading API proxy (XML/SOAP)",
        description: "Proxies any eBay Trading API call. XML envelope is built automatically.",
        tags: ["eBay"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["callName"],
                properties: {
                  callName: { type: "string", example: "GetMyeBaySelling" },
                  params: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Parsed Trading API response" },
          "400": { description: "Missing or invalid request fields" },
          "500": { description: "Internal error or eBay unreachable" },
        },
      },
    },
    "/amazon/orders": {
      post: {
        summary: "Amazon orders (coming soon)",
        tags: ["Amazon"],
        responses: { "501": { description: "Not implemented" } },
      },
    },
    "/amazon/listings": {
      post: {
        summary: "Amazon listings (coming soon)",
        tags: ["Amazon"],
        responses: { "501": { description: "Not implemented" } },
      },
    },
    "/sync/orders-to-zoho": {
      post: {
        summary: "Sync orders to Zoho (coming soon)",
        tags: ["Sync"],
        responses: { "501": { description: "Not implemented" } },
      },
    },
  },
};

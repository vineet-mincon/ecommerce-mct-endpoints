import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callEbayApi, callEbayTradingApi } from "../services/ebayClient.js";

export function registerEbayTools(server: McpServer): void {
  server.registerTool(
    "ebay_api",
    {
      title: "eBay API Proxy",
      description: `Call any eBay REST API endpoint via the proxy. Uses a cached OAuth access token that is auto-refreshed from EBAY_REFRESH_TOKEN.

Args:
  - method (string): HTTP method — GET, POST, PUT, or DELETE
  - path (string): eBay API path starting with "/" (e.g. /sell/account/v1/privilege)
  - body (object, optional): JSON body for POST/PUT requests

Returns: { status, data } — the eBay response status code and parsed body`,
      inputSchema: z.object({
        method: z.enum(["GET", "POST", "PUT", "DELETE"]),
        path: z.string().regex(/^\//, "path must start with /"),
        body: z.record(z.unknown()).optional(),
      }),
    },
    async ({ method, path, body }) => {
      try {
        const result = await callEbayApi(method, path, body);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`ebay_api failed: ${msg}`);
      }
    }
  );

  server.registerTool(
    "ebay_trading_api",
    {
      title: "eBay Trading API Proxy",
      description: `Call any eBay Trading API (XML SOAP) operation via the proxy. The XML request body is built automatically.

Args:
  - callName (string): Trading API call name (e.g. GetMyeBaySelling, GetOrders, AddFixedPriceItem)
  - params (object, optional): Request body fields as a nested object matching the Trading API XML schema

Returns: { status, data } — HTTP status and the parsed XML response (unwrapped from the {callName}Response envelope)`,
      inputSchema: z.object({
        callName: z.string().min(1),
        params: z.record(z.unknown()).optional(),
      }),
    },
    async ({ callName, params }) => {
      try {
        const result = await callEbayTradingApi(callName, params ?? {});
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`ebay_trading_api failed: ${msg}`);
      }
    }
  );

  server.registerTool(
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

  server.registerTool(
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
}

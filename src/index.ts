import { initProxy, ValidationError } from "./init-server.js";
import { z } from "zod";
import path from "node:path";

// Configuration schema for user settings
export const configSchema = z.object({
  notionToken: z.string().optional().describe("Notion integration token (recommended)"),
  openapiMcpHeaders: z.string().optional().describe("JSON string for HTTP headers, must include Authorization and Notion-Version (alternative to notionToken)"),
  baseUrl: z.string().optional().describe("Optional override for Notion API base URL"),
});

export type Config = z.infer<typeof configSchema>;

// Required: Export default createServer function
export default async function createServer({ config }: { config: Config }) {
  // Initialize the proxy with the OpenAPI spec
  const specPath = path.resolve(process.cwd(), "scripts/notion-openapi.json");
  
  // Set up environment variables based on config
  if (config.notionToken) {
    process.env.NOTION_TOKEN = config.notionToken;
  } else if (config.openapiMcpHeaders) {
    process.env.OPENAPI_MCP_HEADERS = config.openapiMcpHeaders;
  }
  
  if (config.baseUrl) {
    process.env.BASE_URL = config.baseUrl;
  }

  try {
    // Initialize the proxy and return it
    // The proxy contains the MCP server that Smithery will use
    const proxy = await initProxy(specPath, config.baseUrl);
    return proxy.getServer();
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Invalid OpenAPI 3.1 specification:');
      error.errors.forEach(err => console.error(err));
    } else {
      console.error('Error:', error);
    }
    throw error;
  }
}

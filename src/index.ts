import { initProxy, ValidationError } from "./init-server.js";
import { z } from "zod";
import path from "node:path";

// Configuration schema for user settings - automatically detected by Smithery
export const configSchema = z.object({
  notionToken: z.string()
    .describe("Notion integration token (recommended)")
    .optional(),
  openapiMcpHeaders: z.string()
    .describe("JSON string for HTTP headers, must include Authorization and Notion-Version (alternative to notionToken)")
    .optional(),
  baseUrl: z.string()
    .url()
    .default("https://api.notion.com")
    .describe("Notion API base URL"),
}).refine(
  (data) => data.notionToken || data.openapiMcpHeaders,
  {
    message: "Either notionToken or openapiMcpHeaders must be provided",
    path: ["notionToken"]
  }
);

export type Config = z.infer<typeof configSchema>;

// Required: Export default createServer function
export default async function createServer({ config }: { config: Config }) {
  // Initialize the proxy with the OpenAPI spec
  const specPath = path.resolve(process.cwd(), "scripts/notion-openapi.json");
  
  // Use config values in your server setup
  console.log(`Notion MCP Server starting with base URL: ${config.baseUrl}`);
  
  // Set up environment variables based on config
  if (config.notionToken) {
    process.env.NOTION_TOKEN = config.notionToken;
    console.log("Using Notion token for authentication");
  } else if (config.openapiMcpHeaders) {
    process.env.OPENAPI_MCP_HEADERS = config.openapiMcpHeaders;
    console.log("Using custom headers for authentication");
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

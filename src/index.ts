import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InitializeRequestSchema, ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MCPProxy } from "./openapi-mcp-server/mcp/proxy.js";
import { readFileSync } from "fs";
import { join } from "path";

// Load OpenAPI spec dynamically
const notionOpenApiSpec = JSON.parse(
  readFileSync(join(process.cwd(), "scripts/notion-openapi.json"), "utf-8")
);

// Configuration schema - automatically detected by Smithery
export const configSchema = z.object({
  notionToken: z.string().describe("Notion integration token"),
  baseUrl: z.string().default("https://api.notion.com").describe("Notion API base URL"),
});

export type Config = z.infer<typeof configSchema>;

// Required: Export default createServer function
export default function createServer({ config }: { config: Config }) {
  try {
    console.log(`Notion MCP Server starting with base URL: ${config.baseUrl}`);
    console.log(`Using Notion token: ${config.notionToken.substring(0, 10)}...`);
    
    // Validate token format
    if (!config.notionToken.startsWith('secret_') && !config.notionToken.startsWith('ntn_')) {
      throw new Error(`Invalid Notion token format. Expected token starting with 'secret_' or 'ntn_', got: ${config.notionToken.substring(0, 10)}...`);
    }
    
    // Set up environment variables based on config
    process.env.NOTION_TOKEN = config.notionToken;
    process.env.BASE_URL = config.baseUrl;
    
    console.log("Environment variables set successfully");

    // Create MCP proxy using OpenAPI specification
    const mcpProxy = new MCPProxy("Notion API", notionOpenApiSpec);
    
    console.log("Notion MCP Server initialized successfully with OpenAPI tools");
    
    return mcpProxy.getServer();
  } catch (err) {
    console.error("Server init failed:", err);
    throw err;
  }
}

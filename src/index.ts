import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InitializeRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

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

    // Create a simple MCP server for Smithery
    const server = new Server({
      name: "Notion API",
      version: "1.9.0",
    }, {
      capabilities: {
        tools: {}
      }
    });

    // Add proper MCP request handlers using schema objects
    server.setRequestHandler(InitializeRequestSchema, async () => {
      console.log("Handling initialize request");
      return {
        protocolVersion: "2025-06-18",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "Notion API",
          version: "1.9.0"
        }
      };
    });

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      console.log("Handling tools/list request");
      return {
        tools: [
          {
            name: "notion-test",
            description: "Test tool for Notion MCP Server",
            inputSchema: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "Test message"
                }
              }
            }
          }
        ]
      };
    });

    console.log("Notion MCP Server initialized successfully");
    
    return server;
  } catch (err) {
    console.error("Server init failed:", err);
    throw err;
  }
}

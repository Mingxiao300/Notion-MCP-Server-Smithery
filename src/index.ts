import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InitializeRequestSchema, ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import axios from "axios";

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
            name: "search_notion",
            description: "Search for pages and databases in your Notion workspace",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query to find pages or databases"
                }
              },
              required: ["query"]
            }
          },
          {
            name: "get_page_content",
            description: "Get the content of a specific Notion page",
            inputSchema: {
              type: "object",
              properties: {
                page_id: {
                  type: "string",
                  description: "The ID of the Notion page to retrieve"
                }
              },
              required: ["page_id"]
            }
          },
          {
            name: "create_page",
            description: "Create a new page in Notion",
            inputSchema: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "Title of the new page"
                },
                parent_id: {
                  type: "string",
                  description: "ID of the parent page or database"
                },
                content: {
                  type: "string",
                  description: "Initial content for the page (optional)"
                }
              },
              required: ["title", "parent_id"]
            }
          },
          {
            name: "update_page",
            description: "Update the content of an existing Notion page",
            inputSchema: {
              type: "object",
              properties: {
                page_id: {
                  type: "string",
                  description: "ID of the page to update"
                },
                title: {
                  type: "string",
                  description: "New title for the page (optional)"
                },
                content: {
                  type: "string",
                  description: "New content to add to the page"
                }
              },
              required: ["page_id"]
            }
          },
          {
            name: "list_databases",
            description: "List all databases accessible to the integration",
            inputSchema: {
              type: "object",
              properties: {},
              required: []
            }
          },
          {
            name: "query_database",
            description: "Query a Notion database with filters",
            inputSchema: {
              type: "object",
              properties: {
                database_id: {
                  type: "string",
                  description: "ID of the database to query"
                },
                filter: {
                  type: "string",
                  description: "JSON string of filter criteria (optional)"
                },
                page_size: {
                  type: "number",
                  description: "Number of results to return (default: 10)"
                }
              },
              required: ["database_id"]
            }
          }
        ]
      };
    });

    // Add tool execution handlers
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      console.log(`Handling tool call: ${request.params.name}`);
      
      const { name, arguments: args } = request.params;
      
      try {
        const notionClient = axios.create({
          baseURL: config.baseUrl,
          headers: {
            'Authorization': `Bearer ${config.notionToken}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          }
        });

        switch (name) {
          case 'search_notion':
            const searchResponse = await notionClient.post('/v1/search', {
              query: args.query,
              page_size: 10
            });
            return {
              content: [
                {
                  type: 'text',
                  text: `Found ${searchResponse.data.results.length} results for "${args.query}":\n\n` +
                    searchResponse.data.results.map((result: any) => 
                      `- ${result.object === 'page' ? '📄' : '🗃️'} ${result.title || 'Untitled'} (${result.id})`
                    ).join('\n')
                }
              ]
            };

          case 'get_page_content':
            const pageResponse = await notionClient.get(`/v1/pages/${args.page_id}`);
            const page = pageResponse.data;
            return {
              content: [
                {
                  type: 'text',
                  text: `**${page.properties?.title?.title?.[0]?.text?.content || 'Untitled'}**\n\n` +
                    `Page ID: ${page.id}\n` +
                    `Created: ${page.created_time}\n` +
                    `Last edited: ${page.last_edited_time}\n\n` +
                    `Properties: ${JSON.stringify(page.properties, null, 2)}`
                }
              ]
            };

          case 'create_page':
            const createResponse = await notionClient.post('/v1/pages', {
              parent: { page_id: args.parent_id },
              properties: {
                title: [
                  {
                    text: {
                      content: args.title
                    }
                  }
                ]
              }
            });
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Successfully created page "${args.title}" with ID: ${createResponse.data.id}`
                }
              ]
            };

          case 'update_page':
            const updateData: any = {};
            if (args.title) {
              updateData.properties = {
                title: [
                  {
                    text: {
                      content: args.title
                    }
                  }
                ]
              };
            }
            
            const updateResponse = await notionClient.patch(`/v1/pages/${args.page_id}`, updateData);
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Successfully updated page ${args.page_id}`
                }
              ]
            };

          case 'list_databases':
            const dbResponse = await notionClient.post('/v1/search', {
              filter: {
                property: 'object',
                value: 'database'
              }
            });
            return {
              content: [
                {
                  type: 'text',
                  text: `Found ${dbResponse.data.results.length} databases:\n\n` +
                    dbResponse.data.results.map((db: any) => 
                      `🗃️ ${db.title?.[0]?.text?.content || 'Untitled Database'} (${db.id})`
                    ).join('\n')
                }
              ]
            };

          case 'query_database':
            const queryResponse = await notionClient.post(`/v1/databases/${args.database_id}/query`, {
              page_size: args.page_size || 10,
              filter: args.filter ? JSON.parse(args.filter) : undefined
            });
            return {
              content: [
                {
                  type: 'text',
                  text: `Found ${queryResponse.data.results.length} results in database:\n\n` +
                    queryResponse.data.results.map((result: any) => 
                      `📄 ${result.properties?.Name?.title?.[0]?.text?.content || 'Untitled'} (${result.id})`
                    ).join('\n')
                }
              ]
            };

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        console.error(`Error executing tool ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error: ${error.response?.data?.message || error.message}`
            }
          ],
          isError: true
        };
      }
    });

    console.log("Notion MCP Server initialized successfully");
    
    return server;
  } catch (err) {
    console.error("Server init failed:", err);
    throw err;
  }
}

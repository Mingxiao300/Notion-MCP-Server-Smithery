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
            // Get page details
            const pageResponse = await notionClient.get(`/v1/pages/${args.page_id}`);
            const page = pageResponse.data;
            
            // Get page content (blocks)
            const blocksResponse = await notionClient.get(`/v1/blocks/${args.page_id}/children`);
            const blocks = blocksResponse.data.results;
            
            // Extract text content from blocks
            const extractTextFromBlocks = async (blocks: any[]): Promise<string> => {
              let content = '';
              for (const block of blocks) {
                if (block.type === 'paragraph' && block.paragraph?.rich_text) {
                  content += block.paragraph.rich_text.map((text: any) => text.plain_text).join('') + '\n';
                } else if (block.type === 'heading_1' && block.heading_1?.rich_text) {
                  content += '# ' + block.heading_1.rich_text.map((text: any) => text.plain_text).join('') + '\n';
                } else if (block.type === 'heading_2' && block.heading_2?.rich_text) {
                  content += '## ' + block.heading_2.rich_text.map((text: any) => text.plain_text).join('') + '\n';
                } else if (block.type === 'heading_3' && block.heading_3?.rich_text) {
                  content += '### ' + block.heading_3.rich_text.map((text: any) => text.plain_text).join('') + '\n';
                } else if (block.type === 'bulleted_list_item' && block.bulleted_list_item?.rich_text) {
                  content += '• ' + block.bulleted_list_item.rich_text.map((text: any) => text.plain_text).join('') + '\n';
                } else if (block.type === 'numbered_list_item' && block.numbered_list_item?.rich_text) {
                  content += '1. ' + block.numbered_list_item.rich_text.map((text: any) => text.plain_text).join('') + '\n';
                } else if (block.type === 'to_do' && block.to_do?.rich_text) {
                  const checked = block.to_do.checked ? '✅' : '☐';
                  content += `${checked} ` + block.to_do.rich_text.map((text: any) => text.plain_text).join('') + '\n';
                } else if (block.type === 'quote' && block.quote?.rich_text) {
                  content += '> ' + block.quote.rich_text.map((text: any) => text.plain_text).join('') + '\n';
                } else if (block.type === 'code' && block.code?.rich_text) {
                  content += '```' + (block.code.language || '') + '\n' + 
                    block.code.rich_text.map((text: any) => text.plain_text).join('') + '\n```\n';
                }
                
                // Handle nested blocks (children)
                if (block.has_children) {
                  try {
                    const childBlocksResponse = await notionClient.get(`/v1/blocks/${block.id}/children`);
                    content += await extractTextFromBlocks(childBlocksResponse.data.results);
                  } catch (error) {
                    console.log(`Could not fetch children for block ${block.id}`);
                  }
                }
              }
              return content;
            };
            
            const pageContent = await extractTextFromBlocks(blocks);
            const pageTitle = page.properties?.title?.title?.[0]?.text?.content || 'Untitled';
            
            // Generate a summary
            const generateSummary = (content: string): string => {
              if (!content.trim()) {
                return "This page appears to be empty or contains only structural elements.";
              }
              
              const lines = content.split('\n').filter(line => line.trim());
              const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
              const lineCount = lines.length;
              
              let summary = `**Content Summary:**\n`;
              summary += `• **Word count:** ${wordCount} words\n`;
              summary += `• **Line count:** ${lineCount} lines\n`;
              
              if (lines.length > 0) {
                summary += `• **First few lines:**\n`;
                lines.slice(0, 3).forEach(line => {
                  summary += `  - ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}\n`;
                });
              }
              
              return summary;
            };
            
            return {
              content: [
                {
                  type: 'text',
                  text: `# ${pageTitle}\n\n` +
                    `**Page Details:**\n` +
                    `• **ID:** ${page.id}\n` +
                    `• **Created:** ${new Date(page.created_time).toLocaleDateString()}\n` +
                    `• **Last edited:** ${new Date(page.last_edited_time).toLocaleDateString()}\n\n` +
                    `---\n\n` +
                    `**Page Content:**\n\n${pageContent || '*No content found*'}\n\n` +
                    `---\n\n` +
                    generateSummary(pageContent)
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

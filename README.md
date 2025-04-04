# Notion MCP Server

![notion-mcp-sm](https://github.com/user-attachments/assets/6c07003c-8455-4636-b298-d60ffdf46cd8)

This project implements an [MCP server](https://spec.modelcontextprotocol.io/) for the [Notion API](https://developers.notion.com/reference/intro). 

### Installation

Add the following to your `.cursor/mcp.json` or `claude_desktop_config.json` (MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`)

Don't forget to modify your bearer token.

```javascript
{
  "mcpServers": {
    "notionApi": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer ntn_****\", \"Notion-Version\": \"2022-06-28\" }"
      }
    }
  }
}
```

### Examples

1. Using the following command
```
Comment "Hello MCP" on page "Getting started"
```

AI will correctly plan two API calls, v1/search and v1/comments, to achieve the task

2. Similarly, the following instruction will result in a new page named "Notion MCP" added to parent page "Development"
```
Add a page titled "Notion MCP" to page "Development"
```

3. You may also reference content ID directly
```
Get the content of page 1a6b35e6e67f802fa7e1d27686f017f2
```

### Development

Build

```
npm run build
```

Execute

```
npx --prefix /path/to/local/notion-mcp-server @notionhq/notion-mcp-server
```

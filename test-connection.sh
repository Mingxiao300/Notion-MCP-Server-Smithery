#!/bin/bash

# Test script for Notion MCP Server connection
# Replace YOUR_NOTION_TOKEN with your actual Notion integration token

NOTION_TOKEN="YOUR_NOTION_TOKEN_HERE"
SERVER_URL="https://server.smithery.ai/@Mingxiao300/notion-mcp-server-smithery/mcp?notionToken=$NOTION_TOKEN"

echo "Testing Notion MCP Server connection..."
echo "Server URL: $SERVER_URL"
echo ""

# Test initialize request
echo "1. Testing initialize request..."
curl -X POST "$SERVER_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    },
    "id": 0
  }' | jq '.'

echo ""
echo "2. Testing tools/list request..."
curl -X POST "$SERVER_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 1
  }' | jq '.'

echo ""
echo "Connection test completed!"

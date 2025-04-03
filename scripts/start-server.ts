import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'url'

import { OpenAPIV3 } from 'openapi-types'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import OpenAPISchemaValidator from 'openapi-schema-validator'

import { MCPProxy } from '../src/openapi-mcp-server/mcp/proxy'

export class ValidationError extends Error {
  constructor(public errors: any[]) {
    super('OpenAPI validation failed')
    this.name = 'ValidationError'
  }
}

export async function loadOpenApiSpec(specPath: string): Promise<OpenAPIV3.Document> {
  let rawSpec: string

  try {
    rawSpec = fs.readFileSync(path.resolve(process.cwd(), specPath), 'utf-8')
  } catch (error) {
    console.error('Failed to read OpenAPI specification file:', (error as Error).message)
    process.exit(1)
  }

  // Parse and validate the spec
  try {
    const parsed = JSON.parse(rawSpec)
    const baseUrl = process.env.BASE_URL

    if (baseUrl) {
      parsed.servers[0].url = baseUrl
    }

    return parsed as OpenAPIV3.Document
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error
    }
    console.error('Failed to parse OpenAPI specification:', (error as Error).message)
    process.exit(1)
  }
}

// Main execution
export async function main(args: string[] = process.argv.slice(2)) {
  const filename = fileURLToPath(import.meta.url)
  const directory = path.dirname(filename)
  const specPath = path.resolve(directory, '../scripts/notion-openapi.json')
  const openApiSpec = await loadOpenApiSpec(specPath)
  const proxy = new MCPProxy('OpenAPI Tools', openApiSpec)

  return proxy.connect(new StdioServerTransport())
}

const shouldStart = process.argv[1].endsWith('notion-mcp-server')
// Only run main if this is the entry point
if (shouldStart) {
  main().catch(error => {
    if (error instanceof ValidationError) {
      console.error('Invalid OpenAPI 3.1 specification:')
      error.errors.forEach(err => console.error(err))
    } else {
      console.error('Error:', error.message)
    }
    process.exit(1)
  })
}

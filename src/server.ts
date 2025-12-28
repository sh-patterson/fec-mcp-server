/**
 * MCP Server Configuration
 * Sets up the FEC MCP server with all tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from './tools/index.js';
import type { Config } from './config.js';

const SERVER_NAME = 'fec-mcp-server';
const SERVER_VERSION = '1.0.0';

/**
 * Create and configure the MCP server
 */
export function createServer(config: Config): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Register all FEC tools
  registerTools(server, config);

  return server;
}

export { SERVER_NAME, SERVER_VERSION };

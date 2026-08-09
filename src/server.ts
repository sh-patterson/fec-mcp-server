/**
 * MCP Server Configuration
 * Sets up the FEC MCP server with all tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createRequire } from 'node:module';
import { registerTools } from './tools/index.js';
import type { Config } from './config.js';

const SERVER_NAME = 'fec-mcp-server';
const require = createRequire(import.meta.url);
const packageJson: unknown = require('../package.json');

if (
  typeof packageJson !== 'object' ||
  packageJson === null ||
  !('version' in packageJson) ||
  typeof packageJson.version !== 'string'
) {
  throw new Error('package.json must contain a string version.');
}

const SERVER_VERSION = packageJson.version;

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

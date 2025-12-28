#!/usr/bin/env node
/**
 * FEC MCP Server Entry Point
 *
 * An MCP server for FEC campaign finance research and transparency.
 * Provides tools to search candidates, retrieve financial reports,
 * and analyze contributions and disbursements from official FEC data.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { loadConfig } from './config.js';

async function main(): Promise<void> {
  // Load configuration
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error('Configuration error:', error instanceof Error ? error.message : error);
    console.error('');
    console.error('Please ensure FEC_API_KEY is set in your environment or .env file.');
    console.error('You can obtain an API key at: https://api.open.fec.gov/developers/');
    process.exit(1);
  }

  // Create and configure server
  const server = createServer(config);

  // Connect via stdio transport
  const transport = new StdioServerTransport();

  // Log to stderr (not stdout, which is reserved for JSON-RPC)
  console.error('FEC MCP Server starting...');
  console.error(`Using API base URL: ${config.fecApiBaseUrl}`);

  try {
    await server.connect(transport);
    console.error('FEC MCP Server connected and running on stdio');
  } catch (error) {
    console.error('Failed to connect:', error);
    process.exit(1);
  }
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

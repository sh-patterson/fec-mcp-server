/**
 * Server creation tests
 */

import { describe, expect, it, vi } from 'vitest';

const registerToolsMock = vi.fn();

vi.mock('../src/tools/index.js', () => ({
  registerTools: registerToolsMock,
}));

describe('createServer', () => {
  it('should create a server and register tools', async () => {
    const { createServer, SERVER_NAME, SERVER_VERSION } = await import(
      '../src/server.js'
    );

    const config = {
      fecApiKey: 'test-key',
      fecApiBaseUrl: 'https://api.open.fec.gov/v1',
    };

    const server = createServer(config);

    expect(server).toBeDefined();
    expect(registerToolsMock).toHaveBeenCalledWith(server, config);
    expect(SERVER_NAME).toBe('fec-mcp-server');
    expect(SERVER_VERSION).toBe('1.0.0');
  });
});

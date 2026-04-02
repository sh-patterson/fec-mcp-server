/**
 * Tool registration tests
 */

import { describe, expect, it } from 'vitest';
import { registerTools } from '../../src/tools/index.js';

interface RegisteredTool {
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (params: unknown) => Promise<{
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
  }>;
}

class FakeServer {
  registeredTools = new Map<string, RegisteredTool>();

  tool(
    name: string,
    description: string,
    inputSchema: Record<string, unknown>,
    handler: RegisteredTool['handler']
  ): void {
    this.registeredTools.set(name, {
      description,
      inputSchema,
      handler,
    });
  }
}

describe('registerTools', () => {
  it('should register all public tools', () => {
    const server = new FakeServer();

    registerTools(server as never, {
      fecApiKey: 'test-key',
      fecApiBaseUrl: 'https://api.open.fec.gov/v1',
    });

    expect(server.registeredTools.size).toBe(8);
    expect(server.registeredTools.has('search_candidates')).toBe(true);
    expect(server.registeredTools.has('get_committee_flags')).toBe(true);
    expect(server.registeredTools.has('search_spending')).toBe(true);
  });

  it('should validate cross-field requirements before execution', async () => {
    const server = new FakeServer();

    registerTools(server as never, {
      fecApiKey: 'test-key',
      fecApiBaseUrl: 'https://api.open.fec.gov/v1',
    });

    const searchSpending = server.registeredTools.get('search_spending');
    const result = await searchSpending!.handler({ recipient_state: 'DC' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid input');
    expect(result.content[0].text).toContain('description or recipient_name');
  });

  it('should reject malformed candidate IDs for independent expenditures', async () => {
    const server = new FakeServer();

    registerTools(server as never, {
      fecApiKey: 'test-key',
      fecApiBaseUrl: 'https://api.open.fec.gov/v1',
    });

    const tool = server.registeredTools.get('get_independent_expenditures');
    const result = await tool!.handler({ candidate_id: 'BAD-ID' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid input');
    expect(result.content[0].text).toContain('H8CA15053');
  });
});

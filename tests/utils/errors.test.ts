import { describe, it, expect } from 'vitest';
import { FECApiError, formatErrorForToolResponse, sanitizeApiKey } from '../../src/utils/errors.js';

describe('error sanitization', () => {
  it('should sanitize api_key query params', () => {
    const input = 'https://api.open.fec.gov/v1/?api_key=abc123&q=test';
    expect(sanitizeApiKey(input)).toContain('api_key=[REDACTED]');
    expect(sanitizeApiKey(input)).not.toContain('abc123');
  });

  it('should sanitize literal API key values from FECApiError messages', () => {
    const previous = process.env.FEC_API_KEY;
    process.env.FEC_API_KEY = 'secret-key-xyz';

    const message = formatErrorForToolResponse(
      new FECApiError('request failed with secret-key-xyz in response')
    );

    expect(message).toContain('[REDACTED]');
    expect(message).not.toContain('secret-key-xyz');
    process.env.FEC_API_KEY = previous;
  });
});

import { describe, it, expect } from 'vitest';
import { loadConfig, resetConfig } from '../src/config.js';

describe('config', () => {
  it('should allow missing FEC_API_KEY and load base URL', () => {
    const previousApiKey = process.env.FEC_API_KEY;
    const previousBaseUrl = process.env.FEC_API_BASE_URL;

    try {
      delete process.env.FEC_API_KEY;
      process.env.FEC_API_BASE_URL = 'https://api.example.com/v1';
      resetConfig();

      const config = loadConfig();
      expect(config.fecApiKey).toBeUndefined();
      expect(config.fecApiBaseUrl).toBe('https://api.example.com/v1');
    } finally {
      if (previousApiKey !== undefined) {
        process.env.FEC_API_KEY = previousApiKey;
      } else {
        delete process.env.FEC_API_KEY;
      }

      if (previousBaseUrl !== undefined) {
        process.env.FEC_API_BASE_URL = previousBaseUrl;
      } else {
        delete process.env.FEC_API_BASE_URL;
      }
    }
  });
});

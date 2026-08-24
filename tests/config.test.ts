import { describe, it, expect } from 'vitest';
import { loadConfig, resetConfig } from '../src/config.js';

describe('config', () => {
  it('should allow missing FEC_API_KEY and use the default OpenFEC base URL', () => {
    const previousApiKey = process.env.FEC_API_KEY;
    const previousBaseUrl = process.env.FEC_API_BASE_URL;

    try {
      delete process.env.FEC_API_KEY;
      delete process.env.FEC_API_BASE_URL;
      resetConfig();

      const config = loadConfig();
      expect(config.fecApiKey).toBeUndefined();
      expect(config.fecApiBaseUrl).toBe('https://api.open.fec.gov/v1');
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
      resetConfig();
    }
  });

  it('should reject non-OpenFEC base URLs from the environment', () => {
    const previousBaseUrl = process.env.FEC_API_BASE_URL;

    try {
      process.env.FEC_API_BASE_URL = 'https://api.example.com/v1';
      resetConfig();
      expect(() => loadConfig()).toThrow(/FEC_API_BASE_URL/);
    } finally {
      if (previousBaseUrl !== undefined) {
        process.env.FEC_API_BASE_URL = previousBaseUrl;
      } else {
        delete process.env.FEC_API_BASE_URL;
      }
      resetConfig();
    }
  });
});

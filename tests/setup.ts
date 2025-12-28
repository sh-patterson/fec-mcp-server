/**
 * Vitest Setup File
 * Runs before all tests
 */

import { beforeEach, afterEach, vi } from 'vitest';

// Reset all mocks between tests
beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Set up environment variables for testing
process.env.FEC_API_KEY = 'test-api-key';
process.env.FEC_API_BASE_URL = 'https://api.open.fec.gov/v1';

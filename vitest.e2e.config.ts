import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    // No setup files for e2e - we load .env directly
    testTimeout: 30000, // Longer timeout for live API calls
  }
});

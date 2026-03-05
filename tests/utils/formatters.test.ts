import { describe, it, expect } from 'vitest';
import { formatDate } from '../../src/utils/formatters.js';

describe('formatDate', () => {
  it('should format valid dates', () => {
    expect(formatDate('2024-09-15')).toBe('Sep 15, 2024');
  });

  it('should return fallback for null, undefined, or invalid dates', () => {
    expect(formatDate(null)).toBe('Unknown date');
    expect(formatDate(undefined)).toBe('Unknown date');
    expect(formatDate('not-a-date')).toBe('Unknown date');
  });
});

/**
 * search_spending Input Schema
 */

import { z } from 'zod';

export const searchSpendingInputSchema = {
  description: z
    .string()
    .optional()
    .describe('Search disbursement descriptions for keywords (e.g., "dinner", "travel", "event tickets", "Disney")'),
  recipient_name: z
    .string()
    .optional()
    .describe('Search for payments to a specific recipient/vendor'),
  recipient_state: z
    .string()
    .length(2)
    .optional()
    .describe('Two-letter state code to filter by (e.g., "FL", "NV")'),
  min_amount: z
    .number()
    .min(0)
    .optional()
    .describe('Minimum disbursement amount to include'),
  cycle: z
    .number()
    .int()
    .min(2000)
    .max(2030)
    .optional()
    .describe('Two-year election cycle (e.g., 2024)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of results to return (default: 20)'),
};

export type SearchSpendingInput = {
  description?: string;
  recipient_name?: string;
  recipient_state?: string;
  min_amount?: number;
  cycle?: number;
  limit?: number;
};

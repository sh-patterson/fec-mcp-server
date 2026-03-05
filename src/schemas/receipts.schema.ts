/**
 * Zod Schema for get_receipts tool
 */

import { z } from 'zod';

const committeeIdPattern = /^C\d{8}$/;

export const getReceiptsInputSchema = {
  committee_id: z
    .string()
    .regex(committeeIdPattern, 'Committee ID must be in format C00000000')
    .describe('FEC committee ID (e.g., "C00401224")'),

  min_amount: z
    .number()
    .positive('Minimum amount must be positive')
    .optional()
    .default(1000)
    .describe('Minimum contribution amount to filter (default: $1,000)'),

  two_year_transaction_period: z
    .number()
    .int()
    .min(1980)
    .max(2030)
    .optional()
    .describe('Two-year period (e.g., 2024 covers 2023-2024).'),

  cycle: z
    .number()
    .int()
    .min(1980)
    .max(2030)
    .optional()
    .describe('Alias for two_year_transaction_period to align with finance cycle filters.'),

  contributor_type: z
    .enum(['individual', 'committee'])
    .optional()
    .describe('Filter by contributor type: "individual" or "committee" (PAC)'),

  include_notable: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include flagged-first notable analysis block in output (default: true)'),

  fuzzy_threshold: z
    .number()
    .int()
    .min(80)
    .max(99)
    .optional()
    .default(90)
    .describe('Fuzzy match confidence threshold for reference list matching (default: 90)'),

  limit: z
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .optional()
    .default(20)
    .describe('Number of results to return (default: 20, max: 100)'),

  sort_by: z
    .enum(['amount', 'date'])
    .optional()
    .default('amount')
    .describe('Sort results by "amount" (descending) or "date" (most recent first)'),
};

export type GetReceiptsInput = {
  committee_id: string;
  min_amount?: number;
  two_year_transaction_period?: number;
  cycle?: number;
  contributor_type?: 'individual' | 'committee';
  include_notable?: boolean;
  fuzzy_threshold?: number;
  limit?: number;
  sort_by?: 'amount' | 'date';
};

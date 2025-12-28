/**
 * Zod Schema for get_disbursements tool
 */

import { z } from 'zod';

const committeeIdPattern = /^C\d{8}$/;

export const getDisbursementsInputSchema = {
  committee_id: z
    .string()
    .regex(committeeIdPattern, 'Committee ID must be in format C00000000')
    .describe('FEC committee ID (e.g., "C00401224")'),

  min_amount: z
    .number()
    .positive('Minimum amount must be positive')
    .optional()
    .default(1000)
    .describe('Minimum disbursement amount to filter (default: $1,000)'),

  two_year_transaction_period: z
    .number()
    .int()
    .min(1980)
    .max(2030)
    .optional()
    .describe('Two-year period (e.g., 2024 covers 2023-2024). Defaults to current cycle.'),

  purpose: z
    .string()
    .optional()
    .describe('Filter by disbursement purpose keyword (e.g., "CONSULTING", "MEDIA")'),

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

export type GetDisbursementsInput = {
  committee_id: string;
  min_amount?: number;
  two_year_transaction_period?: number;
  purpose?: string;
  limit?: number;
  sort_by?: 'amount' | 'date';
};

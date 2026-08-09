/**
 * Zod Schema for get_receipts tool
 */

import { z } from 'zod';
import { continuationSchema } from './continuation.schema.js';

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
    .optional()
    .describe('Two-year period (e.g., 2024 covers 2023-2024).'),

  cycle: z
    .number()
    .int()
    .min(1980)
    .optional()
    .describe('Alias for two_year_transaction_period to align with finance cycle filters.'),

  contributor_type: z
    .enum(['individual', 'non_individual', 'committee'])
    .optional()
    .describe('Filter by contributor type. "committee" is a legacy alias for "non_individual".'),

  include_notable: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include third-party analyst enrichment (default: false)'),

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

  continuation: continuationSchema,
};

export const getReceiptsParamsSchema = z
  .object(getReceiptsInputSchema)
  .superRefine((value, ctx) => {
    if (
      value.cycle !== undefined &&
      value.two_year_transaction_period !== undefined &&
      value.cycle !== value.two_year_transaction_period
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Conflicting cycle aliases: cycle and two_year_transaction_period must match.',
      });
    }
  });

export type GetReceiptsInput = z.infer<typeof getReceiptsParamsSchema>;

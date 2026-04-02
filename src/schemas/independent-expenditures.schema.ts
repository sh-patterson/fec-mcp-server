/**
 * get_independent_expenditures Input Schema
 */

import { z } from 'zod';

// Candidate IDs are either House/Senate format like H8CA15053 or presidential format like P00009423.
const candidateIdPattern = /^(?:[HS]\d[A-Z]{2}\d{5}|P\d{8})$/;
// Committee ID format: C followed by 8 digits
const committeeIdPattern = /^C\d{8}$/;

export const getIndependentExpendituresInputSchema = {
  candidate_id: z
    .string()
    .regex(
      candidateIdPattern,
      'Candidate ID must be in format like H8CA15053 or P00009423'
    )
    .optional()
    .describe('FEC candidate ID to find expenditures targeting this candidate'),
  committee_id: z
    .string()
    .regex(committeeIdPattern, 'Committee ID must be in format like C00123456')
    .optional()
    .describe('FEC committee ID to find expenditures made by this committee'),
  support_oppose: z
    .enum(['support', 'oppose'])
    .optional()
    .describe('Filter by support or oppose indicator'),
  min_amount: z
    .number()
    .min(0)
    .optional()
    .describe('Minimum expenditure amount to include'),
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

export const getIndependentExpendituresParamsSchema = z
  .object(getIndependentExpendituresInputSchema)
  .superRefine((value, ctx) => {
    if (!value.candidate_id && !value.committee_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Please provide either a candidate_id or committee_id to search for independent expenditures.',
      });
    }
  });

export type GetIndependentExpendituresInput = z.infer<
  typeof getIndependentExpendituresParamsSchema
>;

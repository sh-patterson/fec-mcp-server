/**
 * get_independent_expenditures Input Schema
 */

import { z } from 'zod';

// Candidate ID format: Letter followed by 8 digits
const candidateIdPattern = /^[A-Z]\d{8}$/;
// Committee ID format: C followed by 8 digits
const committeeIdPattern = /^C\d{8}$/;

export const getIndependentExpendituresInputSchema = {
  candidate_id: z
    .string()
    .regex(candidateIdPattern, 'Candidate ID must be in format like H8CA15053')
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

export type GetIndependentExpendituresInput = {
  candidate_id?: string;
  committee_id?: string;
  support_oppose?: 'support' | 'oppose';
  min_amount?: number;
  cycle?: number;
  limit?: number;
};

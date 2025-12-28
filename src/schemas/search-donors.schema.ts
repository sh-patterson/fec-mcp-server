/**
 * search_donors Input Schema
 */

import { z } from 'zod';

export const searchDonorsInputSchema = {
  contributor_name: z
    .string()
    .optional()
    .describe('Donor name to search for (partial match supported)'),
  contributor_employer: z
    .string()
    .optional()
    .describe('Employer name to search for (e.g., "Google", "Goldman Sachs")'),
  contributor_occupation: z
    .string()
    .optional()
    .describe('Occupation to search for (e.g., "Attorney", "Government Affairs", "Lobbyist")'),
  contributor_state: z
    .string()
    .length(2)
    .optional()
    .describe('Two-letter state code to filter by (e.g., "CA", "NY")'),
  min_amount: z
    .number()
    .min(0)
    .optional()
    .describe('Minimum contribution amount to include'),
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

export type SearchDonorsInput = {
  contributor_name?: string;
  contributor_employer?: string;
  contributor_occupation?: string;
  contributor_state?: string;
  min_amount?: number;
  cycle?: number;
  limit?: number;
};

/**
 * Zod Schema for search_candidates tool
 */

import { z } from 'zod';

export const searchCandidatesInputSchema = {
  q: z
    .string()
    .min(1, 'Search query must not be empty')
    .describe('Candidate name to search for (e.g., "John Smith" or "Smith")'),

  election_year: z
    .number()
    .int()
    .min(1980, 'Election year must be 1980 or later')
    .max(2030, 'Election year must be 2030 or earlier')
    .optional()
    .describe('Filter by election year (e.g., 2024)'),

  office: z
    .enum(['H', 'S', 'P'])
    .optional()
    .describe('Filter by office: H=House, S=Senate, P=President'),

  state: z
    .string()
    .length(2, 'State must be a 2-letter code')
    .toUpperCase()
    .optional()
    .describe('Filter by state (2-letter code, e.g., "CA")'),

  party: z
    .string()
    .optional()
    .describe('Filter by party code (e.g., "DEM", "REP", "LIB")'),
};

// Infer TypeScript type from schema
export type SearchCandidatesInput = {
  q: string;
  election_year?: number;
  office?: 'H' | 'S' | 'P';
  state?: string;
  party?: string;
};

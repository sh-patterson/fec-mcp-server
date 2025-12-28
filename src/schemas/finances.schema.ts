/**
 * Zod Schema for get_committee_finances tool
 */

import { z } from 'zod';

// Committee ID format: C followed by 8 digits
const committeeIdPattern = /^C\d{8}$/;

export const getCommitteeFinancesInputSchema = {
  committee_id: z
    .string()
    .regex(committeeIdPattern, 'Committee ID must be in format C00000000 (C followed by 8 digits)')
    .describe('FEC committee ID (e.g., "C00401224")'),

  cycle: z
    .number()
    .int()
    .min(1980, 'Cycle must be 1980 or later')
    .max(2030, 'Cycle must be 2030 or earlier')
    .optional()
    .describe('Two-year election cycle (e.g., 2024). Defaults to most recent.'),
};

export type GetCommitteeFinancesInput = {
  committee_id: string;
  cycle?: number;
};

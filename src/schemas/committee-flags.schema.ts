/**
 * get_committee_flags Input Schema
 */

import { z } from 'zod';

// Committee ID format: C followed by 8 digits
const committeeIdPattern = /^C\d{8}$/;

export const getCommitteeFlagsInputSchema = {
  committee_id: z
    .string()
    .regex(committeeIdPattern, 'Committee ID must be in format like C00123456')
    .describe('FEC committee ID to check for compliance flags'),
  cycle: z
    .number()
    .int()
    .min(2000)
    .max(2030)
    .optional()
    .describe('Two-year election cycle to check (e.g., 2024)'),
};

export type GetCommitteeFlagsInput = {
  committee_id: string;
  cycle?: number;
};

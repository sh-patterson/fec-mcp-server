/**
 * Input schema validation tests
 */

import { describe, expect, it } from 'vitest';
import {
  searchCandidatesParamsSchema,
  getReceiptsParamsSchema,
  getDisbursementsParamsSchema,
  getIndependentExpendituresParamsSchema,
  searchDonorsParamsSchema,
  searchSpendingParamsSchema,
} from '../../src/schemas/index.js';

describe('tool input schemas', () => {
  it('should accept real House/Senate FEC candidate IDs', () => {
    const parsed = getIndependentExpendituresParamsSchema.safeParse({
      candidate_id: 'H8CA15053',
    });

    expect(parsed.success).toBe(true);
  });

  it('should accept presidential FEC candidate IDs', () => {
    const parsed = getIndependentExpendituresParamsSchema.safeParse({
      candidate_id: 'P00009423',
    });

    expect(parsed.success).toBe(true);
  });

  it('should require a candidate_id or committee_id for independent expenditures', () => {
    const parsed = getIndependentExpendituresParamsSchema.safeParse({});

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toContain('candidate_id or committee_id');
  });

  it('should require at least one donor search criterion', () => {
    const parsed = searchDonorsParamsSchema.safeParse({
      contributor_state: 'CA',
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toContain('at least one search criterion');
  });

  it('should require a description or recipient_name for spending search', () => {
    const parsed = searchSpendingParamsSchema.safeParse({
      recipient_state: 'DC',
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toContain('description or recipient_name');
  });

  it('should accept bounded continuation tokens on all six paginated tools', () => {
    const continuation = 'fecp1.example';
    const schemasAndInputs = [
      [searchCandidatesParamsSchema, { q: 'Smith', continuation }],
      [getReceiptsParamsSchema, { committee_id: 'C00000001', continuation }],
      [getDisbursementsParamsSchema, { committee_id: 'C00000001', continuation }],
      [getIndependentExpendituresParamsSchema, { candidate_id: 'H8CA15053', continuation }],
      [searchDonorsParamsSchema, { contributor_name: 'Smith', continuation }],
      [searchSpendingParamsSchema, { recipient_name: 'Vendor', continuation }],
    ] as const;

    for (const [schema, input] of schemasAndInputs) {
      expect(schema.safeParse(input).success).toBe(true);
      expect(schema.safeParse({ ...input, continuation: 'x'.repeat(2049) }).success).toBe(false);
    }
  });
});

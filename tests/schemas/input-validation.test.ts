/**
 * Input schema validation tests
 */

import { describe, expect, it } from 'vitest';
import {
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
});

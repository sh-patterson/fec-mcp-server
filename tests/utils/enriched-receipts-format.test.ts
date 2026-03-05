import { describe, it, expect } from 'vitest';
import type { EnrichedReceipt } from '../../src/api/types.js';
import { formatEnrichedReceiptsText } from '../../src/utils/formatters.js';

describe('formatEnrichedReceiptsText', () => {
  it('should place unclassified committee contributions in organization section, not individual', () => {
    const receipts: EnrichedReceipt[] = [
      {
        contributor_name: 'ACME COMMITTEE',
        amount: 5000,
        date: '2024-09-15',
        contributor_type: 'Committee',
        employer: null,
        occupation: null,
        city: 'WASHINGTON',
        state: 'DC',
        contributor_committee_id: 'C00000001',
        pac_classification: null,
      },
    ];

    const text = formatEnrichedReceiptsText(receipts);

    expect(text).toContain('### Other Committee/Organization Contributions');
    expect(text).not.toContain('### Individual Contributions');
  });
});

import { describe, it, expect } from 'vitest';
import type { EnrichedReceipt, PACClassification } from '../../src/api/types.js';
import {
  formatEnrichedReceiptsText,
  formatPACClassificationText,
} from '../../src/utils/formatters.js';

const leadershipPac: PACClassification = {
  committee_id: 'C00000002',
  name: 'LEADERSHIP PAC',
  designation: 'D',
  designation_full: 'Leadership PAC',
  organization_type: 'C',
  organization_type_full: 'Corporation',
  connected_organization: 'ACME CORP',
  is_leadership_pac: true,
  is_corporate_pac: true,
  is_labor_pac: false,
  is_trade_pac: true,
  sponsor_candidate: 'Jane Candidate',
};

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

  it('should format classified PAC contributions with tags and enrichment details', () => {
    const receipts: EnrichedReceipt[] = [
      {
        contributor_name: 'LEADERSHIP PAC',
        amount: 7500,
        date: '2024-10-01',
        contributor_type: 'Committee',
        employer: null,
        occupation: null,
        city: 'WASHINGTON',
        state: 'DC',
        contributor_committee_id: 'C00000002',
        pac_classification: leadershipPac,
      },
      {
        contributor_name: 'Jane Donor',
        amount: 500,
        date: '2024-10-02',
        contributor_type: 'Individual',
        employer: 'ACME',
        occupation: 'Engineer',
        city: 'SAN FRANCISCO',
        state: 'CA',
        contributor_committee_id: null,
        pac_classification: null,
      },
    ];

    const text = formatEnrichedReceiptsText(receipts, 'TEST COMMITTEE');

    expect(text).toContain('## Contributions to TEST COMMITTEE');
    expect(text).toContain('### PAC Contributions');
    expect(text).toContain('**LEADERSHIP PAC** - $7,500 [Leadership, Corporate, Trade]');
    expect(text).toContain('- Connected Org: ACME CORP');
    expect(text).toContain('- Sponsor: Jane Candidate');
    expect(text).toContain('### Individual Contributions');
    expect(text).toContain('- Employer: ACME');
    expect(text).toContain('- Location: SAN FRANCISCO, CA');
  });

  it('should format PAC classification summaries', () => {
    const text = formatPACClassificationText({
      ...leadershipPac,
      is_labor_pac: true,
    });

    expect(text).toContain('**LEADERSHIP PAC** (C00000002)');
    expect(text).toContain(
      '- Classification: Leadership PAC, Corporate PAC, Labor PAC, Trade/Membership PAC'
    );
    expect(text).toContain('- Connected Organization: ACME CORP');
    expect(text).toContain('- Sponsor Candidate: Jane Candidate');
  });
});

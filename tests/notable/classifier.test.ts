import { describe, it, expect } from 'vitest';
import type { EnrichedReceipt, FECScheduleB } from '../../src/api/types.js';
import type { ReferenceData } from '../../src/notable/reference-data.js';
import {
  classifyNotableReceipts,
  classifyNotableDisbursements,
} from '../../src/notable/classifier.js';

const referenceData: ReferenceData = {
  attribution: 'test',
  lpac: [{ committeeId: 'C001', shortName: 'LPAC', officialName: 'LPAC TEST', sponsor: '' }],
  industry: [
    {
      committeeId: 'C002',
      committeeName: 'INDUSTRY TEST PAC',
      orgType: 'C',
      smallerCategory: '',
      largerCategory: 'Energy',
      connectedOrganization: 'Energy Corp',
    },
  ],
  badGroups: [
    {
      committeeId: 'C003',
      committeeName: 'BAD GROUP TEST',
      flag: 'Extremist group',
    },
  ],
  committees: [
    {
      committeeId: 'C002',
      committeeName: 'INDUSTRY TEST PAC',
      orgType: 'C',
      connectedOrgName: 'Energy Corp',
      party: 'UNK',
    },
  ],
};

describe('notable classifier', () => {
  it('should sort flagged receipts first by priority', () => {
    const receipts: EnrichedReceipt[] = [
      {
        contributor_name: 'UNFLAGGED DONOR',
        amount: 9000,
        date: '2024-08-01',
        contributor_type: 'Committee',
        employer: null,
        occupation: null,
        city: null,
        state: null,
        contributor_committee_id: null,
        pac_classification: null,
      },
      {
        contributor_name: 'BAD GROUP TEST',
        amount: 2000,
        date: '2024-09-01',
        contributor_type: 'Committee',
        employer: null,
        occupation: null,
        city: null,
        state: null,
        contributor_committee_id: 'C003',
        pac_classification: null,
      },
    ];

    const results = classifyNotableReceipts(receipts, 'TARGET COMMITTEE', referenceData, 90);

    expect(results[0].name).toBe('BAD GROUP TEST');
    expect(results[0].flags[0].type).toBe('BAD_GROUP');
  });

  it('should apply keyword-pattern flags to disbursements', () => {
    const disbursements: FECScheduleB[] = [
      {
        committee_id: 'C100',
        committee_name: 'TEST COMMITTEE',
        recipient_name: 'SMITH LEGAL LLC',
        recipient_city: 'WASHINGTON',
        recipient_state: 'DC',
        recipient_zip: '20001',
        disbursement_amount: 15000,
        disbursement_date: '2024-07-10',
        disbursement_description: 'LEGAL SERVICES',
        disbursement_purpose_category: 'LEGAL',
        disbursement_type: '001',
        disbursement_type_description: 'Operating expenditure',
        line_number: '17',
        line_number_label: 'Operating Expenditures',
        memo_text: null,
        two_year_transaction_period: 2024,
        sub_id: '1',
        link_id: '1',
        transaction_id: 'SB17.1',
        file_number: 1,
        recipient_committee_id: null,
      },
    ];

    const results = classifyNotableDisbursements(
      disbursements,
      'TEST COMMITTEE',
      referenceData,
      90
    );

    expect(results[0].flags.some((flag) => flag.type === 'KEYWORD_PATTERN')).toBe(true);
  });
});

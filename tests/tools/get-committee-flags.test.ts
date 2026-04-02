/**
 * get_committee_flags Tool Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FECClient } from '../../src/api/client.js';
import { executeGetCommitteeFlags } from '../../src/tools/get-committee-flags.js';
import type { FECApiResponse, FECFiling } from '../../src/api/types.js';

const mockFilingsResponse: FECApiResponse<FECFiling> = {
  api_version: '1.0',
  pagination: {
    count: 3,
    page: 1,
    pages: 1,
    per_page: 50,
  },
  results: [
    {
      committee_id: 'C00523969',
      committee_name: 'SWALWELL FOR CONGRESS',
      form_type: 'Q3',
      report_type: 'Q3',
      report_type_full: 'October Quarterly',
      document_type: 'REPORT',
      document_type_full: 'Report',
      amendment_indicator: 'N',
      receipt_date: '2024-10-15',
      coverage_start_date: '2024-07-01',
      coverage_end_date: '2024-09-30',
      file_number: 1111,
      pdf_url: null,
      request_type: null,
      is_amended: false,
    },
    {
      committee_id: 'C00523969',
      committee_name: 'SWALWELL FOR CONGRESS',
      form_type: 'RFAI',
      report_type: null,
      report_type_full: null,
      document_type: 'RFAI',
      document_type_full: 'Request for Additional Information',
      amendment_indicator: 'N',
      receipt_date: '2024-10-20',
      coverage_start_date: null,
      coverage_end_date: null,
      file_number: 2222,
      pdf_url: null,
      request_type: 'ADMIN',
      is_amended: false,
    },
    {
      committee_id: 'C00523969',
      committee_name: 'SWALWELL FOR CONGRESS',
      form_type: 'Q3',
      report_type: 'Q3',
      report_type_full: 'October Quarterly',
      document_type: 'REPORT',
      document_type_full: 'Report',
      amendment_indicator: 'A',
      receipt_date: '2024-10-22',
      coverage_start_date: '2024-07-01',
      coverage_end_date: '2024-09-30',
      file_number: 3333,
      pdf_url: null,
      request_type: null,
      is_amended: true,
    },
  ],
};

describe('get_committee_flags tool', () => {
  let mockClient: FECClient;

  beforeEach(() => {
    mockClient = new FECClient({ apiKey: 'test-key' });
  });

  it('should summarize RFAIs and amendments', async () => {
    vi.spyOn(mockClient, 'getFilings').mockResolvedValue(mockFilingsResponse);

    const result = await executeGetCommitteeFlags(mockClient, {
      committee_id: 'C00523969',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Compliance Review');
    expect(result.content[0].text).toContain('RFAIs');
    expect(result.content[0].text).toContain('Amendments');
  });

  it('should pass cycle to both filings lookups', async () => {
    const spy = vi
      .spyOn(mockClient, 'getFilings')
      .mockResolvedValue(mockFilingsResponse);

    await executeGetCommitteeFlags(mockClient, {
      committee_id: 'C00523969',
      cycle: 2024,
    });

    expect(spy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        committee_id: 'C00523969',
        cycle: 2024,
        limit: 50,
      })
    );
    expect(spy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        committee_id: 'C00523969',
        cycle: 2024,
        document_type: 'RFAI',
        limit: 20,
      })
    );
  });

  it('should handle missing filings as not found', async () => {
    vi.spyOn(mockClient, 'getFilings').mockResolvedValue({
      api_version: '1.0',
      pagination: { count: 0, page: 1, pages: 0, per_page: 50 },
      results: [],
    });

    const result = await executeGetCommitteeFlags(mockClient, {
      committee_id: 'C99999999',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FECClient } from '../src/api/client.js';
import type { FECApiResponse, FECCommitteeReport, FECCommitteeTotals, FECFiling } from '../src/api/types.js';
import { loadConfig, resetConfig } from '../src/config.js';
import { tryValidateOpenFecKeysetValues } from '../src/pagination/continuation.js';
import { executeGetCommitteeFinances } from '../src/tools/get-committee-finances.js';
import { executeGetCommitteeFlags } from '../src/tools/get-committee-flags.js';
import { executeGetReceipts } from '../src/tools/get-receipts.js';
import { mockCommitteeReportsResponse, mockScheduleAResponse } from './mocks/fec-responses.js';

describe('thermo-nuclear review regressions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetConfig();
  });

  it('does not crash when filing description fields are null', async () => {
    const client = new FECClient({ apiKey: 'test-key' });
    const filings: FECApiResponse<FECFiling> = {
      api_version: '1.0',
      pagination: { count: 1, page: 1, pages: 1, per_page: 20 },
      results: [
        {
          committee_id: 'C00523969',
          committee_name: 'SWALWELL FOR CONGRESS',
          form_type: 'F3',
          report_type: null,
          report_type_full: null,
          document_type: '',
          document_type_full: '',
          document_description: null,
          amendment_indicator: 'N',
          receipt_date: '2024-10-20',
          coverage_start_date: null,
          coverage_end_date: null,
          file_number: 9999,
          pdf_url: null,
          request_type: null,
          is_amended: false,
        },
      ],
    };
    vi.spyOn(client, 'getFilings').mockResolvedValue(filings);

    const result = await executeGetCommitteeFlags(client, { committee_id: 'C00523969' });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('No RFAIs or amendments');
  });

  it('does not treat bare FRQ filings as RFAIs without RFAI wording', async () => {
    const client = new FECClient({ apiKey: 'test-key' });
    const filings: FECApiResponse<FECFiling> = {
      api_version: '1.0',
      pagination: { count: 1, page: 1, pages: 1, per_page: 20 },
      results: [
        {
          committee_id: 'C00523969',
          committee_name: 'SWALWELL FOR CONGRESS',
          form_type: 'FRQ',
          report_type: null,
          report_type_full: null,
          document_type: 'LETTER',
          document_type_full: 'Miscellaneous letter',
          document_description: 'General correspondence',
          amendment_indicator: 'N',
          receipt_date: '2024-10-20',
          coverage_start_date: null,
          coverage_end_date: null,
          file_number: 4444,
          pdf_url: null,
          request_type: null,
          is_amended: false,
        },
      ],
    };
    vi.spyOn(client, 'getFilings').mockResolvedValue(filings);

    const result = await executeGetCommitteeFlags(client, { committee_id: 'C00523969' });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('No RFAIs or amendments');
    expect(result.content[0].text).not.toContain('### Records for review');
    expect(result.content[0].text).not.toContain('File number: 4444');
  });

  it('pairs committee totals with a same-cycle final report when cycle is omitted', async () => {
    const client = new FECClient({ apiKey: 'test-key' });
    const totals: FECApiResponse<FECCommitteeTotals> = {
      api_version: '1.0',
      pagination: { count: 1, page: 1, pages: 1, per_page: 20 },
      results: [
        {
          committee_id: 'C00523969',
          cycle: 2024,
          coverage_start_date: '2023-01-01',
          coverage_end_date: '2024-09-30',
          receipts: 1_500_000,
          disbursements: 1_200_000,
          individual_contributions: 1_000_000,
          individual_itemized_contributions: 700_000,
          individual_unitemized_contributions: 300_000,
          other_political_committee_contributions: 400_000,
          political_party_committee_contributions: 100_000,
          loans: 25_000,
          loans_received_from_candidate: 10_000,
        },
      ],
    };
    const mismatchedReport: FECCommitteeReport = {
      ...mockCommitteeReportsResponse.results[0],
      cycle: 2022,
      report_year: 2022,
      coverage_start_date: '2021-01-01',
      coverage_end_date: '2022-12-31',
      cash_on_hand_end_period: 111_111,
    };
    const matchingReport: FECCommitteeReport = {
      ...mockCommitteeReportsResponse.results[0],
      cycle: 2024,
      cash_on_hand_end_period: 750_000,
    };

    const reportsSpy = vi
      .spyOn(client, 'getCommitteeReports')
      .mockResolvedValueOnce({
        api_version: '1.0',
        pagination: { count: 1, page: 1, pages: 1, per_page: 20 },
        results: [mismatchedReport],
      })
      .mockResolvedValueOnce({
        api_version: '1.0',
        pagination: { count: 1, page: 1, pages: 1, per_page: 20 },
        results: [matchingReport],
      });
    vi.spyOn(client, 'getCommitteeTotals').mockResolvedValue(totals);

    const result = await executeGetCommitteeFinances(client, { committee_id: 'C00523969' });

    expect(result.isError).toBeUndefined();
    expect(reportsSpy).toHaveBeenCalledTimes(2);
    expect(reportsSpy).toHaveBeenNthCalledWith(2, 'C00523969', { cycle: 2024 });
    expect(result.content[0].text).toContain('Cycle totals (2024)');
    expect(result.content[0].text).toContain('$750,000');
    expect(result.content[0].text).not.toContain('$111,111');
  });

  it('returns the page and clears continuation when OpenFEC keyset metadata is incomplete', async () => {
    const client = new FECClient({ apiKey: 'test-key' });
    vi.spyOn(client, 'getScheduleA').mockResolvedValue({
      ...mockScheduleAResponse,
      pagination: {
        count: 1,
        per_page: 20,
        pages: 0,
        last_indexes: { last_index: 1 },
        is_count_exact: true,
      },
    } as typeof mockScheduleAResponse);

    const result = await executeGetReceipts(client, { committee_id: 'C00523969' });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Contributions to');
    expect(result.content[0].text).toContain('Continuation: none');
  });

  it('soft-fails invalid OpenFEC keyset values to null', () => {
    expect(
      tryValidateOpenFecKeysetValues(
        { last_index: 1 },
        ['last_index', 'last_contribution_receipt_amount'],
        ['last_index', 'last_contribution_receipt_amount']
      )
    ).toBeNull();
  });

  it('rejects non-OpenFEC FEC_API_BASE_URL values', () => {
    const previous = process.env.FEC_API_BASE_URL;
    try {
      process.env.FEC_API_BASE_URL = 'https://api.example.com/v1';
      resetConfig();
      expect(() => loadConfig()).toThrow(/FEC_API_BASE_URL/);
    } finally {
      if (previous === undefined) {
        delete process.env.FEC_API_BASE_URL;
      } else {
        process.env.FEC_API_BASE_URL = previous;
      }
      resetConfig();
    }
  });

  it('allows localhost mock FEC_API_BASE_URL values', () => {
    const previous = process.env.FEC_API_BASE_URL;
    try {
      process.env.FEC_API_BASE_URL = 'http://127.0.0.1:4010/v1';
      resetConfig();
      expect(loadConfig().fecApiBaseUrl).toBe('http://127.0.0.1:4010/v1');
    } finally {
      if (previous === undefined) {
        delete process.env.FEC_API_BASE_URL;
      } else {
        process.env.FEC_API_BASE_URL = previous;
      }
      resetConfig();
    }
  });
});

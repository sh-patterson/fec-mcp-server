import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FECClient } from '../src/api/client.js';
import type { FECApiResponse, FECCommitteeTotals } from '../src/api/types.js';
import {
  getCommitteeFinancesParamsSchema,
  getDisbursementsParamsSchema,
  getIndependentExpendituresParamsSchema,
  getReceiptsParamsSchema,
  searchDonorsParamsSchema,
  searchSpendingParamsSchema,
} from '../src/schemas/index.js';
import { executeGetCommitteeFinances } from '../src/tools/get-committee-finances.js';
import { executeGetCommitteeFlags } from '../src/tools/get-committee-flags.js';
import { executeGetIndependentExpenditures } from '../src/tools/get-independent-expenditures.js';
import { executeGetReceipts } from '../src/tools/get-receipts.js';
import { executeSearchDonors } from '../src/tools/search-donors.js';
import { FECApiError, RateLimitError, formatErrorForToolResponse } from '../src/utils/errors.js';
import {
  createMockResponse,
  mockCommitteeReportsResponse,
  mockScheduleAResponse,
} from './mocks/fec-responses.js';

const committeeTotalsResponse: FECApiResponse<FECCommitteeTotals> = {
  api_version: '1.0',
  pagination: { count: 1, page: 1, pages: 1, per_page: 20 },
  results: [
    {
      committee_id: 'C00523969',
      cycle: 2024,
      receipts: 1_500_000,
      disbursements: 1_200_000,
      individual_contributions: 1_000_000,
      individual_itemized_contributions: 700_000,
      individual_unitemized_contributions: 300_000,
      other_political_committee_contributions: 400_000,
      political_party_committee_contributions: 100_000,
      loans: 25_000,
      loans_received_from_candidate: 10_000,
      coverage_start_date: '2023-01-01',
      coverage_end_date: '2024-09-30',
      last_cash_on_hand_end_period: 750_000,
      last_debts_owed_by_committee: 50_000,
    },
  ],
};

describe('release 1.1 correctness regressions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses cycle totals and the latest final report without partial Schedule C or D lists', async () => {
    const client = new FECClient({ apiKey: 'test-key' });
    vi.spyOn(client, 'getCommitteeReports').mockResolvedValue(mockCommitteeReportsResponse);
    const totalsSpy = vi
      .spyOn(client, 'getCommitteeTotals')
      .mockResolvedValue(committeeTotalsResponse);
    const loansSpy = vi.spyOn(client, 'getScheduleC');
    const debtsSpy = vi.spyOn(client, 'getScheduleD');

    const result = await executeGetCommitteeFinances(client, {
      committee_id: 'C00523969',
      cycle: 2024,
    });

    expect(result.isError).toBeUndefined();
    expect(totalsSpy).toHaveBeenCalledWith('C00523969', { cycle: 2024 });
    expect(loansSpy).not.toHaveBeenCalled();
    expect(debtsSpy).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain('Cycle total receipts');
    expect(result.content[0].text).toContain('$1,500,000');
    expect(result.content[0].text).toContain('Latest-report cash balance');
    expect(result.content[0].text).not.toContain('Schedule C');
    expect(result.content[0].text).not.toContain('Schedule D');
  });

  it('requests final reports and committee totals from the correct routes', async () => {
    const client = new FECClient({ apiKey: 'test-key' });
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      createMockResponse(mockCommitteeReportsResponse)
    );

    await client.getCommitteeReports('C00523969', { cycle: 2024 });
    const reportsUrl = String(fetchSpy.mock.calls[0][0]);
    expect(reportsUrl).toContain('is_amended=false');

    await client.getCommitteeTotals('C00523969', { cycle: 2024 });
    const totalsUrl = String(fetchSpy.mock.calls[1][0]);
    expect(totalsUrl).toContain('/committee/C00523969/totals/');
    expect(totalsUrl).toContain('cycle=2024');
  });

  it('describes RFAIs and amendments as filing review signals with source records', async () => {
    const client = new FECClient({ apiKey: 'test-key' });
    const filings = {
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
          document_type_full: 'Request for Additional Information',
          document_description: 'Request for Additional Information',
          amendment_indicator: 'N',
          receipt_date: '2024-10-20',
          coverage_start_date: null,
          coverage_end_date: null,
          file_number: 2222,
          pdf_url: 'https://docquery.fec.gov/pdf/2222/2222.pdf',
          request_type: 'ADMIN',
          is_amended: false,
        },
      ],
    };
    const spy = vi.spyOn(client, 'getFilings').mockResolvedValue(filings);

    const result = await executeGetCommitteeFlags(client, { committee_id: 'C00523969' });

    expect(spy).toHaveBeenNthCalledWith(2, expect.objectContaining({ form_type: 'RFAI' }));
    expect(spy).toHaveBeenNthCalledWith(2, expect.not.objectContaining({ document_type: 'RFAI' }));
    expect(result.content[0].text).toContain('Filing review signals');
    expect(result.content[0].text).toContain('File number: 2222');
    expect(result.content[0].text).toContain('https://docquery.fec.gov/pdf/2222/2222.pdf');
    expect(result.content[0].text).not.toContain('Compliance violation');
  });

  it('renders null Schedule E indicators as UNKNOWN and labels current-page sums', async () => {
    const client = new FECClient({ apiKey: 'test-key' });
    vi.spyOn(client, 'getScheduleE').mockResolvedValue({
      api_version: '1.0',
      pagination: { count: 1, page: 1, pages: 1, per_page: 20 },
      results: [
        {
          committee_id: 'C90000001',
          committee_name: 'UNITED FOR CHANGE PAC',
          spender_name: null,
          spender_committee_type: null,
          candidate_id: 'H8CA15053',
          candidate_name: 'TEST CANDIDATE',
          candidate_party: 'DEM',
          candidate_office: 'H',
          candidate_office_state: 'CA',
          candidate_office_district: '15',
          support_oppose_indicator: null,
          expenditure_amount: 125_000,
          expenditure_date: '2024-09-20',
          expenditure_description: null,
          payee_name: null,
          payee_city: null,
          payee_state: null,
          filing_date: '2024-09-21',
          two_year_transaction_period: 2024,
        },
      ],
    });

    const result = await executeGetIndependentExpenditures(client, {
      candidate_id: 'H8CA15053',
    });

    expect(result.content[0].text).toContain('[UNKNOWN]');
    expect(result.content[0].text).toContain('Current-page support total');
    expect(result.content[0].text).toContain('Current-page oppose total');
  });

  it('keeps notable enrichment off by default and labels explicit enrichment', async () => {
    const client = new FECClient({ apiKey: 'test-key' });
    vi.spyOn(client, 'getScheduleA').mockResolvedValue(mockScheduleAResponse);

    const defaultResult = await executeGetReceipts(client, { committee_id: 'C00523969' });
    const enrichedResult = await executeGetReceipts(client, {
      committee_id: 'C00523969',
      include_notable: true,
    });

    expect(defaultResult.content[0].text).not.toContain('Flagged Notables');
    expect(enrichedResult.content[0].text).toContain('Third-party analyst enrichment');
  });

  it('prints every effective receipt filter and rejects conflicting cycle aliases', async () => {
    const client = new FECClient({ apiKey: 'test-key' });
    const scheduleSpy = vi.spyOn(client, 'getScheduleA').mockResolvedValue(mockScheduleAResponse);

    const defaultResult = await executeGetReceipts(client, { committee_id: 'C00523969' });
    expect(defaultResult.content[0].text).toContain(
      'minimum $1,000; cycle all; type all; sort amount'
    );

    const conflictResult = await executeGetReceipts(client, {
      committee_id: 'C00523969',
      cycle: 2024,
      two_year_transaction_period: 2022,
    });
    expect(conflictResult.isError).toBe(true);
    expect(conflictResult.content[0].text.toLowerCase()).toContain('conflicting cycle aliases');
    expect(scheduleSpy).toHaveBeenCalledTimes(1);
  });

  it('accepts non_individual, keeps committee as an alias, and removes the 2030 ceiling', () => {
    expect(getReceiptsParamsSchema.safeParse({
      committee_id: 'C00523969',
      contributor_type: 'non_individual',
      cycle: 2040,
    }).success).toBe(true);
    expect(getReceiptsParamsSchema.safeParse({
      committee_id: 'C00523969',
      contributor_type: 'committee',
    }).success).toBe(true);
    expect(getDisbursementsParamsSchema.safeParse({
      committee_id: 'C00523969',
      cycle: 2040,
    }).success).toBe(true);
    expect(getCommitteeFinancesParamsSchema.safeParse({
      committee_id: 'C00523969',
      cycle: 2040,
    }).success).toBe(true);
    expect(getIndependentExpendituresParamsSchema.safeParse({
      candidate_id: 'H8CA15053',
      cycle: 2040,
    }).success).toBe(true);
    expect(searchDonorsParamsSchema.safeParse({
      contributor_name: 'SMITH',
      cycle: 2040,
    }).success).toBe(true);
    expect(searchSpendingParamsSchema.safeParse({
      description: 'MEDIA',
      cycle: 2040,
    }).success).toBe(true);
  });

  it('uses the configured client timeout in donor search and prints the effective minimum', async () => {
    const client = new FECClient({ apiKey: 'test-key', timeout: 12_345 });
    const spy = vi.spyOn(client, 'searchDonors').mockResolvedValue(mockScheduleAResponse);

    const result = await executeSearchDonors(client, { contributor_name: 'SMITH' });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ min_amount: 200 }));
    expect(spy.mock.calls[0]).toHaveLength(1);
    expect(result.content[0].text).toContain('minimum: $200');
  });

  it('preserves rate-limit and gateway details without duplicate prefixes', () => {
    expect(formatErrorForToolResponse(new RateLimitError(45))).toContain('Retry-After: 45 seconds');
    const gateway = formatErrorForToolResponse(
      new FECApiError('504 Gateway Timeout', 504, '/schedules/schedule_a/')
    );
    expect(gateway).toContain('504');
    expect(gateway).toContain('narrower filters');
    const ordinary = formatErrorForToolResponse(
      new FECApiError('502 Bad Gateway', 502, '/candidates/search/')
    );
    expect(ordinary.match(/FEC API error/g)).toHaveLength(1);
  });
});

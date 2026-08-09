import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FECClient } from '../src/api/client.js';
import { encodeContinuationToken, decodeContinuationToken } from '../src/pagination/continuation.js';
import { executeSearchCandidates } from '../src/tools/search-candidates.js';
import { executeGetReceipts } from '../src/tools/get-receipts.js';

const filters = { q: 'SMITH', election_year: 2024 };

const candidate = (id: string, name: string) => ({
  candidate_id: id,
  name,
  party: 'DEM',
  party_full: 'Democratic Party',
  office: 'H',
  office_full: 'House',
  state: 'CA',
  district: '12',
  election_years: [2024],
  cycles: [2024],
  incumbent_challenge: 'C',
  incumbent_challenge_full: 'Challenger',
  candidate_status: 'C',
  federal_funds_flag: false,
  has_raised_funds: true,
  principal_committees: [],
});

const receipt = (id: string, amount: number) => ({
  committee_id: 'C00000001',
  committee_name: 'TEST COMMITTEE',
  contributor_name: `DONOR ${id}`,
  contributor_first_name: null,
  contributor_last_name: null,
  contributor_middle_name: null,
  contributor_employer: null,
  contributor_occupation: null,
  contributor_city: null,
  contributor_state: 'CA',
  contributor_zip: null,
  contribution_receipt_amount: amount,
  contribution_receipt_date: '2024-01-01',
  entity_type: null,
  entity_type_desc: null,
  is_individual: true,
  line_number: '11AI',
  line_number_label: 'Itemized individual contribution',
  memo_text: null,
  receipt_type: '15',
  receipt_type_full: 'Contribution',
  two_year_transaction_period: 2024,
  sub_id: id,
  link_id: id,
  transaction_id: id,
  file_number: 100,
  contributor_committee_id: null,
});

describe('release 1.2 pagination regressions', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('round-trips a fecp1 page token and keeps it opaque', () => {
    const token = encodeContinuationToken({
      tool: 'search_candidates',
      effectiveFilters: filters,
      cursor: { kind: 'page', page: 2 },
    });
    expect(token.startsWith('fecp1.')).toBe(true);
    expect(token).not.toContain('test-key');
    expect(decodeContinuationToken({
      token,
      tool: 'search_candidates',
      effectiveFilters: filters,
      cursorKind: 'page',
    })).toEqual({ kind: 'page', page: 2 });
  });

  it('rejects changed filters before the mocked fetch', async () => {
    const client = new FECClient({ apiKey: 'test-key' });
    const fetchSpy = vi.spyOn(client, 'searchCandidates').mockResolvedValue({
      api_version: '1',
      pagination: { count: 2, page: 1, pages: 2, per_page: 1, is_count_exact: true },
      results: [candidate('A', 'ALICE')],
    });
    const first = await executeSearchCandidates(client, filters);
    const continuation = first.content[0].text.match(/Continuation: (\{"continuation":"[^"]+"\})/)?.[1];
    expect(continuation).toBeDefined();
    const result = await executeSearchCandidates(client, {
      ...filters,
      continuation: JSON.parse(continuation!).continuation,
      election_year: 2020,
    } as any);
    expect(result.isError).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.content[0].text).not.toContain('test-key');
  });

  it.each([
    ['wrong tool', { tool: 'get_receipts' as const }],
    ['wrong cursor kind', { cursorKind: 'keyset' as const }],
  ])('rejects %s tokens', (_label, change) => {
    const token = encodeContinuationToken({
      tool: 'search_candidates', effectiveFilters: filters,
      cursor: { kind: 'page', page: 2 },
    });
    expect(() => decodeContinuationToken({
      token,
      tool: ('tool' in change ? change.tool : 'search_candidates'),
      effectiveFilters: filters,
      cursorKind: ('cursorKind' in change ? change.cursorKind : 'page'),
    })).toThrow();
  });

  it('rejects route-specific keyset fields', () => {
    const token = encodeContinuationToken({
      tool: 'get_receipts',
      effectiveFilters: filters,
      cursor: { kind: 'keyset', values: { last_index: 2, last_disbursement_amount: 900 } },
    });
    expect(() => decodeContinuationToken({
      token,
      tool: 'get_receipts',
      effectiveFilters: filters,
      cursorKind: 'keyset',
      allowedKeysetKeys: ['last_index', 'last_contribution_receipt_amount'],
    })).toThrow();
  });

  it('rejects invalid token versions and oversized tokens', () => {
    const validToken = encodeContinuationToken({
      tool: 'search_candidates', effectiveFilters: filters,
      cursor: { kind: 'page', page: 2 },
    });
    const encodedPayload = validToken.slice('fecp1.'.length);
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    const token = `fecp1.${Buffer.from(JSON.stringify({ ...payload, v: 2 })).toString('base64url')}`;
    expect(() => decodeContinuationToken({
      token, tool: 'search_candidates', effectiveFilters: filters, cursorKind: 'page',
    })).toThrow();
    expect(() => decodeContinuationToken({
      token: `fecp1.${'a'.repeat(2048)}`,
      tool: 'search_candidates',
      effectiveFilters: filters,
      cursorKind: 'page',
    })).toThrow();
  });

  it('rejects non-scalar keyset values', () => {
    expect(() => encodeContinuationToken({
      tool: 'get_receipts',
      effectiveFilters: filters,
      cursor: {
        kind: 'keyset',
        values: { last_index: 1, last_contribution_receipt_amount: {} } as any,
      },
    })).toThrow();
  });

  it('traverses two fixed candidate pages without gaps or duplicates', async () => {
    const client = new FECClient({ apiKey: 'test-key' });
    const spy = vi.spyOn(client, 'searchCandidates')
      .mockResolvedValueOnce({ api_version: '1', pagination: { count: 3, page: 1, pages: 2, per_page: 2 }, results: [candidate('A', 'ALICE'), candidate('B', 'BOB')] })
      .mockResolvedValueOnce({ api_version: '1', pagination: { count: 3, page: 2, pages: 2, per_page: 2 }, results: [candidate('C', 'CAROL')] });
    const first = await executeSearchCandidates(client, { ...filters } as any);
    const continuation = first.content[0].text.match(/Continuation: (\{"continuation":"[^"]+"\})/)?.[1];
    const second = await executeSearchCandidates(client, { ...filters, continuation: continuation ? JSON.parse(continuation).continuation : undefined } as any);
    const text = `${first.content[0].text}\n${second.content[0].text}`;
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2 }));
    expect(text.indexOf('ALICE')).toBeLessThan(text.indexOf('BOB'));
    expect(text.indexOf('BOB')).toBeLessThan(text.indexOf('CAROL'));
    expect((text.match(/Candidate ID/g) ?? []).length).toBe(3);
  });

  it('traverses two fixed keyset pages and clears the empty terminal cursor', async () => {
    const client = new FECClient({ apiKey: 'test-key' });
    const spy = vi.spyOn(client, 'getScheduleA')
      .mockResolvedValueOnce({ api_version: '1', pagination: { count: 3, per_page: 2, pages: 0, last_indexes: { last_index: 2, last_contribution_receipt_amount: 900 }, is_count_exact: true }, results: [receipt('A', 1000), receipt('B', 900)] })
      .mockResolvedValueOnce({ api_version: '1', pagination: { count: 3, per_page: 2, pages: 0, last_indexes: { last_index: 3, last_contribution_receipt_amount: 800 }, is_count_exact: true }, results: [receipt('C', 800)] })
      .mockResolvedValueOnce({ api_version: '1', pagination: { count: 3, per_page: 2, pages: 0, last_indexes: null, is_count_exact: true }, results: [] });
    const first = await executeGetReceipts(client, { committee_id: 'C00000001' } as any);
    const firstContinuation = first.content[0].text.match(/Continuation: (\{"continuation":"[^"]+"\})/)?.[1];
    const second = await executeGetReceipts(client, { committee_id: 'C00000001', continuation: firstContinuation ? JSON.parse(firstContinuation).continuation : undefined } as any);
    const secondContinuation = second.content[0].text.match(/Continuation: (\{"continuation":"[^"]+"\})/)?.[1];
    const terminal = await executeGetReceipts(client, { committee_id: 'C00000001', continuation: secondContinuation ? JSON.parse(secondContinuation).continuation : undefined } as any);
    const text = `${first.content[0].text}\n${second.content[0].text}`;
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenNthCalledWith(2, expect.objectContaining({
      cursor: {
        last_index: 2,
        last_contribution_receipt_amount: 900,
      },
    }));
    expect(spy).toHaveBeenNthCalledWith(3, expect.objectContaining({
      cursor: {
        last_index: 3,
        last_contribution_receipt_amount: 800,
      },
    }));
    expect(text.match(/DONOR [ABC]/g)).toEqual(['DONOR A', 'DONOR B', 'DONOR C']);
    expect(terminal.content[0].text).toContain('Records shown: 0');
    expect(terminal.content[0].text).toContain('Continuation: none');
  });

  it.each([
    [{ count: 3, is_count_exact: true }, 'exact (3 records)'],
    [{ count: 3, is_count_exact: false }, 'approximate (3 reported records)'],
    [{ count: null, is_count_exact: undefined }, 'unspecified'],
  ])('prints %s count footer', async (pagination, footer) => {
    const client = new FECClient({ apiKey: 'test-key' });
    vi.spyOn(client, 'searchCandidates').mockResolvedValue({
      api_version: '1', pagination: { page: 1, pages: 1, per_page: 20, ...pagination }, results: [candidate('A', 'ALICE')],
    } as any);
    const result = await executeSearchCandidates(client, { q: 'A' } as any);
    expect(result.content[0].text.toLowerCase()).toContain(footer);
  });

  it('prints source IDs and upstream-only URLs without leaking the API key', async () => {
    const client = new FECClient({ apiKey: 'secret-key' });
    vi.spyOn(client, 'getScheduleA').mockResolvedValue({
      api_version: '1',
      pagination: { count: 1, per_page: 20, pages: 1, last_indexes: null },
      results: [{ ...receipt('source-sub-id', 1000), transaction_id: 'source-transaction-id', file_number: 123, pdf_url: 'https://docquery.fec.gov/pdf/source.pdf' }],
    } as any);
    const result = await executeGetReceipts(client, { committee_id: 'C00000001' } as any);
    expect(result.content[0].text).toContain('source-sub-id');
    expect(result.content[0].text).toContain('source-transaction-id');
    expect(result.content[0].text).toContain('123');
    expect(result.content[0].text).toContain('https://docquery.fec.gov/pdf/source.pdf');
    expect(result.content[0].text).not.toContain('secret-key');
  });
});

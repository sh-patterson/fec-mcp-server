/**
 * FEC API Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FECClient } from '../../src/api/client.js';
import { FECApiError, RateLimitError } from '../../src/utils/errors.js';
import {
  mockCandidateSearchResponse,
  mockEmptyCandidateSearchResponse,
  mockCommitteeReportsResponse,
  mockScheduleAResponse,
  mockScheduleBResponse,
  createMockResponse,
} from '../mocks/fec-responses.js';

function getCalledUrl(fetchCallArg: unknown): string {
  if (fetchCallArg instanceof URL) {
    return fetchCallArg.toString();
  }
  return String(fetchCallArg);
}

describe('FECClient', () => {
  let client: FECClient;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    client = new FECClient({ apiKey: mockApiKey });
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create client with required apiKey', () => {
      const client = new FECClient({ apiKey: 'my-key' });
      expect(client).toBeDefined();
    });

    it('should use default base URL if not provided', () => {
      const client = new FECClient({ apiKey: 'my-key' });
      expect(client.getBaseUrl()).toBe('https://api.open.fec.gov/v1');
    });

    it('should use custom base URL if provided', () => {
      const client = new FECClient({
        apiKey: 'my-key',
        baseUrl: 'https://custom.api.com/v1',
      });
      expect(client.getBaseUrl()).toBe('https://custom.api.com/v1');
    });
  });

  describe('get', () => {
    it('should include api_key in request URL', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(mockCandidateSearchResponse)
      );

      await client.get('/candidates/search/', { q: 'test' });

      expect(fetchSpy).toHaveBeenCalled();
      const calledUrl = getCalledUrl(fetchSpy.mock.calls[0][0]);
      expect(calledUrl).toContain(`api_key=${mockApiKey}`);
    });

    it('should include query parameters in URL', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(mockCandidateSearchResponse)
      );

      await client.get('/candidates/search/', {
        q: 'Smith',
        election_year: 2024,
      });

      const calledUrl = getCalledUrl(fetchSpy.mock.calls[0][0]);
      expect(calledUrl).toContain('q=Smith');
      expect(calledUrl).toContain('election_year=2024');
    });

    it('should handle 404 errors', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse({ error: 'Not found' }, 404)
      );

      await expect(client.get('/committee/C99999999/')).rejects.toThrow();
    });

    it('should handle 429 rate limit errors', async () => {
      const response = createMockResponse({ error: 'Rate limit exceeded' }, 429);
      (response as Response).headers = new Headers({ 'Retry-After': '15' });
      vi.spyOn(global, 'fetch').mockResolvedValue(response);

      try {
        await client.get('/candidates/search/');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).retryAfter).toBe(15);
      }
    });

    it('should handle network errors', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      await expect(client.get('/candidates/search/')).rejects.toThrow(FECApiError);
    });

    it('should sanitize API key from fetch error messages', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(
        new Error(`request failed for https://example.com?api_key=${mockApiKey}`)
      );

      try {
        await client.get('/candidates/search/');
      } catch (error) {
        expect(error).toBeInstanceOf(FECApiError);
        const message = (error as FECApiError).message;
        expect(message).toContain('[REDACTED]');
        expect(message).not.toContain(mockApiKey);
      }
    });

    it('should sanitize API key from non-OK response text', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(
          { error: `https://api.open.fec.gov/v1/?api_key=${mockApiKey}` },
          400
        )
      );

      try {
        await client.get('/candidates/search/');
      } catch (error) {
        expect(error).toBeInstanceOf(FECApiError);
        const message = (error as FECApiError).message;
        expect(message).toContain('[REDACTED]');
        expect(message).not.toContain(mockApiKey);
      }
    });

    it('should fail lazily when API key is not configured', async () => {
      const clientWithoutApiKey = new FECClient({});
      const fetchSpy = vi.spyOn(global, 'fetch');

      await expect(clientWithoutApiKey.get('/candidates/search/')).rejects.toThrow(
        'FEC API key is not configured'
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('searchCandidates', () => {
    it('should return candidates matching search query', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(mockCandidateSearchResponse)
      );

      const result = await client.searchCandidates({ q: 'Swalwell' });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].name).toBe('SWALWELL, ERIC MICHAEL');
      expect(result.results[0].candidate_id).toBe('H2CA15103');
    });

    it('should return empty results when no candidates found', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(mockEmptyCandidateSearchResponse)
      );

      const result = await client.searchCandidates({ q: 'ZZZZNOTFOUND' });

      expect(result.results).toHaveLength(0);
    });

    it('should filter by election_year when provided', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(mockCandidateSearchResponse)
      );

      await client.searchCandidates({ q: 'Swalwell', election_year: 2024 });

      const calledUrl = getCalledUrl(fetchSpy.mock.calls[0][0]);
      expect(calledUrl).toContain('election_year=2024');
    });

    it('should filter by office when provided', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(mockCandidateSearchResponse)
      );

      await client.searchCandidates({ q: 'Smith', office: 'H' });

      const calledUrl = getCalledUrl(fetchSpy.mock.calls[0][0]);
      expect(calledUrl).toContain('office=H');
    });

    it('should include principal_committees in response', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(mockCandidateSearchResponse)
      );

      const result = await client.searchCandidates({ q: 'Swalwell' });

      expect(result.results[0].principal_committees).toBeDefined();
      expect(result.results[0].principal_committees[0].committee_id).toBe('C00523969');
    });
  });

  describe('getCommitteeReports', () => {
    it('should return committee financial reports', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(mockCommitteeReportsResponse)
      );

      const result = await client.getCommitteeReports('C00523969');

      expect(result.results).toHaveLength(1);
      expect(result.results[0].committee_id).toBe('C00523969');
      expect(result.results[0].total_receipts_period).toBe(500000);
    });

    it('should sort by coverage_end_date descending', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(mockCommitteeReportsResponse)
      );

      await client.getCommitteeReports('C00523969');

      const calledUrl = getCalledUrl(fetchSpy.mock.calls[0][0]);
      expect(calledUrl).toContain('sort=-coverage_end_date');
    });

    it('should filter by cycle when provided', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(mockCommitteeReportsResponse)
      );

      await client.getCommitteeReports('C00523969', { cycle: 2024 });

      const calledUrl = getCalledUrl(fetchSpy.mock.calls[0][0]);
      expect(calledUrl).toContain('cycle=2024');
    });
  });

  describe('getScheduleA', () => {
    it('should return itemized receipts', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(mockScheduleAResponse)
      );

      const result = await client.getScheduleA({ committee_id: 'C00523969' });

      expect(result.results).toHaveLength(3);
      expect(result.results[0].contributor_name).toBe('SMITH, JOHN');
    });

    it('should filter by min_amount', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(mockScheduleAResponse)
      );

      await client.getScheduleA({ committee_id: 'C00523969', min_amount: 2000 });

      const calledUrl = getCalledUrl(fetchSpy.mock.calls[0][0]);
      expect(calledUrl).toContain('min_amount=2000');
    });

    it('should sort by contribution_receipt_amount descending by default', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(mockScheduleAResponse)
      );

      await client.getScheduleA({ committee_id: 'C00523969' });

      const calledUrl = getCalledUrl(fetchSpy.mock.calls[0][0]);
      expect(calledUrl).toContain('sort=-contribution_receipt_amount');
    });

    it('should sort by date when specified', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(mockScheduleAResponse)
      );

      await client.getScheduleA({ committee_id: 'C00523969', sort_by: 'date' });

      const calledUrl = getCalledUrl(fetchSpy.mock.calls[0][0]);
      expect(calledUrl).toContain('sort=-contribution_receipt_date');
    });

    it('should filter by is_individual for individual contributors', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(mockScheduleAResponse)
      );

      await client.getScheduleA({
        committee_id: 'C00523969',
        contributor_type: 'individual',
      });

      const calledUrl = getCalledUrl(fetchSpy.mock.calls[0][0]);
      expect(calledUrl).toContain('is_individual=true');
    });
  });

  describe('getScheduleB', () => {
    it('should return itemized disbursements', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(mockScheduleBResponse)
      );

      const result = await client.getScheduleB({ committee_id: 'C00523969' });

      expect(result.results).toHaveLength(3);
      expect(result.results[0].recipient_name).toBe('MEDIA BUYING AGENCY LLC');
    });

    it('should filter by min_amount', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(mockScheduleBResponse)
      );

      await client.getScheduleB({ committee_id: 'C00523969', min_amount: 10000 });

      const calledUrl = getCalledUrl(fetchSpy.mock.calls[0][0]);
      expect(calledUrl).toContain('min_amount=10000');
    });

    it('should sort by disbursement_amount descending by default', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(mockScheduleBResponse)
      );

      await client.getScheduleB({ committee_id: 'C00523969' });

      const calledUrl = getCalledUrl(fetchSpy.mock.calls[0][0]);
      expect(calledUrl).toContain('sort=-disbursement_amount');
    });

    it('should filter by disbursement_description when purpose provided', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        createMockResponse(mockScheduleBResponse)
      );

      await client.getScheduleB({ committee_id: 'C00523969', purpose: 'MEDIA' });

      const calledUrl = getCalledUrl(fetchSpy.mock.calls[0][0]);
      expect(calledUrl).toContain('disbursement_description=MEDIA');
    });
  });
});

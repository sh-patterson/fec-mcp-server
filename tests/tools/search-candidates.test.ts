/**
 * search_candidates Tool Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSearchCandidates } from '../../src/tools/search-candidates.js';
import { FECClient } from '../../src/api/client.js';
import {
  mockCandidateSearchResponse,
  mockEmptyCandidateSearchResponse,
} from '../mocks/fec-responses.js';

describe('search_candidates tool', () => {
  let mockClient: FECClient;

  beforeEach(() => {
    mockClient = new FECClient({ apiKey: 'test-key' });
  });

  it('should return formatted candidate results', async () => {
    vi.spyOn(mockClient, 'searchCandidates').mockResolvedValue(
      mockCandidateSearchResponse
    );

    const result = await executeSearchCandidates(mockClient, { q: 'Swalwell' });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('SWALWELL, ERIC MICHAEL');
    expect(result.content[0].text).toContain('H2CA15103');
    expect(result.content[0].text).toContain('C00523969');
  });

  it('should include party and office information', async () => {
    vi.spyOn(mockClient, 'searchCandidates').mockResolvedValue(
      mockCandidateSearchResponse
    );

    const result = await executeSearchCandidates(mockClient, { q: 'Swalwell' });

    expect(result.content[0].text).toContain('Democratic Party');
    expect(result.content[0].text).toContain('House');
  });

  it('should include principal committee ID', async () => {
    vi.spyOn(mockClient, 'searchCandidates').mockResolvedValue(
      mockCandidateSearchResponse
    );

    const result = await executeSearchCandidates(mockClient, { q: 'Swalwell' });

    expect(result.content[0].text).toContain('Committee ID');
    expect(result.content[0].text).toContain('C00523969');
  });

  it('should handle no results found', async () => {
    vi.spyOn(mockClient, 'searchCandidates').mockResolvedValue(
      mockEmptyCandidateSearchResponse
    );

    const result = await executeSearchCandidates(mockClient, {
      q: 'ZZZZNOTFOUND',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('No candidates found');
  });

  it('should handle API errors gracefully', async () => {
    vi.spyOn(mockClient, 'searchCandidates').mockRejectedValue(
      new Error('Network error')
    );

    const result = await executeSearchCandidates(mockClient, { q: 'Test' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error');
  });

  it('should pass election_year filter to API', async () => {
    const spy = vi.spyOn(mockClient, 'searchCandidates').mockResolvedValue(
      mockCandidateSearchResponse
    );

    await executeSearchCandidates(mockClient, {
      q: 'Smith',
      election_year: 2024,
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ election_year: 2024 })
    );
  });

  it('should pass office filter to API', async () => {
    const spy = vi.spyOn(mockClient, 'searchCandidates').mockResolvedValue(
      mockCandidateSearchResponse
    );

    await executeSearchCandidates(mockClient, { q: 'Smith', office: 'S' });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ office: 'S' }));
  });
});

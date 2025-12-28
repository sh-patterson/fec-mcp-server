/**
 * get_receipts Tool Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeGetReceipts } from '../../src/tools/get-receipts.js';
import { FECClient } from '../../src/api/client.js';
import { mockScheduleAResponse } from '../mocks/fec-responses.js';
import type { FECApiResponse, FECScheduleA } from '../../src/api/types.js';

describe('get_receipts tool', () => {
  let mockClient: FECClient;

  beforeEach(() => {
    mockClient = new FECClient({ apiKey: 'test-key' });
  });

  it('should return formatted receipts', async () => {
    vi.spyOn(mockClient, 'getScheduleA').mockResolvedValue(mockScheduleAResponse);

    const result = await executeGetReceipts(mockClient, {
      committee_id: 'C00523969',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('SMITH, JOHN');
    expect(result.content[0].text).toContain('$2,900');
  });

  it('should include contributor employer and occupation', async () => {
    vi.spyOn(mockClient, 'getScheduleA').mockResolvedValue(mockScheduleAResponse);

    const result = await executeGetReceipts(mockClient, {
      committee_id: 'C00523969',
    });

    expect(result.content[0].text).toContain('TECH COMPANY INC');
    expect(result.content[0].text).toContain('SOFTWARE ENGINEER');
  });

  it('should show PAC contributions', async () => {
    vi.spyOn(mockClient, 'getScheduleA').mockResolvedValue(mockScheduleAResponse);

    const result = await executeGetReceipts(mockClient, {
      committee_id: 'C00523969',
    });

    expect(result.content[0].text).toContain('CALIFORNIA TEACHERS PAC');
    expect(result.content[0].text).toContain('$5,000');
  });

  it('should handle empty results', async () => {
    const emptyResponse: FECApiResponse<FECScheduleA> = {
      api_version: '1.0',
      pagination: {
        count: 0,
        per_page: 20,
        pages: 0,
        last_indexes: null,
      },
      results: [],
    };
    vi.spyOn(mockClient, 'getScheduleA').mockResolvedValue(emptyResponse);

    const result = await executeGetReceipts(mockClient, {
      committee_id: 'C00523969',
      min_amount: 100000,
    });

    expect(result.content[0].text).toContain('No contributions found');
  });

  it('should pass min_amount filter', async () => {
    const spy = vi.spyOn(mockClient, 'getScheduleA').mockResolvedValue(
      mockScheduleAResponse
    );

    await executeGetReceipts(mockClient, {
      committee_id: 'C00523969',
      min_amount: 2000,
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ min_amount: 2000 })
    );
  });

  it('should pass contributor_type filter', async () => {
    const spy = vi.spyOn(mockClient, 'getScheduleA').mockResolvedValue(
      mockScheduleAResponse
    );

    await executeGetReceipts(mockClient, {
      committee_id: 'C00523969',
      contributor_type: 'individual',
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ contributor_type: 'individual' })
    );
  });

  it('should default to sorting by amount', async () => {
    const spy = vi.spyOn(mockClient, 'getScheduleA').mockResolvedValue(
      mockScheduleAResponse
    );

    await executeGetReceipts(mockClient, {
      committee_id: 'C00523969',
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ sort_by: 'amount' })
    );
  });

  it('should handle API errors gracefully', async () => {
    vi.spyOn(mockClient, 'getScheduleA').mockRejectedValue(
      new Error('API error')
    );

    const result = await executeGetReceipts(mockClient, {
      committee_id: 'C00523969',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error');
  });
});

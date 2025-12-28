/**
 * get_disbursements Tool Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeGetDisbursements } from '../../src/tools/get-disbursements.js';
import { FECClient } from '../../src/api/client.js';
import { mockScheduleBResponse } from '../mocks/fec-responses.js';
import type { FECApiResponse, FECScheduleB } from '../../src/api/types.js';

describe('get_disbursements tool', () => {
  let mockClient: FECClient;

  beforeEach(() => {
    mockClient = new FECClient({ apiKey: 'test-key' });
  });

  it('should return formatted disbursements', async () => {
    vi.spyOn(mockClient, 'getScheduleB').mockResolvedValue(mockScheduleBResponse);

    const result = await executeGetDisbursements(mockClient, {
      committee_id: 'C00523969',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('MEDIA BUYING AGENCY LLC');
    expect(result.content[0].text).toContain('$150,000');
  });

  it('should include disbursement purpose', async () => {
    vi.spyOn(mockClient, 'getScheduleB').mockResolvedValue(mockScheduleBResponse);

    const result = await executeGetDisbursements(mockClient, {
      committee_id: 'C00523969',
    });

    expect(result.content[0].text).toContain('MEDIA PLACEMENT');
    expect(result.content[0].text).toContain('POLLING SERVICES');
  });

  it('should include purpose category', async () => {
    vi.spyOn(mockClient, 'getScheduleB').mockResolvedValue(mockScheduleBResponse);

    const result = await executeGetDisbursements(mockClient, {
      committee_id: 'C00523969',
    });

    expect(result.content[0].text).toContain('ADVERTISING');
    expect(result.content[0].text).toContain('POLLING');
  });

  it('should handle empty results', async () => {
    const emptyResponse: FECApiResponse<FECScheduleB> = {
      api_version: '1.0',
      pagination: {
        count: 0,
        per_page: 20,
        pages: 0,
        last_indexes: null,
      },
      results: [],
    };
    vi.spyOn(mockClient, 'getScheduleB').mockResolvedValue(emptyResponse);

    const result = await executeGetDisbursements(mockClient, {
      committee_id: 'C00523969',
      min_amount: 1000000,
    });

    expect(result.content[0].text).toContain('No disbursements found');
  });

  it('should pass min_amount filter', async () => {
    const spy = vi.spyOn(mockClient, 'getScheduleB').mockResolvedValue(
      mockScheduleBResponse
    );

    await executeGetDisbursements(mockClient, {
      committee_id: 'C00523969',
      min_amount: 10000,
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ min_amount: 10000 })
    );
  });

  it('should pass purpose filter', async () => {
    const spy = vi.spyOn(mockClient, 'getScheduleB').mockResolvedValue(
      mockScheduleBResponse
    );

    await executeGetDisbursements(mockClient, {
      committee_id: 'C00523969',
      purpose: 'MEDIA',
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'MEDIA' })
    );
  });

  it('should default to sorting by amount', async () => {
    const spy = vi.spyOn(mockClient, 'getScheduleB').mockResolvedValue(
      mockScheduleBResponse
    );

    await executeGetDisbursements(mockClient, {
      committee_id: 'C00523969',
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ sort_by: 'amount' })
    );
  });

  it('should handle API errors gracefully', async () => {
    vi.spyOn(mockClient, 'getScheduleB').mockRejectedValue(
      new Error('API error')
    );

    const result = await executeGetDisbursements(mockClient, {
      committee_id: 'C00523969',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error');
  });
});

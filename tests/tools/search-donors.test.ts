/**
 * search_donors Tool Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FECClient } from '../../src/api/client.js';
import { executeSearchDonors } from '../../src/tools/search-donors.js';
import { mockScheduleAResponse } from '../mocks/fec-responses.js';

describe('search_donors tool', () => {
  let mockClient: FECClient;

  beforeEach(() => {
    mockClient = new FECClient({ apiKey: 'test-key' });
  });

  it('should return grouped donor search results with filters', async () => {
    vi.spyOn(mockClient, 'searchDonors').mockResolvedValue(mockScheduleAResponse);

    const result = await executeSearchDonors(mockClient, {
      contributor_name: 'Smith',
      min_amount: 500,
      cycle: 2024,
      limit: 10,
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Donor Search Results');
    expect(result.content[0].text).toContain('name: "Smith"');
    expect(result.content[0].text).toContain('minimum: $500');
    expect(result.content[0].text).toContain('cycle: 2024');
    expect(result.content[0].text).toContain('SWALWELL FOR CONGRESS');
  });

  it('should pass the search parameters through to the client', async () => {
    const spy = vi
      .spyOn(mockClient, 'searchDonors')
      .mockResolvedValue(mockScheduleAResponse);

    await executeSearchDonors(mockClient, {
      contributor_employer: 'TECH COMPANY INC',
      contributor_state: 'CA',
      cycle: 2024,
      limit: 5,
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        contributor_employer: 'TECH COMPANY INC',
        contributor_state: 'CA',
        two_year_transaction_period: 2024,
        limit: 5,
      }),
      60000
    );
  });

  it('should handle API errors gracefully', async () => {
    vi.spyOn(mockClient, 'searchDonors').mockRejectedValue(new Error('API error'));

    const result = await executeSearchDonors(mockClient, {
      contributor_name: 'Smith',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error');
  });
});

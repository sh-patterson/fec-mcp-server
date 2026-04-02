/**
 * search_spending Tool Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FECClient } from '../../src/api/client.js';
import { executeSearchSpending } from '../../src/tools/search-spending.js';
import { mockScheduleBResponse } from '../mocks/fec-responses.js';

describe('search_spending tool', () => {
  let mockClient: FECClient;

  beforeEach(() => {
    mockClient = new FECClient({ apiKey: 'test-key' });
  });

  it('should return grouped spending search results with filters', async () => {
    vi.spyOn(mockClient, 'searchSpending').mockResolvedValue(mockScheduleBResponse);

    const result = await executeSearchSpending(mockClient, {
      description: 'MEDIA',
      min_amount: 1000,
      cycle: 2024,
      limit: 10,
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Spending Search Results');
    expect(result.content[0].text).toContain('description: "MEDIA"');
    expect(result.content[0].text).toContain('minimum: $1,000');
    expect(result.content[0].text).toContain('cycle: 2024');
    expect(result.content[0].text).toContain('SWALWELL FOR CONGRESS');
  });

  it('should pass the search parameters through to the client', async () => {
    const spy = vi
      .spyOn(mockClient, 'searchSpending')
      .mockResolvedValue(mockScheduleBResponse);

    await executeSearchSpending(mockClient, {
      recipient_name: 'MEDIA BUYING AGENCY LLC',
      recipient_state: 'DC',
      cycle: 2024,
      limit: 5,
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient_name: 'MEDIA BUYING AGENCY LLC',
        recipient_state: 'DC',
        two_year_transaction_period: 2024,
        limit: 5,
      }),
      60000
    );
  });

  it('should handle API errors gracefully', async () => {
    vi.spyOn(mockClient, 'searchSpending').mockRejectedValue(new Error('API error'));

    const result = await executeSearchSpending(mockClient, {
      description: 'MEDIA',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error');
  });
});

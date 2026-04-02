/**
 * get_independent_expenditures Tool Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FECClient } from '../../src/api/client.js';
import { executeGetIndependentExpenditures } from '../../src/tools/get-independent-expenditures.js';
import type { FECApiResponse, FECScheduleE } from '../../src/api/types.js';

const mockScheduleEResponse: FECApiResponse<FECScheduleE> = {
  api_version: '1.0',
  pagination: {
    count: 2,
    page: 1,
    pages: 1,
    per_page: 20,
  },
  results: [
    {
      committee_id: 'C90000001',
      committee_name: 'UNITED FOR CHANGE PAC',
      spender_name: 'UNITED FOR CHANGE PAC',
      spender_committee_type: 'O',
      candidate_id: 'H8CA15053',
      candidate_name: 'SWALWELL, ERIC MICHAEL',
      candidate_party: 'DEM',
      candidate_office: 'H',
      candidate_office_state: 'CA',
      candidate_office_district: '15',
      support_oppose_indicator: 'S',
      expenditure_amount: 125000,
      expenditure_date: '2024-09-20',
      expenditure_description: 'DIGITAL AD BUY',
      payee_name: 'MEDIA AGENCY LLC',
      payee_city: 'WASHINGTON',
      payee_state: 'DC',
      filing_date: '2024-09-21',
      two_year_transaction_period: 2024,
    },
    {
      committee_id: 'C90000002',
      committee_name: 'ACCOUNTABILITY NOW',
      spender_name: 'ACCOUNTABILITY NOW',
      spender_committee_type: 'O',
      candidate_id: 'H8CA15053',
      candidate_name: 'SWALWELL, ERIC MICHAEL',
      candidate_party: 'DEM',
      candidate_office: 'H',
      candidate_office_state: 'CA',
      candidate_office_district: '15',
      support_oppose_indicator: 'O',
      expenditure_amount: 64000,
      expenditure_date: '2024-09-18',
      expenditure_description: 'MAIL PROGRAM',
      payee_name: 'MAIL SHOP INC',
      payee_city: 'CHICAGO',
      payee_state: 'IL',
      filing_date: '2024-09-19',
      two_year_transaction_period: 2024,
    },
  ],
};

describe('get_independent_expenditures tool', () => {
  let mockClient: FECClient;

  beforeEach(() => {
    mockClient = new FECClient({ apiKey: 'test-key' });
  });

  it('should return formatted independent expenditures', async () => {
    vi.spyOn(mockClient, 'getScheduleE').mockResolvedValue(mockScheduleEResponse);

    const result = await executeGetIndependentExpenditures(mockClient, {
      candidate_id: 'H8CA15053',
      limit: 10,
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Independent Expenditures');
    expect(result.content[0].text).toContain('SWALWELL, ERIC MICHAEL');
    expect(result.content[0].text).toContain('UNITED FOR CHANGE PAC');
  });

  it('should pass support_oppose and cycle filters to the client', async () => {
    const spy = vi
      .spyOn(mockClient, 'getScheduleE')
      .mockResolvedValue(mockScheduleEResponse);

    await executeGetIndependentExpenditures(mockClient, {
      candidate_id: 'H8CA15053',
      support_oppose: 'support',
      cycle: 2024,
      limit: 5,
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        candidate_id: 'H8CA15053',
        support_oppose_indicator: 'S',
        two_year_transaction_period: 2024,
        limit: 5,
      })
    );
  });

  it('should handle API errors gracefully', async () => {
    vi.spyOn(mockClient, 'getScheduleE').mockRejectedValue(new Error('API error'));

    const result = await executeGetIndependentExpenditures(mockClient, {
      candidate_id: 'H8CA15053',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error');
  });
});

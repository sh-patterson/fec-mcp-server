/**
 * get_committee_finances Tool Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeGetCommitteeFinances } from '../../src/tools/get-committee-finances.js';
import { FECClient } from '../../src/api/client.js';
import {
  mockCommitteeReportsResponse,
  mockZeroReceiptsReportResponse,
} from '../mocks/fec-responses.js';
import type { FECApiResponse, FECCommitteeReport, FECScheduleC, FECScheduleD } from '../../src/api/types.js';

// Empty mock responses for loans and debts (most committees have none)
const emptyLoansResponse: FECApiResponse<FECScheduleC> = {
  api_version: '1.0',
  pagination: { count: 0, page: 1, pages: 0, per_page: 20 },
  results: [],
};

const emptyDebtsResponse: FECApiResponse<FECScheduleD> = {
  api_version: '1.0',
  pagination: { count: 0, page: 1, pages: 0, per_page: 20 },
  results: [],
};

describe('get_committee_finances tool', () => {
  let mockClient: FECClient;

  beforeEach(() => {
    mockClient = new FECClient({ apiKey: 'test-key' });
    // Default mocks for loans and debts (empty results)
    vi.spyOn(mockClient, 'getScheduleC').mockResolvedValue(emptyLoansResponse);
    vi.spyOn(mockClient, 'getScheduleD').mockResolvedValue(emptyDebtsResponse);
  });

  it('should return formatted financial summary', async () => {
    vi.spyOn(mockClient, 'getCommitteeReports').mockResolvedValue(
      mockCommitteeReportsResponse
    );

    const result = await executeGetCommitteeFinances(mockClient, {
      committee_id: 'C00523969',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('SWALWELL FOR CONGRESS');
    expect(result.content[0].text).toContain('$500,000');
    expect(result.content[0].text).toContain('$350,000');
  });

  it('should include cash on hand', async () => {
    vi.spyOn(mockClient, 'getCommitteeReports').mockResolvedValue(
      mockCommitteeReportsResponse
    );

    const result = await executeGetCommitteeFinances(mockClient, {
      committee_id: 'C00523969',
    });

    expect(result.content[0].text).toContain('Cash on Hand');
    expect(result.content[0].text).toContain('$750,000');
  });

  it('should calculate and display burn rate', async () => {
    vi.spyOn(mockClient, 'getCommitteeReports').mockResolvedValue(
      mockCommitteeReportsResponse
    );

    const result = await executeGetCommitteeFinances(mockClient, {
      committee_id: 'C00523969',
    });

    // Burn rate = 350000 / 500000 = 0.7
    expect(result.content[0].text).toContain('Burn Rate');
    expect(result.content[0].text).toContain('0.70');
  });

  it('should handle zero receipts gracefully (no division by zero)', async () => {
    vi.spyOn(mockClient, 'getCommitteeReports').mockResolvedValue(
      mockZeroReceiptsReportResponse
    );

    const result = await executeGetCommitteeFinances(mockClient, {
      committee_id: 'C00523969',
    });

    // Should not crash and should handle null burn rate
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).not.toContain('NaN');
    expect(result.content[0].text).not.toContain('Infinity');
  });

  it('should handle committee not found', async () => {
    const emptyResponse: FECApiResponse<FECCommitteeReport> = {
      api_version: '1.0',
      pagination: { count: 0, page: 1, pages: 0, per_page: 20 },
      results: [],
    };
    vi.spyOn(mockClient, 'getCommitteeReports').mockResolvedValue(emptyResponse);

    const result = await executeGetCommitteeFinances(mockClient, {
      committee_id: 'C99999999',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  it('should include contribution breakdown', async () => {
    vi.spyOn(mockClient, 'getCommitteeReports').mockResolvedValue(
      mockCommitteeReportsResponse
    );

    const result = await executeGetCommitteeFinances(mockClient, {
      committee_id: 'C00523969',
    });

    expect(result.content[0].text).toContain('Individual Contributions');
    expect(result.content[0].text).toContain('PAC Contributions');
  });

  it('should pass cycle filter to API', async () => {
    const spy = vi.spyOn(mockClient, 'getCommitteeReports').mockResolvedValue(
      mockCommitteeReportsResponse
    );

    await executeGetCommitteeFinances(mockClient, {
      committee_id: 'C00523969',
      cycle: 2024,
    });

    expect(spy).toHaveBeenCalledWith(
      'C00523969',
      expect.objectContaining({ cycle: 2024 })
    );
  });

  it('should include loans when present', async () => {
    vi.spyOn(mockClient, 'getCommitteeReports').mockResolvedValue(
      mockCommitteeReportsResponse
    );

    const loansWithData: FECApiResponse<FECScheduleC> = {
      api_version: '1.0',
      pagination: { count: 1, page: 1, pages: 1, per_page: 20 },
      results: [
        {
          committee_id: 'C00523969',
          committee_name: 'SWALWELL FOR CONGRESS',
          loan_source_name: 'First National Bank',
          loan_source_city: 'Washington',
          loan_source_state: 'DC',
          original_loan_amount: 100000,
          loan_balance: 75000,
          payment_to_date: 25000,
          incurred_date: '2024-01-15',
          due_date: '2025-01-15',
          interest_rate: 5.5,
          secured: true,
          personally_funded: false,
          candidate_name: null,
          two_year_transaction_period: 2024,
        },
      ],
    };
    vi.spyOn(mockClient, 'getScheduleC').mockResolvedValue(loansWithData);

    const result = await executeGetCommitteeFinances(mockClient, {
      committee_id: 'C00523969',
    });

    expect(result.content[0].text).toContain('Loans');
    expect(result.content[0].text).toContain('First National Bank');
    expect(result.content[0].text).toContain('$100,000');
  });

  it('should include debts when present', async () => {
    vi.spyOn(mockClient, 'getCommitteeReports').mockResolvedValue(
      mockCommitteeReportsResponse
    );

    const debtsWithData: FECApiResponse<FECScheduleD> = {
      api_version: '1.0',
      pagination: { count: 1, page: 1, pages: 1, per_page: 20 },
      results: [
        {
          committee_id: 'C00523969',
          committee_name: 'SWALWELL FOR CONGRESS',
          creditor_debtor_name: 'ABC Consulting',
          creditor_debtor_city: 'San Francisco',
          creditor_debtor_state: 'CA',
          nature_of_debt: 'Consulting services',
          outstanding_balance_beginning_of_period: 50000,
          outstanding_balance_close_of_period: 35000,
          coverage_start_date: '2024-01-01',
          coverage_end_date: '2024-06-30',
          two_year_transaction_period: 2024,
        },
      ],
    };
    vi.spyOn(mockClient, 'getScheduleD').mockResolvedValue(debtsWithData);

    const result = await executeGetCommitteeFinances(mockClient, {
      committee_id: 'C00523969',
    });

    expect(result.content[0].text).toContain('Debts');
    expect(result.content[0].text).toContain('ABC Consulting');
    expect(result.content[0].text).toContain('Consulting services');
  });
});

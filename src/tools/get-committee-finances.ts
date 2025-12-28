/**
 * get_committee_finances MCP Tool
 * Retrieve financial summary for a campaign committee
 */

import type { FECClient } from '../api/client.js';
import type { EnhancedFinancialSummary } from '../api/types.js';
import { getCommitteeFinancesInputSchema } from '../schemas/finances.schema.js';
import { formatErrorForToolResponse, NotFoundError } from '../utils/errors.js';
import {
  transformCommitteeReport,
  transformLoans,
  transformDebts,
  formatEnhancedFinancialSummaryText,
} from '../utils/formatters.js';

export const GET_COMMITTEE_FINANCES_TOOL = {
  name: 'get_committee_finances',
  description: `Retrieve comprehensive financial summary for a campaign committee from official FEC filings. Returns total receipts, disbursements, cash on hand, debts, loans (including candidate loans), and calculates burn rate (spending/income ratio). Includes Schedule C loans and Schedule D debts for complete financial picture. Essential for understanding campaign financial health and transparency research.`,
  inputSchema: getCommitteeFinancesInputSchema,
};

export interface GetCommitteeFinancesResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export async function executeGetCommitteeFinances(
  client: FECClient,
  params: {
    committee_id: string;
    cycle?: number;
  }
): Promise<GetCommitteeFinancesResult> {
  try {
    // Fetch reports, loans, and debts in parallel
    const [reportsResponse, loansResponse, debtsResponse] = await Promise.all([
      client.getCommitteeReports(params.committee_id, {
        cycle: params.cycle,
      }),
      client.getScheduleC({
        committee_id: params.committee_id,
        two_year_transaction_period: params.cycle,
        limit: 20,
      }),
      client.getScheduleD({
        committee_id: params.committee_id,
        two_year_transaction_period: params.cycle,
        limit: 20,
      }),
    ]);

    if (reportsResponse.results.length === 0) {
      throw new NotFoundError('Committee reports', params.committee_id);
    }

    // Get the most recent report
    const report = reportsResponse.results[0];
    const baseSummary = transformCommitteeReport(report);

    // Transform loans and debts
    const loans = transformLoans(loansResponse.results);
    const debts = transformDebts(debtsResponse.results);

    // Calculate loan totals
    const totalLoans = loans.reduce((sum, loan) => sum + loan.amount, 0);
    const candidateLoans = loans
      .filter(loan => loan.is_candidate_loan)
      .reduce((sum, loan) => sum + loan.amount, 0);

    // Build enhanced summary
    const enhancedSummary: EnhancedFinancialSummary = {
      ...baseSummary,
      total_loans: totalLoans,
      candidate_loans: candidateLoans,
      loans,
      debts,
    };

    const formattedText = formatEnhancedFinancialSummaryText(enhancedSummary);

    return {
      content: [{ type: 'text', text: formattedText }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: formatErrorForToolResponse(error) }],
      isError: true,
    };
  }
}

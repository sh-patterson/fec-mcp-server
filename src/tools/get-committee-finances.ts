/**
 * get_committee_finances MCP Tool
 * Retrieve financial summary for a campaign committee
 */

import type { FECClient } from '../api/client.js';
import { getCommitteeFinancesInputSchema } from '../schemas/finances.schema.js';
import { formatErrorForToolResponse, NotFoundError } from '../utils/errors.js';
import {
  transformCommitteeFinancials,
  formatFinancialSummaryText,
} from '../utils/formatters.js';

export const GET_COMMITTEE_FINANCES_TOOL = {
  name: 'get_committee_finances',
  description: `Retrieve a committee financial summary from OpenFEC. Cycle totals come from the committee totals endpoint. Cash and debt balances come from the latest final report.`,
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
    const [totalsResponse, reportsResponse] = await Promise.all([
      client.getCommitteeTotals(params.committee_id, {
        cycle: params.cycle,
      }),
      client.getCommitteeReports(params.committee_id, {
        cycle: params.cycle,
      }),
    ]);

    if (totalsResponse.results.length === 0) {
      throw new NotFoundError('Committee financial records', params.committee_id);
    }

    const totals = totalsResponse.results[0];
    let report = reportsResponse.results.find((entry) => entry.cycle === totals.cycle);

    // When cycle is omitted, totals and reports can land on different cycles.
    // Re-fetch the final report for the totals cycle before mixing numbers.
    if (!report && params.cycle === undefined) {
      const cycleReports = await client.getCommitteeReports(params.committee_id, {
        cycle: totals.cycle,
      });
      report = cycleReports.results[0];
    }

    if (!report) {
      throw new NotFoundError('Committee financial records', params.committee_id);
    }

    const summary = transformCommitteeFinancials(totals, report);
    const formattedText = formatFinancialSummaryText(summary);

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

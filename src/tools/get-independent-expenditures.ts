/**
 * get_independent_expenditures MCP Tool
 * Retrieve independent expenditures (Schedule E) supporting or opposing candidates
 */

import type { FECClient } from '../api/client.js';
import { getIndependentExpendituresInputSchema } from '../schemas/independent-expenditures.schema.js';
import { formatErrorForToolResponse } from '../utils/errors.js';
import { formatIndependentExpenditureText } from '../utils/formatters.js';

export const GET_INDEPENDENT_EXPENDITURES_TOOL = {
  name: 'get_independent_expenditures',
  description: `Retrieve independent expenditures (Schedule E) - money spent by PACs and Super PACs to support or oppose candidates without coordinating with campaigns. Critical for understanding outside money influence in elections. Can filter by candidate targeted, committee spending, or support/oppose indicator.`,
  inputSchema: getIndependentExpendituresInputSchema,
};

export interface GetIndependentExpendituresResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export async function executeGetIndependentExpenditures(
  client: FECClient,
  params: {
    candidate_id?: string;
    committee_id?: string;
    support_oppose?: 'support' | 'oppose';
    min_amount?: number;
    cycle?: number;
    limit?: number;
  }
): Promise<GetIndependentExpendituresResult> {
  try {
    // At least one of candidate_id or committee_id should be provided
    if (!params.candidate_id && !params.committee_id) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Please provide either a candidate_id or committee_id to search for independent expenditures.',
          },
        ],
        isError: true,
      };
    }

    // Map support/oppose to FEC indicator
    let supportOpposeIndicator: 'S' | 'O' | undefined;
    if (params.support_oppose === 'support') {
      supportOpposeIndicator = 'S';
    } else if (params.support_oppose === 'oppose') {
      supportOpposeIndicator = 'O';
    }

    const response = await client.getScheduleE({
      candidate_id: params.candidate_id,
      committee_id: params.committee_id,
      support_oppose_indicator: supportOpposeIndicator,
      min_amount: params.min_amount,
      two_year_transaction_period: params.cycle,
      limit: params.limit ?? 20,
    });

    // Build header based on search type
    let targetCandidate: string | undefined;
    if (params.candidate_id && response.results.length > 0) {
      targetCandidate = response.results[0].candidate_name || params.candidate_id;
    }

    // Format response
    const lines: string[] = [];

    // Add context header
    if (params.candidate_id) {
      lines.push(`## Independent Expenditures Targeting ${targetCandidate || params.candidate_id}`);
    } else if (params.committee_id) {
      const committeeName = response.results[0]?.committee_name || params.committee_id;
      lines.push(`## Independent Expenditures by ${committeeName}`);
    }

    // Add filter info
    const filters: string[] = [];
    if (params.support_oppose) {
      filters.push(`${params.support_oppose} only`);
    }
    if (params.min_amount) {
      filters.push(`minimum $${params.min_amount.toLocaleString()}`);
    }
    if (params.cycle) {
      filters.push(`${params.cycle} cycle`);
    }

    if (filters.length > 0) {
      lines.push(`*Filters: ${filters.join(', ')}*`);
    }

    lines.push(`*Showing ${response.results.length} of ${response.pagination.count} results*`);
    lines.push('');

    // Format the expenditures
    const expendituresText = formatIndependentExpenditureText(response.results, targetCandidate);
    lines.push(expendituresText);

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: formatErrorForToolResponse(error) }],
      isError: true,
    };
  }
}

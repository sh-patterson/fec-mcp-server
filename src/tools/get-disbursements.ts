/**
 * get_disbursements MCP Tool
 * Retrieve itemized expenditures (Schedule B)
 */

import type { FECClient } from '../api/client.js';
import { getDisbursementsInputSchema } from '../schemas/disbursements.schema.js';
import { formatErrorForToolResponse } from '../utils/errors.js';
import { transformScheduleB, formatDisbursementsText } from '../utils/formatters.js';

export const GET_DISBURSEMENTS_TOOL = {
  name: 'get_disbursements',
  description: `Retrieve itemized expenditures (Schedule B) made by a campaign committee. Shows payment recipients, amounts, and stated purposes. Supports filtering by amount for researching significant spending patterns and campaign finance transparency.`,
  inputSchema: getDisbursementsInputSchema,
};

export interface GetDisbursementsResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export async function executeGetDisbursements(
  client: FECClient,
  params: {
    committee_id: string;
    min_amount?: number;
    two_year_transaction_period?: number;
    purpose?: string;
    limit?: number;
    sort_by?: 'amount' | 'date';
  }
): Promise<GetDisbursementsResult> {
  try {
    const response = await client.getScheduleB({
      committee_id: params.committee_id,
      min_amount: params.min_amount ?? 1000,
      two_year_transaction_period: params.two_year_transaction_period,
      purpose: params.purpose,
      limit: params.limit ?? 20,
      sort_by: params.sort_by ?? 'amount',
    });

    // Transform to formatted disbursements
    const disbursements = response.results.map(transformScheduleB);

    // Get committee name from first result if available
    const committeeName = response.results[0]?.committee_name;

    // Build response text
    const lines: string[] = [];

    if (committeeName) {
      lines.push(`## Disbursements by ${committeeName}`);
    } else {
      lines.push(`## Disbursements by ${params.committee_id}`);
    }

    // Add filter info
    const filters: string[] = [];
    if (params.min_amount) {
      filters.push(`minimum $${params.min_amount.toLocaleString()}`);
    }
    if (params.purpose) {
      filters.push(`purpose contains "${params.purpose}"`);
    }
    if (params.two_year_transaction_period) {
      filters.push(`${params.two_year_transaction_period} cycle`);
    }

    if (filters.length > 0) {
      lines.push(`*Filters: ${filters.join(', ')}*`);
    }

    lines.push(`*Showing ${disbursements.length} of ${response.pagination.count} results*`);
    lines.push('');

    // Format disbursements
    const disbursementsText = formatDisbursementsText(disbursements);
    lines.push(disbursementsText);

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

/**
 * search_spending MCP Tool
 * Search for campaign spending by description or recipient across all committees
 */

import type { FECClient } from '../api/client.js';
import { searchSpendingInputSchema } from '../schemas/search-spending.schema.js';
import { formatErrorForToolResponse } from '../utils/errors.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';

export const SEARCH_SPENDING_TOOL = {
  name: 'search_spending',
  description: `Search campaign spending (Schedule B) across all committees by description or recipient. Use to find questionable expenditures like "steak dinner", "event tickets", "travel", "Disney", "golf", or payments to specific vendors. Essential for identifying spending patterns and potential misuse of campaign funds.`,
  inputSchema: searchSpendingInputSchema,
};

export interface SearchSpendingResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export async function executeSearchSpending(
  client: FECClient,
  params: {
    description?: string;
    recipient_name?: string;
    recipient_state?: string;
    min_amount?: number;
    cycle?: number;
    limit?: number;
  }
): Promise<SearchSpendingResult> {
  try {
    // Require at least one search criterion
    if (!params.description && !params.recipient_name) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Please provide at least one search criterion: description or recipient_name.',
          },
        ],
        isError: true,
      };
    }

    const response = await client.searchSpending({
      description: params.description,
      recipient_name: params.recipient_name,
      recipient_state: params.recipient_state,
      min_amount: params.min_amount ?? 500, // Default to $500 to filter noise
      two_year_transaction_period: params.cycle,
      limit: params.limit ?? 20,
    });

    // Build header
    const lines: string[] = ['## Spending Search Results'];

    // Show search criteria
    const criteria: string[] = [];
    if (params.description) criteria.push(`description: "${params.description}"`);
    if (params.recipient_name) criteria.push(`recipient: "${params.recipient_name}"`);
    if (params.recipient_state) criteria.push(`state: ${params.recipient_state}`);

    lines.push(`*Search: ${criteria.join(', ')}*`);
    lines.push(`*Found ${response.pagination.count} disbursements, showing ${response.results.length}*`);
    lines.push('');

    if (response.results.length === 0) {
      lines.push('No disbursements found matching the criteria.');
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      };
    }

    // Calculate totals
    const totalAmount = response.results.reduce((sum, r) => sum + r.disbursement_amount, 0);
    lines.push(`**Total (shown):** ${formatCurrency(totalAmount)}`);
    lines.push('');

    // Group by spending committee
    const byCommittee = new Map<string, typeof response.results>();
    for (const result of response.results) {
      const key = result.committee_name || result.committee_id;
      if (!byCommittee.has(key)) {
        byCommittee.set(key, []);
      }
      byCommittee.get(key)!.push(result);
    }

    // Format results
    let index = 1;
    for (const [committeeName, disbursements] of byCommittee) {
      const committeeTotal = disbursements.reduce((sum, d) => sum + d.disbursement_amount, 0);
      lines.push(`### ${committeeName} (${formatCurrency(committeeTotal)})`);

      for (const disb of disbursements) {
        const location = [disb.recipient_city, disb.recipient_state].filter(Boolean).join(', ');

        lines.push(`${index}. **${disb.recipient_name}** - ${formatCurrency(disb.disbursement_amount)}`);
        lines.push(`   - Date: ${formatDate(disb.disbursement_date)}`);
        if (disb.disbursement_description) {
          lines.push(`   - Purpose: ${disb.disbursement_description}`);
        }
        if (disb.disbursement_purpose_category) {
          lines.push(`   - Category: ${disb.disbursement_purpose_category}`);
        }
        if (location) {
          lines.push(`   - Location: ${location}`);
        }
        lines.push('');
        index++;
      }
    }

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

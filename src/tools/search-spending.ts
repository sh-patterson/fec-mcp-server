/**
 * search_spending MCP Tool
 * Search for campaign spending by description or recipient across all committees
 */

import type { FECClient } from '../api/client.js';
import { searchSpendingInputSchema } from '../schemas/search-spending.schema.js';
import { formatErrorForToolResponse } from '../utils/errors.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { formatCycleFilter } from '../utils/filters.js';
import {
  createKeysetPaginationState,
  decodeContinuationToken,
  encodeContinuationToken,
  formatPaginationFooter,
  validateOpenFecKeysetValues,
} from '../pagination/continuation.js';

const SPENDING_CURSOR_KEYS = [
  'last_index',
  'last_disbursement_amount',
  'last_disbursement_date',
  'sort_null_only',
] as const;
const REQUIRED_SPENDING_CURSOR_KEYS = [
  'last_index',
  'last_disbursement_amount',
] as const;

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
    continuation?: string;
  }
): Promise<SearchSpendingResult> {
  try {
    const minimumAmount = params.min_amount ?? 500;
    const limit = params.limit ?? 20;
    const effectiveFilters = {
      description: params.description,
      recipient_name: params.recipient_name,
      recipient_state: params.recipient_state,
      min_amount: minimumAmount,
      cycle: params.cycle,
      limit,
      type: 'all',
      sort: 'amount',
    };
    const continuationCursor = params.continuation
      ? decodeContinuationToken({
          token: params.continuation,
          tool: 'search_spending',
          effectiveFilters,
          cursorKind: 'keyset',
          allowedKeysetKeys: SPENDING_CURSOR_KEYS,
          requiredKeysetKeys: REQUIRED_SPENDING_CURSOR_KEYS,
        })
      : null;
    const response = await client.searchSpending({
      description: params.description,
      recipient_name: params.recipient_name,
      recipient_state: params.recipient_state,
      min_amount: minimumAmount,
      two_year_transaction_period: params.cycle,
      limit,
      cursor: continuationCursor?.values,
    });
    const pagination = createKeysetPaginationState(response.pagination);
    const nextCursor = pagination.nextValues === null
      ? null
      : validateOpenFecKeysetValues(
          pagination.nextValues,
          SPENDING_CURSOR_KEYS,
          REQUIRED_SPENDING_CURSOR_KEYS
        );
    const nextContinuation = nextCursor === null
      ? undefined
      : encodeContinuationToken({
          tool: 'search_spending',
          effectiveFilters,
          cursor: { kind: 'keyset', values: nextCursor },
        });

    // Build header
    const lines: string[] = ['## Spending Search Results'];

    // Show search criteria
    const criteria: string[] = [];
    if (params.description) criteria.push(`description: "${params.description}"`);
    if (params.recipient_name) criteria.push(`recipient: "${params.recipient_name}"`);
    if (params.recipient_state) criteria.push(`state: ${params.recipient_state}`);
    criteria.push(`minimum: ${formatCurrency(minimumAmount)}`);
    criteria.push(formatCycleFilter(params.cycle).replace('cycle ', 'cycle: '));
    criteria.push('type: all');
    criteria.push('sort: amount');

    lines.push(`*Search: ${criteria.join(', ')}*`);
    lines.push('');

    if (response.results.length === 0) {
      lines.push('No disbursements found matching the criteria.');
      lines.push('');
      lines.push(formatPaginationFooter(0, pagination, nextContinuation));
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
        lines.push(`   - Source IDs: sub_id ${disb.sub_id}; transaction_id ${disb.transaction_id}; file_number ${disb.file_number}`);
        if (disb.pdf_url) {
          lines.push(`   - Source document: ${disb.pdf_url}`);
        }
        lines.push('');
        index++;
      }
    }

    lines.push(formatPaginationFooter(response.results.length, pagination, nextContinuation));

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

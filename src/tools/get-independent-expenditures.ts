/**
 * get_independent_expenditures MCP Tool
 * Retrieve independent expenditures (Schedule E) supporting or opposing candidates
 */

import type { FECClient } from '../api/client.js';
import { getIndependentExpendituresInputSchema } from '../schemas/independent-expenditures.schema.js';
import { formatErrorForToolResponse } from '../utils/errors.js';
import { formatCycleFilter } from '../utils/filters.js';
import { formatIndependentExpenditureText } from '../utils/formatters.js';
import {
  createKeysetPaginationState,
  decodeContinuationToken,
  encodeContinuationToken,
  formatPaginationFooter,
  validateOpenFecKeysetValues,
} from '../pagination/continuation.js';

const EXPENDITURE_CURSOR_KEYS = [
  'last_index',
  'last_expenditure_amount',
  'sort_null_only',
] as const;
const REQUIRED_EXPENDITURE_CURSOR_KEYS = [
  'last_index',
  'last_expenditure_amount',
] as const;

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
    continuation?: string;
  }
): Promise<GetIndependentExpendituresResult> {
  try {
    // Map support/oppose to FEC indicator
    let supportOpposeIndicator: 'S' | 'O' | undefined;
    if (params.support_oppose === 'support') {
      supportOpposeIndicator = 'S';
    } else if (params.support_oppose === 'oppose') {
      supportOpposeIndicator = 'O';
    }
    const limit = params.limit ?? 20;
    const effectiveFilters = {
      candidate_id: params.candidate_id,
      committee_id: params.committee_id,
      support_oppose: params.support_oppose,
      min_amount: params.min_amount,
      cycle: params.cycle,
      limit,
      sort: 'amount',
    };
    const continuationCursor = params.continuation
      ? decodeContinuationToken({
          token: params.continuation,
          tool: 'get_independent_expenditures',
          effectiveFilters,
          cursorKind: 'keyset',
          allowedKeysetKeys: EXPENDITURE_CURSOR_KEYS,
          requiredKeysetKeys: REQUIRED_EXPENDITURE_CURSOR_KEYS,
        })
      : null;
    const response = await client.getScheduleE({
      candidate_id: params.candidate_id,
      committee_id: params.committee_id,
      support_oppose_indicator: supportOpposeIndicator,
      min_amount: params.min_amount,
      two_year_transaction_period: params.cycle,
      limit,
      cursor: continuationCursor?.values,
    });
    const pagination = createKeysetPaginationState(response.pagination);
    const nextCursor = pagination.nextValues === null
      ? null
      : validateOpenFecKeysetValues(
          pagination.nextValues,
          EXPENDITURE_CURSOR_KEYS,
          REQUIRED_EXPENDITURE_CURSOR_KEYS
        );
    const nextContinuation = nextCursor === null
      ? undefined
      : encodeContinuationToken({
          tool: 'get_independent_expenditures',
          effectiveFilters,
          cursor: { kind: 'keyset', values: nextCursor },
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
    const filters = [
      `minimum ${params.min_amount === undefined ? 'none' : `$${params.min_amount.toLocaleString()}`}`,
      formatCycleFilter(params.cycle),
      `type ${params.support_oppose ?? 'all'}`,
      'sort amount',
    ];
    lines.push(`*Filters: ${filters.join('; ')}*`);

    lines.push('');

    // Format the expenditures
    const expendituresText = formatIndependentExpenditureText(response.results, targetCandidate);
    lines.push(expendituresText);
    lines.push('');
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

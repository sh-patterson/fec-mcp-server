/**
 * get_disbursements MCP Tool
 * Retrieve itemized expenditures (Schedule B)
 */

import type { FECClient } from '../api/client.js';
import { getDisbursementsInputSchema } from '../schemas/disbursements.schema.js';
import { formatErrorForToolResponse } from '../utils/errors.js';
import { formatCycleFilter, resolveTransactionPeriod } from '../utils/filters.js';
import { transformScheduleB, formatDisbursementsText } from '../utils/formatters.js';
import { loadReferenceData } from '../notable/reference-data.js';
import { classifyNotableDisbursements } from '../notable/classifier.js';
import { formatNotableDisbursementsText } from '../notable/formatters.js';
import {
  createKeysetPaginationState,
  decodeContinuationToken,
  encodeContinuationToken,
  formatPaginationFooter,
  tryValidateOpenFecKeysetValues,
} from '../pagination/continuation.js';

const DISBURSEMENT_CURSOR_KEYS = [
  'last_index',
  'last_disbursement_amount',
  'last_disbursement_date',
  'sort_null_only',
] as const;

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
    cycle?: number;
    include_notable?: boolean;
    fuzzy_threshold?: number;
    purpose?: string;
    limit?: number;
    sort_by?: 'amount' | 'date';
    continuation?: string;
  }
): Promise<GetDisbursementsResult> {
  try {
    const transactionPeriod = resolveTransactionPeriod(
      params.two_year_transaction_period,
      params.cycle
    );
    const includeNotable = params.include_notable ?? false;
    const fuzzyThreshold = params.fuzzy_threshold ?? 90;
    const minimumAmount = params.min_amount ?? 1000;
    const sortBy = params.sort_by ?? 'amount';
    const limit = params.limit ?? 20;
    const effectiveFilters = {
      committee_id: params.committee_id,
      min_amount: minimumAmount,
      two_year_transaction_period: transactionPeriod,
      purpose: params.purpose,
      include_notable: includeNotable,
      fuzzy_threshold: fuzzyThreshold,
      limit,
      sort: sortBy,
    };
    const requiredCursorKeys = [
      'last_index',
      sortBy === 'date' ? 'last_disbursement_date' : 'last_disbursement_amount',
    ] as const;
    const continuationCursor = params.continuation
      ? decodeContinuationToken({
          token: params.continuation,
          tool: 'get_disbursements',
          effectiveFilters,
          cursorKind: 'keyset',
          allowedKeysetKeys: DISBURSEMENT_CURSOR_KEYS,
          requiredKeysetKeys: requiredCursorKeys,
        })
      : null;
    const response = await client.getScheduleB({
      committee_id: params.committee_id,
      min_amount: minimumAmount,
      two_year_transaction_period: transactionPeriod,
      purpose: params.purpose,
      limit,
      sort_by: sortBy,
      cursor: continuationCursor?.values,
    });
    const pagination = createKeysetPaginationState(response.pagination);
    const nextCursor = pagination.nextValues === null
      ? null
      : tryValidateOpenFecKeysetValues(
          pagination.nextValues,
          DISBURSEMENT_CURSOR_KEYS,
          requiredCursorKeys
        );
    const nextContinuation = nextCursor === null
      ? undefined
      : encodeContinuationToken({
          tool: 'get_disbursements',
          effectiveFilters,
          cursor: { kind: 'keyset', values: nextCursor },
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
    const filters = [
      `minimum $${minimumAmount.toLocaleString()}`,
      formatCycleFilter(transactionPeriod),
      `purpose ${params.purpose ? `contains "${params.purpose}"` : 'all'}`,
      `sort ${sortBy}`,
    ];
    lines.push(`*Filters: ${filters.join('; ')}*`);

    lines.push('');

    if (includeNotable) {
      const referenceData = loadReferenceData();
      const notableItems = classifyNotableDisbursements(
        response.results,
        committeeName || params.committee_id,
        referenceData,
        fuzzyThreshold
      );
      lines.push('### Third-party analyst enrichment');
      lines.push('*Opt-in matches from the packaged analyst reference data. Review the provenance manifest before use.*');
      lines.push('');
      lines.push(formatNotableDisbursementsText(notableItems, Math.min(params.limit ?? 20, 10)));
      lines.push('');
    }

    // Format disbursements
    const disbursementsText = formatDisbursementsText(disbursements);
    lines.push(disbursementsText);
    lines.push('');
    lines.push(formatPaginationFooter(disbursements.length, pagination, nextContinuation));

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

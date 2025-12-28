/**
 * get_receipts MCP Tool
 * Retrieve itemized contributions (Schedule A) with PAC classification
 */

import type { FECClient } from '../api/client.js';
import type { EnrichedReceipt, PACClassification } from '../api/types.js';
import { getReceiptsInputSchema } from '../schemas/receipts.schema.js';
import { formatErrorForToolResponse } from '../utils/errors.js';
import {
  transformScheduleA,
  classifyPAC,
  formatEnrichedReceiptsText,
} from '../utils/formatters.js';

export const GET_RECEIPTS_TOOL = {
  name: 'get_receipts',
  description: `Retrieve itemized contributions (Schedule A) received by a campaign committee. Shows individual and organizational donors, amounts, and contributor details. Automatically classifies PAC contributions by type (Corporate, Labor, Trade, Leadership PAC) for deeper analysis. Supports filtering by amount threshold for researching significant contributions and campaign finance patterns.`,
  inputSchema: getReceiptsInputSchema,
};

export interface GetReceiptsResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export async function executeGetReceipts(
  client: FECClient,
  params: {
    committee_id: string;
    min_amount?: number;
    two_year_transaction_period?: number;
    contributor_type?: 'individual' | 'committee';
    limit?: number;
    sort_by?: 'amount' | 'date';
  }
): Promise<GetReceiptsResult> {
  try {
    const response = await client.getScheduleA({
      committee_id: params.committee_id,
      min_amount: params.min_amount ?? 1000,
      two_year_transaction_period: params.two_year_transaction_period,
      contributor_type: params.contributor_type,
      limit: params.limit ?? 20,
      sort_by: params.sort_by ?? 'amount',
    });

    // Get unique PAC committee IDs for enrichment
    const pacCommitteeIds = [
      ...new Set(
        response.results
          .filter(r => r.contributor_committee_id)
          .map(r => r.contributor_committee_id as string)
      ),
    ];

    // Fetch PAC details in parallel (limit to 10 to avoid rate limiting)
    const pacDetailsMap = new Map<string, PACClassification>();
    const pacIdsToFetch = pacCommitteeIds.slice(0, 10);

    if (pacIdsToFetch.length > 0) {
      const pacDetailsPromises = pacIdsToFetch.map(async (id) => {
        try {
          const committeeResponse = await client.getCommittee(id);
          if (committeeResponse.results.length > 0) {
            return { id, classification: classifyPAC(committeeResponse.results[0]) };
          }
          return null;
        } catch {
          // If lookup fails, skip this PAC
          return null;
        }
      });

      const pacResults = await Promise.all(pacDetailsPromises);
      for (const result of pacResults) {
        if (result) {
          pacDetailsMap.set(result.id, result.classification);
        }
      }
    }

    // Transform to enriched receipts with PAC classification
    const enrichedReceipts: EnrichedReceipt[] = response.results.map(record => {
      const base = transformScheduleA(record);
      const pacId = record.contributor_committee_id;

      return {
        ...base,
        contributor_committee_id: pacId,
        pac_classification: pacId ? (pacDetailsMap.get(pacId) || null) : null,
      };
    });

    // Get committee name from first result if available
    const committeeName = response.results[0]?.committee_name;

    // Build response text
    const lines: string[] = [];

    if (committeeName) {
      lines.push(`## Contributions to ${committeeName}`);
    } else {
      lines.push(`## Contributions to ${params.committee_id}`);
    }

    // Add filter info
    const filters: string[] = [];
    if (params.min_amount) {
      filters.push(`minimum $${params.min_amount.toLocaleString()}`);
    }
    if (params.contributor_type) {
      filters.push(`${params.contributor_type}s only`);
    }
    if (params.two_year_transaction_period) {
      filters.push(`${params.two_year_transaction_period} cycle`);
    }

    if (filters.length > 0) {
      lines.push(`*Filters: ${filters.join(', ')}*`);
    }

    lines.push(`*Showing ${enrichedReceipts.length} of ${response.pagination.count} results*`);
    if (pacDetailsMap.size > 0) {
      lines.push(`*PAC classification enrichment: ${pacDetailsMap.size} PACs identified*`);
    }
    lines.push('');

    // Format enriched receipts
    const receiptsText = formatEnrichedReceiptsText(enrichedReceipts, undefined);
    lines.push(receiptsText);

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

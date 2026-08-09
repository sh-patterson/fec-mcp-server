/**
 * search_candidates MCP Tool
 * Search FEC records for candidates by name
 */

import type { FECClient } from '../api/client.js';
import { searchCandidatesInputSchema } from '../schemas/candidate.schema.js';
import { formatErrorForToolResponse } from '../utils/errors.js';
import {
  createPagePaginationState,
  decodeContinuationToken,
  encodeContinuationToken,
  formatPaginationFooter,
} from '../pagination/continuation.js';

export const SEARCH_CANDIDATES_TOOL = {
  name: 'search_candidates',
  description: `Search FEC records for candidates by name. Returns candidate identifiers and their principal campaign committee IDs, which are required for retrieving detailed financial information. Useful for campaign finance research and transparency investigations.`,
  inputSchema: searchCandidatesInputSchema,
};

export interface SearchCandidatesResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export async function executeSearchCandidates(
  client: FECClient,
  params: {
    q: string;
    election_year?: number;
    office?: 'H' | 'S' | 'P';
    state?: string;
    party?: string;
    continuation?: string;
  }
): Promise<SearchCandidatesResult> {
  try {
    const effectiveFilters = {
      q: params.q,
      election_year: params.election_year,
      office: params.office,
      state: params.state,
      party: params.party,
      limit: 20,
      sort: 'name',
    };
    const cursor = params.continuation
      ? decodeContinuationToken({
          token: params.continuation,
          tool: 'search_candidates',
          effectiveFilters,
          cursorKind: 'page',
        })
      : null;
    const response = await client.searchCandidates({
      q: params.q,
      election_year: params.election_year,
      office: params.office,
      state: params.state,
      party: params.party,
      page: cursor?.page ?? 1,
      limit: 20,
    });
    const pagination = createPagePaginationState(response.pagination);
    const nextContinuation = pagination.nextPage === null
      ? undefined
      : encodeContinuationToken({
          tool: 'search_candidates',
          effectiveFilters,
          cursor: { kind: 'page', page: pagination.nextPage },
        });

    if (response.results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: [
              `No candidates found matching "${params.q}". Try a different spelling or broader search term.`,
              '',
              formatPaginationFooter(0, pagination, nextContinuation),
            ].join('\n'),
          },
        ],
      };
    }

    // Format results
    const lines: string[] = [
      `## Candidate Search Results for "${params.q}"`,
      '',
    ];

    response.results.forEach((candidate, index) => {
      lines.push(`### ${index + 1}. ${candidate.name}`);
      lines.push(`- **Candidate ID:** ${candidate.candidate_id}`);
      lines.push(`- **Party:** ${candidate.party_full} (${candidate.party})`);
      lines.push(`- **Office:** ${candidate.office_full}`);

      if (candidate.state) {
        lines.push(`- **State:** ${candidate.state}${candidate.district ? `, District ${candidate.district}` : ''}`);
      }

      lines.push(`- **Status:** ${candidate.incumbent_challenge_full}`);

      if (candidate.election_years && candidate.election_years.length > 0) {
        const recentYears = candidate.election_years.slice(0, 5).join(', ');
        lines.push(`- **Recent Election Years:** ${recentYears}`);
      }

      // Principal committees (critical for financial lookups)
      if (candidate.principal_committees && candidate.principal_committees.length > 0) {
        lines.push(`- **Principal Campaign Committee:**`);
        candidate.principal_committees.forEach((committee) => {
          lines.push(`  - ${committee.name}`);
          lines.push(`  - **Committee ID:** ${committee.committee_id}`);
        });
      } else {
        lines.push(`- **Principal Campaign Committee:** None listed`);
      }

      lines.push('');
    });

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

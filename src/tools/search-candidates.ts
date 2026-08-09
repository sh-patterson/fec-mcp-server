/**
 * search_candidates MCP Tool
 * Search FEC records for candidates by name
 */

import type { FECClient } from '../api/client.js';
import { searchCandidatesInputSchema } from '../schemas/candidate.schema.js';
import { formatErrorForToolResponse } from '../utils/errors.js';

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
  }
): Promise<SearchCandidatesResult> {
  try {
    const response = await client.searchCandidates(params);

    if (response.results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No candidates found matching "${params.q}". Try a different spelling or broader search term.`,
          },
        ],
      };
    }

    // Format results
    const lines: string[] = [
      `## Candidate Search Results for "${params.q}"`,
      `Found ${response.pagination.count} candidate(s).`,
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

    // Add pagination info if there are more results
    if (response.pagination.pages > 1) {
      lines.push(`*Showing page 1 of ${response.pagination.pages}. Total results: ${response.pagination.count}*`);
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

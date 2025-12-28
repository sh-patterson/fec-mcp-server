/**
 * search_donors MCP Tool
 * Search for individual donors by name, employer, or occupation across all committees
 */

import type { FECClient } from '../api/client.js';
import { searchDonorsInputSchema } from '../schemas/search-donors.schema.js';
import { formatErrorForToolResponse } from '../utils/errors.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';

export const SEARCH_DONORS_TOOL = {
  name: 'search_donors',
  description: `Search for individual donors across all FEC filings by name, employer, or occupation. Essential for tracking donor patterns, identifying industry contributions, or researching specific individuals' political giving. Supports searching by employer (e.g., "Goldman Sachs") or occupation (e.g., "Lobbyist", "Government Affairs").`,
  inputSchema: searchDonorsInputSchema,
};

export interface SearchDonorsResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export async function executeSearchDonors(
  client: FECClient,
  params: {
    contributor_name?: string;
    contributor_employer?: string;
    contributor_occupation?: string;
    contributor_state?: string;
    min_amount?: number;
    cycle?: number;
    limit?: number;
  }
): Promise<SearchDonorsResult> {
  try {
    // Require at least one search criterion
    if (!params.contributor_name && !params.contributor_employer && !params.contributor_occupation) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Please provide at least one search criterion: contributor_name, contributor_employer, or contributor_occupation.',
          },
        ],
        isError: true,
      };
    }

    const response = await client.searchDonors({
      contributor_name: params.contributor_name,
      contributor_employer: params.contributor_employer,
      contributor_occupation: params.contributor_occupation,
      contributor_state: params.contributor_state,
      min_amount: params.min_amount ?? 200, // Default to itemized threshold
      two_year_transaction_period: params.cycle,
      limit: params.limit ?? 20,
    });

    // Build header
    const lines: string[] = ['## Donor Search Results'];

    // Show search criteria
    const criteria: string[] = [];
    if (params.contributor_name) criteria.push(`name: "${params.contributor_name}"`);
    if (params.contributor_employer) criteria.push(`employer: "${params.contributor_employer}"`);
    if (params.contributor_occupation) criteria.push(`occupation: "${params.contributor_occupation}"`);
    if (params.contributor_state) criteria.push(`state: ${params.contributor_state}`);

    lines.push(`*Search: ${criteria.join(', ')}*`);
    lines.push(`*Found ${response.pagination.count} contributions, showing ${response.results.length}*`);
    lines.push('');

    if (response.results.length === 0) {
      lines.push('No contributions found matching the criteria.');
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      };
    }

    // Calculate totals
    const totalAmount = response.results.reduce((sum, r) => sum + r.contribution_receipt_amount, 0);
    lines.push(`**Total (shown):** ${formatCurrency(totalAmount)}`);
    lines.push('');

    // Group by recipient committee for better readability
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
    for (const [committeeName, contributions] of byCommittee) {
      const committeeTotal = contributions.reduce((sum, c) => sum + c.contribution_receipt_amount, 0);
      lines.push(`### ${committeeName} (${formatCurrency(committeeTotal)})`);

      for (const contrib of contributions) {
        const location = [contrib.contributor_city, contrib.contributor_state].filter(Boolean).join(', ');

        lines.push(`${index}. **${contrib.contributor_name}** - ${formatCurrency(contrib.contribution_receipt_amount)}`);
        lines.push(`   - Date: ${formatDate(contrib.contribution_receipt_date)}`);
        if (contrib.contributor_employer) {
          lines.push(`   - Employer: ${contrib.contributor_employer}`);
        }
        if (contrib.contributor_occupation) {
          lines.push(`   - Occupation: ${contrib.contributor_occupation}`);
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

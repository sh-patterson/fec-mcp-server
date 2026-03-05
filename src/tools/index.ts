/**
 * MCP Tools Registration
 * Registers all FEC tools with the MCP server
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FECClient } from '../api/client.js';
import type { Config } from '../config.js';

// Import tool definitions and executors
import {
  SEARCH_CANDIDATES_TOOL,
  executeSearchCandidates,
} from './search-candidates.js';
import {
  GET_COMMITTEE_FINANCES_TOOL,
  executeGetCommitteeFinances,
} from './get-committee-finances.js';
import { GET_RECEIPTS_TOOL, executeGetReceipts } from './get-receipts.js';
import {
  GET_DISBURSEMENTS_TOOL,
  executeGetDisbursements,
} from './get-disbursements.js';
import {
  GET_INDEPENDENT_EXPENDITURES_TOOL,
  executeGetIndependentExpenditures,
} from './get-independent-expenditures.js';
import {
  GET_COMMITTEE_FLAGS_TOOL,
  executeGetCommitteeFlags,
} from './get-committee-flags.js';
import {
  SEARCH_DONORS_TOOL,
  executeSearchDonors,
} from './search-donors.js';
import {
  SEARCH_SPENDING_TOOL,
  executeSearchSpending,
} from './search-spending.js';

// Re-export tools
export {
  SEARCH_CANDIDATES_TOOL,
  executeSearchCandidates,
  GET_COMMITTEE_FINANCES_TOOL,
  executeGetCommitteeFinances,
  GET_RECEIPTS_TOOL,
  executeGetReceipts,
  GET_DISBURSEMENTS_TOOL,
  executeGetDisbursements,
  GET_INDEPENDENT_EXPENDITURES_TOOL,
  executeGetIndependentExpenditures,
  GET_COMMITTEE_FLAGS_TOOL,
  executeGetCommitteeFlags,
  SEARCH_DONORS_TOOL,
  executeSearchDonors,
  SEARCH_SPENDING_TOOL,
  executeSearchSpending,
};

// MCP SDK expected return type
interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

interface BaseToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface ToolRegistration {
  def: ToolDefinition;
  execute: (params: unknown) => Promise<BaseToolResult>;
}

/**
 * Register all FEC tools with the MCP server
 */
export function registerTools(server: McpServer, config: Config): void {
  const client = new FECClient({
    apiKey: config.fecApiKey,
    baseUrl: config.fecApiBaseUrl,
  });

  const toolRegistrations: ToolRegistration[] = [
    {
      def: SEARCH_CANDIDATES_TOOL,
      execute: async (params) =>
        executeSearchCandidates(client, params as {
          q: string;
          election_year?: number;
          office?: 'H' | 'S' | 'P';
          state?: string;
          party?: string;
        }),
    },
    {
      def: GET_COMMITTEE_FINANCES_TOOL,
      execute: async (params) =>
        executeGetCommitteeFinances(client, params as {
          committee_id: string;
          cycle?: number;
        }),
    },
    {
      def: GET_RECEIPTS_TOOL,
      execute: async (params) =>
        executeGetReceipts(client, params as {
          committee_id: string;
          min_amount?: number;
          two_year_transaction_period?: number;
          cycle?: number;
          contributor_type?: 'individual' | 'committee';
          include_notable?: boolean;
          fuzzy_threshold?: number;
          limit?: number;
          sort_by?: 'amount' | 'date';
        }),
    },
    {
      def: GET_DISBURSEMENTS_TOOL,
      execute: async (params) =>
        executeGetDisbursements(client, params as {
          committee_id: string;
          min_amount?: number;
          two_year_transaction_period?: number;
          cycle?: number;
          purpose?: string;
          include_notable?: boolean;
          fuzzy_threshold?: number;
          limit?: number;
          sort_by?: 'amount' | 'date';
        }),
    },
    {
      def: GET_INDEPENDENT_EXPENDITURES_TOOL,
      execute: async (params) =>
        executeGetIndependentExpenditures(client, params as {
          candidate_id?: string;
          committee_id?: string;
          support_oppose?: 'support' | 'oppose';
          min_amount?: number;
          cycle?: number;
          limit?: number;
        }),
    },
    {
      def: GET_COMMITTEE_FLAGS_TOOL,
      execute: async (params) =>
        executeGetCommitteeFlags(client, params as {
          committee_id: string;
          cycle?: number;
        }),
    },
    {
      def: SEARCH_DONORS_TOOL,
      execute: async (params) =>
        executeSearchDonors(client, params as {
          contributor_name?: string;
          contributor_employer?: string;
          contributor_occupation?: string;
          contributor_state?: string;
          min_amount?: number;
          cycle?: number;
          limit?: number;
        }),
    },
    {
      def: SEARCH_SPENDING_TOOL,
      execute: async (params) =>
        executeSearchSpending(client, params as {
          description?: string;
          recipient_name?: string;
          recipient_state?: string;
          min_amount?: number;
          cycle?: number;
          limit?: number;
        }),
    },
  ];

  for (const { def, execute } of toolRegistrations) {
    server.tool(
      def.name,
      def.description,
      def.inputSchema,
      async (params): Promise<ToolResult> => {
        const result = await execute(params);
        return { ...result } as ToolResult;
      }
    );
  }
}

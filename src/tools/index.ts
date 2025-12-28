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

/**
 * Register all FEC tools with the MCP server
 */
export function registerTools(server: McpServer, config: Config): void {
  const client = new FECClient({
    apiKey: config.fecApiKey,
    baseUrl: config.fecApiBaseUrl,
  });

  // Register search_candidates
  server.tool(
    SEARCH_CANDIDATES_TOOL.name,
    SEARCH_CANDIDATES_TOOL.description,
    SEARCH_CANDIDATES_TOOL.inputSchema,
    async (params): Promise<ToolResult> => {
      const result = await executeSearchCandidates(client, params as {
        q: string;
        election_year?: number;
        office?: 'H' | 'S' | 'P';
        state?: string;
        party?: string;
      });
      return { ...result };
    }
  );

  // Register get_committee_finances
  server.tool(
    GET_COMMITTEE_FINANCES_TOOL.name,
    GET_COMMITTEE_FINANCES_TOOL.description,
    GET_COMMITTEE_FINANCES_TOOL.inputSchema,
    async (params): Promise<ToolResult> => {
      const result = await executeGetCommitteeFinances(client, params as {
        committee_id: string;
        cycle?: number;
      });
      return { ...result };
    }
  );

  // Register get_receipts
  server.tool(
    GET_RECEIPTS_TOOL.name,
    GET_RECEIPTS_TOOL.description,
    GET_RECEIPTS_TOOL.inputSchema,
    async (params): Promise<ToolResult> => {
      const result = await executeGetReceipts(client, params as {
        committee_id: string;
        min_amount?: number;
        two_year_transaction_period?: number;
        contributor_type?: 'individual' | 'committee';
        limit?: number;
        sort_by?: 'amount' | 'date';
      });
      return { ...result };
    }
  );

  // Register get_disbursements
  server.tool(
    GET_DISBURSEMENTS_TOOL.name,
    GET_DISBURSEMENTS_TOOL.description,
    GET_DISBURSEMENTS_TOOL.inputSchema,
    async (params): Promise<ToolResult> => {
      const result = await executeGetDisbursements(client, params as {
        committee_id: string;
        min_amount?: number;
        two_year_transaction_period?: number;
        purpose?: string;
        limit?: number;
        sort_by?: 'amount' | 'date';
      });
      return { ...result };
    }
  );

  // Register get_independent_expenditures
  server.tool(
    GET_INDEPENDENT_EXPENDITURES_TOOL.name,
    GET_INDEPENDENT_EXPENDITURES_TOOL.description,
    GET_INDEPENDENT_EXPENDITURES_TOOL.inputSchema,
    async (params): Promise<ToolResult> => {
      const result = await executeGetIndependentExpenditures(client, params as {
        candidate_id?: string;
        committee_id?: string;
        support_oppose?: 'support' | 'oppose';
        min_amount?: number;
        cycle?: number;
        limit?: number;
      });
      return { ...result };
    }
  );

  // Register get_committee_flags
  server.tool(
    GET_COMMITTEE_FLAGS_TOOL.name,
    GET_COMMITTEE_FLAGS_TOOL.description,
    GET_COMMITTEE_FLAGS_TOOL.inputSchema,
    async (params): Promise<ToolResult> => {
      const result = await executeGetCommitteeFlags(client, params as {
        committee_id: string;
        cycle?: number;
      });
      return { ...result };
    }
  );

  // Register search_donors
  server.tool(
    SEARCH_DONORS_TOOL.name,
    SEARCH_DONORS_TOOL.description,
    SEARCH_DONORS_TOOL.inputSchema,
    async (params): Promise<ToolResult> => {
      const result = await executeSearchDonors(client, params as {
        contributor_name?: string;
        contributor_employer?: string;
        contributor_occupation?: string;
        contributor_state?: string;
        min_amount?: number;
        cycle?: number;
        limit?: number;
      });
      return { ...result };
    }
  );

  // Register search_spending
  server.tool(
    SEARCH_SPENDING_TOOL.name,
    SEARCH_SPENDING_TOOL.description,
    SEARCH_SPENDING_TOOL.inputSchema,
    async (params): Promise<ToolResult> => {
      const result = await executeSearchSpending(client, params as {
        description?: string;
        recipient_name?: string;
        recipient_state?: string;
        min_amount?: number;
        cycle?: number;
        limit?: number;
      });
      return { ...result };
    }
  );
}

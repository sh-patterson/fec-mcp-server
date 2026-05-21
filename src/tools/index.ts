/**
 * MCP Tools Registration
 * Registers all FEC tools with the MCP server
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodType } from 'zod';
import { FECClient } from '../api/client.js';
import type { Config } from '../config.js';
import {
  searchCandidatesParamsSchema,
  getCommitteeFinancesParamsSchema,
  getReceiptsParamsSchema,
  getDisbursementsParamsSchema,
  getIndependentExpendituresParamsSchema,
  getCommitteeFlagsParamsSchema,
  searchDonorsParamsSchema,
  searchSpendingParamsSchema,
} from '../schemas/index.js';
import { formatErrorForToolResponse } from '../utils/errors.js';

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

function registerValidatedTool<TParams>(
  server: McpServer,
  def: ToolDefinition,
  paramsSchema: ZodType<TParams>,
  execute: (params: TParams) => Promise<BaseToolResult>
): void {
  server.tool(
    def.name,
    def.description,
    def.inputSchema,
    async (params): Promise<ToolResult> => {
      try {
        const validatedParams = await paramsSchema.parseAsync(params);
        const result = await execute(validatedParams);
        return { ...result };
      } catch (error) {
        return {
          content: [{ type: 'text', text: formatErrorForToolResponse(error) }],
          isError: true,
        };
      }
    }
  );
}

export function registerTools(server: McpServer, config: Config): void {
  const client = new FECClient({
    apiKey: config.fecApiKey,
    baseUrl: config.fecApiBaseUrl,
    timeout: config.fecApiTimeoutMs,
  });

  registerValidatedTool(
    server,
    SEARCH_CANDIDATES_TOOL,
    searchCandidatesParamsSchema,
    (params) => executeSearchCandidates(client, params)
  );
  registerValidatedTool(
    server,
    GET_COMMITTEE_FINANCES_TOOL,
    getCommitteeFinancesParamsSchema,
    (params) => executeGetCommitteeFinances(client, params)
  );
  registerValidatedTool(
    server,
    GET_RECEIPTS_TOOL,
    getReceiptsParamsSchema,
    (params) => executeGetReceipts(client, params)
  );
  registerValidatedTool(
    server,
    GET_DISBURSEMENTS_TOOL,
    getDisbursementsParamsSchema,
    (params) => executeGetDisbursements(client, params)
  );
  registerValidatedTool(
    server,
    GET_INDEPENDENT_EXPENDITURES_TOOL,
    getIndependentExpendituresParamsSchema,
    (params) => executeGetIndependentExpenditures(client, params)
  );
  registerValidatedTool(
    server,
    GET_COMMITTEE_FLAGS_TOOL,
    getCommitteeFlagsParamsSchema,
    (params) => executeGetCommitteeFlags(client, params)
  );
  registerValidatedTool(
    server,
    SEARCH_DONORS_TOOL,
    searchDonorsParamsSchema,
    (params) => executeSearchDonors(client, params)
  );
  registerValidatedTool(
    server,
    SEARCH_SPENDING_TOOL,
    searchSpendingParamsSchema,
    (params) => executeSearchSpending(client, params)
  );
}

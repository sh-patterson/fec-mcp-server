# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP (Model Context Protocol) server providing tools to query FEC campaign finance data via the OpenFEC API. Designed for non-partisan campaign finance transparency research.

## Commands

```bash
npm run build               # Compile TypeScript to build/
npm run test                # Run vitest in watch mode
npm run test:run            # Run tests once
npm run test:e2e            # Run e2e tests against live FEC API
npm run typecheck           # Type check without emitting
npm run dev                 # Run with tsx watch (development)
npm run acceptance:fec-day  # Live acceptance checks (federal targets)
npm run acceptance:notable  # Live smoke test (notable classification)
```

Run a single test file:
```bash
npx vitest run tests/tools/get-receipts.test.ts
```

## Architecture

### MCP Server Flow
```
src/index.ts          → Entry point, STDIO transport
src/server.ts         → McpServer creation
src/tools/index.ts    → Tool registration hub (registerTools function)
src/config.ts         → Loads FEC_API_KEY from environment
```

### Tool Pattern
Each tool follows this structure:
- `src/tools/{tool-name}.ts` - Tool definition constant + execute function
- `src/schemas/{tool-name}.schema.ts` - Zod schema object for MCP SDK

Tools export:
- `{TOOL_NAME}_TOOL` - Contains name, description, inputSchema
- `execute{ToolName}` - Async function taking FECClient + params

### API Layer
- `src/api/client.ts` - FECClient class wrapping fetch calls to OpenFEC
- `src/api/endpoints.ts` - API URL constants and endpoint builders
- `src/api/types.ts` - FEC response interfaces (FECCandidate, FECScheduleA, etc.)

### Notable Engine
```
src/notable/reference-data.ts  → Loads bundled reference lists (lobbyists, PACs, etc.)
src/notable/matchers.ts        → Fuzzy + exact matching against reference lists
src/notable/classifier.ts      → Classifies receipts/disbursements as notable with flag reasons
src/notable/formatters.ts      → Renders notable blocks for tool output
resources/reference-lists/     → Bundled CSV snapshots (lobbyists, leadership PACs, etc.)
```

Notable output is opt-in via `include_notable` (default: true) on `get_receipts` and `get_disbursements`. The `fuzzy_threshold` param (default: 90) controls matching strictness.

### Data Transformation
- `src/utils/formatters.ts` - Transforms raw FEC data to formatted output, calculates metrics like burn rate
- `src/utils/errors.ts` - Custom error classes (FECApiError, RateLimitError, NotFoundError)

## Testing

Unit tests mock the FECClient methods. E2E tests (`tests/e2e/`) call the live API and use a separate vitest config that doesn't override environment variables.

Test mocks are in `tests/mocks/fec-responses.ts`.

## Tools (8 total)

1. **search_candidates** - Find candidates by name/office/state
2. **get_committee_finances** - Financial reports with loans & debts
3. **get_receipts** - Contributions TO a specific committee (with PAC enrichment)
4. **get_disbursements** - Spending BY a specific committee
5. **get_independent_expenditures** - Super PAC spending for/against candidates
6. **get_committee_flags** - RFAIs and compliance issues
7. **search_donors** - Search donors by name/employer/occupation across ALL committees
8. **search_spending** - Search spending by description/recipient across ALL committees

## Key Types

- Committee IDs: `C` + 8 digits (e.g., `C00502294`)
- Candidate IDs: Letter + 8 digits (e.g., `H2CA15094` for House, `P00011312` for President)
- Schedules: A (receipts), B (disbursements), C (loans), D (debts), E (independent expenditures)

## MCP SDK Notes

Tool input schemas must be Zod schema objects (not JSON schema). The pattern:
```typescript
export const myToolInputSchema = {
  param: z.string().describe('Description'),
  optional_param: z.number().optional().describe('Description'),
};
```

Tool handlers must return `{ content: [{ type: 'text', text: string }], isError?: boolean }` with an index signature for MCP SDK compatibility.

## STDIO Constraint

Never use `console.log()` - it corrupts JSON-RPC transport. Use `console.error()` for debugging only.

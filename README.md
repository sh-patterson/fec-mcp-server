# FEC MCP Server

`fec-mcp-server` is a command-line Model Context Protocol server for federal campaign-finance research. It has no web interface. It queries the [OpenFEC API](https://api.open.fec.gov/developers/) and returns formatted text for an MCP client.

## Install and configure

Install Node.js 20 or later. Get an API key from the [OpenFEC developer site](https://api.open.fec.gov/developers/). Keep the key private.

```bash
npm install -g fec-mcp-server
```

Set `FEC_API_KEY` in the MCP server environment. For example, this Claude Desktop configuration starts the installed command-line server.

```json
{
  "mcpServers": {
    "fec": {
      "command": "fec-mcp-server",
      "env": {
        "FEC_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

You can also run the package through `npx fec-mcp-server`.

## Tools

The server exposes eight tools.

- `search_candidates` finds federal candidate records and principal committee IDs.
- `get_committee_finances` returns cycle totals and latest final-report balances.
- `get_receipts` returns itemized Schedule A receipts for one committee.
- `get_disbursements` returns itemized Schedule B disbursements for one committee.
- `get_independent_expenditures` returns Schedule E spending by a committee or against or for a candidate.
- `get_committee_flags` lists RFAI and amended-filing records for one committee.
- `search_donors` searches individual Schedule A records across committees.
- `search_spending` searches Schedule B records across committees.

Resolve a candidate or committee before you request committee-level data. Keep `cycle` and `two_year_transaction_period` equal when you compare a financial summary with receipts or disbursements.

## Output and result limits

Each transaction or search query returns one OpenFEC page. The displayed "showing" value is the number of rows in that response. The accompanying count comes from OpenFEC pagination. It does not mean that the tool returned every matching filing.

OpenFEC limits each API call to 100 results per page. The tools that accept `limit` accept values from 1 through 100. Their default is 20. Large OpenFEC result counts can be approximate. Narrow the query before you draw a conclusion.

### Continue a result set

These tools support continuation: `search_candidates`, `get_receipts`, `get_disbursements`, `get_independent_expenditures`, `search_donors`, and `search_spending`. When OpenFEC supplies continuation state, the result includes a paste-ready value such as `{"continuation":"fecp1..."}`. Pass the token as the tool's `continuation` field in the next call.

Continuation tokens are unsigned, stateless, opaque cursors. The server binds each token to the effective filters and the tool that created it. If you change a filter or use the token with another tool, the server rejects the request before it calls OpenFEC. Candidate continuation uses OpenFEC page numbers. Transaction continuation uses OpenFEC keyset cursor values. A final nonempty keyset page can include another token. Continue until the footer says `Continuation: none`; the terminal response can contain no records. Candidate page contents are not guaranteed to remain stable across OpenFEC refreshes.

The footer reports the OpenFEC count status as exact, approximate, or unspecified. Exact counts are marked `exact (N records)`. Approximate counts are marked `approximate (N reported records)`. Missing or unclassified counts are marked `unspecified` (or `unspecified (N reported records)` when OpenFEC supplies a value). The response preserves source record IDs and URLs returned by OpenFEC. Treat those IDs and URLs as upstream evidence, not as values created by this package.

`get_committee_finances` uses `/committee/{id}/totals/` for cycle receipts, disbursements, contribution categories, and loan values. It uses the latest final report for cash and debt balances. Every amount is labeled by its period model. `get_committee_flags` reports filing records. An RFAI or amendment is a review lead, not proof of a violation.

## Docker

Build the command-line server image locally.

```bash
docker build -t fec-mcp-server .
```

Run the image with an API key.

```bash
docker run --rm -i -e FEC_API_KEY=your-api-key-here fec-mcp-server
```

## Data freshness and use

OpenFEC updates its data nightly. Its API cache can delay a refreshed value for up to one hour. Treat a result as a dated API response, not a real-time ledger. The base limit for a registered API key is 1,000 requests per hour. See the [OpenFEC documentation](https://api.open.fec.gov/developers/) and the [api.data.gov developer manual](https://api.data.gov/docs/developer-manual/) for current limits and API-key rules.

Attribute official records to the Federal Election Commission and OpenFEC. This package does not alter the source of record. Review the [FEC Terms of Service](https://github.com/fecgov/FEC/blob/master/TERMS-OF-SERVICE.md) and [FEC Acceptable Use Policy](https://github.com/fecgov/FEC/blob/master/ACCEPTABLE-USE-POLICY.md) before you use the API. The policy restricts commercial use of campaign-finance data. Federal law also restricts contributor-data use for commercial purposes and contribution solicitations. Keep API keys private. Keep contributor data within the approved research purpose.

### Optional analyst enrichment

`get_receipts` and `get_disbursements` can add a flagged-notables block when you explicitly set `include_notable: true`. This block uses bundled third-party analyst reference data. It is not FEC data, a legal finding, or a factual classification. Treat each flag as a lead. Confirm it with the official filing fields and an independent source before you report it.

The four bundled CSV snapshots are derived from `DGA-Research/FEC_Coder_Project_Streamlit` under `Databases/`. The [provenance manifest](resources/reference-lists/provenance.json) records the import commit, date, hashes, method, and recorded license status. The source has no recorded license in this package. Review rights before you redistribute or refresh the snapshots.

## Development

```bash
npm install
npm run build
npm run typecheck
npm test
```

## License

MIT. See [LICENSE](LICENSE).

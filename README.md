# FEC MCP Server

A Model Context Protocol (MCP) server for Federal Election Commission (FEC) campaign finance research and transparency. This server provides tools to search candidates, retrieve financial reports, and analyze contributions and disbursements from official FEC data.

## Features

- **search_candidates**: Search for federal candidates by name, filter by election year, office, state, or party
- **get_committee_finances**: Retrieve financial summaries including receipts, disbursements, cash on hand, and burn rate
- **get_receipts**: Get itemized contributions (Schedule A) with donor details
- **get_disbursements**: Get itemized expenditures (Schedule B) with recipient and purpose details
- **Flagged-first notable analysis**: Optional notable blocks for receipts/disbursements with reference-list + heuristic flag reasons
- **get_independent_expenditures**: Track Super PAC spending for or against candidates (Schedule E)
- **get_committee_flags**: Check for RFAIs, amendments, and compliance red flags
- **search_donors**: Search individual donors by name, employer, or occupation across all committees
- **search_spending**: Search campaign spending by description or recipient across all committees

All data comes directly from the official [OpenFEC API](https://api.open.fec.gov/developers/).

## Installation

### Prerequisites

- Node.js 20 or later
- An FEC API key (free from [api.open.fec.gov](https://api.open.fec.gov/developers/))

### Install from npm

```bash
npm install -g fec-mcp-server
```

### Install from source

```bash
git clone <repository-url>
cd fecmcp
npm install
npm run build
```

## Configuration

Set your FEC API key as an environment variable:

```bash
export FEC_API_KEY=your-api-key-here
```

Or create a `.env` file in your project root:

```
FEC_API_KEY=your-api-key-here
```

## Usage with Claude Desktop

Add the server to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "fec": {
      "command": "npx",
      "args": ["fec-mcp-server"],
      "env": {
        "FEC_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Or if installed globally:

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

## Tools

### search_candidates

Search FEC records for candidates by name.

**Parameters:**
- `q` (required): Candidate name to search for
- `election_year` (optional): Filter by election year (e.g., 2024)
- `office` (optional): Filter by office - H (House), S (Senate), P (President)
- `state` (optional): Filter by state (2-letter code)
- `party` (optional): Filter by party code (e.g., "DEM", "REP")

**Example:**
```
Search for candidates named "Smith" running for Senate in 2024
```

### get_committee_finances

Retrieve financial summary for a campaign committee.

**Parameters:**
- `committee_id` (required): FEC committee ID (e.g., "C00401224")
- `cycle` (optional): Two-year election cycle (e.g., 2024)

**Returns:**
- Total receipts and disbursements
- Cash on hand
- Debts owed
- Burn rate (spending/income ratio)
- Contribution breakdown (individual, PAC, party)
- Small donor percentage

**Example:**
```
Get the financial summary for committee C00401224
```

### get_receipts

Retrieve itemized contributions (Schedule A) received by a committee.

**Parameters:**
- `committee_id` (required): FEC committee ID
- `min_amount` (optional): Minimum contribution amount (default: $1,000)
- `two_year_transaction_period` (optional): Election cycle (e.g., 2024)
- `cycle` (optional): Alias for `two_year_transaction_period`; auto-aligns receipts with finance cycle usage
- `contributor_type` (optional): "individual" or "committee"
- `include_notable` (optional): Include flagged-first notable block (default: `true`)
- `fuzzy_threshold` (optional): Fuzzy matching threshold for reference-list flags (default: `90`, range: `80-99`)
- `limit` (optional): Number of results (default: 20, max: 100)
- `sort_by` (optional): "amount" or "date" (default: "amount")

**Example:**
```
Show the top 10 contributions over $5,000 to committee C00401224
```

### get_disbursements

Retrieve itemized expenditures (Schedule B) made by a committee.

**Parameters:**
- `committee_id` (required): FEC committee ID
- `min_amount` (optional): Minimum disbursement amount (default: $1,000)
- `two_year_transaction_period` (optional): Election cycle
- `cycle` (optional): Alias for `two_year_transaction_period`; auto-aligns disbursements with finance cycle usage
- `purpose` (optional): Filter by purpose keyword (e.g., "MEDIA", "CONSULTING")
- `include_notable` (optional): Include flagged-first notable block (default: `true`)
- `fuzzy_threshold` (optional): Fuzzy matching threshold for reference-list flags (default: `90`, range: `80-99`)
- `limit` (optional): Number of results (default: 20, max: 100)
- `sort_by` (optional): "amount" or "date" (default: "amount")

**Example:**
```
Show media-related spending over $10,000 by committee C00401224
```

### get_independent_expenditures

Retrieve independent expenditures (Schedule E) - money spent by PACs and Super PACs to support or oppose candidates.

**Parameters:**
- `candidate_id` (optional): FEC candidate ID to see spending targeting them
- `committee_id` (optional): FEC committee ID to see their independent spending
- `support_oppose` (optional): Filter by "support" or "oppose"
- `min_amount` (optional): Minimum expenditure amount
- `cycle` (optional): Two-year election cycle
- `limit` (optional): Number of results (default: 20)

*Note: Either `candidate_id` or `committee_id` is required.*

**Example:**
```
Show independent expenditures opposing candidate P00009423
```

### get_committee_flags

Check a campaign committee for compliance red flags including RFAIs and amendments.

**Parameters:**
- `committee_id` (required): FEC committee ID
- `cycle` (optional): Two-year election cycle

**Returns:**
- RFAI (Request for Additional Information) count and details
- Amendment count and details
- Recent compliance issues

**Example:**
```
Check committee C00401224 for any compliance flags
```

### search_donors

Search for individual donors across all FEC filings by name, employer, or occupation.

**Parameters:**
- `contributor_name` (optional): Donor name to search
- `contributor_employer` (optional): Employer name (e.g., "Goldman Sachs")
- `contributor_occupation` (optional): Occupation (e.g., "Lobbyist")
- `contributor_state` (optional): Two-letter state code
- `min_amount` (optional): Minimum contribution amount (default: $200)
- `cycle` (optional): Two-year election cycle
- `limit` (optional): Number of results (default: 20)

*Note: At least one of `contributor_name`, `contributor_employer`, or `contributor_occupation` is required.*

**Example:**
```
Find contributions from employees of "Meta" in California
```

### search_spending

Search campaign spending (Schedule B) across all committees by description or recipient.

**Parameters:**
- `description` (optional): Keyword in spending description (e.g., "travel", "consulting")
- `recipient_name` (optional): Recipient/vendor name
- `recipient_state` (optional): Two-letter state code
- `min_amount` (optional): Minimum amount (default: $500)
- `cycle` (optional): Two-year election cycle
- `limit` (optional): Number of results (default: 20)

*Note: At least one of `description` or `recipient_name` is required.*

**Example:**
```
Find spending on "golf" or "resort" across all committees
```

## Development

### Setup

```bash
npm install
```

### Run tests

```bash
npm test          # Watch mode
npm run test:run  # Single run
npm run test:coverage  # With coverage
```

### Build

```bash
npm run build
```

### Type checking

```bash
npm run typecheck
```

### Live acceptance checks

```bash
npm run acceptance:fec-day
npm run acceptance:notable
```

## API Rate Limits

The FEC API allows 1,000 requests per hour with an API key. For higher limits (up to 7,200 requests/hour), contact the FEC.

## License

MIT

## Disclaimer

This tool is designed for campaign finance transparency research. It provides access to public FEC data in a neutral, non-partisan manner. The tool and its outputs should not be used to promote or oppose any candidate or political party.

## Resources

- [OpenFEC API Documentation](https://api.open.fec.gov/developers/)
- [FEC.gov](https://www.fec.gov/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- Reference list attribution: `github/DGA-Research/FEC_Coder_Project_Streamlit` (bundled snapshots under `resources/reference-lists/`)

---
name: fec-campaign-finance-research
description: Research federal campaign finance with the FEC MCP server. Use when a user asks for FEC candidate, committee, receipt, disbursement, independent-expenditure, donor, spending, or filing-flag records.
---

# FEC campaign finance research

Use the FEC MCP tools for federal records only.

1. Run `search_candidates` when you need a candidate or principal committee ID.
2. State that no result was found in the searched federal records. Do not infer that a person or race is non-federal.
3. Use `get_committee_finances` for a committee-level summary.
4. Use `get_receipts`, `get_disbursements`, or `get_independent_expenditures` for transaction detail.
5. Use `search_donors` or `search_spending` only for cross-committee searches.
6. Use `get_committee_flags` for filing records. Do not describe a flag as a violation.

When you compare a summary with transactions, pass the same value for `cycle` and `two_year_transaction_period`. Use narrow filters and a small `limit` first. State the filters, cycle, result count, and returned-row count in the answer.

OpenFEC refreshes nightly. Cached results can remain stale for up to one hour. A returned page is not a complete result set. Treat large result counts as approximate.

## Continue a search

The following tools support continuation: `search_candidates`, `get_receipts`, `get_disbursements`, `get_independent_expenditures`, `search_donors`, and `search_spending`.

When a result includes `Continuation: {"continuation":"fecp1..."}`, paste that JSON value into the next call as the `continuation` field. Keep every other filter unchanged. Continue until the footer says `Continuation: none`. A keyset route can return an empty terminal page. The server rejects a token when filters change or when a token is used with a different tool.

Treat continuation tokens as unsigned, stateless, and opaque. Do not decode, edit, or construct one. Candidate tokens advance OpenFEC page numbers. Transaction tokens advance OpenFEC keyset cursors. Candidate page membership is not guaranteed to stay stable across OpenFEC refreshes.

Read the footer count status as exact, approximate, or unspecified. Report exact counts as exact records. Report approximate counts as reported records. Report unspecified counts without claiming a total. Preserve source record IDs and OpenFEC-returned URLs when you cite a record.

Set `include_notable: true` only when the user explicitly asks for optional analyst enrichment. The flagged-notables block uses third-party reference snapshots. It is not official FEC data and does not establish a fact, legal status, or affiliation. Name the source fields that support each reported finding.

Respect the OpenFEC Terms of Service and Acceptable Use policy. Do not use contributor data for commercial purposes or to solicit contributions.

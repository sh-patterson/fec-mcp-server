# FEC Campaign Finance Research Skill

Use this workflow when investigating federal campaign finance data with this MCP server.

## Tool Order

1. Run `search_candidates` first to get `candidate_id` and principal `committee_id`.
2. Use `get_committee_finances` for top-level receipts/disbursements/cash.
3. Use detail tools by question type:
   - `get_receipts` for contributions
   - `get_disbursements` for spending
   - `get_independent_expenditures` for outside spending
   - `get_committee_flags` for risk signals
   - `search_donors` for donor-level patterns across committees
   - `search_spending` for vendor/purpose analysis across committees

## Context Management

- Start with narrow filters (`cycle`, `min_amount`, `limit`) before broad pulls.
- Keep `limit` low by default (10-25) and expand only if needed.
- Summarize large result sets instead of pasting every row.
- If results are empty, relax one filter at a time.

## Field Guidance

- `committee_id` is required for most finance tools.
- `two_year_transaction_period` and `cycle` should usually be the same election cycle.
- Use `sort_by: "amount"` for top money flow; use `sort_by: "date"` for timelines.
- `support_oppose` maps to independent expenditure polarity.

## Analysis Pattern

1. Identify committee/candidate.
2. Establish high-level financial posture (`get_committee_finances`).
3. Validate with top receipts and top disbursements.
4. Check independent expenditures and compliance/risk flags.
5. Report key findings with caveats about filter scope and date range.

## Intent Components

Use these components based on user intent. Prefer the smallest component that answers the question.

### 1) Federal Race Check

- User asks:
  - "Is this race in FEC?"
  - "Can you check if this is federal?"
  - "Why can’t you find this candidate?"
- Tool chain:
  1. `search_candidates` with name + optional office/state.
- Output:
  - Federal candidate found/not found.
  - If not found, state likely non-federal or outside candidate endpoint scope.
  - If found, include candidate and principal committee IDs.

### 2) Candidate Resolution

- User asks:
  - "Find the right committee for X."
  - "Which candidate record is the right one?"
- Tool chain:
  1. `search_candidates`
- Output:
  - Candidate disambiguation table with candidate_id, office, state/district, committee_id.
  - Explicitly call out ambiguity if multiple matches.

### 3) Finance Snapshot

- User asks:
  - "Give me top lines for this committee."
  - "What are receipts/disbursements/COH/debt?"
- Tool chain:
  1. `get_committee_finances`
- Output:
  - Receipts, disbursements, COH, debts, burn rate, small-donor share for specified cycle.

### 4) Notable Receipts

- User asks:
  - "Show notable contributions."
  - "Who are the major PAC/committee donors?"
- Tool chain:
  1. `get_receipts` with `contributor_type: committee` (or `individual` if requested).
- Output:
  - Top contributors with amount/date/type.
  - PAC classification context when available.
  - Include committee/org coverage line (classified vs unclassified).

### 5) Notable Disbursements

- User asks:
  - "What spending stands out?"
  - "Show big media/consulting/legal spend."
- Tool chain:
  1. `get_disbursements`
- Output:
  - Top disbursements with amount/date/purpose/category/vendor.
  - Emphasize consulting/media/polling/legal/reimbursement-like entries.

### 6) Compliance Signals

- User asks:
  - "Any compliance flags?"
  - "Any RFAIs or amendment concerns?"
- Tool chain:
  1. `get_committee_flags`
- Output:
  - Amendments/RFAIs summary with recency.
  - Short risk interpretation (weak/moderate/strong signal language).

### 7) Cycle Alignment Guard

- User asks:
  - "Why do these numbers look inconsistent?"
  - "Why does summary show zero but transactions are huge?"
- Tool chain:
  1. `get_committee_finances` with `cycle`
  2. `get_receipts` with same `cycle` (or explicit matching `two_year_transaction_period`)
  3. `get_disbursements` with same `cycle` (or explicit matching `two_year_transaction_period`)
- Output:
  - Explain whether mismatch was caused by timeframe misalignment.
  - State the exact cycle/period filters used.

### 8) Period Comparison

- User asks:
  - "What changed since last filing?"
  - "Compare this period to the previous one."
- Tool chain:
  1. `get_committee_finances` for target cycle
  2. `get_committee_finances` for previous period/cycle as needed
  3. Optional: `get_receipts`/`get_disbursements` for notable delta drivers
- Output:
  - Delta-focused summary (direction + magnitude) instead of full raw lists.

### 9) Target Brief

- User asks:
  - "Give me a quick brief for this target."
  - "Summarize key finance + risk points."
- Tool chain:
  1. `search_candidates`
  2. `get_committee_finances`
  3. `get_receipts`
  4. `get_disbursements`
  5. `get_committee_flags`
- Output:
  - Compact multi-section brief with caveats and timeframe notes.

### 10) Acceptance Run

- User asks:
  - "Run my FEC-day dry run."
  - "Validate these targets end-to-end."
- Tool chain:
  1. `npm run acceptance:fec-day` with optional `--target` args.
- Output:
  - Pass/fail style run summary with surfaced issues and timings.

## Heuristic Pack (From Analyst Training)

Apply these heuristics when the user asks for "notable" receipts/disbursements.

1. High-dollar first:
   - Start by sorting largest-to-smallest and review top contributors/spenders first.
2. Receipts pattern checks:
   - Leadership/elected-official/PAC/industry-linked donors.
   - Repeated large donors across periods.
   - Donor clustering by employer, location, surname, or committee type.
3. Disbursement pattern checks:
   - Consulting, media buys, polling/research, legal fees, reimbursements.
   - Unusual venues or categories (extravagant hotels/restaurants, gifts, odd items).
   - Large transfers to affiliated committees and sudden spend spikes.
4. Narrative fit:
   - Flag items that reinforce existing known storylines.
   - Separate "interesting but weak" from "strong evidence-backed" findings.
5. Data caveats:
   - Federal tools cover federal races; state races may return no candidate/committee IDs.
   - Cycle alignment is mandatory before comparing top-lines vs transactions.

## Prompt Template (For LLM-Guided Search)

Use this template to drive consistent analyst behavior.

```text
You are a campaign-finance research assistant. Work target-by-target.

Target: {race/candidate}
Requested cycle: {cycle}

Process:
1) Resolve candidate and principal committee ID.
2) If no federal candidate is found, say this appears non-federal and stop.
3) Pull finance snapshot for the same cycle.
4) Pull notable receipts with cycle-aligned filters (committee contributions first).
5) Pull notable disbursements with cycle-aligned filters.
6) Pull compliance flags.
7) Apply heuristics:
   - High-dollar first
   - Leadership/PAC/industry donor patterns
   - Consulting/media/polling/legal/reimbursement/odd-spend patterns
   - Narrative relevance
8) Report:
   - Top lines (receipts/disbursements/COH/debt/burn rate)
   - Notable receipts (with evidence fields: donor, amount, date, type)
   - Notable disbursements (vendor, amount, date, purpose/category)
   - Compliance signals
   - Caveats (filter scope, missing data, federal-vs-state limitations)

Rules:
- Keep findings evidence-based and cite concrete fields.
- Do not compare cycle-scoped summary to unscoped transaction lists.
- If data is thin/empty, say so clearly and propose the next best filter change.
- Keep `include_notable=true` unless the user explicitly requests raw output only.
- Use `fuzzy_threshold` (default 90) for list-matching strictness adjustments.
```

## FEC Day Acceptance Checklist

Run this checklist per target before sending the email update.

Command for dry runs:
- `npm run acceptance:fec-day -- --target "Label|Query|Office|State|Cycle" --target "Label|Query|Office|State|Cycle"`

1. Candidate disambiguation:
   - Confirm search returns exactly one intended candidate for district/state.
   - If multiple matches exist, stop and choose by candidate ID and district before continuing.
2. Committee ID lock:
   - Capture the principal `committee_id` from `search_candidates`.
3. Timeframe alignment:
   - If using `cycle` in `get_committee_finances`, also pass matching `two_year_transaction_period` to `get_receipts` and `get_disbursements`.
   - Do not compare cycle-filtered summary metrics to unbounded historical transaction lists.
4. Top-lines validation:
   - Ensure `Total Receipts`, `Total Disbursements`, `Cash on Hand`, and `Debts Owed` are internally coherent.
   - If summary shows near-zero activity but transaction tools return large historical counts, treat as timeframe mismatch and rerun with aligned filters.
5. Notable receipts:
   - Pull committee/organization receipts (`contributor_type: committee`) and review PAC/leadership/elected-official/industry patterns.
   - Note: not every committee/org contribution has PAC enrichment metadata; review `Type` and name strings directly.
6. Notable disbursements:
   - Pull high-dollar disbursements and scan for consulting/media/polling/legal/reimbursements/odd vendors.
7. Compliance flags:
   - Review amendments and any RFAI references.
   - Treat amendments as weak-to-moderate signal unless tied to clear reporting anomalies.
8. Email-ready output:
   - Produce concise top-lines plus bulletized notable receipts/disbursements/debts and caveats.

## Live Issues Observed (2026-03-05)

1. Cycle mismatch risk:
   - `get_committee_finances` can be cycle-scoped while `get_receipts`/`get_disbursements` are unscoped unless `two_year_transaction_period` is explicitly set.
   - Symptom: summary shows $0/$0 while transaction tools show very large historical volumes.
2. Committee-only receipts nuance:
   - `contributor_type: committee` can include records without PAC classification enrichment.
   - Use contributor `Type` + name heuristics when PAC tags are absent.

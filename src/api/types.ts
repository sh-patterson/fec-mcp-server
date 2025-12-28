/**
 * FEC API Response Types
 * Based on OpenFEC API v1: https://api.open.fec.gov/developers/
 */

// Generic FEC API response wrapper
export interface FECApiResponse<T> {
  api_version: string;
  pagination: FECPagination | FECKeysetPagination;
  results: T[];
}

// Standard pagination (most endpoints)
export interface FECPagination {
  count: number;
  page: number;
  pages: number;
  per_page: number;
}

// Keyset pagination (Schedule A/B endpoints)
export interface FECKeysetPagination {
  count: number;
  per_page: number;
  pages: number;
  last_indexes: {
    last_index: string;
    last_contribution_receipt_date?: string;
    last_disbursement_date?: string;
  } | null;
}

// Principal committee associated with a candidate
export interface FECPrincipalCommittee {
  committee_id: string;
  name: string;
  designation: string;
  designation_full: string;
  committee_type: string;
  committee_type_full: string;
  cycles: number[];
}

// Candidate from /candidates/search/
export interface FECCandidate {
  candidate_id: string;
  name: string;
  party: string;
  party_full: string;
  office: string;
  office_full: string;
  state: string;
  district: string;
  election_years: number[];
  cycles: number[];
  incumbent_challenge: string;
  incumbent_challenge_full: string;
  candidate_status: string;
  federal_funds_flag: boolean;
  has_raised_funds: boolean;
  principal_committees: FECPrincipalCommittee[];
}

// Committee financial report from /committee/{id}/reports/
export interface FECCommitteeReport {
  committee_id: string;
  committee_name: string;
  report_type: string;
  report_type_full: string;
  report_year: number;
  cycle: number;
  coverage_start_date: string;
  coverage_end_date: string;
  // Financial totals for the period
  total_receipts_period: number;
  total_disbursements_period: number;
  cash_on_hand_beginning_period: number;
  cash_on_hand_end_period: number;
  debts_owed_by_committee: number;
  debts_owed_to_committee: number;
  // Contribution breakdowns
  individual_contributions_period: number;
  individual_unitemized_contributions_period: number;
  individual_itemized_contributions_period: number;
  other_political_committee_contributions_period: number;
  political_party_committee_contributions_period: number;
  // Other fields
  net_contributions_period: number;
  net_operating_expenditures_period: number;
  operating_expenditures_period: number;
  // Cumulative totals
  total_receipts_ytd: number;
  total_disbursements_ytd: number;
}

// Schedule A - Itemized receipts/contributions
export interface FECScheduleA {
  committee_id: string;
  committee_name: string;
  // Contributor info
  contributor_name: string;
  contributor_first_name: string | null;
  contributor_last_name: string | null;
  contributor_middle_name: string | null;
  contributor_employer: string | null;
  contributor_occupation: string | null;
  contributor_city: string | null;
  contributor_state: string | null;
  contributor_zip: string | null;
  // Contribution details
  contribution_receipt_amount: number;
  contribution_receipt_date: string;
  entity_type: string | null;
  entity_type_desc: string | null;
  is_individual: boolean;
  // Classification
  line_number: string;
  line_number_label: string;
  memo_text: string | null;
  receipt_type: string;
  receipt_type_full: string;
  two_year_transaction_period: number;
  // Identifiers
  sub_id: string;
  link_id: string;
  transaction_id: string;
  file_number: number;
  // Contributor committee (if PAC)
  contributor_committee_id: string | null;
}

// Schedule B - Itemized disbursements/expenditures
export interface FECScheduleB {
  committee_id: string;
  committee_name: string;
  // Recipient info
  recipient_name: string;
  recipient_city: string | null;
  recipient_state: string | null;
  recipient_zip: string | null;
  // Disbursement details
  disbursement_amount: number;
  disbursement_date: string;
  disbursement_description: string | null;
  disbursement_purpose_category: string | null;
  disbursement_type: string | null;
  disbursement_type_description: string | null;
  // Classification
  line_number: string;
  line_number_label: string;
  memo_text: string | null;
  two_year_transaction_period: number;
  // Identifiers
  sub_id: string;
  link_id: string;
  transaction_id: string;
  file_number: number;
  // Recipient committee (if PAC)
  recipient_committee_id: string | null;
}

// Calculated financial summary (our derived type)
export interface CommitteeFinancialSummary {
  committee_id: string;
  committee_name: string;
  report_type: string;
  coverage_period: {
    start: string;
    end: string;
  };
  cycle: number;
  // Core financials
  total_receipts: number;
  total_disbursements: number;
  cash_on_hand: number;
  debts_owed: number;
  // Calculated metrics
  burn_rate: number | null; // disbursements / receipts, null if receipts = 0
  // Contribution breakdown
  individual_contributions: number;
  individual_itemized: number;
  individual_unitemized: number;
  pac_contributions: number;
  party_contributions: number;
  // Derived percentages
  small_donor_percentage: number | null; // unitemized / total_receipts
}

// Formatted receipt for tool output
export interface FormattedReceipt {
  contributor_name: string;
  amount: number;
  date: string;
  contributor_type: string;
  employer: string | null;
  occupation: string | null;
  city: string | null;
  state: string | null;
}

// Formatted disbursement for tool output
export interface FormattedDisbursement {
  recipient_name: string;
  amount: number;
  date: string;
  description: string | null;
  purpose_category: string | null;
  city: string | null;
  state: string | null;
}

// Committee details (for PAC classification)
export interface FECCommittee {
  committee_id: string;
  name: string;
  committee_type: string;
  committee_type_full: string;
  designation: string;
  designation_full: string;
  organization_type: string | null;
  organization_type_full: string | null;
  connected_organization_name: string | null;
  party: string | null;
  party_full: string | null;
  state: string | null;
  treasurer_name: string | null;
  sponsor_candidate_ids: string[] | null;
  sponsor_candidate_list: Array<{
    candidate_id: string;
    candidate_name: string;
  }> | null;
  // Flags
  is_active: boolean;
  leadership_pac: boolean | null;
  lobbyist_registrant_pac: boolean | null;
}

// Schedule C - Loans
export interface FECScheduleC {
  committee_id: string;
  committee_name: string;
  loan_source_name: string;
  loan_source_city: string | null;
  loan_source_state: string | null;
  original_loan_amount: number;
  loan_balance: number;
  payment_to_date: number;
  incurred_date: string;
  due_date: string | null;
  interest_rate: number | null;
  secured: boolean;
  personally_funded: boolean;
  candidate_name: string | null;
  two_year_transaction_period: number;
}

// Schedule D - Debts and Obligations
export interface FECScheduleD {
  committee_id: string;
  committee_name: string;
  creditor_debtor_name: string;
  creditor_debtor_city: string | null;
  creditor_debtor_state: string | null;
  nature_of_debt: string | null;
  outstanding_balance_beginning_of_period: number;
  outstanding_balance_close_of_period: number;
  coverage_start_date: string;
  coverage_end_date: string;
  two_year_transaction_period: number;
}

// Schedule E - Independent Expenditures
export interface FECScheduleE {
  committee_id: string;
  committee_name: string;
  // Who spent the money
  spender_name: string | null;
  spender_committee_type: string | null;
  // Who it was for/against
  candidate_id: string | null;
  candidate_name: string | null;
  candidate_party: string | null;
  candidate_office: string | null;
  candidate_office_state: string | null;
  candidate_office_district: string | null;
  // Support or oppose
  support_oppose_indicator: 'S' | 'O' | null;
  // Expenditure details
  expenditure_amount: number;
  expenditure_date: string;
  expenditure_description: string | null;
  payee_name: string | null;
  payee_city: string | null;
  payee_state: string | null;
  // Filing info
  filing_date: string;
  two_year_transaction_period: number;
}

// Filing record (for RFAIs and amendments)
export interface FECFiling {
  committee_id: string;
  committee_name: string;
  form_type: string;
  report_type: string | null;
  report_type_full: string | null;
  document_type: string;
  document_type_full: string;
  amendment_indicator: string | null;
  receipt_date: string;
  coverage_start_date: string | null;
  coverage_end_date: string | null;
  file_number: number;
  pdf_url: string | null;
  // For RFAIs
  request_type: string | null;
  is_amended: boolean;
}

// Enhanced financial summary with loans and debts
export interface EnhancedFinancialSummary extends CommitteeFinancialSummary {
  // Loans (Schedule C)
  total_loans: number;
  candidate_loans: number;
  loans: Array<{
    source: string;
    amount: number;
    balance: number;
    date: string;
    is_candidate_loan: boolean;
  }>;
  // Debts (Schedule D)
  debts: Array<{
    creditor: string;
    amount: number;
    nature: string | null;
  }>;
}

// PAC classification for enriched receipts
export interface PACClassification {
  committee_id: string;
  name: string;
  designation: string; // P, D, J, etc.
  designation_full: string;
  organization_type: string | null; // C, L, T, M, W, V
  organization_type_full: string | null;
  connected_organization: string | null;
  is_leadership_pac: boolean;
  is_corporate_pac: boolean;
  is_labor_pac: boolean;
  is_trade_pac: boolean;
  sponsor_candidate: string | null;
}

// Enriched receipt with PAC classification
export interface EnrichedReceipt extends FormattedReceipt {
  contributor_committee_id: string | null;
  pac_classification: PACClassification | null;
}

// Committee flags/red flags
export interface CommitteeFlags {
  committee_id: string;
  committee_name: string;
  has_rfais: boolean;
  rfai_count: number;
  has_late_filings: boolean;
  late_filing_count: number;
  has_amendments: boolean;
  amendment_count: number;
  recent_issues: Array<{
    type: 'rfai' | 'late_filing' | 'amendment';
    date: string;
    description: string;
  }>;
}

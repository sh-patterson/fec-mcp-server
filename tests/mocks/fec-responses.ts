/**
 * Mock FEC API Responses for Testing
 * These responses are based on real FEC API response structures
 */

import type {
  FECApiResponse,
  FECCandidate,
  FECCommitteeReport,
  FECScheduleA,
  FECScheduleB,
} from '../../src/api/types.js';

// Mock candidate search response
export const mockCandidateSearchResponse: FECApiResponse<FECCandidate> = {
  api_version: '1.0',
  pagination: {
    count: 1,
    page: 1,
    pages: 1,
    per_page: 20,
  },
  results: [
    {
      candidate_id: 'H2CA15103',
      name: 'SWALWELL, ERIC MICHAEL',
      party: 'DEM',
      party_full: 'Democratic Party',
      office: 'H',
      office_full: 'House',
      state: 'CA',
      district: '15',
      election_years: [2024, 2022, 2020, 2018, 2016, 2014, 2012],
      cycles: [2024, 2022, 2020, 2018, 2016, 2014, 2012],
      incumbent_challenge: 'I',
      incumbent_challenge_full: 'Incumbent',
      candidate_status: 'C',
      federal_funds_flag: false,
      has_raised_funds: true,
      principal_committees: [
        {
          committee_id: 'C00523969',
          name: 'SWALWELL FOR CONGRESS',
          designation: 'P',
          designation_full: 'Principal campaign committee',
          committee_type: 'H',
          committee_type_full: 'House',
          cycles: [2024, 2022, 2020],
        },
      ],
    },
  ],
};

// Mock empty candidate search
export const mockEmptyCandidateSearchResponse: FECApiResponse<FECCandidate> = {
  api_version: '1.0',
  pagination: {
    count: 0,
    page: 1,
    pages: 0,
    per_page: 20,
  },
  results: [],
};

// Mock committee reports response
export const mockCommitteeReportsResponse: FECApiResponse<FECCommitteeReport> = {
  api_version: '1.0',
  pagination: {
    count: 1,
    page: 1,
    pages: 1,
    per_page: 20,
  },
  results: [
    {
      committee_id: 'C00523969',
      committee_name: 'SWALWELL FOR CONGRESS',
      report_type: 'Q3',
      report_type_full: 'October Quarterly',
      report_year: 2024,
      cycle: 2024,
      coverage_start_date: '2024-07-01',
      coverage_end_date: '2024-09-30',
      total_receipts_period: 500000,
      total_disbursements_period: 350000,
      cash_on_hand_beginning_period: 600000,
      cash_on_hand_end_period: 750000,
      debts_owed_by_committee: 50000,
      debts_owed_to_committee: 0,
      individual_contributions_period: 400000,
      individual_unitemized_contributions_period: 150000,
      individual_itemized_contributions_period: 250000,
      other_political_committee_contributions_period: 75000,
      political_party_committee_contributions_period: 25000,
      net_contributions_period: 475000,
      net_operating_expenditures_period: 300000,
      operating_expenditures_period: 320000,
      total_receipts_ytd: 1500000,
      total_disbursements_ytd: 1200000,
    },
  ],
};

// Mock committee reports with zero receipts (for burn rate edge case)
export const mockZeroReceiptsReportResponse: FECApiResponse<FECCommitteeReport> = {
  api_version: '1.0',
  pagination: {
    count: 1,
    page: 1,
    pages: 1,
    per_page: 20,
  },
  results: [
    {
      ...mockCommitteeReportsResponse.results[0],
      total_receipts_period: 0,
      total_disbursements_period: 50000,
    },
  ],
};

// Mock Schedule A (receipts) response
export const mockScheduleAResponse: FECApiResponse<FECScheduleA> = {
  api_version: '1.0',
  pagination: {
    count: 3,
    per_page: 20,
    pages: 1,
    last_indexes: {
      last_index: '123456789',
      last_contribution_receipt_date: '2024-09-15',
    },
  },
  results: [
    {
      committee_id: 'C00523969',
      committee_name: 'SWALWELL FOR CONGRESS',
      contributor_name: 'SMITH, JOHN',
      contributor_first_name: 'JOHN',
      contributor_last_name: 'SMITH',
      contributor_middle_name: null,
      contributor_employer: 'TECH COMPANY INC',
      contributor_occupation: 'SOFTWARE ENGINEER',
      contributor_city: 'SAN FRANCISCO',
      contributor_state: 'CA',
      contributor_zip: '94102',
      contribution_receipt_amount: 2900,
      contribution_receipt_date: '2024-09-15',
      entity_type: 'IND',
      entity_type_desc: 'Individual',
      is_individual: true,
      line_number: '11AI',
      line_number_label: 'Contributions from Individuals/Persons',
      memo_text: null,
      receipt_type: '15',
      receipt_type_full: 'Individual contribution',
      two_year_transaction_period: 2024,
      sub_id: '1234567890001',
      link_id: '1234567890',
      transaction_id: 'SA11AI.1234',
      file_number: 1234567,
      contributor_committee_id: null,
    },
    {
      committee_id: 'C00523969',
      committee_name: 'SWALWELL FOR CONGRESS',
      contributor_name: 'CALIFORNIA TEACHERS PAC',
      contributor_first_name: null,
      contributor_last_name: null,
      contributor_middle_name: null,
      contributor_employer: null,
      contributor_occupation: null,
      contributor_city: 'SACRAMENTO',
      contributor_state: 'CA',
      contributor_zip: '95814',
      contribution_receipt_amount: 5000,
      contribution_receipt_date: '2024-09-10',
      entity_type: 'COM',
      entity_type_desc: 'Committee',
      is_individual: false,
      line_number: '11C',
      line_number_label: 'Contributions from Other Political Committees',
      memo_text: null,
      receipt_type: '15E',
      receipt_type_full: 'Earmarked contribution',
      two_year_transaction_period: 2024,
      sub_id: '1234567890002',
      link_id: '1234567891',
      transaction_id: 'SA11C.5678',
      file_number: 1234567,
      contributor_committee_id: 'C00123456',
    },
    {
      committee_id: 'C00523969',
      committee_name: 'SWALWELL FOR CONGRESS',
      contributor_name: 'DOE, JANE',
      contributor_first_name: 'JANE',
      contributor_last_name: 'DOE',
      contributor_middle_name: 'M',
      contributor_employer: 'SELF-EMPLOYED',
      contributor_occupation: 'ATTORNEY',
      contributor_city: 'OAKLAND',
      contributor_state: 'CA',
      contributor_zip: '94612',
      contribution_receipt_amount: 1500,
      contribution_receipt_date: '2024-09-05',
      entity_type: 'IND',
      entity_type_desc: 'Individual',
      is_individual: true,
      line_number: '11AI',
      line_number_label: 'Contributions from Individuals/Persons',
      memo_text: null,
      receipt_type: '15',
      receipt_type_full: 'Individual contribution',
      two_year_transaction_period: 2024,
      sub_id: '1234567890003',
      link_id: '1234567892',
      transaction_id: 'SA11AI.9012',
      file_number: 1234567,
      contributor_committee_id: null,
    },
  ],
};

// Mock Schedule B (disbursements) response
export const mockScheduleBResponse: FECApiResponse<FECScheduleB> = {
  api_version: '1.0',
  pagination: {
    count: 3,
    per_page: 20,
    pages: 1,
    last_indexes: {
      last_index: '987654321',
      last_disbursement_date: '2024-09-20',
    },
  },
  results: [
    {
      committee_id: 'C00523969',
      committee_name: 'SWALWELL FOR CONGRESS',
      recipient_name: 'MEDIA BUYING AGENCY LLC',
      recipient_city: 'WASHINGTON',
      recipient_state: 'DC',
      recipient_zip: '20001',
      disbursement_amount: 150000,
      disbursement_date: '2024-09-20',
      disbursement_description: 'MEDIA PLACEMENT',
      disbursement_purpose_category: 'ADVERTISING',
      disbursement_type: '001',
      disbursement_type_description: 'Operating expenditure',
      line_number: '17',
      line_number_label: 'Operating Expenditures',
      memo_text: null,
      two_year_transaction_period: 2024,
      sub_id: '9876543210001',
      link_id: '9876543210',
      transaction_id: 'SB17.1234',
      file_number: 1234567,
      recipient_committee_id: null,
    },
    {
      committee_id: 'C00523969',
      committee_name: 'SWALWELL FOR CONGRESS',
      recipient_name: 'POLLING RESEARCH INC',
      recipient_city: 'CHICAGO',
      recipient_state: 'IL',
      recipient_zip: '60601',
      disbursement_amount: 25000,
      disbursement_date: '2024-09-15',
      disbursement_description: 'POLLING SERVICES',
      disbursement_purpose_category: 'POLLING',
      disbursement_type: '001',
      disbursement_type_description: 'Operating expenditure',
      line_number: '17',
      line_number_label: 'Operating Expenditures',
      memo_text: null,
      two_year_transaction_period: 2024,
      sub_id: '9876543210002',
      link_id: '9876543211',
      transaction_id: 'SB17.5678',
      file_number: 1234567,
      recipient_committee_id: null,
    },
    {
      committee_id: 'C00523969',
      committee_name: 'SWALWELL FOR CONGRESS',
      recipient_name: 'CAMPAIGN CONSULTING GROUP',
      recipient_city: 'SAN FRANCISCO',
      recipient_state: 'CA',
      recipient_zip: '94105',
      disbursement_amount: 15000,
      disbursement_date: '2024-09-01',
      disbursement_description: 'CONSULTING FEE',
      disbursement_purpose_category: 'CONSULTING',
      disbursement_type: '001',
      disbursement_type_description: 'Operating expenditure',
      line_number: '17',
      line_number_label: 'Operating Expenditures',
      memo_text: null,
      two_year_transaction_period: 2024,
      sub_id: '9876543210003',
      link_id: '9876543212',
      transaction_id: 'SB17.9012',
      file_number: 1234567,
      recipient_committee_id: null,
    },
  ],
};

// Mock error responses
export const mockRateLimitResponse = {
  error: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Rate limit exceeded. Please wait before making more requests.',
  },
};

export const mockNotFoundResponse = {
  error: {
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
  },
};

// Helper to create a mock fetch response
export function createMockResponse<T>(data: T, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: () => createMockResponse(data, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    bytes: async () => new Uint8Array(),
  } as Response;
}

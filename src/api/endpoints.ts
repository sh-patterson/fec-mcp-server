/**
 * FEC API Endpoint Constants
 */

export const FEC_API_BASE_URL = 'https://api.open.fec.gov/v1';

export const ENDPOINTS = {
  // Candidate endpoints
  CANDIDATES_SEARCH: '/candidates/search/',
  CANDIDATES: '/candidates/',
  CANDIDATE_BY_ID: (id: string) => `/candidate/${id}/`,
  CANDIDATE_HISTORY: (id: string) => `/candidate/${id}/history/`,

  // Committee endpoints
  COMMITTEES: '/committees/',
  COMMITTEE_BY_ID: (id: string) => `/committee/${id}/`,
  COMMITTEE_REPORTS: (id: string) => `/committee/${id}/reports/`,
  COMMITTEE_TOTALS: (id: string) => `/committee/${id}/totals/`,

  // Schedule endpoints (itemized transactions)
  SCHEDULE_A: '/schedules/schedule_a/',
  SCHEDULE_B: '/schedules/schedule_b/',
  SCHEDULE_C: '/schedules/schedule_c/', // Loans
  SCHEDULE_D: '/schedules/schedule_d/', // Debts
  SCHEDULE_E: '/schedules/schedule_e/', // Independent Expenditures

  // Filings
  FILINGS: '/filings/',
} as const;

// Default pagination settings
export const DEFAULT_PER_PAGE = 20;
export const MAX_PER_PAGE = 100;

// Rate limiting info (for reference)
export const RATE_LIMIT = {
  REQUESTS_PER_HOUR: 1000,
  ENHANCED_REQUESTS_PER_HOUR: 7200, // Available via email request
} as const;

/**
 * FEC API Client
 * Wrapper for the Federal Election Commission OpenFEC API
 */

import { FEC_API_BASE_URL, ENDPOINTS, DEFAULT_PER_PAGE } from './endpoints.js';
import { FECApiError, RateLimitError, sanitizeApiKey } from '../utils/errors.js';
import type {
  FECApiResponse,
  FECCandidate,
  FECCommittee,
  FECCommitteeReport,
  FECScheduleA,
  FECScheduleB,
  FECScheduleC,
  FECScheduleD,
  FECScheduleE,
  FECFiling,
} from './types.js';

export interface FECClientConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}

export interface SearchCandidatesParams {
  q: string;
  election_year?: number;
  office?: 'H' | 'S' | 'P';
  state?: string;
  party?: string;
}

export interface GetCommitteeReportsParams {
  cycle?: number;
}

export interface GetScheduleAParams {
  committee_id: string;
  min_amount?: number;
  two_year_transaction_period?: number;
  contributor_type?: 'individual' | 'committee';
  limit?: number;
  sort_by?: 'amount' | 'date';
}

export interface GetScheduleBParams {
  committee_id: string;
  min_amount?: number;
  two_year_transaction_period?: number;
  purpose?: string;
  limit?: number;
  sort_by?: 'amount' | 'date';
}

export interface GetScheduleCParams {
  committee_id: string;
  two_year_transaction_period?: number;
  limit?: number;
}

export interface GetScheduleDParams {
  committee_id: string;
  two_year_transaction_period?: number;
  limit?: number;
}

export interface GetScheduleEParams {
  candidate_id?: string;
  committee_id?: string;
  support_oppose_indicator?: 'S' | 'O';
  min_amount?: number;
  two_year_transaction_period?: number;
  limit?: number;
}

export interface SearchDonorsParams {
  contributor_name?: string;
  contributor_employer?: string;
  contributor_occupation?: string;
  contributor_state?: string;
  min_amount?: number;
  two_year_transaction_period?: number;
  limit?: number;
}

export interface SearchSpendingParams {
  description?: string;
  recipient_name?: string;
  recipient_state?: string;
  min_amount?: number;
  two_year_transaction_period?: number;
  limit?: number;
}

export interface GetFilingsParams {
  committee_id: string;
  form_type?: string;
  document_type?: string;
  is_amended?: boolean;
  limit?: number;
}

export class FECClient {
  private apiKey?: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: FECClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || FEC_API_BASE_URL;
    this.timeout = config.timeout || 30000;
  }

  /**
   * Get the base URL (for testing)
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Build URL with query parameters (without auth)
   */
  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): URL {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    // Add other parameters
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url;
  }

  /**
   * Apply API key auth to a URL just before making the request
   */
  private withApiKey(url: URL): URL {
    const authenticatedUrl = new URL(url.toString());
    if (this.apiKey) {
      authenticatedUrl.searchParams.set('api_key', this.apiKey);
    }
    return authenticatedUrl;
  }

  /**
   * Make a GET request to the FEC API
   */
  async get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<FECApiResponse<T>> {
    if (!this.apiKey) {
      throw new FECApiError(
        'FEC API key is not configured. Set FEC_API_KEY to use FEC API tools.',
        undefined,
        endpoint
      );
    }

    const baseUrl = this.buildUrl(endpoint, params);
    const requestUrl = this.withApiKey(baseUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfterHeader = response.headers.get('Retry-After');
          const retryAfter = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : NaN;
          throw new RateLimitError(Number.isNaN(retryAfter) ? undefined : retryAfter);
        }
        const errorText = sanitizeApiKey(await response.text(), this.apiKey);
        throw new FECApiError(
          `FEC API error: ${response.status} ${response.statusText}. ${errorText}`,
          response.status,
          endpoint
        );
      }

      const data = await response.json();
      return data as FECApiResponse<T>;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof FECApiError || error instanceof RateLimitError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new FECApiError(`Request timeout after ${this.timeout}ms`, undefined, endpoint);
        }
        throw new FECApiError(sanitizeApiKey(error.message, this.apiKey), undefined, endpoint);
      }

      throw new FECApiError('Unknown error occurred', undefined, endpoint);
    }
  }

  /**
   * Search for candidates by name
   */
  async searchCandidates(
    params: SearchCandidatesParams
  ): Promise<FECApiResponse<FECCandidate>> {
    return this.get<FECCandidate>(ENDPOINTS.CANDIDATES_SEARCH, {
      q: params.q,
      election_year: params.election_year,
      office: params.office,
      state: params.state,
      party: params.party,
      per_page: DEFAULT_PER_PAGE,
    });
  }

  /**
   * Get committee financial reports
   */
  async getCommitteeReports(
    committeeId: string,
    params?: GetCommitteeReportsParams
  ): Promise<FECApiResponse<FECCommitteeReport>> {
    return this.get<FECCommitteeReport>(ENDPOINTS.COMMITTEE_REPORTS(committeeId), {
      cycle: params?.cycle,
      sort: '-coverage_end_date',
      per_page: DEFAULT_PER_PAGE,
    });
  }

  /**
   * Get Schedule A (itemized receipts/contributions)
   */
  async getScheduleA(params: GetScheduleAParams): Promise<FECApiResponse<FECScheduleA>> {
    const sortField =
      params.sort_by === 'date'
        ? '-contribution_receipt_date'
        : '-contribution_receipt_amount';

    const queryParams: Record<string, string | number | boolean | undefined> = {
      committee_id: params.committee_id,
      min_amount: params.min_amount,
      two_year_transaction_period: params.two_year_transaction_period,
      sort: sortField,
      per_page: params.limit || DEFAULT_PER_PAGE,
    };

    // Filter by contributor type
    if (params.contributor_type === 'individual') {
      queryParams.is_individual = true;
    } else if (params.contributor_type === 'committee') {
      queryParams.is_individual = false;
    }

    return this.get<FECScheduleA>(ENDPOINTS.SCHEDULE_A, queryParams);
  }

  /**
   * Get Schedule B (itemized disbursements/expenditures)
   */
  async getScheduleB(params: GetScheduleBParams): Promise<FECApiResponse<FECScheduleB>> {
    const sortField =
      params.sort_by === 'date' ? '-disbursement_date' : '-disbursement_amount';

    return this.get<FECScheduleB>(ENDPOINTS.SCHEDULE_B, {
      committee_id: params.committee_id,
      min_amount: params.min_amount,
      two_year_transaction_period: params.two_year_transaction_period,
      disbursement_description: params.purpose,
      sort: sortField,
      per_page: params.limit || DEFAULT_PER_PAGE,
    });
  }

  /**
   * Get Schedule C (loans)
   */
  async getScheduleC(params: GetScheduleCParams): Promise<FECApiResponse<FECScheduleC>> {
    return this.get<FECScheduleC>(ENDPOINTS.SCHEDULE_C, {
      committee_id: params.committee_id,
      two_year_transaction_period: params.two_year_transaction_period,
      sort: '-incurred_date',
      per_page: params.limit || DEFAULT_PER_PAGE,
    });
  }

  /**
   * Get Schedule D (debts and obligations)
   */
  async getScheduleD(params: GetScheduleDParams): Promise<FECApiResponse<FECScheduleD>> {
    return this.get<FECScheduleD>(ENDPOINTS.SCHEDULE_D, {
      committee_id: params.committee_id,
      two_year_transaction_period: params.two_year_transaction_period,
      sort: '-coverage_end_date',
      per_page: params.limit || DEFAULT_PER_PAGE,
    });
  }

  /**
   * Get Schedule E (independent expenditures)
   */
  async getScheduleE(params: GetScheduleEParams): Promise<FECApiResponse<FECScheduleE>> {
    return this.get<FECScheduleE>(ENDPOINTS.SCHEDULE_E, {
      candidate_id: params.candidate_id,
      committee_id: params.committee_id,
      support_oppose_indicator: params.support_oppose_indicator,
      min_amount: params.min_amount,
      two_year_transaction_period: params.two_year_transaction_period,
      sort: '-expenditure_amount',
      per_page: params.limit || DEFAULT_PER_PAGE,
    });
  }

  /**
   * Get committee details (for PAC classification)
   */
  async getCommittee(committeeId: string): Promise<FECApiResponse<FECCommittee>> {
    return this.get<FECCommittee>(ENDPOINTS.COMMITTEE_BY_ID(committeeId), {});
  }

  /**
   * Get committee filings (for RFAIs, amendments)
   */
  async getFilings(params: GetFilingsParams): Promise<FECApiResponse<FECFiling>> {
    return this.get<FECFiling>(ENDPOINTS.FILINGS, {
      committee_id: params.committee_id,
      form_type: params.form_type,
      document_type: params.document_type,
      is_amended: params.is_amended,
      sort: '-receipt_date',
      per_page: params.limit || DEFAULT_PER_PAGE,
    });
  }

  /**
   * Search Schedule A by donor name, employer, or occupation (across all committees)
   */
  async searchDonors(params: SearchDonorsParams): Promise<FECApiResponse<FECScheduleA>> {
    return this.get<FECScheduleA>(ENDPOINTS.SCHEDULE_A, {
      contributor_name: params.contributor_name,
      contributor_employer: params.contributor_employer,
      contributor_occupation: params.contributor_occupation,
      contributor_state: params.contributor_state,
      min_amount: params.min_amount,
      two_year_transaction_period: params.two_year_transaction_period,
      is_individual: true, // Only search individual donors
      sort: '-contribution_receipt_amount',
      per_page: params.limit || DEFAULT_PER_PAGE,
    });
  }

  /**
   * Search Schedule B by description or recipient (across all committees)
   */
  async searchSpending(params: SearchSpendingParams): Promise<FECApiResponse<FECScheduleB>> {
    return this.get<FECScheduleB>(ENDPOINTS.SCHEDULE_B, {
      disbursement_description: params.description,
      recipient_name: params.recipient_name,
      recipient_state: params.recipient_state,
      min_amount: params.min_amount,
      two_year_transaction_period: params.two_year_transaction_period,
      sort: '-disbursement_amount',
      per_page: params.limit || DEFAULT_PER_PAGE,
    });
  }
}

/**
 * Create a FEC client from environment configuration
 */
export function createFECClient(apiKey: string, baseUrl?: string): FECClient {
  return new FECClient({
    apiKey,
    baseUrl,
  });
}

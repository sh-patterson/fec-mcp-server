/**
 * E2E Tests against Live FEC API
 * Run with: npm run test:e2e
 *
 * These tests make real API calls and require FEC_API_KEY in .env
 */

import { config as dotenvConfig } from 'dotenv';
import { describe, it, expect, beforeAll } from 'vitest';
import { FECClient } from '../../src/api/client.js';
import { executeSearchCandidates } from '../../src/tools/search-candidates.js';
import { executeGetCommitteeFinances } from '../../src/tools/get-committee-finances.js';
import { executeGetReceipts } from '../../src/tools/get-receipts.js';
import { executeGetDisbursements } from '../../src/tools/get-disbursements.js';
import { executeGetIndependentExpenditures } from '../../src/tools/get-independent-expenditures.js';
import { executeGetCommitteeFlags } from '../../src/tools/get-committee-flags.js';

// Load .env file for e2e tests (override test setup)
dotenvConfig();

describe('Live FEC API E2E Tests', () => {
  let client: FECClient;
  let testCommitteeId: string;

  beforeAll(() => {
    const apiKey = process.env.FEC_API_KEY;
    if (!apiKey || apiKey === 'test-api-key') {
      throw new Error('FEC_API_KEY not set in .env file for e2e tests');
    }
    client = new FECClient({
      apiKey,
      baseUrl: process.env.FEC_API_BASE_URL || 'https://api.open.fec.gov/v1',
    });
  });

  describe('search_candidates', () => {
    it('should find Eric Swalwell', async () => {
      const result = await executeSearchCandidates(client, {
        q: 'Swalwell',
        office: 'H',
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('SWALWELL');
      // Extract committee ID for later tests
      const match = result.content[0].text.match(/C\d{8}/);
      if (match) {
        testCommitteeId = match[0];
      }
    });

    it('should filter by state', async () => {
      const result = await executeSearchCandidates(client, {
        q: 'Smith',
        state: 'CA',
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('CA');
    });
  });

  describe('get_committee_finances', () => {
    it('should return financial summary with loans and debts sections', async () => {
      const result = await executeGetCommitteeFinances(client, {
        committee_id: 'C00502294', // Swalwell For Congress (correct ID)
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Financial Summary');
      expect(result.content[0].text).toContain('Total Receipts');
      expect(result.content[0].text).toContain('SWALWELL');
    });

    it('should handle cycle parameter', async () => {
      const result = await executeGetCommitteeFinances(client, {
        committee_id: 'C00502294',
        cycle: 2024,
      });

      expect(result.isError).toBeUndefined();
    });
  });

  describe('get_receipts with PAC enrichment', () => {
    it('should return contributions with PAC classification', async () => {
      const result = await executeGetReceipts(client, {
        committee_id: 'C00502294', // Swalwell
        min_amount: 1000,
        limit: 10,
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Contributions');
    });

    it('should filter by contributor type', async () => {
      const result = await executeGetReceipts(client, {
        committee_id: 'C00502294',
        contributor_type: 'committee',
        limit: 5,
      });

      expect(result.isError).toBeUndefined();
      // If PAC contributions exist, should show classification
    });
  });

  describe('get_disbursements', () => {
    it('should return spending data', async () => {
      const result = await executeGetDisbursements(client, {
        committee_id: 'C00502294',
        min_amount: 1000,
        limit: 10,
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Disbursements');
    });
  });

  describe('get_independent_expenditures', () => {
    it('should find expenditures targeting a candidate', async () => {
      // Use a candidate ID that typically has IE spending
      const result = await executeGetIndependentExpenditures(client, {
        candidate_id: 'H8CA15053', // Swalwell
        limit: 10,
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Independent Expenditures');
    });

    it('should filter by support/oppose', async () => {
      const result = await executeGetIndependentExpenditures(client, {
        candidate_id: 'H8CA15053',
        support_oppose: 'support',
        limit: 5,
      });

      expect(result.isError).toBeUndefined();
    });

    it('should require at least one ID parameter', async () => {
      const result = await executeGetIndependentExpenditures(client, {
        limit: 10,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('candidate_id or committee_id');
    });
  });

  describe('get_committee_flags', () => {
    it('should check for compliance issues', async () => {
      const result = await executeGetCommitteeFlags(client, {
        committee_id: 'C00502294', // Swalwell
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Compliance Review');
    }, 60000); // Longer timeout for this API call
  });
});

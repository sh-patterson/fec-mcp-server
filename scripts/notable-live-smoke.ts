import { config as dotenvConfig } from 'dotenv';
import { FECClient } from '../src/api/client.js';
import { executeSearchCandidates } from '../src/tools/search-candidates.js';
import { executeGetReceipts } from '../src/tools/get-receipts.js';
import { executeGetDisbursements } from '../src/tools/get-disbursements.js';

dotenvConfig();

interface Target {
  label: string;
  query: string;
  office: 'H' | 'S' | 'P';
  state: string;
  cycle: number;
  expectFederal: boolean;
}

const targets: Target[] = [
  { label: 'Federal A', query: 'Eric Swalwell', office: 'H', state: 'CA', cycle: 2024, expectFederal: true },
  { label: 'Federal B', query: 'Jeff Denham', office: 'H', state: 'CA', cycle: 2024, expectFederal: true },
  { label: 'State Negative Control', query: 'Tate Reeves', office: 'P', state: 'MS', cycle: 2024, expectFederal: false },
];

function firstCommitteeId(text: string): string | undefined {
  return text.match(/C\d{8}/)?.[0];
}

async function main(): Promise<void> {
  const apiKey = process.env.FEC_API_KEY;
  if (!apiKey) {
    console.error('FEC_API_KEY is required for notable live smoke test');
    process.exitCode = 1;
    return;
  }

  const client = new FECClient({
    apiKey,
    baseUrl: process.env.FEC_API_BASE_URL || 'https://api.open.fec.gov/v1',
    timeout: 45000,
  });

  let failures = 0;
  for (const target of targets) {
    console.log(`\n=== ${target.label}: ${target.query} ===`);

    const search = await executeSearchCandidates(client, {
      q: target.query,
      office: target.office,
      state: target.state,
    });

    if (search.isError) {
      console.log('FAIL | search_candidates errored');
      failures++;
      continue;
    }

    const committeeId = firstCommitteeId(search.content[0].text);

    if (!target.expectFederal) {
      if (!committeeId) {
        console.log('PASS | non-federal target gracefully returned no committee_id');
      } else {
        console.log(`FAIL | expected no committee_id but got ${committeeId}`);
        failures++;
      }
      continue;
    }

    if (!committeeId) {
      console.log('FAIL | expected federal committee_id but none found');
      failures++;
      continue;
    }

    const receipts = await executeGetReceipts(client, {
      committee_id: committeeId,
      cycle: target.cycle,
      contributor_type: 'committee',
      min_amount: 1000,
      limit: 10,
      include_notable: true,
      fuzzy_threshold: 90,
    });

    const disbursements = await executeGetDisbursements(client, {
      committee_id: committeeId,
      cycle: target.cycle,
      min_amount: 1000,
      limit: 10,
      include_notable: true,
      fuzzy_threshold: 90,
    });

    const receiptsOk = !receipts.isError && receipts.content[0].text.includes('### Flagged Notables');
    const disbursementsOk =
      !disbursements.isError && disbursements.content[0].text.includes('### Flagged Notables');

    if (receiptsOk && disbursementsOk) {
      console.log(`PASS | notable blocks rendered for committee ${committeeId}`);
    } else {
      console.log('FAIL | notable block missing or tool errored');
      failures++;
    }
  }

  console.log('\n=== Notable Live Smoke Summary ===');
  if (failures === 0) {
    console.log('PASS | all checks passed');
    return;
  }

  console.log(`FAIL | ${failures} check(s) failed`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

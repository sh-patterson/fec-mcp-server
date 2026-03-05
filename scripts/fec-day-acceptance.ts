import { config as dotenvConfig } from 'dotenv';
import { performance } from 'node:perf_hooks';
import { FECClient } from '../src/api/client.js';
import { executeSearchCandidates } from '../src/tools/search-candidates.js';
import { executeGetCommitteeFinances } from '../src/tools/get-committee-finances.js';
import { executeGetReceipts } from '../src/tools/get-receipts.js';
import { executeGetDisbursements } from '../src/tools/get-disbursements.js';
import { executeGetCommitteeFlags } from '../src/tools/get-committee-flags.js';

dotenvConfig();

interface Target {
  label: string;
  query: string;
  office?: 'H' | 'S' | 'P';
  state?: string;
  cycle?: number;
}

interface ScriptOptions {
  minAmount: number;
  limit: number;
  contributorType: 'committee' | 'individual';
  targets: Target[];
}

const DEFAULT_TARGETS: Target[] = [
  { label: 'AZ-02 Martha McSally', query: 'Martha McSally', office: 'H', state: 'AZ', cycle: 2024 },
  { label: 'CA-10 Jeff Denham', query: 'Jeff Denham', office: 'H', state: 'CA', cycle: 2024 },
];

function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
}

function firstCommitteeId(text: string): string | undefined {
  const matches = text.match(/C\d{8}/g);
  return matches?.[0];
}

function firstCandidateId(text: string): string | undefined {
  const matches = text.match(/H\d[A-Z]{2}\d{5}|S\d[A-Z]{2}\d{5}|P\d{8}/g);
  return matches?.[0];
}

function parseFoundCount(text: string): number | null {
  const match = text.match(/Found\s+(\d+)\s+candidate\(s\)/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

function parseArgValue(args: string[], key: string): string | undefined {
  const idx = args.findIndex((arg) => arg === key);
  if (idx === -1 || idx + 1 >= args.length) {
    return undefined;
  }
  return args[idx + 1];
}

function parseTargets(rawTargets: string[] | undefined): Target[] {
  if (!rawTargets || rawTargets.length === 0) {
    return DEFAULT_TARGETS;
  }

  const targets: Target[] = [];
  for (const raw of rawTargets) {
    const [label, query, office, state, cycle] = raw.split('|').map((part) => part.trim());
    if (!label || !query) {
      continue;
    }

    const target: Target = { label, query };
    if (office === 'H' || office === 'S' || office === 'P') {
      target.office = office;
    }
    if (state) {
      target.state = state;
    }
    if (cycle) {
      const parsedCycle = Number.parseInt(cycle, 10);
      if (!Number.isNaN(parsedCycle)) {
        target.cycle = parsedCycle;
      }
    }

    targets.push(target);
  }

  return targets.length > 0 ? targets : DEFAULT_TARGETS;
}

function parseOptions(): ScriptOptions {
  const args = process.argv.slice(2);
  const minAmount = Number.parseInt(parseArgValue(args, '--min-amount') || '1000', 10);
  const limit = Number.parseInt(parseArgValue(args, '--limit') || '10', 10);
  const contributorTypeRaw = parseArgValue(args, '--contributor-type') || 'committee';
  const contributorType = contributorTypeRaw === 'individual' ? 'individual' : 'committee';

  const targetArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' && i + 1 < args.length) {
      targetArgs.push(args[i + 1]);
      i++;
    }
  }

  return {
    minAmount: Number.isNaN(minAmount) ? 1000 : minAmount,
    limit: Number.isNaN(limit) ? 10 : limit,
    contributorType,
    targets: parseTargets(targetArgs),
  };
}

function printUsage(): void {
  console.log('Usage: npm run acceptance:fec-day -- [options]');
  console.log('');
  console.log('Options:');
  console.log('  --target "Label|Query|Office|State|Cycle"   Add a target (repeatable)');
  console.log('  --min-amount 1000                            Min amount for receipts/disbursements');
  console.log('  --limit 10                                   Max rows per receipts/disbursements query');
  console.log('  --contributor-type committee|individual      Receipts contributor filter');
  console.log('');
  console.log('Example:');
  console.log('  npm run acceptance:fec-day -- \\');
  console.log('    --target "MS-GOV Tate Reeves|Tate Reeves|P|MS|2024" \\');
  console.log('    --target "MS-GOV Brandon Presley|Brandon Presley|P|MS|2024"');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  const apiKey = process.env.FEC_API_KEY;
  if (!apiKey) {
    console.error('FEC_API_KEY is required for live acceptance runs.');
    process.exitCode = 1;
    return;
  }

  const options = parseOptions();
  const client = new FECClient({
    apiKey,
    baseUrl: process.env.FEC_API_BASE_URL || 'https://api.open.fec.gov/v1',
    timeout: 45000,
  });

  console.log('FEC Day Acceptance Run');
  console.log(`Targets: ${options.targets.length}`);
  console.log(`Filters: min_amount=${options.minAmount}, limit=${options.limit}, contributor_type=${options.contributorType}`);

  const globalIssues: string[] = [];

  for (const target of options.targets) {
    console.log(`\n===== TARGET: ${target.label} =====`);

    const searchStart = performance.now();
    const search = await executeSearchCandidates(client, {
      q: target.query,
      office: target.office,
      state: target.state,
    });
    console.log(`[search_candidates] ${search.isError ? 'ERROR' : 'ok'} (${elapsedMs(searchStart)}ms)`);

    if (search.isError) {
      const message = search.content[0]?.text || 'Unknown error';
      console.log(message.split('\n').slice(0, 10).join('\n'));
      globalIssues.push(`${target.label}: search failed`);
      continue;
    }

    const foundCount = parseFoundCount(search.content[0]?.text || '');
    if (foundCount !== null && foundCount > 1) {
      globalIssues.push(`${target.label}: candidate ambiguity (${foundCount} matches)`);
    }

    const committeeId = firstCommitteeId(search.content[0]?.text || '');
    const candidateId = firstCandidateId(search.content[0]?.text || '');
    if (!committeeId) {
      globalIssues.push(`${target.label}: no committee_id found in search output`);
      continue;
    }

    console.log(`candidate_id: ${candidateId || 'n/a'}`);
    console.log(`committee_id: ${committeeId}`);
    if (target.cycle) {
      console.log(`cycle: ${target.cycle} (receipts/disbursements auto-aligned)`);
    }

    const financeStart = performance.now();
    const finances = await executeGetCommitteeFinances(client, {
      committee_id: committeeId,
      cycle: target.cycle,
    });
    console.log(`[get_committee_finances] ${finances.isError ? 'ERROR' : 'ok'} (${elapsedMs(financeStart)}ms)`);
    if (finances.isError) {
      globalIssues.push(`${target.label}: get_committee_finances failed`);
    }

    const receiptsStart = performance.now();
    const receipts = await executeGetReceipts(client, {
      committee_id: committeeId,
      cycle: target.cycle,
      contributor_type: options.contributorType,
      min_amount: options.minAmount,
      limit: options.limit,
      sort_by: 'amount',
    });
    console.log(`[get_receipts] ${receipts.isError ? 'ERROR' : 'ok'} (${elapsedMs(receiptsStart)}ms)`);
    if (receipts.isError) {
      globalIssues.push(`${target.label}: get_receipts failed`);
    }

    const disbStart = performance.now();
    const disbursements = await executeGetDisbursements(client, {
      committee_id: committeeId,
      cycle: target.cycle,
      min_amount: options.minAmount,
      limit: options.limit,
      sort_by: 'amount',
    });
    console.log(`[get_disbursements] ${disbursements.isError ? 'ERROR' : 'ok'} (${elapsedMs(disbStart)}ms)`);
    if (disbursements.isError) {
      globalIssues.push(`${target.label}: get_disbursements failed`);
    }

    const flagsStart = performance.now();
    const flags = await executeGetCommitteeFlags(client, {
      committee_id: committeeId,
      cycle: target.cycle,
    });
    console.log(`[get_committee_flags] ${flags.isError ? 'ERROR' : 'ok'} (${elapsedMs(flagsStart)}ms)`);
    if (flags.isError) {
      globalIssues.push(`${target.label}: get_committee_flags failed`);
    }

    if (!receipts.isError) {
      const receiptsText = receipts.content[0].text;
      const hasNoResults = receiptsText.includes('No contributions found matching the criteria.');
      const hasCoverageMetrics = receiptsText.includes('Committee/organization receipts:');

      if (!hasNoResults && !hasCoverageMetrics) {
        globalIssues.push(`${target.label}: receipts output missing committee/org PAC coverage metrics`);
      }
    }
  }

  console.log('\n===== ACCEPTANCE SUMMARY =====');
  if (globalIssues.length === 0) {
    console.log('No blocking issues detected.');
  } else {
    for (const issue of globalIssues) {
      console.log(`- ${issue}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

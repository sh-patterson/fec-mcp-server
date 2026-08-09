import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { runInstalledPackageSmoke } from './installed-package-smoke.mjs';

const EXPECTED_TOOLS = [
  'search_candidates',
  'get_committee_finances',
  'get_receipts',
  'get_disbursements',
  'get_independent_expenditures',
  'get_committee_flags',
  'search_donors',
  'search_spending',
];

function npmInvocation(args) {
  if (process.platform === 'win32') {
    return { command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', 'npm', ...args] };
  }
  return { command: 'npm', args };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function run(command, args, cwd) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', rejectRun);
    child.once('close', (code) => resolveRun({ code, stdout, stderr }));
  });
}

async function checkVersionConsistency(repoRoot) {
  const [manifest, lockfile, serverSource] = await Promise.all([
    readJson(resolve(repoRoot, 'package.json')),
    readJson(resolve(repoRoot, 'package-lock.json')),
    readFile(resolve(repoRoot, 'src', 'server.ts'), 'utf8'),
  ]);
  const lockVersion = lockfile.packages?.['']?.version || lockfile.version;
  assert(typeof manifest.version === 'string', 'package.json must contain a version.');
  assert(lockVersion === manifest.version, `package-lock.json version ${lockVersion || 'missing'} does not match package.json version ${manifest.version}.`);
  assert(
    /require\(['"]\.\.\/package\.json['"]\)/.test(serverSource) &&
      /SERVER_VERSION\s*=\s*packageJson\.version/.test(serverSource),
    'src/server.ts must derive SERVER_VERSION from package.json.'
  );
  return manifest.version;
}

async function checkSkill(repoRoot) {
  const skillRoot = resolve(repoRoot, 'skill', 'fec-campaign-finance-research');
  const [skill, metadata] = await Promise.all([
    readFile(resolve(skillRoot, 'SKILL.md'), 'utf8'),
    readFile(resolve(skillRoot, 'agents', 'openai.yaml'), 'utf8'),
  ]);
  assert(/^---\nname: fec-campaign-finance-research\n/m.test(skill), 'The FEC skill must declare its canonical name in YAML front matter.');
  assert(/^#\s+\S/m.test(skill), 'The FEC skill must contain a top-level heading.');
  assert(/display_name:\s+"FEC Campaign Finance Research"/m.test(metadata), 'The FEC skill metadata must declare its display name.');
  assert(/default_prompt:\s+"Use \$fec-campaign-finance-research/m.test(metadata), 'The FEC skill metadata must declare its default prompt.');
  for (const toolName of EXPECTED_TOOLS) {
    assert(skill.includes(`\`${toolName}\``), `SKILL.md does not document ${toolName}.`);
  }
}

async function checkProductionAudit(repoRoot) {
  const invocation = npmInvocation(['audit', '--omit=dev', '--audit-level=low', '--json']);
  const result = await run(invocation.command, invocation.args, repoRoot);
  let audit;
  try {
    audit = JSON.parse(result.stdout);
  } catch {
    throw new Error(`npm audit did not return JSON.\n${result.stdout}${result.stderr}`);
  }
  if (audit.error) {
    throw new Error(`npm audit could not verify zero production advisories. ${audit.message || audit.error.summary || 'Unknown audit error.'}`);
  }
  const vulnerabilities = audit.metadata?.vulnerabilities;
  assert(vulnerabilities && typeof vulnerabilities === 'object', 'npm audit did not return production vulnerability totals.');
  const advisoryCount = Object.values(vulnerabilities).reduce((sum, value) => sum + (typeof value === 'number' ? value : 0), 0);
  assert(advisoryCount === 0, `npm audit found ${advisoryCount} production advisory or advisories.`);
  assert(result.code === 0, `npm audit exited with code ${result.code}.\n${result.stderr}`);
}

export async function runReleaseCheck({ repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..') } = {}) {
  const version = await checkVersionConsistency(repoRoot);
  await checkSkill(repoRoot);
  await checkProductionAudit(repoRoot);
  const smoke = await runInstalledPackageSmoke({ repoRoot });
  assert(smoke.tools.length === EXPECTED_TOOLS.length, 'The installed package did not discover exactly eight tools.');
  return { version, tools: smoke.tools.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runReleaseCheck()
    .then((result) => {
      console.log(`Release check passed for ${result.version} with ${result.tools} MCP tools.`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}

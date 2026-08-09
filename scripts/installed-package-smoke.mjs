import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

function installedBinInvocation(packageRoot) {
  const binPath = join(packageRoot, 'node_modules', '.bin', 'fec-mcp-server');
  if (process.platform === 'win32') {
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', `${binPath}.cmd`],
    };
  }
  return { command: binPath, args: [] };
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
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
    child.once('close', (code) => {
      if (code === 0) {
        resolveRun({ stdout, stderr });
        return;
      }
      rejectRun(new Error(`${command} ${args.join(' ')} failed with exit code ${code}.\n${stdout}${stderr}`));
    });
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parsePackResult(output) {
  const parsed = JSON.parse(output);
  assert(Array.isArray(parsed) && parsed.length === 1, 'npm pack returned an unexpected JSON result.');
  const [pack] = parsed;
  assert(
    typeof pack === 'object' && pack !== null && typeof pack.filename === 'string' && Array.isArray(pack.files),
    'npm pack JSON does not contain a filename and file list.'
  );
  return pack;
}

function assertPackageContents(files) {
  const paths = new Set(files.map((file) => file.path));
  const required = [
    'package.json',
    'README.md',
    'LICENSE',
    'build/index.js',
    'build/index.d.ts',
    'skill/fec-campaign-finance-research/SKILL.md',
    'skill/fec-campaign-finance-research/agents/openai.yaml',
    'resources/reference-lists/bad-group-master.csv',
    'resources/reference-lists/committee-master.csv',
    'resources/reference-lists/industry-master.csv',
    'resources/reference-lists/lpac-master.csv',
    'resources/reference-lists/provenance.json',
  ];
  for (const path of required) {
    assert(paths.has(path), `The packed package is missing ${path}.`);
  }
  for (const path of paths) {
    assert(!path.startsWith('src/'), `The packed package must not include source file ${path}.`);
    assert(!path.startsWith('tests/'), `The packed package must not include test file ${path}.`);
    assert(!path.startsWith('scripts/'), `The packed package must not include script ${path}.`);
  }
}

async function startOpenFecStub() {
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    if (request.method === 'GET' && requestUrl.pathname === '/v1/candidates/search/') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ pagination: { count: 0, pages: 0 }, results: [] }));
      return;
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ message: `Unexpected OpenFEC stub request: ${request.method} ${requestUrl.pathname}` }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string', 'The OpenFEC stub did not expose a TCP port.');
  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    close: () => new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose())),
  };
}

async function connectInstalledClient({ packageRoot, apiBaseUrl, clientVersion }) {
  const sdkRoot = join(packageRoot, 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'esm');
  const [{ Client }, { StdioClientTransport }] = await Promise.all([
    import(pathToFileURL(join(sdkRoot, 'client', 'index.js')).href),
    import(pathToFileURL(join(sdkRoot, 'client', 'stdio.js')).href),
  ]);
  const client = new Client({ name: 'fec-mcp-release-smoke', version: clientVersion }, { capabilities: {} });
  const binInvocation = installedBinInvocation(packageRoot);
  const transport = new StdioClientTransport({
    command: binInvocation.command,
    args: binInvocation.args,
    cwd: packageRoot,
    env: {
      ...process.env,
      FEC_API_KEY: 'release-smoke-key',
      FEC_API_BASE_URL: apiBaseUrl,
      FEC_API_TIMEOUT_MS: '5000',
    },
    stderr: 'pipe',
  });
  await client.connect(transport);
  return { client, transport };
}

export async function runInstalledPackageSmoke({ repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..') } = {}) {
  const tempRoot = await mkdtemp(join(tmpdir(), 'fec-mcp-release-'));
  try {
    const packInvocation = npmInvocation(['pack', '--pack-destination', tempRoot, '--json']);
    const { stdout: packOutput } = await run(packInvocation.command, packInvocation.args, { cwd: repoRoot });
    const pack = parsePackResult(packOutput);
    assertPackageContents(pack.files);

    const installRoot = join(tempRoot, 'installed');
    await mkdir(installRoot);
    const installInvocation = npmInvocation(['install', '--ignore-scripts', '--no-audit', '--no-fund', join(tempRoot, pack.filename)]);
    await run(installInvocation.command, installInvocation.args, { cwd: installRoot });

    const installedPackage = join(installRoot, 'node_modules', 'fec-mcp-server');
    const installedManifest = JSON.parse(await readFile(join(installedPackage, 'package.json'), 'utf8'));
    assert(installedManifest.version === pack.version, 'The installed package version does not match the packed version.');

    const stub = await startOpenFecStub();
    let transport;
    try {
      const connection = await connectInstalledClient({
        packageRoot: installRoot,
        apiBaseUrl: stub.baseUrl,
        clientVersion: installedManifest.version,
      });
      transport = connection.transport;
      const { client } = connection;
      const toolList = await client.listTools();
      const names = toolList.tools.map((tool) => tool.name).sort();
      const expected = [...EXPECTED_TOOLS].sort();
      assert(names.length === expected.length, `Expected ${expected.length} discovered tools, found ${names.length}.`);
      assert(names.every((name, index) => name === expected[index]), `Discovered tools do not match the release registry: ${names.join(', ')}.`);

      const result = await client.callTool({ name: 'search_candidates', arguments: { q: 'Release smoke' } });
      assert(!result.isError, 'search_candidates returned an MCP error through the installed package.');
      assert(result.content.some((item) => item.type === 'text' && item.text.includes('No candidates found')), 'search_candidates did not return the OpenFEC stub response.');
    } finally {
      try {
        if (transport) {
          await transport.close();
        }
      } finally {
        await stub.close();
      }
    }

    return { files: pack.files.map((file) => file.path), tools: EXPECTED_TOOLS };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Installed-package smoke failed. The package must pack, install, and run on this platform.\n${message}`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runInstalledPackageSmoke()
    .then((result) => {
      console.log(`Installed-package smoke passed with ${result.tools.length} MCP tools.`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}

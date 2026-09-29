import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  assertFreshProductionCandidate,
  changedPathsFromCompare,
  productionFreshnessMode,
} from './cloudflare-production-freshness.mjs';
import {
  PRODUCTION_DEPLOYMENT_PATH_PATTERNS,
  isProductionDeploymentRelevantPath,
} from './cloudflare-production-surface.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function githubFetch({ mainSha = B, comparison = null } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith('/git/ref/heads/main')) {
      return jsonResponse({ object: { sha: mainSha } });
    }
    if (String(url).includes('/compare/')) {
      assert.ok(comparison, 'Unexpected compare request');
      return jsonResponse(comparison);
    }
    return jsonResponse({ message: 'unexpected request' }, 404);
  };
  return { fetchImpl, calls };
}

function compare(files, overrides = {}) {
  return {
    status: 'ahead',
    ahead_by: 1,
    files: files.map((file) =>
      typeof file === 'string' ? { filename: file } : file
    ),
    ...overrides,
  };
}

async function freshness({
  mainSha = B,
  candidateSha = A,
  comparison = compare([]),
} = {}) {
  const mock = githubFetch({ mainSha, comparison });
  const result = await assertFreshProductionCandidate({
    configPath: '/repo/apps/website/wrangler.production.jsonc',
    candidateSource: 'staging',
    candidateSha,
    repository: 'vellira-dev/vellira',
    githubToken: 'test-token',
    fetchImpl: mock.fetchImpl,
  });
  return { result, calls: mock.calls };
}

test('exact current-main staging candidate is fresh without compare', async () => {
  const { result, calls } = await freshness({
    mainSha: A,
    candidateSha: A,
  });

  assert.deepEqual(result, {
    checked: true,
    mode: 'staging',
    mainSha: A,
    deploymentEquivalent: true,
    changedPaths: [],
    relevantPaths: [],
  });
  assert.equal(calls.length, 1);
});

test('deployment-irrelevant main advance remains production eligible', async () => {
  const { result, calls } = await freshness({
    comparison: compare([
      'scripts/semantic-release-packages.cjs',
      'scripts/release-recovery/recovery.test.ts',
      'docs/release-incidents/2026-09-28-v2.124.0.md',
    ]),
  });

  assert.equal(result.mainSha, B);
  assert.equal(result.deploymentEquivalent, true);
  assert.deepEqual(result.relevantPaths, []);
  assert.equal(calls.length, 2);
});

test('deployment-relevant main advance fails closed', async () => {
  const cases = [
    'apps/website/src/app/layout.tsx',
    'packages/react/package.json',
    'package.json',
    'pnpm-lock.yaml',
    '.github/workflows/deploy-website-cloudflare-production.yml',
  ];

  for (const filename of cases) {
    const mock = githubFetch({
      mainSha: B,
      comparison: compare([filename]),
    });

    await assert.rejects(
      assertFreshProductionCandidate({
        configPath: '/repo/apps/website/wrangler.production.jsonc',
        candidateSource: 'staging',
        candidateSha: A,
        repository: 'vellira-dev/vellira',
        githubToken: 'test-token',
        fetchImpl: mock.fetchImpl,
      }),
      new RegExp(filename.replaceAll('.', '\\.').replaceAll('/', '\\/'))
    );
  }
});

test('rename touching the deployment surface fails closed by previous filename', async () => {
  const mock = githubFetch({
    comparison: compare([
      {
        filename: 'docs/retired-worker.yml',
        previous_filename:
          '.github/workflows/deploy-website-cloudflare-production.yml',
      },
    ]),
  });

  await assert.rejects(
    assertFreshProductionCandidate({
      configPath: '/repo/apps/website/wrangler.production.jsonc',
      candidateSource: 'staging',
      candidateSha: A,
      repository: 'vellira-dev/vellira',
      githubToken: 'test-token',
      fetchImpl: mock.fetchImpl,
    }),
    /deploy-website-cloudflare-production\.yml/
  );
});

test('diverged or API-truncated comparisons fail closed', () => {
  assert.throws(
    () => changedPathsFromCompare({ status: 'diverged', files: [] }),
    /not an ancestor/
  );
  assert.throws(
    () =>
      changedPathsFromCompare({
        status: 'ahead',
        files: Array.from({ length: 300 }, (_, index) => ({
          filename: `docs/file-${index}.md`,
        })),
      }),
    /ambiguous at the API file limit/
  );
});

test('emergency production recovery is an explicit freshness bypass', async () => {
  let calls = 0;
  assert.deepEqual(
    await assertFreshProductionCandidate({
      configPath: '/repo/apps/website/wrangler.production.jsonc',
      candidateSource: 'emergency-recovery',
      candidateSha: A,
      repository: 'vellira-dev/vellira',
      githubToken: null,
      fetchImpl: async () => {
        calls += 1;
        throw new Error('must not fetch');
      },
    }),
    {
      checked: false,
      mode: 'emergency-recovery',
      mainSha: null,
      deploymentEquivalent: null,
      changedPaths: [],
      relevantPaths: [],
    }
  );
  assert.equal(calls, 0);
});

test('staging target does not require production freshness', () => {
  assert.equal(
    productionFreshnessMode({
      configPath: '/repo/apps/website/wrangler.jsonc',
      candidateSource: undefined,
    }),
    'not-production'
  );
});

test('unknown production candidate source fails closed', () => {
  assert.throws(
    () =>
      productionFreshnessMode({
        configPath: '/repo/apps/website/wrangler.production.jsonc',
        candidateSource: undefined,
      }),
    /recognized candidate source/
  );
});

test('canonical deployment matcher mirrors staging workflow path filters', async () => {
  const workflow = await fs.readFile(
    path.resolve(
      import.meta.dirname,
      '../../../.github/workflows/deploy-website-cloudflare-staging.yml'
    ),
    'utf8'
  );
  const pathsBlock = workflow.match(
    /\n    paths:\n([\s\S]*?)\n  workflow_dispatch:/
  );
  assert.ok(pathsBlock, 'Unable to read staging workflow paths authority');
  const workflowPatterns = [...pathsBlock[1].matchAll(/^      - '([^']+)'$/gm)]
    .map((match) => match[1])
    .sort();

  assert.deepEqual(
    workflowPatterns,
    [...PRODUCTION_DEPLOYMENT_PATH_PATTERNS].sort()
  );
  assert.equal(
    isProductionDeploymentRelevantPath('scripts/semantic-release-packages.cjs'),
    false
  );
  assert.equal(
    isProductionDeploymentRelevantPath('apps/website/src/app/layout.tsx'),
    true
  );
});

test('deploy script gates archive mutation and real activation with shared freshness', async () => {
  const source = await fs.readFile(
    path.resolve(import.meta.dirname, 'cloudflare-deploy.mjs'),
    'utf8'
  );

  const marker = 'await assertFreshProductionCandidate(freshnessContext);';
  const firstCheck = source.indexOf(marker);
  const secondCheck = source.indexOf(marker, firstCheck + marker.length);
  const thirdCheck = source.indexOf(marker, secondCheck + marker.length);
  const archive = source.indexOf('await withRemoteArchive(');
  const dryRun = source.indexOf("'--dry-run'");
  const activation = source.indexOf(
    "run('pnpm', ['exec', 'wrangler', 'deploy'",
    dryRun
  );

  assert.ok(firstCheck >= 0);
  assert.ok(secondCheck > firstCheck);
  assert.equal(thirdCheck, -1);
  assert.ok(firstCheck < archive, 'Freshness must gate remote archive mutation');
  assert.ok(dryRun < secondCheck, 'Final freshness must run after dry-run');
  assert.ok(
    secondCheck < activation,
    'Final freshness must run immediately before production activation'
  );

  const between = source.slice(secondCheck + marker.length, activation);
  assert.doesNotMatch(
    between,
    /await |fetch\(|withRemoteArchive|prepareDeployment|populateCache/,
    'No async or remote mutation may occur after final freshness check'
  );
});

test('production workflow uses shared freshness instead of raw SHA equality', async () => {
  const workflow = await fs.readFile(
    path.resolve(
      import.meta.dirname,
      '../../../.github/workflows/deploy-website-cloudflare-production.yml'
    ),
    'utf8'
  );

  assert.doesNotMatch(
    workflow,
    /test "\$current_main" = "\$CANDIDATE_SHA"/
  );
  assert.match(
    workflow,
    /cloudflare-production-freshness\.mjs apps\/website\/wrangler\.production\.jsonc/
  );
});

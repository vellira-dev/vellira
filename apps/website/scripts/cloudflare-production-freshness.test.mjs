import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  assertFreshProductionCandidate,
  changedPathsFromCompare,
  productionFreshnessMode,
} from './cloudflare-production-freshness.mjs';
import { RELEASE_SYNC_MANIFESTS } from '../../../scripts/ci/release-sync-contract.mjs';
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

function githubFetch({
  mainSha = B,
  comparison = null,
  documents = {},
} = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    const value = String(url);
    calls.push(value);
    if (value.endsWith('/git/ref/heads/main')) {
      return jsonResponse({ object: { sha: mainSha } });
    }
    if (value.includes('/compare/')) {
      assert.ok(comparison, 'Unexpected compare request');
      return jsonResponse(comparison);
    }
    if (value.includes('/contents/')) {
      const parsed = new URL(value);
      const marker = '/contents/';
      const filePath = decodeURIComponent(
        parsed.pathname.slice(parsed.pathname.indexOf(marker) + marker.length)
      );
      const ref = parsed.searchParams.get('ref');
      const document = documents[`${ref}:${filePath}`];
      assert.ok(document, `Unexpected content request for ${ref}:${filePath}`);
      return jsonResponse({
        type: 'file',
        encoding: 'base64',
        content: Buffer.from(JSON.stringify(document)).toString('base64'),
      });
    }
    return jsonResponse({ message: 'unexpected request' }, 404);
  };
  return { fetchImpl, calls };
}

function compare(files, overrides = {}) {
  return {
    status: 'ahead',
    ahead_by: 1,
    behind_by: 0,
    total_commits: 1,
    commits: [],
    files: files.map((file) =>
      typeof file === 'string'
        ? { filename: file, status: 'modified' }
        : file
    ),
    ...overrides,
  };
}

async function freshness({
  mainSha = B,
  candidateSha = A,
  comparison = compare([]),
  documents = {},
} = {}) {
  const mock = githubFetch({ mainSha, comparison, documents });
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

test('canonical release-sync advance remains production eligible', async () => {
  const baseVersion = '2.126.6';
  const headVersion = '2.126.7';
  const documents = {};

  for (const manifestPath of RELEASE_SYNC_MANIFESTS) {
    const baseDocument = {
      name: manifestPath,
      private: false,
      version: baseVersion,
    };
    const headDocument = {
      ...baseDocument,
      version: headVersion,
    };
    documents[`${A}:${manifestPath}`] = baseDocument;
    documents[`${B}:${manifestPath}`] = headDocument;
  }

  const { result, calls } = await freshness({
    documents,
    comparison: compare(RELEASE_SYNC_MANIFESTS, {
      commits: [
        {
          sha: B,
          author: { login: 'vellira-release-sync[bot]' },
          commit: {
            message:
              'chore(release): sync package versions (#1440)\n\nCo-authored-by: romanbakurov',
          },
          parents: [{ sha: A }],
        },
      ],
    }),
  });

  assert.equal(result.deploymentEquivalent, true);
  assert.deepEqual(result.changedPaths, [...RELEASE_SYNC_MANIFESTS].sort());
  assert.deepEqual(result.relevantPaths, []);
  assert.equal(calls.length, 2 + RELEASE_SYNC_MANIFESTS.length * 2);
});

test('release-sync-shaped advance from another actor fails closed', async () => {
  const documents = {};

  for (const manifestPath of RELEASE_SYNC_MANIFESTS) {
    documents[`${A}:${manifestPath}`] = {
      name: manifestPath,
      version: '2.126.6',
    };
    documents[`${B}:${manifestPath}`] = {
      name: manifestPath,
      version: '2.126.7',
    };
  }

  await assert.rejects(
    freshness({
      documents,
      comparison: compare(RELEASE_SYNC_MANIFESTS, {
        commits: [
          {
            sha: B,
            author: { login: 'romanbakurov' },
            commit: {
              message: 'chore(release): sync package versions (#1440)',
            },
            parents: [{ sha: A }],
          },
        ],
      }),
    }),
    /release-sync GitHub App actor/
  );
});

test('release-sync-shaped advance with manifest drift fails closed', async () => {
  const documents = {};

  for (const manifestPath of RELEASE_SYNC_MANIFESTS) {
    documents[`${A}:${manifestPath}`] = {
      name: manifestPath,
      version: '2.126.6',
    };
    documents[`${B}:${manifestPath}`] = {
      name: manifestPath,
      version: '2.126.7',
    };
  }
  documents[`${B}:packages/react/package.json`].scripts = {
    postinstall: 'unexpected',
  };

  await assert.rejects(
    freshness({
      documents,
      comparison: compare(RELEASE_SYNC_MANIFESTS, {
        commits: [
          {
            sha: B,
            author: { login: 'vellira-release-sync[bot]' },
            commit: {
              message: 'chore(release): sync package versions (#1440)',
            },
            parents: [{ sha: A }],
          },
        ],
      }),
    }),
    /only permits the version field/
  );
});

test('multiple contiguous canonical release-sync commits remain deployment equivalent', async () => {
  const C = 'c'.repeat(40);
  const documents = {};

  for (const manifestPath of RELEASE_SYNC_MANIFESTS) {
    documents[`${A}:${manifestPath}`] = {
      name: manifestPath,
      version: '2.126.6',
    };
    documents[`${C}:${manifestPath}`] = {
      name: manifestPath,
      version: '2.126.8',
    };
  }

  const { result } = await freshness({
    mainSha: C,
    documents,
    comparison: compare(RELEASE_SYNC_MANIFESTS, {
      ahead_by: 2,
      total_commits: 2,
      commits: [
        {
          sha: B,
          author: { login: 'vellira-release-sync[bot]' },
          commit: {
            message: 'chore(release): sync package versions (#1440)',
          },
          parents: [{ sha: A }],
        },
        {
          sha: C,
          author: { login: 'vellira-release-sync[bot]' },
          commit: {
            message: 'chore(release): sync package versions (#1441)',
          },
          parents: [{ sha: B }],
        },
      ],
    }),
  });

  assert.equal(result.deploymentEquivalent, true);
  assert.deepEqual(result.relevantPaths, []);
});

test('deployment-relevant main advance fails closed', async () => {
  const cases = [
    'apps/website/src/app/layout.tsx',
    'packages/react/package.json',
    'package.json',
    'pnpm-lock.yaml',
    'tsconfig.base.json',
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
    /\n {4}paths:\n([\s\S]*?)\n {2}workflow_dispatch:/
  );
  assert.ok(pathsBlock, 'Unable to read staging workflow paths authority');
  const workflowPatterns = [...pathsBlock[1].matchAll(/^ {6}- '([^']+)'$/gm)]
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
  assert.equal(
    isProductionDeploymentRelevantPath('tsconfig.base.json'),
    true,
    'Shared package build configuration must stay in the deployment surface'
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
  assert.match(
    source,
    /const \{ GITHUB_TOKEN: githubToken, \.\.\.childProcessEnv \} = process\.env;/
  );
  assert.match(source, /githubToken,/);
  assert.match(
    source,
    /function run\(command, args, env = childProcessEnv\)/
  );
  assert.doesNotMatch(
    source,
    /\.\.\.process\.env[\s\S]{0,80}OPEN_NEXT_DEPLOY/,
    'Deployment child processes must not inherit GITHUB_TOKEN through process.env'
  );
  assert.equal(
    (source.match(/\.\.\.childProcessEnv,/g) ?? []).length,
    2,
    'Both Wrangler dry-run and real activation must use the sanitized child environment'
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

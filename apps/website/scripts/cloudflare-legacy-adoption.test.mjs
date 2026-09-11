import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { parse } from 'yaml';
import {
  LEGACY,
  BASELINE,
  ADOPTION_KEY,
  CONFIRMATION,
  ATTESTATION,
  assertAdoptionContext,
  assertLegacy,
  assertGreenMain,
  readIsolation,
  allPages,
} from './cloudflare-legacy-adoption-control.mjs';
import {
  adoptIsolatedLegacy,
  completeCandidateInventory,
  requireEmptyAdoptionBucket,
} from './cloudflare-adopt-isolated-legacy.mjs';
import { requireArchivedDeployment } from './cloudflare-static-asset-archive.mjs';
import { preflightArchive } from './cloudflare-archive-preflight.mjs';
import { readDeploymentConfig } from './cloudflare-target-config.mjs';

const config = readDeploymentConfig(
  path.resolve(import.meta.dirname, '../wrangler.production.jsonc')
);
const env = {
  CLOUDFLARE_ACCOUNT_ID: LEGACY.accountId,
  WEBSITE_URL: LEGACY.origin,
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'vellira-dev/vellira',
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_WORKFLOW_REF:
    'vellira-dev/vellira/.github/workflows/adopt-website-cloudflare-legacy.yml@refs/heads/main',
  GITHUB_SHA: BASELINE,
  ADOPTION_MAIN_SHA: BASELINE,
  GITHUB_RUN_ID: '123',
  GITHUB_RUN_ATTEMPT: '1',
  GITHUB_ACTOR: 'operator',
  VELLIRA_BUILD_ID: `${BASELINE}-123-1`,
  ADOPTION_CONFIRMATION: CONFIRMATION,
  ADOPTION_NEVER_PUBLIC: ATTESTATION,
};
function snapshot() {
  return {
    worker: {
      name: LEGACY.worker,
      id: LEGACY.workerId,
      subdomain: { enabled: true, url: LEGACY.origin },
      references: {
        workers: [],
        domains: [],
        dispatch_namespace_outbounds: [],
      },
    },
    deployment: { versions: [{ version_id: LEGACY.version, percentage: 100 }] },
    buildId: LEGACY.buildId,
    domains: [],
    routes: [],
  };
}

test('adoption refuses every other identity, attachment and missing isolation proof', () => {
  assertLegacy(snapshot());
  const mutations = [
    (s) => (s.worker.name = 'vellira-website-staging'),
    (s) => (s.worker.id = 'recreated-worker'),
    (s) => (s.buildId = 'other-build'),
    (s) => (s.deployment.versions[0].version_id = 'other-version'),
    (s) => (s.deployment.versions[0].percentage = 99),
    (s) => s.deployment.versions.push({ version_id: 'other', percentage: 0 }),
    (s) => (s.worker.subdomain.enabled = false),
    (s) => (s.worker.subdomain.url = 'https://vellira.dev'),
    (s) => s.domains.push({ service: LEGACY.worker, hostname: 'vellira.dev' }),
    (s) =>
      s.domains.push({ service: LEGACY.worker, hostname: 'unrelated.example' }),
    (s) => s.routes.push({ script: LEGACY.worker, pattern: '*.vellira.dev/*' }),
    (s) =>
      s.routes.push({
        script: LEGACY.worker,
        pattern: 'another-zone.example/*',
      }),
    (s) => s.worker.references.workers.push({ name: 'public-proxy' }),
    (s) => delete s.worker.references,
    (s) => delete s.routes,
  ];
  for (const mutate of mutations) {
    const s = snapshot();
    mutate(s);
    assert.throws(() => assertLegacy(s));
  }
});

test('adoption requires dedicated main workflow, exact approved source and explicit historical attestation', () => {
  assertAdoptionContext(config, env);
  for (const key of Object.keys(env).filter(
    (key) => key !== 'VELLIRA_BUILD_ID'
  ))
    assert.throws(
      () => assertAdoptionContext(config, { ...env, [key]: '' }),
      key
    );
  for (const changed of [
    { name: 'vellira-website-staging' },
    { workers_dev: false },
    { routes: [{ pattern: 'vellira.dev/*' }] },
    { account_id: 'b'.repeat(32) },
    { r2_buckets: [{ binding: 'STATIC_ASSET_ARCHIVE', bucket_name: 'other' }] },
  ])
    assert.throws(() => assertAdoptionContext({ ...config, ...changed }, env));
});

test('main CI validation refuses moved main, stale green runs and missing or unsuccessful jobs', async () => {
  const good = {
    main: { object: { sha: BASELINE } },
    runs: {
      workflow_runs: [
        {
          id: 1,
          head_sha: BASELINE,
          head_branch: 'main',
          event: 'push',
          status: 'completed',
          conclusion: 'success',
        },
      ],
    },
    jobs: {
      total_count: 2,
      jobs: [
        'Build, Test & Validate',
        'Cloudflare cache and multi-deployment browser contracts',
      ].map((name) => ({ name, status: 'completed', conclusion: 'success' })),
    },
  };
  const get = (data) => async (url) =>
    url.includes('/git/ref/')
      ? data.main
      : url.includes('/jobs?')
        ? data.jobs
        : data.runs;
  await assertGreenMain(get(good), BASELINE);
  for (const mutate of [
    (s) => (s.main.object.sha = 'other'),
    (s) => (s.runs.workflow_runs[0].head_sha = 'other'),
    (s) => (s.jobs.jobs[0].conclusion = 'failure'),
    (s) => s.jobs.jobs.pop(),
    (s) => (s.runs.workflow_runs[0].event = 'pull_request'),
  ]) {
    const s = structuredClone(good);
    mutate(s);
    await assert.rejects(assertGreenMain(get(s), BASELINE));
  }
});

test('isolation pagination and permission errors fail closed; all account zones are checked', async () => {
  await assert.rejects(
    allPages(
      async () => ({ result: [], result_info: { total_count: 1 } }),
      '/domains'
    ),
    /Incomplete/
  );
  let pages = 0;
  assert.deepEqual(
    await allPages(
      async () => ({
        result: [++pages],
        result_info: { page: pages, total_pages: 2, total_count: 2 },
      }),
      '/zones'
    ),
    [1, 2]
  );
  const s = snapshot();
  const seen = [];
  const get = async (url) => {
    seen.push(url);
    if (url.includes('/workers/workers/')) return { result: s.worker };
    if (url.endsWith('/deployments'))
      return { result: { deployments: [s.deployment] } };
    if (url.startsWith('/zones?'))
      return {
        result: ['vellira.dev', 'second.example'].map((name, i) => ({
          id: `zone${i}`,
          name,
          account: { id: LEGACY.accountId },
        })),
      };
    if (url.startsWith('/zones/zone1/')) throw Error('HTTP 403');
    return { result: [] };
  };
  await assert.rejects(
    readIsolation(get, async () => new Response(LEGACY.buildId)),
    /403/
  );
  assert.ok(seen.some((url) => url.startsWith('/zones/zone1/')));
});

async function fixture() {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'vellira-adoption-test-')
  );
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("local test")}}',
      compatibilityDate: '2026-09-06',
      r2Buckets: ['ARCHIVE'],
    })
  );
  for (const tree of ['.next/static', '.open-next/assets/_next/static']) {
    await fs.mkdir(path.join(root, tree, 'chunks'), { recursive: true });
    await fs.writeFile(
      path.join(root, tree, 'chunks/app.js'),
      'export const app = 1;'
    );
    await fs.writeFile(
      path.join(root, tree, 'chunks/lazy.js'),
      'export const lazy = 2;'
    );
    await fs.writeFile(path.join(root, tree, 'style.css'), 'body{color:blue}');
  }
  const bucket = await mf.getR2Bucket('ARCHIVE');
  const events = [];
  const identity = { buildId: env.VELLIRA_BUILD_ID };
  const options = {
    config,
    env,
    bucket,
    checkLegacy: async () => {
      events.push('check-legacy');
      return { snapshot: snapshot() };
    },
    prepareCandidate: async () => ({
      identity,
      inventory: await completeCandidateInventory(root),
    }),
    verifyCandidate: () => completeCandidateInventory(root),
    dryRun: async () => {
      events.push('dry-run');
      await requireArchivedDeployment(bucket, identity.buildId);
    },
    activate: async () => {
      events.push('activate');
      await requireArchivedDeployment(bucket, identity.buildId);
    },
    postflight: async () => {
      events.push('postflight');
      const standard = await preflightArchive(config, LEGACY.origin, {
        accountId: LEGACY.accountId,
        log: () => {},
        fetchImpl: async () => new Response(identity.buildId),
        openArchive: async (_config, operation) => operation(bucket),
      });
      const after = snapshot();
      after.buildId = identity.buildId;
      after.deployment.versions[0].version_id = 'new-version';
      return { snapshot: after, standardPreflight: standard };
    },
  };
  return {
    root,
    bucket,
    options,
    events,
    dispose: async () => {
      await mf.dispose();
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}

test('one-time adoption uses real R2, normal archive verification, immutable evidence and standard postflight', async () => {
  const f = await fixture();
  try {
    await adoptIsolatedLegacy(f.options);
    assert.deepEqual(f.events, [
      'check-legacy',
      'dry-run',
      'check-legacy',
      'activate',
      'postflight',
    ]);
    const record = await (await f.bucket.get(ADOPTION_KEY)).json();
    assert.deepEqual(record.legacy, LEGACY);
    assert.equal(
      record.historicalNonAttachment.neverAttachedToPublicVelliraDev,
      true
    );
    assert.equal(record.candidate.sourceCommit, BASELINE);
    assert.equal(
      await f.bucket.get(`deployments/${LEGACY.buildId}.json`),
      null
    );
    await assert.rejects(
      requireArchivedDeployment(f.bucket, LEGACY.buildId),
      /has not been archived/
    );
    await requireArchivedDeployment(f.bucket, env.VELLIRA_BUILD_ID);
    assert.ok(
      await f.bucket.get(`adoption-completions/isolated-${LEGACY.version}.json`)
    );
    const before = await (await f.bucket.get(ADOPTION_KEY)).text();
    await assert.rejects(adoptIsolatedLegacy(f.options), /pristine empty/);
    assert.equal(await (await f.bucket.get(ADOPTION_KEY)).text(), before);
    assert.equal(f.events.filter((event) => event === 'activate').length, 1);
  } finally {
    await f.dispose();
  }
});

test('dirty or inaccessible archive, incomplete graph, collisions and late drift never activate', async (t) => {
  const cases = {
    'missing bucket': async (f) => {
      f.options.bucket = {
        list: async () => {
          throw Error('Bucket not found');
        },
      };
    },
    'pre-existing object': async (f) => {
      await f.bucket.put('unrelated', 'dirty');
    },
    'fake legacy manifest': async (f) => {
      await f.bucket.put(`deployments/${LEGACY.buildId}.json`, '{}');
    },
    'missing copied lazy chunk': async (f) => {
      await fs.unlink(
        path.join(f.root, '.open-next/assets/_next/static/chunks/lazy.js')
      );
    },
    'copied byte corruption': async (f) => {
      await fs.writeFile(
        path.join(f.root, '.open-next/assets/_next/static/chunks/app.js'),
        'corrupt'
      );
    },
    'candidate identity mismatch': async (f) => {
      const prepare = f.options.prepareCandidate;
      f.options.prepareCandidate = async () => ({
        ...(await prepare()),
        identity: { buildId: 'wrong' },
      });
    },
    'predecessor changes during dry run': async (f) => {
      let checks = 0;
      f.options.checkLegacy = async () => {
        const s = snapshot();
        if (++checks > 1) s.buildId = 'raced';
        return { snapshot: s };
      };
    },
    'new public attachment before activation': async (f) => {
      let checks = 0;
      f.options.checkLegacy = async () => {
        const s = snapshot();
        if (++checks > 1)
          s.domains.push({ service: LEGACY.worker, hostname: 'vellira.dev' });
        return { snapshot: s };
      };
    },
    'archive corruption before activation': async (f) => {
      f.options.dryRun = async () => {
        await f.bucket.put('assets/_next/static/chunks/app.js', 'corrupt');
      };
    },
    'archive MIME corruption': async (f) => {
      f.options.dryRun = async () => {
        const key = 'assets/_next/static/chunks/app.js';
        const old = await f.bucket.get(key);
        await f.bucket.put(key, await old.arrayBuffer(), {
          customMetadata: old.customMetadata,
          httpMetadata: { ...old.httpMetadata, contentType: 'text/html' },
        });
      };
    },
    'foreign archive object during dry run': async (f) => {
      f.options.dryRun = async () => {
        await f.bucket.put('unexpected', 'dirty');
      };
    },
    'local graph changes during dry run': async (f) => {
      f.options.dryRun = async () => {
        await fs.writeFile(
          path.join(f.root, '.open-next/assets/_next/static/chunks/lazy.js'),
          'changed'
        );
      };
    },
    'lost atomic adoption claim': async (f) => {
      f.options.bucket = {
        list: (...args) => f.bucket.list(...args),
        put: async () => null,
      };
    },
  };
  for (const [name, setup] of Object.entries(cases))
    await t.test(name, async () => {
      const f = await fixture();
      try {
        await setup(f);
        await assert.rejects(adoptIsolatedLegacy(f.options));
        assert.equal(f.events.includes('activate'), false);
      } finally {
        await f.dispose();
      }
    });
});

test('post-activation verification failure is not recorded as completion and cannot blindly retry', async () => {
  const f = await fixture();
  try {
    f.options.postflight = async () => {
      throw Error('Runtime or standard preflight failed');
    };
    await assert.rejects(adoptIsolatedLegacy(f.options), /preflight failed/);
    assert.ok(f.events.includes('activate'));
    assert.equal(
      await f.bucket.get(
        `adoption-completions/isolated-${LEGACY.version}.json`
      ),
      null
    );
    await assert.rejects(
      requireEmptyAdoptionBucket(f.bucket),
      /pristine empty/
    );
    await requireArchivedDeployment(f.bucket, env.VELLIRA_BUILD_ID);
  } finally {
    await f.dispose();
  }
});

test('dedicated workflow keeps every normal build/browser gate and target serialization', async () => {
  const workflow = async (name) =>
    parse(
      await fs.readFile(
        path.resolve(import.meta.dirname, `../../../.github/workflows/${name}`),
        'utf8'
      )
    );
  const normal = await workflow('deploy-website-cloudflare-production.yml');
  const adoption = await workflow('adopt-website-cloudflare-legacy.yml');
  assert.deepEqual(adoption.concurrency, normal.concurrency);
  assert.deepEqual(Object.keys(adoption.on), ['workflow_dispatch']);
  assert.match(adoption.jobs.deploy.if, /refs\/heads\/main/);
  assert.match(
    adoption.jobs.deploy.if,
    /inputs.expected_main_sha == github.sha/
  );
  assert.match(adoption.jobs.deploy.if, /I_CONFIRM_LEGACY_NEVER_PUBLIC/);
  const steps = adoption.jobs.deploy.steps;
  const runs = steps.map((step) => step.run).filter(Boolean);
  for (const step of normal.jobs.deploy.steps.filter((step) => step.run)) {
    if (/cloudflare-(archive-preflight|deploy)\.mjs/.test(step.run)) continue;
    assert.ok(runs.includes(step.run), `Missing normal gate: ${step.name}`);
  }
  const first = runs.findIndex((run) =>
    run.includes('cloudflare-adopt-isolated-legacy.mjs preflight')
  );
  const build = runs.findIndex((run) =>
    run.includes('opennextjs-cloudflare build')
  );
  const activation = runs.findIndex((run) =>
    run.includes('cloudflare-adopt-isolated-legacy.mjs adopt')
  );
  assert.ok(first >= 0 && first < build && build < activation);
  assert.ok(runs.indexOf('pnpm test:cloudflare-migration') < activation);
  assert.ok(
    runs.indexOf('node apps/website/scripts/cloudflare-runtime-contract.mjs') >
      activation
  );
});

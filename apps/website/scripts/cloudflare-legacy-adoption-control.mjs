import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validateDeploymentTarget } from './cloudflare-target-config.mjs';
import { deploymentIdentity } from '../cloudflare/build-identity.mjs';

// Deliberately not configurable: remove this module after the one adoption.
export const LEGACY = Object.freeze({
  accountId: '73faefeb9b4fe1f444cb03cd97275f02',
  worker: 'vellira-website',
  workerId: '5df676cc95354b57aeb8588fe2676746',
  version: 'a0314de6-3d91-4be7-9f1b-89664f762047',
  buildId: 'j1Ga_52JNrUFbfTjXlofU',
  sourceCommit: 'aae0f50b57cbef0df4e572ba7ded8993c9ba7e3a',
  deploymentRun: '34261147540',
  bucket: 'vellira-website-static-archive',
  origin: 'https://vellira-website.vellira.workers.dev',
});
export const ADOPTION_KEY = `adoptions/isolated-${LEGACY.version}.json`;
export const BASELINE = 'e9b1f44293ea78a1eb21751d8b3d1935052a4243';
export const CONFIRMATION = 'ADOPT_ISOLATED_A0314DE6_ONCE';
export const ATTESTATION = 'I_CONFIRM_LEGACY_NEVER_PUBLIC';

export function assertAdoptionContext(config, env) {
  validateDeploymentTarget(config);
  assert.equal(config.name, LEGACY.worker);
  assert.equal(config.workers_dev, true);
  assert.equal(env.CLOUDFLARE_ACCOUNT_ID, LEGACY.accountId);
  if (config.account_id) assert.equal(config.account_id, LEGACY.accountId);
  assert.equal(config.r2_buckets.length, 1);
  assert.equal(config.r2_buckets[0].bucket_name, LEGACY.bucket);
  assert.equal(env.WEBSITE_URL, LEGACY.origin);
  assert.equal(env.GITHUB_ACTIONS, 'true', 'Adoption is workflow-only');
  assert.equal(env.GITHUB_REPOSITORY, 'vellira-dev/vellira');
  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch');
  assert.equal(env.GITHUB_REF, 'refs/heads/main');
  assert.equal(
    env.GITHUB_WORKFLOW_REF,
    'vellira-dev/vellira/.github/workflows/adopt-website-cloudflare-legacy.yml@refs/heads/main'
  );
  assert.match(env.ADOPTION_MAIN_SHA ?? '', /^[a-f0-9]{40}$/);
  assert.equal(env.GITHUB_SHA, env.ADOPTION_MAIN_SHA);
  assert.equal(env.ADOPTION_CONFIRMATION, CONFIRMATION);
  assert.equal(
    env.ADOPTION_NEVER_PUBLIC,
    ATTESTATION,
    'Historical non-attachment requires explicit operator attestation'
  );
  assert.ok(env.GITHUB_ACTOR && env.GITHUB_RUN_ID && env.GITHUB_RUN_ATTEMPT);
  deploymentIdentity({ ...env, VELLIRA_DEPLOYABLE: '1' });
}

export async function jsonGet(origin, pathname, token, fetchImpl = fetch) {
  assert.ok(token, 'Explicit API credential required');
  const response = await fetchImpl(new URL(pathname, origin), {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(
    response.status,
    200,
    `Read-only prerequisite failed: ${pathname} HTTP ${response.status}`
  );
  const data = await response.json();
  assert.notEqual(data.success, false, `API prerequisite failed: ${pathname}`);
  return data;
}

export async function allPages(get, pathname) {
  const items = [];
  for (let page = 1; page <= 100; page++) {
    const url = new URL(pathname, 'https://api.cloudflare.com');
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', '50');
    const data = await get(url.pathname + url.search);
    assert.ok(Array.isArray(data.result), 'Missing API list');
    items.push(...data.result);
    const info = data.result_info;
    if (info?.total_pages > page) {
      assert.equal(info.page, page, 'Pagination did not advance');
      continue;
    }
    if (info?.total_count !== undefined)
      assert.equal(items.length, info.total_count, 'Incomplete API list');
    return items;
  }
  throw Error('API pagination exceeded adoption limit');
}

export async function readIsolation(get, fetchImpl = fetch) {
  const base = `/accounts/${LEGACY.accountId}/workers`;
  const script = `${base}/scripts/${LEGACY.worker}`;
  const worker = (await get(`${base}/workers/${LEGACY.worker}`)).result;
  const deployment = (await get(`${script}/deployments`)).result
    ?.deployments?.[0];
  const domains = await allPages(get, `${base}/domains`);
  const zones = await allPages(get, `/zones?account.id=${LEGACY.accountId}`);
  assert.ok(
    zones.some((zone) => zone.name === 'vellira.dev'),
    'Public zone not visible to deployment credential'
  );
  const routes = [];
  for (const zone of zones) {
    assert.equal(zone.account?.id, LEGACY.accountId);
    routes.push(...(await allPages(get, `/zones/${zone.id}/workers/routes`)));
  }
  const response = await fetchImpl(
    `${LEGACY.origin}/BUILD_ID?legacy-adoption=${randomUUID()}`,
    {
      cache: 'no-store',
      redirect: 'error',
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(30_000),
    }
  );
  assert.equal(response.status, 200, 'Cannot identify active BUILD_ID');
  const snapshot = {
    at: new Date().toISOString(),
    worker,
    deployment,
    domains,
    routes,
    buildId: (await response.text()).trim(),
    zoneIds: zones.map((zone) => zone.id),
  };
  assertIsolation(snapshot);
  return snapshot;
}

export function assertIsolation(snapshot) {
  assert.equal(snapshot.worker?.name, LEGACY.worker);
  assert.equal(snapshot.worker?.id, LEGACY.workerId, 'Worker was replaced');
  assert.equal(snapshot.worker.subdomain?.enabled, true);
  assert.equal(snapshot.worker.subdomain.url, LEGACY.origin);
  assert.ok(Array.isArray(snapshot.domains) && Array.isArray(snapshot.routes));
  assert.equal(
    snapshot.domains.some((domain) => domain.service === LEGACY.worker),
    false,
    'Worker has a custom-domain attachment'
  );
  assert.equal(
    snapshot.routes.some((route) => route.script === LEGACY.worker),
    false,
    'Worker has a route attachment'
  );
  // Fail closed for indirect public service/dispatch consumers too.
  for (const key of ['workers', 'domains', 'dispatch_namespace_outbounds'])
    assert.deepEqual(
      snapshot.worker.references?.[key],
      [],
      `Worker has ${key} references`
    );
  assert.equal(
    snapshot.deployment?.versions?.length,
    1,
    'Split traffic is forbidden'
  );
  assert.equal(snapshot.deployment.versions[0].percentage, 100);
}

export function assertLegacy(snapshot) {
  assertIsolation(snapshot);
  assert.equal(snapshot.buildId, LEGACY.buildId, 'Unexpected legacy BUILD_ID');
  assert.equal(
    snapshot.deployment.versions[0].version_id,
    LEGACY.version,
    'Unexpected legacy Worker version'
  );
}

export async function assertGreenMain(get, sha) {
  const repo = '/repos/vellira-dev/vellira';
  assert.equal(
    (await get(`${repo}/git/ref/heads/main`)).object?.sha,
    sha,
    'main moved; require a newly reviewed exact main SHA'
  );
  const runs = await get(
    `${repo}/actions/workflows/ci.yml/runs?branch=main&event=push&head_sha=${sha}&status=success&per_page=100`
  );
  const run = runs.workflow_runs?.find(
    (item) =>
      item.head_sha === sha &&
      item.head_branch === 'main' &&
      item.event === 'push' &&
      item.status === 'completed' &&
      item.conclusion === 'success'
  );
  assert.ok(run, 'Exact-main CI is not successful');
  const jobs = await get(`${repo}/actions/runs/${run.id}/jobs?per_page=100`);
  assert.equal(
    jobs.jobs?.length,
    jobs.total_count,
    'Incomplete CI job response'
  );
  for (const name of [
    'Build, Test & Validate',
    'Cloudflare cache and multi-deployment browser contracts',
  ])
    assert.ok(
      jobs.jobs.some(
        (job) =>
          job.name === name &&
          job.status === 'completed' &&
          job.conclusion === 'success'
      ),
      `Missing successful exact-main job: ${name}`
    );
  return {
    sha,
    runId: run.id,
    jobs: jobs.jobs.map(({ name, conclusion }) => ({ name, conclusion })),
  };
}

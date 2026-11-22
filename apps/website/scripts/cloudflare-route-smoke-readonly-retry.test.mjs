import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyRouteSmokeRetry, retryRouteSmokeReadOnly } from './cloudflare-route-smoke-readonly-retry.mjs';

const job = {
  name: 'Build, deploy, and verify merged main on website staging',
  conclusion: 'failure',
  steps: [
    { name: 'Deploy website staging to Cloudflare Workers', conclusion: 'success' },
    { name: 'Smoke test deployed routes', status: 'completed', conclusion: 'failure' },
  ],
};
const jobs = { total_count: 1, jobs: [job] };

test('only exact failed route smoke is selectable', () => {
  assert.deepEqual(classifyRouteSmokeRetry({ jobs }), {
    eligible: true, failedStep: 'Smoke test deployed routes',
  });
});

test('rejects different failures, duplicate or truncated job evidence', () => {
  for (const invalid of [
    { total_count: 0, jobs: [job] },
    { total_count: 100, jobs: [job] },
    { total_count: 1, jobs: [{ ...job, conclusion: 'success' }] },
    { total_count: 1, jobs: [{ ...job, steps: [
      job.steps[0], { ...job.steps[1], name: 'Verify deployed identities, freshness and immutable bytes' },
    ] }] },
    { total_count: 1, jobs: [{ ...job, steps: [
      ...job.steps, { name: 'Smoke test static chunk integrity', conclusion: 'failure' },
    ] }] },
    { total_count: 1, jobs: [{ ...job, steps: [...job.steps, job.steps[1]] }] },
    { total_count: 2, jobs: [job, job] },
  ]) {
    assert.throws(() => classifyRouteSmokeRetry({ jobs: invalid }));
  }
});

test('retries exactly seven public read-only GET routes, bounded to three attempts', async () => {
  const visited = [];
  const expected = ['/', '/components/switch', '/blog', '/blog/two-runtimes',
    '/blog/rss.xml', '/sitemap.xml', '/robots.txt'];
  const bodies = [
    'Vellira',
    'data-component-explorer-main >Switch</h1>',
    '<h1>Blog</h1> aria-label="Published articles"',
    'One Design System, Two Runtimes data-language="ts"',
    '<rss version="2.0"',
    '<urlset', 'User-Agent: *',
  ];
  const result = await retryRouteSmokeReadOnly({
    fetchImpl: async (url, init) => {
      assert.equal(init.method, 'GET');
      assert.equal(init.redirect, 'error');
      assert.equal(url.origin, 'https://vellira-website-staging.vellira.workers.dev');
      visited.push(url.pathname);
      return { status: 200, text: async () => bodies[expected.indexOf(url.pathname)] };
    },
    sleep: async () => { throw Error('Unexpected retry sleep'); },
    log: () => {},
  });
  assert.deepEqual(visited, expected);
  assert.equal(result.status, 'diagnostic-route-smoke-passed');
  assert.equal(result.routes, 7);
});

test('failing route gets at most three requests, never writes or promotes', async () => {
  const calls = [];
  await assert.rejects(retryRouteSmokeReadOnly({
    fetchImpl: async (url, init) => {
      calls.push([url.pathname, init.method]);
      return { status: 503, text: async () => '' };
    },
    sleep: async () => {},
    log: () => {},
  }), /Read-only route smoke failed: \/$/);
  assert.deepEqual(calls, [['/', 'GET'], ['/', 'GET'], ['/', 'GET']]);
});

test('noncanonical origin and attempts are forbidden', async () => {
  await assert.rejects(retryRouteSmokeReadOnly({
    base: 'https://vellira.dev',
  }), /Only canonical staging/);
  await assert.rejects(retryRouteSmokeReadOnly({
    maxAttempts: 4,
  }), /fixed to three/);
});

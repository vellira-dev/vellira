import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { Miniflare } from 'miniflare';

import { UTC_DAY_MS } from '../cloudflare/newsletter-fixed-utc-day-model.mjs';
import { NewsletterVersionFenceCandidate } from '../cloudflare/newsletter-version-fence-candidate.mjs';

const root = path.resolve(import.meta.dirname, '..');
const files = [
  'scripts/newsletter-version-fence-fixture.mjs',
  'cloudflare/newsletter-version-fence-candidate.mjs',
  'cloudflare/newsletter-fixed-utc-migration.mjs',
  'cloudflare/newsletter-fixed-utc-day-model.mjs',
  'cloudflare/newsletter-rolling-window-model.mjs',
  'cloudflare/newsletter-rolling-response.mjs',
];

function localWorkers(persistPath, capacity = '2') {
  const owner = {
    config: {
      type: 'worker',
      name: 'version-fence-local-owner',
      compatibilityDate: '2026-09-06',
      manifest: {
        mainModule: files[0],
        modules: Object.fromEntries(
          files.map((name) => [
            name,
            { type: 'esm', contents: readFileSync(path.join(root, name), 'utf8') },
          ])
        ),
      },
      env: {
        NEWSLETTER_GLOBAL_BUDGET_CAPACITY: { type: 'text', value: capacity },
        TEST_BUDGET: {
          type: 'durable-object',
          worker: 'version-fence-local-owner',
          exportName: 'TestNewsletterVersionFence',
        },
      },
      exports: {
        TestNewsletterVersionFence: { type: 'durable-object', storage: 'sqlite' },
      },
    },
  };
  const consumer = [
    'export default {',
    '  fetch(request, env) {',
    '    const url = new URL(request.url);',
    '    const version = url.pathname === "/fixed" ? "fixed" : "legacy";',
    '    return env.SHARED.getByName("one-buttondown-account").fetch(',
    '      new Request("https://budget.internal/admit/" + version, {',
    '        method: "POST",',
    '        headers: { "x-test-clock": request.headers.get("x-test-clock") ?? "0" },',
    '      })',
    '    );',
    '  },',
    '};',
  ].join('\n');
  const callers = ['local-legacy-site', 'local-fixed-site'].map((name) => ({
    config: {
      type: 'worker',
      name,
      compatibilityDate: '2026-09-06',
      manifest: {
        mainModule: 'consumer.mjs',
        modules: {
          'consumer.mjs': { type: 'esm', contents: consumer },
        },
      },
      env: {
        SHARED: {
          type: 'durable-object',
          worker: 'version-fence-local-owner',
          exportName: 'TestNewsletterVersionFence',
        },
      },
    },
  }));
  return new Miniflare({
    resourcePersistencePath: persistPath,
    workers: [owner, ...callers],
  });
}

const attempt = (worker, version, now) =>
  worker.fetch('https://local.test/' + version, {
    method: 'POST',
    headers: { 'x-test-clock': String(now) },
  });

test('cutover is a single durable fence across cooperative site versions', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vellira-version-fence-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const mf = localWorkers(dir);
  t.after(() => mf.dispose());
  const legacy = await mf.getWorker('local-legacy-site');
  const fixed = await mf.getWorker('local-fixed-site');
  const owner = await mf.getWorker('version-fence-local-owner');

  assert.equal((await attempt(legacy, 'legacy', 1_000)).status, 200);

  const races = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      attempt(i % 2 === 0 ? legacy : fixed,
        i % 2 === 0 ? 'legacy' : 'fixed', 2_000)
    )
  );
  assert.ok(races.every((response) => [200, 429, 503].includes(response.status)));
  const state = await (await owner.fetch('https://budget.internal/__test/state')).json();
  assert.equal(state.version, 'fixed');
  assert.equal(state.fixed.spent, 2);

  const obsolete = await Promise.all(
    Array.from({ length: 10 }, () => attempt(legacy, 'legacy', 3_000))
  );
  assert.ok(obsolete.every((response) => response.status === 503));

  const afterMidnight = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      attempt(i % 2 === 0 ? legacy : fixed,
        i % 2 === 0 ? 'legacy' : 'fixed', UTC_DAY_MS)
    )
  );
  assert.equal(afterMidnight.filter((response) => response.status === 200).length, 2);
  assert.equal(afterMidnight.filter((response) => response.status === 503).length, 6);
  assert.equal(afterMidnight.filter((response) => response.status === 429).length, 4);
});

test('version fence survives restart and prohibits rollback to legacy writer', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vellira-version-restart-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const original = localWorkers(dir, '1');
  try {
    const site = await original.getWorker('local-fixed-site');
    assert.equal((await attempt(site, 'fixed', 1_000)).status, 429);
  } finally {
    await original.dispose();
  }
  const restarted = localWorkers(dir, '1');
  try {
    const old = await restarted.getWorker('local-legacy-site');
    const current = await restarted.getWorker('local-fixed-site');
    assert.equal((await attempt(old, 'legacy', UTC_DAY_MS)).status, 503);
    assert.equal((await attempt(current, 'fixed', UTC_DAY_MS)).status, 200);
    assert.equal((await attempt(current, 'fixed', UTC_DAY_MS)).status, 429);
  } finally {
    await restarted.dispose();
  }
});

test('unknown markers and inconsistent cutover fail closed', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vellira-version-invalid-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const mf = localWorkers(dir);
  t.after(() => mf.dispose());
  const owner = await mf.getWorker('version-fence-local-owner');
  const legacy = await mf.getWorker('local-legacy-site');
  const fixed = await mf.getWorker('local-fixed-site');
  const seed = (key, value) => owner.fetch('https://budget.internal/__test/seed', {
    method: 'POST',
    body: JSON.stringify({ key, value }),
  });
  assert.equal((await seed('newsletter-coordinator-version-v1', 'unknown')).status, 204);
  assert.equal((await attempt(legacy, 'legacy', 1_000)).status, 503);
  assert.equal((await attempt(fixed, 'fixed', 1_000)).status, 503);
});

test('failed fence persistence never acknowledges an admission', async () => {
  const coordinator = new NewsletterVersionFenceCandidate(
    {
      storage: {
        transaction: async (callback) => callback({
          get: async () => undefined,
          put: async () => { throw new Error('write failed'); },
        }),
      },
    },
    { NEWSLETTER_GLOBAL_BUDGET_CAPACITY: '2' }
  );
  const response = await coordinator.fetch(
    new Request('https://budget.internal/admit/fixed', { method: 'POST' })
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'unavailable');
});

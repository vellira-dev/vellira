import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { Miniflare } from 'miniflare';

import { NewsletterFixedUtcTransactionalCandidate } from '../cloudflare/newsletter-fixed-utc-transactional-candidate.mjs';
import { UTC_DAY_MS } from '../cloudflare/newsletter-fixed-utc-day-model.mjs';

const root = path.resolve(import.meta.dirname, '..');
const ownerModules = [
  'scripts/newsletter-fixed-utc-transactional-fixture.mjs',
  'cloudflare/newsletter-fixed-utc-transactional-candidate.mjs',
  'cloudflare/newsletter-fixed-utc-migration.mjs',
  'cloudflare/newsletter-fixed-utc-day-model.mjs',
  'cloudflare/newsletter-rolling-window-model.mjs',
  'cloudflare/newsletter-rolling-response.mjs',
];

function makeMiniflare(persistPath, capacity = '2') {
  const owner = {
    config: {
      type: 'worker',
      name: 'local-budget-owner',
      compatibilityDate: '2026-09-06',
      manifest: {
        mainModule: ownerModules[0],
        modules: Object.fromEntries(ownerModules.map((name) => [
          name,
          { type: 'esm', contents: readFileSync(path.join(root, name), 'utf8') },
        ])),
      },
      env: {
        NEWSLETTER_GLOBAL_BUDGET_CAPACITY: { type: 'text', value: capacity },
        TEST_BUDGET: {
          type: 'durable-object',
          worker: 'local-budget-owner',
          exportName: 'TestFixedUtcCoordinator',
        },
      },
      exports: {
        TestFixedUtcCoordinator: { type: 'durable-object', storage: 'sqlite' },
      },
    },
  };
  const consumer = [
    'export default {',
    '  fetch(request, env) {',
    '    return env.SHARED_BUDGET.getByName("one-buttondown-account").fetch(',
    '      new Request("https://budget.internal/admit", {',
    '        method: "POST",',
    '        headers: { "x-test-now": request.headers.get("x-test-now") ?? "0" },',
    '      })',
    '    );',
    '  },',
    '};',
  ].join('\n');
  const workers = ['local-site-a', 'local-site-b'].map((name) => ({
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
        SHARED_BUDGET: {
          type: 'durable-object',
          worker: 'local-budget-owner',
          exportName: 'TestFixedUtcCoordinator',
        },
      },
    },
  }));
  return new Miniflare({
    resourcePersistencePath: persistPath,
    workers: [owner, ...workers],
  });
}

const admit = (worker, now) =>
  worker.fetch('https://site.test/attempt', {
    method: 'POST',
    headers: { 'x-test-now': String(now) },
  });

test('transactional cutover fences both website Workers until UTC midnight', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vellira-fixed-cutover-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const mf = makeMiniflare(dir);
  t.after(() => mf.dispose());
  const owner = await mf.getWorker('local-budget-owner');
  const siteA = await mf.getWorker('local-site-a');
  const siteB = await mf.getWorker('local-site-b');
  const seeded = await owner.fetch('https://budget.internal/__test/seed', {
    method: 'POST',
    body: JSON.stringify({
      key: 'rolling-v1',
      value: { attempts: [1_000], lastSeen: 1_000 },
    }),
  });
  assert.equal(seeded.status, 204);
  const firstDay = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      admit(i % 2 === 0 ? siteA : siteB, 2_000)
    )
  );
  assert.ok(firstDay.every((response) => response.status === 429));

  const state = await owner.fetch('https://budget.internal/__test/state');
  const persisted = await state.json();
  assert.deepEqual(persisted.fixed, {
    dayStart: 0,
    spent: 2,
    lastSeen: 2_000,
  });
  assert.deepEqual(persisted.legacy, {
    attempts: [1_000],
    lastSeen: 1_000,
  });

  const secondDay = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      admit(i % 2 === 0 ? siteA : siteB, UTC_DAY_MS)
    )
  );
  assert.equal(secondDay.filter((response) => response.status === 200).length, 2);
  assert.equal(secondDay.filter((response) => response.status === 429).length, 10);
  assert.ok(
    [...firstDay, ...secondDay].every(
      (response) => response.headers.get('cache-control') === 'no-store'
    )
  );
});

test('first-day fence survives complete Miniflare restart', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vellira-fixed-restart-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const first = makeMiniflare(dir, '1');
  try {
    const a = await first.getWorker('local-site-a');
    assert.equal((await admit(a, 1_000)).status, 429);
  } finally {
    await first.dispose();
  }
  const restarted = makeMiniflare(dir, '1');
  try {
    const b = await restarted.getWorker('local-site-b');
    assert.equal((await admit(b, 2_000)).status, 429);
    assert.equal((await admit(b, UTC_DAY_MS)).status, 200);
    assert.equal((await admit(b, UTC_DAY_MS)).status, 429);
  } finally {
    await restarted.dispose();
  }
});

test('failed transactional commit returns unavailable, not an admission', async () => {
  const coordinator = new NewsletterFixedUtcTransactionalCandidate(
    {
      storage: {
        transaction: async (callback) => {
          await callback({
            get: async () => undefined,
            put: async () => {
              throw new Error('storage commit failed');
            },
          });
          throw new Error('commit failed');
        },
      },
    },
    { NEWSLETTER_GLOBAL_BUDGET_CAPACITY: '2' }
  );
  const response = await coordinator.fetch(
    new Request('https://budget.internal/admit', { method: 'POST' })
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'unavailable');
});

test('invalid persisted fixed state never resets at midnight', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vellira-fixed-corrupt-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const mf = makeMiniflare(dir);
  t.after(() => mf.dispose());
  const owner = await mf.getWorker('local-budget-owner');
  const seeded = await owner.fetch('https://budget.internal/__test/seed', {
    method: 'POST',
    body: JSON.stringify({
      key: 'fixed-utc-v1',
      value: null,
    }),
  });
  assert.equal(seeded.status, 204);
  const a = await mf.getWorker('local-site-a');
  for (const now of [1_000, UTC_DAY_MS, UTC_DAY_MS + 1]) {
    const response = await admit(a, now);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'unavailable');
  }
});

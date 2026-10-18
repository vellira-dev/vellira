import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { Miniflare } from 'miniflare';

function createMiniflare(persistPath, capacity = '7') {
  const root = path.resolve(import.meta.dirname, '..');
  const files = [
    'scripts/newsletter-rolling-miniflare-fixture.mjs',
    'cloudflare/newsletter-rolling-budget-coordinator.mjs',
    'cloudflare/newsletter-rolling-window-model.mjs',
    'cloudflare/newsletter-rolling-response.mjs',
  ];
  return new Miniflare({
    resourcePersistencePath: persistPath,
    workers: [
      {
        config: {
          type: 'worker',
          name: 'newsletter-rolling-local-test',
          compatibilityDate: '2026-09-06',
          manifest: {
            mainModule: files[0],
            modules: Object.fromEntries(
              files.map((name) => [
                name,
                {
                  type: 'esm',
                  contents: readFileSync(path.join(root, name), 'utf8'),
                },
              ])
            ),
          },
          env: {
            NEWSLETTER_GLOBAL_BUDGET_CAPACITY: {
              type: 'text',
              value: capacity,
            },
            TEST_ROLLING_BUDGET: {
              type: 'durable-object',
              worker: 'newsletter-rolling-local-test',
              exportName: 'TestNewsletterRollingBudgetCoordinator',
            },
          },
          exports: {
            TestNewsletterRollingBudgetCoordinator: {
              type: 'durable-object',
              storage: 'sqlite',
            },
          },
        },
      },
    ],
  });
}

const admit = (mf) =>
  mf.dispatchFetch('http://localhost:8787/admit', { method: 'POST' });

test('rolling coordinator serializes 25 requests with capacity 7', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vellira-rolling-do-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const mf = createMiniflare(dir);
  t.after(() => mf.dispose());
  const results = await Promise.all(Array.from({ length: 25 }, () => admit(mf)));
  assert.equal(results.filter((r) => r.status === 200).length, 7);
  assert.equal(results.filter((r) => r.status === 429).length, 18);
  assert.ok(results.every((r) => r.headers.get('cache-control') === 'no-store'));
});

test('rolling coordinator preserves exhausted state over runtime restart', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vellira-rolling-restart-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const first = createMiniflare(dir, '1');
  try {
    assert.equal((await admit(first)).status, 200);
    assert.equal((await admit(first)).status, 429);
  } finally {
    await first.dispose();
  }
  const second = createMiniflare(dir, '1');
  try {
    assert.equal((await admit(second)).status, 429);
  } finally {
    await second.dispose();
  }
});

test('rolling coordinator refuses invalid capacity without admitting', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vellira-rolling-invalid-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const mf = createMiniflare(dir, 'invalid');
  t.after(() => mf.dispose());
  const result = await admit(mf);
  assert.equal(result.status, 503);
  assert.equal((await result.json()).code, 'unavailable');
});

test('persisted null fails closed without resetting the budget', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vellira-rolling-corrupt-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const mf = createMiniflare(dir, '1');
  const base = 'http://localhost:8787';
  const inspect = (instance) =>
    instance.dispatchFetch(base + '/__test/inspect', { method: 'GET' });
  try {
    const seeded = await mf.dispatchFetch(base + '/__test/seed-null', {
      method: 'POST',
    });
    assert.equal(seeded.status, 204);

    const before = await inspect(mf);
    assert.deepEqual(await before.json(), { isNull: true, isMissing: false });

    for (let i = 0; i < 2; i++) {
      const denied = await admit(mf);
      assert.equal(denied.status, 503);
      assert.equal(denied.headers.get('cache-control'), 'no-store');
      assert.equal((await denied.json()).code, 'unavailable');
    }
    const after = await inspect(mf);
    assert.deepEqual(await after.json(), { isNull: true, isMissing: false });
  } finally {
    await mf.dispose();
  }

  const restarted = createMiniflare(dir, '1');
  try {
    assert.equal((await admit(restarted)).status, 503);
    const persisted = await inspect(restarted);
    assert.deepEqual(await persisted.json(), {
      isNull: true,
      isMissing: false,
    });
  } finally {
    await restarted.dispose();
  }
});

test('candidate remains absent from deployed Workers and Wrangler targets', async () => {
  const root = path.resolve(import.meta.dirname, '..');
  for (const name of [
    'cloudflare-worker.mjs',
    'cloudflare/newsletter-budget-owner-worker.mjs',
    'wrangler.jsonc',
    'wrangler.production.jsonc',
  ]) {
    const source = readFileSync(path.join(root, name), 'utf8');
    assert.doesNotMatch(source, /NewsletterRollingBudgetCoordinator/);
    assert.doesNotMatch(source, /newsletter-rolling-budget-coordinator/);
  }
});

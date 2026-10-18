import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { Miniflare } from 'miniflare';

const entry = path.resolve(
  import.meta.dirname,
  'newsletter-budget-miniflare-fixture.mjs'
);

function createMiniflare(persistPath, capacity = '7') {
  return new Miniflare({
    modules: true,
    scriptPath: entry,
    durableObjects: { TEST_NEWSLETTER_BUDGET: 'NewsletterBudgetCoordinator' },
    durableObjectsPersist: persistPath,
    bindings: { NEWSLETTER_GLOBAL_BUDGET_CAPACITY: capacity },
  });
}

const url = 'http://localhost:8787/admit';
const admit = (mf) => mf.dispatchFetch(url, { method: 'POST' });

test('actual local Durable Object admits at most N concurrent requests', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vellira-budget-do-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const mf = createMiniflare(dir);
  t.after(() => mf.dispose());
  const responses = await Promise.all(
    Array.from({ length: 25 }, () => admit(mf))
  );
  assert.equal(responses.filter((res) => res.status === 200).length, 7);
  assert.equal(responses.filter((res) => res.status === 429).length, 18);
  assert.ok(
    responses.every((res) => res.headers.get('cache-control') === 'no-store')
  );
});

test('Durable Object storage survives a Miniflare runtime restart', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vellira-budget-restart-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const first = createMiniflare(dir, '1');
  try {
    assert.equal((await admit(first)).status, 200);
  } finally {
    await first.dispose();
  }
  const restarted = createMiniflare(dir, '1');
  try {
    assert.equal((await admit(restarted)).status, 429);
  } finally {
    await restarted.dispose();
  }
});

test('invalid coordinator capacity fails closed without subscriber writes', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vellira-budget-invalid-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const mf = createMiniflare(dir, 'invalid');
  t.after(() => mf.dispose());
  const response = await admit(mf);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'unavailable');
});

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

test('rolling candidate remains detached from deployed website Workers', () => {
  const root = path.resolve(import.meta.dirname, '..');
  for (const name of [
    'cloudflare-worker.mjs',
    'wrangler.jsonc',
    'wrangler.production.jsonc',
  ]) {
    const source = readFileSync(path.join(root, name), 'utf8');
    assert.doesNotMatch(source, /NewsletterRollingBudgetCoordinator/);
    assert.doesNotMatch(source, /newsletter-rolling-budget-coordinator/);
    assert.doesNotMatch(source, /vellira-newsletter-budget-owner/);
  }

  // The *undeployed* dedicated owner may export this candidate class.
  // It is not an activation path for either canonical website Worker.
  const owner = readFileSync(
    path.join(root, 'cloudflare/newsletter-budget-owner-worker.mjs'),
    'utf8'
  );
  assert.match(
    owner,
    /export \{ NewsletterRollingBudgetCoordinator \} from '\.\/newsletter-rolling-budget-coordinator\.mjs'/
  );
});


// Offline cross-Worker proof: two independently named website simulations
// connect to one standalone owner namespace. No canonical website configuration,
// network provider request, production secret or Cloudflare account is involved.
function createSharedOwnerMiniflare(persistPath, capacity = '7') {
  const root = path.resolve(import.meta.dirname, '..');
  const plan = JSON.parse(
    readFileSync(
      path.join(root, 'cloudflare/newsletter-budget-namespace-plan.json'),
      'utf8'
    )
  );
  const ownerFiles = [
    'cloudflare/newsletter-budget-owner-worker.mjs',
    'cloudflare/newsletter-rolling-budget-coordinator.mjs',
    'cloudflare/newsletter-rolling-window-model.mjs',
    'cloudflare/newsletter-rolling-response.mjs',
  ];
  const ownerWorker = {
    config: {
      type: 'worker',
      name: plan.owner.worker,
      compatibilityDate: '2026-09-06',
      manifest: {
        mainModule: ownerFiles[0],
        modules: Object.fromEntries(
          ownerFiles.map((name) => [
            name,
            { type: 'esm', contents: readFileSync(path.join(root, name), 'utf8') },
          ])
        ),
      },
      env: {
        NEWSLETTER_GLOBAL_BUDGET_CAPACITY: {
          type: 'text',
          value: capacity,
        },
      },
      exports: {
        [plan.owner.className]: {
          type: 'durable-object',
          storage: 'sqlite',
        },
      },
    },
  };
  const consumerSource = [
    'export default {',
    '  fetch(request, env) {',
    '    const url = new URL(request.url);',
    "    if (request.method !== 'POST' || url.pathname !== '/attempt')",
    "      return new Response(null, { status: 404 });",
    '    return env.NEWSLETTER_GLOBAL_BUDGET.getByName(',
    '      "one-buttondown-account"',
    '    ).fetch(new Request("https://budget.internal/admit", { method: "POST" }));',
    '  },',
    '};',
  ].join('\n');
  const siteWorkers = plan.targets.map((target) => {
    assert.equal(target.binding.name, 'NEWSLETTER_GLOBAL_BUDGET');
    assert.equal(target.binding.script_name, plan.owner.worker);
    assert.equal(target.binding.class_name, plan.owner.className);
    assert.equal(target.objectName, plan.owner.objectName);
    assert.equal(target.mode, '0');
    return {
      config: {
        type: 'worker',
        name: target.websiteWorker,
        compatibilityDate: '2026-09-06',
        manifest: {
          mainModule: 'test-cross-worker-consumer.mjs',
          modules: {
            'test-cross-worker-consumer.mjs': {
              type: 'esm',
              contents: consumerSource,
            },
          },
        },
        env: {
          NEWSLETTER_GLOBAL_BUDGET: {
            type: 'durable-object',
            worker: plan.owner.worker,
            exportName: plan.owner.className,
          },
        },
      },
    };
  });
  return new Miniflare({
    resourcePersistencePath: persistPath,
    workers: [ownerWorker, ...siteWorkers],
  });
}

test('two independently named site Workers share one atomic account budget', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vellira-shared-budget-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const mf = createSharedOwnerMiniflare(dir, '7');
  t.after(() => mf.dispose());

  const staging = await mf.getWorker('vellira-website-staging');
  const production = await mf.getWorker('vellira-website');
  const owner = await mf.getWorker('vellira-newsletter-budget-owner');

  // The owner entrypoint remains inaccessible as a subscriber endpoint:
  // only bound Durable Object stubs may reach its /admit method.
  const publicAttempt = await owner.fetch('https://budget.internal/admit', {
    method: 'POST',
  });
  assert.equal(publicAttempt.status, 404);

  const attempts = await Promise.all(
    Array.from({ length: 30 }, (_, index) => {
      const caller = index % 2 === 0 ? staging : production;
      return caller.fetch('https://site.test/attempt?account=other', {
        method: 'POST',
        headers: {
          Origin: index % 2 === 0 ? 'https://vellira.dev' : 'https://elsewhere.test',
          'X-Budget-Key': 'client-cannot-choose-namespace',
        },
      });
    })
  );
  assert.equal(attempts.filter((result) => result.status === 200).length, 7);
  assert.equal(attempts.filter((result) => result.status === 429).length, 23);
  assert.ok(
    attempts.every((result) => result.headers.get('cache-control') === 'no-store')
  );
  assert.equal(
    (await production.fetch('https://site.test/attempt', { method: 'POST' })).status,
    429
  );
  assert.equal(
    (await staging.fetch('https://site.test/attempt', { method: 'POST' })).status,
    429
  );
});

test('a shared budget remains exhausted for both site Workers across restart', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vellira-shared-restart-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  const first = createSharedOwnerMiniflare(dir, '1');
  try {
    const staging = await first.getWorker('vellira-website-staging');
    const production = await first.getWorker('vellira-website');
    assert.equal(
      (await staging.fetch('https://site.test/attempt', { method: 'POST' })).status,
      200
    );
    assert.equal(
      (await production.fetch('https://site.test/attempt', { method: 'POST' })).status,
      429
    );
  } finally {
    await first.dispose();
  }

  const restarted = createSharedOwnerMiniflare(dir, '1');
  try {
    for (const site of ['vellira-website-staging', 'vellira-website']) {
      const caller = await restarted.getWorker(site);
      const response = await caller.fetch('https://site.test/attempt', {
        method: 'POST',
      });
      assert.equal(response.status, 429, site);
    }
  } finally {
    await restarted.dispose();
  }
});

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import path from 'node:path';

import { createWebsiteWorker } from '../cloudflare/cache-policy.mjs';
import {
  maybeLimitNewsletterSubscribe,
  NEWSLETTER_SUBSCRIBE_PATH,
} from '../cloudflare/newsletter-burst-guard.mjs';
import { readDeploymentConfig } from './cloudflare-target-config.mjs';

const ORIGIN = 'https://vellira-website-staging.vellira.workers.dev';
const API_URL = ORIGIN + NEWSLETTER_SUBSCRIBE_PATH;
const PRIVATE_EMAIL = 'private@example.test';

function post(url = API_URL, headers = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ email: PRIVATE_EMAIL }),
  });
}

function limiter(result = { success: true }) {
  const calls = [];
  return {
    calls,
    async limit(input) {
      calls.push(input);
      return typeof result === 'function' ? result(input) : result;
    },
  };
}

function enabled(route = limiter(), actor = limiter()) {
  return {
    NEWSLETTER_ABUSE_GUARD_ENABLED: '1',
    NEWSLETTER_ROUTE_RATE_LIMIT: route,
    NEWSLETTER_ACTOR_RATE_LIMIT: actor,
  };
}

test('disabled guard preserves regular newsletter, Pro mode and other endpoints', async () => {
  for (const env of [
    {},
    { NEWSLETTER_ABUSE_GUARD_ENABLED: '0' },
    { NEWSLETTER_ABUSE_GUARD_ENABLED: undefined },
  ]) {
    assert.equal(await maybeLimitNewsletterSubscribe(post(), env), null);
  }
  const env = enabled();
  assert.equal(
    await maybeLimitNewsletterSubscribe(
      new Request(API_URL, { method: 'GET' }),
      env
    ),
    null
  );
  assert.equal(
    await maybeLimitNewsletterSubscribe(post(ORIGIN + '/api/other'), env),
    null
  );
  assert.equal(env.NEWSLETTER_ROUTE_RATE_LIMIT.calls.length, 0);
  assert.equal(env.NEWSLETTER_ACTOR_RATE_LIMIT.calls.length, 0);
});

test('shared route budget cannot be bypassed by origin, purpose, email or path alias', async () => {
  const route = limiter();
  const actor = limiter();
  const env = enabled(route, actor);

  for (const pathAlias of [
    '/api/newsletter/subscribe',
    '/api/newsletter/subscribe/',
    '/api/newsletter/%73ubscribe',
    '/api//newsletter/subscribe',
  ]) {
    const req = post(ORIGIN + pathAlias, {
      Origin: 'https://other.example',
      'CF-Connecting-IP': '203.0.113.47',
      'X-Forwarded-For': '198.51.100.44',
    });
    assert.equal(await maybeLimitNewsletterSubscribe(req, env), null);
  }
  assert.deepEqual(route.calls, Array.from({ length: 4 }, () => ({
    key: 'newsletter:subscribe',
  })));
  assert.deepEqual(actor.calls, Array.from({ length: 4 }, () => ({
    key: 'newsletter:subscribe:actor:203.0.113.47',
  })));
});

test('missing trusted Cloudflare IP shares one unknown bucket; untrusted XFF is ignored', async () => {
  const route = limiter();
  const actor = limiter();
  const env = enabled(route, actor);

  for (const headers of [
    { 'X-Forwarded-For': '198.51.100.99' },
    { 'CF-Connecting-IP': 'not-an-ip', 'X-Forwarded-For': '198.51.100.23' },
    { 'CF-Connecting-IP': '999.999.999.999' },
  ]) {
    assert.equal(await maybeLimitNewsletterSubscribe(post(API_URL, headers), env), null);
  }
  assert.deepEqual(actor.calls, Array.from({ length: 3 }, () => ({
    key: 'newsletter:subscribe:actor:unknown',
  })));
});

test('canonicalized IPv6 uses a stable actor key', async () => {
  const actor = limiter();
  const env = enabled(limiter(), actor);
  assert.equal(
    await maybeLimitNewsletterSubscribe(
      post(API_URL, { 'CF-Connecting-IP': '2001:0db8::1' }),
      env
    ),
    null
  );
  assert.deepEqual(actor.calls, [
    { key: 'newsletter:subscribe:actor:2001:db8::1' },
  ]);
});

test('route-wide denial is safe HTTP 429 after one actor check', async () => {
  const route = limiter({ success: false });
  const actor = limiter();
  const result = await maybeLimitNewsletterSubscribe(post(), enabled(route, actor));
  assert.equal(result.status, 429);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(result.headers.get('retry-after'), '60');
  assert.deepEqual(await result.json(), {
    ok: false,
    code: 'rate_limited',
    message: 'Please wait a few minutes and try again.',
  });
  assert.equal(actor.calls.length, 1);
});

test('actor denial is safe HTTP 429 independent of Pro signup purpose', async () => {
  const route = limiter();
  const actor = limiter({ success: false });
  const result = await maybeLimitNewsletterSubscribe(post(), enabled(route, actor));
  assert.equal(result.status, 429);
  assert.equal(actor.calls.length, 1);
  assert.equal(route.calls.length, 0);
  assert.equal((await result.json()).code, 'rate_limited');
});

test('enabled guard fails closed for missing, broken, unknown and throwing bindings', async () => {
  for (const env of [
    { NEWSLETTER_ABUSE_GUARD_ENABLED: 'unrecognized' },
    { NEWSLETTER_ABUSE_GUARD_ENABLED: '1' },
    { ...enabled(), NEWSLETTER_ROUTE_RATE_LIMIT: undefined },
    { ...enabled(), NEWSLETTER_ACTOR_RATE_LIMIT: undefined },
    enabled(limiter({ success: 'true' }), limiter()),
    enabled(limiter(), limiter({ success: null })),
    enabled(
      limiter(() => {
        throw new Error('private-email:' + PRIVATE_EMAIL);
      }),
      limiter()
    ),
    enabled(
      limiter(),
      limiter(() => {
        throw new Error('private-email:' + PRIVATE_EMAIL);
      })
    ),
  ]) {
    const result = await maybeLimitNewsletterSubscribe(post(), env);
    assert.equal(result.status, 503);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    const json = await result.json();
    assert.equal(json.code, 'temporarily_unavailable');
    assert.equal(JSON.stringify(json).includes(PRIVATE_EMAIL), false);
  }
});

test('integration: a denied request is stopped before OpenNext and remains traceable', async () => {
  let forwarded = 0;
  const events = [];
  const inner = {
    async fetch() {
      forwarded++;
      return Response.json({ ok: true }, { status: 201 });
    },
  };
  const worker = createWebsiteWorker(inner, 'test-source-123-1', (e) => events.push(e));
  const env = {
    ...enabled(limiter({ success: false }), limiter()),
    CF_VERSION_METADATA: { id: 'test-worker-version' },
  };
  const denied = await worker.fetch(post(), env, {});
  assert.equal(denied.status, 429);
  assert.equal(denied.headers.get('x-vellira-build-id'), 'test-source-123-1');
  assert.ok(denied.headers.get('x-vellira-request-id'));
  assert.equal(denied.headers.get('x-vellira-worker-version'), 'test-worker-version');
  assert.equal(denied.headers.get('cache-control'), 'no-store');
  assert.equal(forwarded, 0);
  assert.equal(events.length, 1);
  assert.equal(events[0].status, 429);
  assert.equal(JSON.stringify(events).includes(PRIVATE_EMAIL), false);

  env.NEWSLETTER_ABUSE_GUARD_ENABLED = '0';
  const workersDevDenied = await worker.fetch(post(), env, {});
  assert.equal(workersDevDenied.status, 503);
  assert.equal((await workersDevDenied.json()).code, 'temporarily_unavailable');
  assert.equal(forwarded, 0);

  // The actual public custom-domain newsletter stays operational.
  const publicPassed = await worker.fetch(
    post('https://vellira.dev/api/newsletter/subscribe'),
    env,
    {}
  );
  assert.equal(publicPassed.status, 201);
  assert.equal(forwarded, 1);
});

test('outer Worker denies workers.dev subscriber POSTs before OpenNext URL rewriting', async () => {
  let forwarded = 0;
  const events = [];
  const handler = {
    async fetch(request) {
      forwarded += 1;
      // Simulate Next/OpenNext replacing the public URL with an internal one.
      // The inner runtime could normalize the original URL to a public
      // host; it must never be reached for the workers.dev POST path.
      return Response.json({
        forwarded: new URL(request.url).hostname,
      });
    },
  };
  const worker = createWebsiteWorker(handler, 'test-ingress-123-1', (event) => events.push(event));
  const env = { NEWSLETTER_ABUSE_GUARD_ENABLED: '0' };
  for (const origin of [
    'https://vellira-website.vellira.workers.dev',
    'https://vellira-website-staging.vellira.workers.dev',
    'https://version-vellira-website.vellira.workers.dev',
  ]) {
    for (const pathname of [
      '/api/newsletter/subscribe',
      '/api/newsletter/subscribe/',
      '/api/newsletter/%73ubscribe',
      '/api//newsletter/subscribe',
    ]) {
      const response = await worker.fetch(post(origin + pathname, {
        Origin: 'https://vellira.dev',
        'X-Forwarded-Host': 'vellira.dev',
      }), env, {});
      assert.equal(response.status, 503, origin + pathname);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal((await response.json()).code, 'temporarily_unavailable');
      assert.ok(response.headers.get('x-vellira-request-id'));
    }
  }
  assert.equal(forwarded, 0);
  assert.equal(events.length, 12);
  assert.ok(events.every((event) => event.status === 503));
  assert.equal(JSON.stringify(events).includes(PRIVATE_EMAIL), false);

  const canonical = await worker.fetch(
    post('https://vellira.dev/api/newsletter/subscribe'),
    env,
    {}
  );
  assert.equal(canonical.status, 200);
  assert.equal(forwarded, 1);
  const diagnostic = await worker.fetch(
    new Request(ORIGIN + '/__vellira_runtime'),
    env,
    {}
  );
  assert.equal(diagnostic.status, 200);
  assert.equal(forwarded, 1);
  const unrelated = await worker.fetch(
    post(ORIGIN + '/api/blog-metrics/articles/test/like'),
    env,
    {}
  );
  assert.equal(unrelated.status, 200);
  assert.equal(forwarded, 2);
});

test('manual staging burst limiter runs before workers.dev provider-write gate', async () => {
  let forwarded = 0;
  const worker = createWebsiteWorker(
    { async fetch() { forwarded += 1; return new Response('unsafe', { status: 201 }); } },
    'test-ingress-preview-1',
    () => {}
  );
  const passedActor = limiter();
  const passedRoute = limiter();
  const mode = enabled(passedRoute, passedActor);
  const blockedBeforeProvider = await worker.fetch(post(), mode, {});
  assert.equal(blockedBeforeProvider.status, 503);
  assert.equal(passedActor.calls.length, 1);
  assert.equal(passedRoute.calls.length, 1);

  const rateDeniedMode = enabled(limiter(), limiter({ success: false }));
  const rateDenied = await worker.fetch(post(), rateDeniedMode, {});
  assert.equal(rateDenied.status, 429);
  assert.equal((await rateDenied.json()).code, 'rate_limited');
  assert.equal(forwarded, 0);
});

// The manual staging workflow intentionally turns its untracked runner copy
// ON before running Cloudflare contracts. Never confuse that temporary
// preview with the committed Wrangler config, which must always remain OFF.
function expectedStagingGuardMode(environment) {
  const mode = environment.NEWSLETTER_ABUSE_GUARD_PREVIEW;
  if (mode === undefined || mode === '0') return '0';
  assert.equal(mode, '1', 'Unexpected newsletter preview mode');
  assert.equal(environment.GITHUB_ACTIONS, 'true');
  assert.equal(environment.GITHUB_EVENT_NAME, 'workflow_dispatch');
  assert.equal(environment.GITHUB_REF, 'refs/heads/main');
  assert.equal(environment.NEXT_PUBLIC_VELLIRA_PRO_INTEREST_ENABLED, '0');
  return '1';
}

function assertStagingGuardMatchesMode(config, environment) {
  const expectedMode = expectedStagingGuardMode(environment);
  assert.equal(config.vars?.NEWSLETTER_ABUSE_GUARD_ENABLED, expectedMode);
  return expectedMode;
}

test('authorized preview ON is accepted but ordinary and forged ON fail', () => {
  const stagingOn = {
    vars: { NEWSLETTER_ABUSE_GUARD_ENABLED: '1' },
  };
  const stagingOff = {
    vars: { NEWSLETTER_ABUSE_GUARD_ENABLED: '0' },
  };
  const authorized = {
    NEWSLETTER_ABUSE_GUARD_PREVIEW: '1',
    GITHUB_ACTIONS: 'true',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_REF: 'refs/heads/main',
    NEXT_PUBLIC_VELLIRA_PRO_INTEREST_ENABLED: '0',
  };

  assert.equal(assertStagingGuardMatchesMode(stagingOn, authorized), '1');
  assert.equal(assertStagingGuardMatchesMode(stagingOff, {}), '0');
  assert.throws(() => assertStagingGuardMatchesMode(stagingOn, {}));
  assert.throws(() => assertStagingGuardMatchesMode(stagingOff, authorized));
  assert.throws(() =>
    assertStagingGuardMatchesMode(stagingOn, {
      ...authorized,
      GITHUB_EVENT_NAME: 'push',
    })
  );
});

test('staging guard contract rejects unauthorized ON preview environments', () => {
  assert.equal(expectedStagingGuardMode({}), '0');
  assert.equal(
    expectedStagingGuardMode({ NEWSLETTER_ABUSE_GUARD_PREVIEW: '0' }),
    '0'
  );
  const authorized = {
    NEWSLETTER_ABUSE_GUARD_PREVIEW: '1',
    GITHUB_ACTIONS: 'true',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_REF: 'refs/heads/main',
    NEXT_PUBLIC_VELLIRA_PRO_INTEREST_ENABLED: '0',
  };
  assert.equal(expectedStagingGuardMode(authorized), '1');
  for (const changed of [
    { NEWSLETTER_ABUSE_GUARD_PREVIEW: 'invalid' },
    { GITHUB_ACTIONS: 'false' },
    { GITHUB_EVENT_NAME: 'push' },
    { GITHUB_REF: 'refs/heads/feature' },
    { NEXT_PUBLIC_VELLIRA_PRO_INTEREST_ENABLED: '1' },
  ]) {
    assert.throws(() =>
      expectedStagingGuardMode({ ...authorized, ...changed })
    );
  }
});

test('committed guard stays OFF; authorized staging overlay may be ON', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const staging = readDeploymentConfig(path.join(root, 'wrangler.jsonc'));
  const production = readDeploymentConfig(
    path.join(root, 'wrangler.production.jsonc')
  );
  const expectedMode = assertStagingGuardMatchesMode(staging, process.env);

  if (expectedMode === '1') {
    const repoRoot = path.resolve(root, '../..');
    // Source authority must remain OFF even when the approved workflow
    // temporarily rewrites a working-copy config for the staging deployment.
    assert.equal(
      execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: repoRoot,
        encoding: 'utf8',
      }).trim(),
      process.env.GITHUB_SHA
    );
    const committed = execFileSync(
      'git',
      ['show', 'HEAD:apps/website/wrangler.jsonc'],
      { cwd: repoRoot, encoding: 'utf8' }
    );
    const matches = [
      ...committed.matchAll(/"NEWSLETTER_ABUSE_GUARD_ENABLED"\s*:\s*"([^"]+)"/g),
    ];
    assert.equal(matches.length, 1, 'Expected a single committed guard setting');
    assert.equal(matches[0][1], '0', 'Committed staging guard must remain OFF');
  }
  assert.equal(staging.ratelimits.length, 2);
  assert.deepEqual(
    staging.ratelimits.map((x) => [x.name, x.simple.limit, x.simple.period]),
    [
      ['NEWSLETTER_ROUTE_RATE_LIMIT', 12, 60],
      ['NEWSLETTER_ACTOR_RATE_LIMIT', 4, 60],
    ]
  );
  assert.equal(
    new Set(staging.ratelimits.map((x) => x.namespace_id)).size,
    2
  );
  assert.ok(
    staging.ratelimits.every((x) => /^\d+$/.test(x.namespace_id))
  );
  assert.equal(production.vars?.NEWSLETTER_ABUSE_GUARD_ENABLED, undefined);
  assert.equal(production.ratelimits?.length ?? 0, 0);
});

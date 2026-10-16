import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  prepareNewsletterGuardStagingMode,
  validateStagingGuardConfig,
} from './newsletter-guard-staging-mode.mjs';
import { verifyNewsletterGuardLive } from './newsletter-guard-live-smoke.mjs';

const URL = 'https://vellira-website-staging.vellira.workers.dev';
const baseConfig = () => ({
  name: 'vellira-website-staging',
  vars: { NEWSLETTER_ABUSE_GUARD_ENABLED: '0' },
  ratelimits: [
    {
      name: 'NEWSLETTER_ROUTE_RATE_LIMIT',
      namespace_id: '1712202601',
      simple: { limit: 12, period: 60 },
    },
    {
      name: 'NEWSLETTER_ACTOR_RATE_LIMIT',
      namespace_id: '1712202602',
      simple: { limit: 4, period: 60 },
    },
  ],
});

test('staging guard OFF does not mutate Wrangler configuration', async () => {
  const config = baseConfig();
  const requests = [];
  const result = await prepareNewsletterGuardStagingMode({
    mode: '0',
    configPath: '/fixture/wrangler.jsonc',
    loadConfig: () => config,
    writeFile: async (...args) => requests.push(args),
  });
  assert.equal(result, 'off');
  assert.equal(requests.length, 0);
  assert.equal(config.vars.NEWSLETTER_ABUSE_GUARD_ENABLED, '0');
});

test('only explicitly owner-gated main dispatch produces staging ON config', async () => {
  const config = baseConfig();
  const writes = [];
  const options = {
    mode: '1',
    configPath: '/fixture/wrangler.jsonc',
    loadConfig: () => config,
    writeFile: async (...args) => writes.push(args),
  };
  await assert.rejects(
    prepareNewsletterGuardStagingMode({
      ...options,
      githubEventName: 'push',
      githubRef: 'refs/heads/main',
    })
  );
  await assert.rejects(
    prepareNewsletterGuardStagingMode({
      ...options,
      githubEventName: 'workflow_dispatch',
      githubRef: 'refs/heads/feature',
    })
  );
  assert.equal(writes.length, 0);

  assert.equal(
    await prepareNewsletterGuardStagingMode({
      ...options,
      githubEventName: 'workflow_dispatch',
      githubRef: 'refs/heads/main',
    }),
    'owner-preview'
  );
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], '/fixture/wrangler.jsonc');
  assert.equal(
    JSON.parse(writes[0][1]).vars.NEWSLETTER_ABUSE_GUARD_ENABLED,
    '1'
  );
  assert.equal(config.vars.NEWSLETTER_ABUSE_GUARD_ENABLED, '0');
});

test('abuse preview rejects simultaneous Pro opt-in preview before any deployment mutation', async () => {
  const writes = [];
  const options = {
    configPath: '/fixture/wrangler.jsonc',
    loadConfig: baseConfig,
    writeFile: async (...args) => writes.push(args),
    githubEventName: 'workflow_dispatch',
    githubRef: 'refs/heads/main',
  };

  await assert.rejects(
    prepareNewsletterGuardStagingMode({
      ...options,
      mode: '1',
      proInterestMode: '1',
    }),
    /must run separately/
  );
  assert.equal(writes.length, 0);

  // A Pro-only preview remains allowed with the abuse guard OFF.
  assert.equal(
    await prepareNewsletterGuardStagingMode({
      ...options,
      mode: '0',
      proInterestMode: '1',
    }),
    'off'
  );
  assert.equal(writes.length, 0);

  await assert.rejects(
    prepareNewsletterGuardStagingMode({
      ...options,
      mode: '1',
      proInterestMode: 'unexpected',
    }),
    /Expected staging Pro interest mode/
  );
  assert.equal(writes.length, 0);
});

test('staging overlay rejects missing/mismatched binding configuration', () => {
  for (const config of [
    null,
    { ...baseConfig(), name: 'vellira-website' },
    { ...baseConfig(), vars: {} },
    { ...baseConfig(), ratelimits: [] },
    { ...baseConfig(), ratelimits: [baseConfig().ratelimits[0]] },
  ])
    assert.throws(() => validateStagingGuardConfig(config));
  assert.doesNotThrow(() => validateStagingGuardConfig(baseConfig()));
});

function providerWriteFreeFetcher({ denyAfter = 4 } = {}) {
  const calls = [];
  return {
    calls,
    fetcher: async (url, init) => {
      calls.push({ url, init });
      const blocked = calls.length >= denyAfter;
      return Response.json(
        {
          ok: false,
          code: blocked ? 'rate_limited' : 'invalid_email',
        },
        {
          status: blocked ? 429 : 400,
          headers: {
            'Cache-Control': 'no-store',
            ...(blocked ? { 'Retry-After': '60' } : {}),
          },
        }
      );
    },
  };
}

test('default OFF smoke sends only one provider-write-free malformed address', async () => {
  const { calls, fetcher } = providerWriteFreeFetcher({ denyAfter: 9 });
  assert.equal(
    await verifyNewsletterGuardLive({ siteUrl: URL, enabled: false, fetcher }),
    'off'
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(
    JSON.parse(calls[0].init.body).email,
    'not-an-email'
  );
  assert.equal(calls[0].url.origin, URL);
});

test('approved ON smoke proves HTTP 429 with bounded invalid POSTs and no writes', async () => {
  const { calls, fetcher } = providerWriteFreeFetcher();
  assert.equal(
    await verifyNewsletterGuardLive({ siteUrl: URL, enabled: true, fetcher }),
    'preview-denial-proven'
  );
  assert.equal(calls.length, 4);
  assert.ok(calls.every(({ init }) =>
    JSON.parse(init.body).email === 'not-an-email'
  ));
});

test('staging smoke fails closed for missing denial, OFF denial, wrong host or wrong method', async () => {
  const noDenial = providerWriteFreeFetcher({ denyAfter: 100 });
  await assert.rejects(
    verifyNewsletterGuardLive({
      siteUrl: URL,
      enabled: true,
      fetcher: noDenial.fetcher,
      maxAttempts: 3,
    }),
    /did not return HTTP 429/
  );
  assert.equal(noDenial.calls.length, 3);
  await assert.rejects(
    verifyNewsletterGuardLive({
      siteUrl: URL,
      enabled: false,
      fetcher: providerWriteFreeFetcher({ denyAfter: 1 }).fetcher,
    })
  );
  for (const origin of ['https://vellira.dev', 'https://example.com', 'http://vellira-website-staging.vellira.workers.dev']) {
    await assert.rejects(
      verifyNewsletterGuardLive({ siteUrl: origin, enabled: true }),
      /Only the canonical staging Worker|requires HTTPS/
    );
  }
});

test('staging workflow gates ON to a manual main dispatch and restores OFF by default', () => {
  const workflow = readFileSync(
    path.resolve(
      import.meta.dirname,
      '../../../.github/workflows/deploy-website-cloudflare-staging.yml'
    ),
    'utf8'
  );
  const prod = readFileSync(
    path.resolve(
      import.meta.dirname,
      '../../../.github/workflows/deploy-website-cloudflare-production.yml'
    ),
    'utf8'
  );
  assert.match(workflow, /newsletter_abuse_preview:/);
  assert.match(
    workflow,
    /github\.event_name == 'workflow_dispatch' && inputs\.newsletter_abuse_preview == true && '1' \|\| '0'/
  );
  assert.match(workflow, /Configure owner-controlled staging newsletter burst guard/);
  assert.match(workflow, /newsletter-guard-staging-mode\.mjs/);
  assert.match(workflow, /newsletter-guard-live-smoke\.mjs/);
  assert.match(workflow, /NEWSLETTER_ABUSE_GUARD_EXPECTED_MODE/);
  assert.doesNotMatch(prod, /NEWSLETTER_ABUSE_GUARD_PREVIEW/);
  assert.doesNotMatch(prod, /NEWSLETTER_ABUSE_GUARD_ENABLED/);
  assert.doesNotMatch(prod, /newsletter_abuse_preview/);
});

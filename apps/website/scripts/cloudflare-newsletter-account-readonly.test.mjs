import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { auditCloudflareNewsletterAccount } from './cloudflare-newsletter-account-readonly.mjs';

const accountId = 'a'.repeat(32);
const zoneId = 'b'.repeat(32);
const version = '11111111-1111-4111-8111-111111111111';
const apiRoot = '/client/v4';
const liveScripts = ['vellira-website-staging', 'vellira-website'];
const makeResponse = (result, status = 200, resultInfo) =>
  Response.json(
    status === 200
      ? { success: true, result, ...(resultInfo ? { result_info: resultInfo } : {}) }
      : { success: false, errors: [{ message: 'private-token-and-user@example.invalid' }] },
    { status }
  );

function mockCloudflare({ workerNames = liveScripts, namespaces = [], withBinding = false, deny = [] } = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    const path = url.pathname.slice(apiRoot.length);
    calls.push({ path, options });
    assert.equal(url.origin, 'https://api.cloudflare.com');
    assert.equal(options.method, 'GET');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Accept, 'application/json');
    assert.equal(options.headers.Authorization, 'Bearer private-test-token');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.body, undefined);
    if (deny.includes(path)) return makeResponse(null, 403);
    if (path === '/accounts/' + accountId + '/workers/scripts') {
      return makeResponse(workerNames.map((id) => ({ id })));
    }
    if (path === '/accounts/' + accountId + '/workers/durable_objects/namespaces') {
      assert.equal(url.searchParams.get('page'), '1');
      assert.equal(url.searchParams.get('per_page'), '100');
      return makeResponse(namespaces, 200, { total_pages: 1 });
    }
    if (path.endsWith('/subdomain')) return makeResponse({ enabled: true, previews_enabled: false });
    if (path.endsWith('/deployments')) return makeResponse({
      deployments: [{ versions: [{ version_id: version, percentage: 100 }] }],
    });
    if (path.endsWith('/versions/' + version)) {
      return makeResponse({ resources: { bindings: withBinding
        ? { NEWSLETTER_GLOBAL_BUDGET: { type: 'durable_object_namespace', name: 'NEWSLETTER_GLOBAL_BUDGET', secret: 'secret' } }
        : { ASSETS: { type: 'assets', name: 'ASSETS' } },
      } });
    }
    if (path === '/accounts/' + accountId + '/workers/domains') {
      return makeResponse([
        { hostname: 'vellira.dev', enabled: true, service: 'vellira-website', id: 'hidden-domain-identifier' },
        { hostname: 'www.vellira.dev', enabled: true, service: 'vellira-website', id: 'hidden-domain-identifier2' },
      ]);
    }
    if (path === '/zones') {
      assert.equal(url.searchParams.get('name'), 'vellira.dev');
      assert.equal(url.searchParams.get('account.id'), accountId);
      return makeResponse([{ id: zoneId, name: 'vellira.dev', account: { id: accountId } }]);
    }
    if (path === '/zones/' + zoneId + '/workers/routes') {
      return makeResponse([{ pattern: 'vellira.dev/api/*', script: 'vellira-website' }]);
    }
    if (path.includes('/rulesets/phases/')) {
      if (path.endsWith('/http_ratelimit/entrypoint')) {
        return makeResponse({ rules: [{ enabled: true, expression: 'private-cookie=value' }] });
      }
      return makeResponse({ rules: [] });
    }
    throw new Error('Unrecognized test API path: ' + path);
  };
  return { fetcher, calls };
}

test('Cloudflare inventory is strictly GET-only, sanitized, and does not claim WAF coverage', async () => {
  const fixture = mockCloudflare();
  const report = await auditCloudflareNewsletterAccount({
    accountId,
    apiToken: 'private-test-token',
    fetcher: fixture.fetcher,
  });
  assert.equal(report.workerInventoryStatus, 'complete');
  assert.equal(report.workerPresence['vellira-website-staging'], 'present');
  assert.equal(report.workerPresence['vellira-website'], 'present');
  assert.equal(report.workerPresence['vellira-newsletter-budget-owner'], 'absent');
  assert.equal(report.namespaceInventoryStatus, 'complete');
  assert.equal(report.coordinatorClassNamespaceCount, 0);
  assert.equal(report.domainInventoryStatus, 'complete');
  assert.deepEqual(report.domains['vellira.dev'], {
    status: 'observed',
    enabled: true,
    expectedProductionWorker: true,
  });
  assert.deepEqual(report.liveBinding['vellira-website'], {
    status: 'observed',
    globalBudgetBindingInServingVersions: false,
  });
  assert.equal(report.workerDev['vellira-website-staging'].enabled, true);
  assert.equal(report.zoneStatus, 'observed');
  assert.equal(report.zoneRoutes.hasNewsletterWebsiteRoute, true);
  assert.equal(report.zoneWaf.http_ratelimit.enabledRules, 1);
  assert.equal(report.accountWaf.http_ratelimit.enabledRules, 1);
  assert.equal(report.sharedNamespaceIdentity, 'unverified');
  assert.equal(report.newsletterWafCoverage, 'unverified');
  assert.equal(report.buttondownQuota, 'unverified');
  assert.equal(report.remoteWrites, 0);
  assert.equal(report.providerWrites, 0);

  const output = JSON.stringify(report);
  for (const sensitive of [
    accountId, zoneId, version, 'private-test-token', 'hidden-domain-identifier',
    'private-cookie=value', 'secret',
  ]) {
    assert.equal(output.includes(sensitive), false, sensitive);
  }
  assert.ok(fixture.calls.length > 8);
  assert.ok(fixture.calls.every(({ options }) => options.method === 'GET'));
});

test('observed budget binding is reported, but never equated with enabled enforcement', async () => {
  const fixture = mockCloudflare({ withBinding: true, workerNames: [
    'vellira-website-staging', 'vellira-website', 'vellira-newsletter-budget-owner',
  ], namespaces: [{
    id: 'private-do-namespace', class: 'NewsletterRollingBudgetCoordinator',
    name: 'NewsletterRollingBudgetCoordinator',
  }] });
  const report = await auditCloudflareNewsletterAccount({
    accountId,
    apiToken: 'private-test-token',
    fetcher: fixture.fetcher,
  });
  assert.equal(report.coordinatorClassNamespaceCount, 1);
  assert.equal(report.workerPresence['vellira-newsletter-budget-owner'], 'present');
  assert.equal(report.liveBinding['vellira-website'].globalBudgetBindingInServingVersions, true);
  assert.equal(report.sharedNamespaceIdentity, 'unverified');
  assert.equal(report.newsletterWafCoverage, 'unverified');
  assert.equal(JSON.stringify(report).includes('private-do-namespace'), false);
});

test('denied Cloudflare permissions stay unverified, never incorrectly absent', async () => {
  const denied = [
    '/accounts/' + accountId + '/workers/scripts',
    '/accounts/' + accountId + '/workers/durable_objects/namespaces',
    '/accounts/' + accountId + '/workers/domains',
    '/zones',
    '/accounts/' + accountId + '/rulesets/phases/http_request_firewall_custom/entrypoint',
  ];
  const fixture = mockCloudflare({ deny: denied });
  const report = await auditCloudflareNewsletterAccount({
    accountId,
    apiToken: 'private-test-token',
    fetcher: fixture.fetcher,
  });
  assert.equal(report.workerInventoryStatus, 'permission_denied');
  assert.equal(report.workerPresence['vellira-website'], 'unverified');
  assert.equal(report.namespaceInventoryStatus, 'permission_denied');
  assert.equal(report.coordinatorClassNamespaceCount, null);
  assert.equal(report.domainInventoryStatus, 'permission_denied');
  assert.equal(report.zoneStatus, 'permission_denied');
  assert.equal(report.zoneRoutes.status, 'permission_denied');
  assert.equal(report.accountWaf.http_request_firewall_custom.status, 'permission_denied');
  assert.equal(report.newsletterWafCoverage, 'unverified');
});

test('truncated namespace inventory is inconclusive, not zero', async () => {
  const fixture = mockCloudflare();
  fixture.fetcher = async (url, options) => {
    if (url.pathname.includes('/durable_objects/namespaces')) {
      assert.equal(options.method, 'GET');
      return makeResponse(
        Array.from({ length: 100 }, (_, i) => ({ id: 'hidden-' + i, class: 'someClass' })),
        200,
        { total_pages: 4 }
      );
    }
    return mockCloudflare().fetcher(url, options);
  };
  const report = await auditCloudflareNewsletterAccount({
    accountId,
    apiToken: 'private-test-token',
    fetcher: fixture.fetcher,
  });
  assert.equal(report.namespaceInventoryStatus, 'incomplete');
  assert.equal(report.coordinatorClassNamespaceCount, null);
  assert.equal(report.sharedNamespaceIdentity, 'unverified');
});

test('missing credentials fail before Cloudflare requests', async () => {
  let calls = 0;
  await assert.rejects(
    auditCloudflareNewsletterAccount({
      accountId,
      apiToken: '',
      fetcher: () => { calls += 1; },
    }),
    /Configured Cloudflare account ID and API token are required/
  );
  assert.equal(calls, 0);
});

test('unexpected provider payloads and network errors do not print sensitive errors', async () => {
  const report = await auditCloudflareNewsletterAccount({
    accountId,
    apiToken: 'private-test-token',
    fetcher: async () => { throw new Error('private-test-token and customer IP'); },
  });
  assert.equal(report.workerInventoryStatus, 'unavailable');
  assert.equal(report.namespaceInventoryStatus, 'unavailable');
  assert.equal(report.sharedNamespaceIdentity, 'unverified');
  assert.equal(JSON.stringify(report).includes('private-test-token'), false);
});

test('manual account audit never runs on push or schedules and cannot deploy', () => {
  const workflow = readFileSync(
    path.resolve(import.meta.dirname, '../../../.github/workflows/cloudflare-newsletter-account-readonly.yml'),
    'utf8'
  );
  assert.match(workflow, /^on:\n[ ]{2}workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^[ ]{2}(?:push|pull_request|schedule|workflow_run):/m);
  assert.match(workflow, /if: github.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /permissions:\n[ ]{2}contents: read/);
  assert.match(workflow, /secrets.CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /secrets.CLOUDFLARE_ACCOUNT_ID/);
  assert.doesNotMatch(workflow, /wrangler|cloudflare-deploy|CLOUDFLARE_R2_SECRET_ACCESS_KEY/);
  assert.doesNotMatch(workflow, /upload-artifact|checkout@main|pull_request_target/);
});

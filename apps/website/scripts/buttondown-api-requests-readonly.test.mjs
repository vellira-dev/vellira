import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditButtondownApiRequests,
  API_REQUESTS_ENDPOINT,
  LOOKBACK_DAYS,
} from './buttondown-api-requests-readonly.mjs';

const now = new Date('2026-10-19T10:00:00.000Z');
const makeRecord = (overrides = {}) => ({
  id: 'api_req_safe_1',
  creation_date: '2026-10-18T12:00:00+00:00',
  method: 'POST',
  path: '/v1/subscribers',
  status_code: 201,
  source: 'node',
  api_key_id: 'secret_api_key_identifier',
  api_key_label: 'private_key_label',
  ip_address: '198.51.100.12',
  subscriber_email: 'private-user@example.com',
  ...overrides,
});

const response = (payload, status = 200) => Response.json(payload, { status });

test('read-only audit uses fixed GET filters, bounded pagination, and aggregate output', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url: new URL(url), options });
    assert.equal(options.method, 'GET');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Token local-key');
    assert.equal(options.headers.Accept, 'application/json');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(url.origin + url.pathname, API_REQUESTS_ENDPOINT);
    assert.equal(url.searchParams.get('method'), 'POST');
    assert.equal(url.searchParams.get('path'), '/v1/subscribers');
    assert.equal(url.searchParams.get('limit'), '100');
    assert.equal(
      url.searchParams.get('creation_date__gt'),
      '2026-10-12T10:00:00.000Z'
    );
    assert.equal(
      url.searchParams.get('creation_date__lt'),
      now.toISOString()
    );
    const page = Number(url.searchParams.get('page'));
    return page === 1
      ? response({
          count: 2,
          results: [makeRecord()],
          next: 'https://api.buttondown.com/v1/api_requests?page=2',
        })
      : response({
          count: 2,
          results: [
            makeRecord({
              id: 'api_req_safe_2',
              status_code: 400,
              creation_date: '2026-10-17T13:00:00Z',
              source: 'app',
              api_key_id: null,
            }),
          ],
          next: null,
        });
  };
  const report = await auditButtondownApiRequests({
    apiKey: ' local-key ',
    now,
    fetcher,
  });
  assert.equal(LOOKBACK_DAYS, 7);
  assert.equal(calls.length, 2);
  assert.equal(report.requests, 2);
  assert.equal(report.reportedMatchingRequests, 2);
  assert.equal(report.countedMatchingRequests, 2);
  assert.equal(report.completeness, 'filtered-pages-complete');
  assert.equal(report.byStatus.success2xx, 1);
  assert.equal(report.byStatus.http400, 1);
  assert.equal(report.bySourceCategory.integrationOrClient, 1);
  assert.equal(report.bySourceCategory.app, 1);
  assert.equal(report.distinctApiKeyIdsObserved, 1);
  assert.equal(report.requestsWithoutApiKeyId, 1);
  assert.deepEqual(report.byUtcDay, {
    '2026-10-17': 1,
    '2026-10-18': 1,
  });
  assert.equal(report.quotaForThisAccount, 'unverified');
  assert.equal(report.resetRule, 'unverified');
  assert.equal(report.otherWriters, 'unverified');
  assert.equal(report.writes, 0);
  assert.equal(report.rawEntriesExported, 0);

  const publicOutput = JSON.stringify(report);
  for (const forbidden of [
    'private-user@example.com',
    'secret_api_key_identifier',
    'private_key_label',
    '198.51.100.12',
    'local-key',
    'api_req_safe',
    'api_key_id',
  ]) {
    assert.equal(publicOutput.includes(forbidden), false, forbidden);
  }
});

test('empty filtered response is not presented as verified quota or all-writer inventory', async () => {
  const report = await auditButtondownApiRequests({
    apiKey: 'test',
    now,
    fetcher: async () => response({ count: 0, results: [], next: null }),
  });
  assert.equal(report.countedMatchingRequests, 0);
  assert.equal(report.completeness, 'filtered-pages-complete');
  assert.equal(report.quotaForThisAccount, 'unverified');
  assert.equal(report.otherWriters, 'unverified');
});

test('missing key fails before any API requests', async () => {
  let called = 0;
  await assert.rejects(
    auditButtondownApiRequests({
      apiKey: '',
      now,
      fetcher: async () => {
        called++;
      },
    }),
    /Existing BUTTONDOWN_API_KEY is required/
  );
  assert.equal(called, 0);
});

test('provider errors cannot echo private response bodies or thrown credential strings', async () => {
  const leaked = 'hidden@sample.invalid-token-value';
  for (const fetcher of [
    async () => {
      throw new Error(leaked);
    },
    async () => response({ message: leaked }, 403),
    async () => ({ status: 200, json: async () => { throw new Error(leaked); } }),
  ]) {
    await assert.rejects(
      auditButtondownApiRequests({ apiKey: 'test', now, fetcher }),
      (error) => {
        assert.equal(error.message.includes(leaked), false);
        return true;
      }
    );
  }
});

test('ignored method or path filters are fatal, not misleading zero usage', async () => {
  for (const record of [
    makeRecord({ method: 'GET' }),
    makeRecord({ path: '/v1/emails' }),
    makeRecord({ path: '/v1/subscribers?email=private@example.com' }),
    makeRecord({ creation_date: '2026-09-01T10:00:00Z' }),
    makeRecord({ creation_date: '2026-10-19T10:00:00.000Z' }),
    makeRecord({ status_code: '200' }),
    makeRecord({ api_key_id: { unsafe: true } }),
  ]) {
    await assert.rejects(
      auditButtondownApiRequests({
        apiKey: 'test',
        now,
        fetcher: async () => response({ count: 1, results: [record], next: null }),
      }),
      /filtered scope validation/
    );
  }
});

test('never follows a provider-supplied pagination URL to a new host', async () => {
  let fetches = 0;
  await assert.rejects(
    auditButtondownApiRequests({
      apiKey: 'test',
      now,
      fetcher: async () => {
        fetches++;
        return response({
          count: 2,
          results: [makeRecord()],
          next: 'https://untrusted.example/v1/api_requests?page=2',
        });
      },
    }),
    /Unexpected API request pagination target/
  );
  assert.equal(fetches, 1);
});

test('pagination must prove completeness and unique entries', async () => {
  for (const firstPage of [
    { count: 2, results: [makeRecord()], next: null },
    { count: 0, results: [makeRecord()], next: null },
    { count: 2, results: [], next: 'https://api.buttondown.com/v1/api_requests?page=2' },
  ]) {
    await assert.rejects(
      auditButtondownApiRequests({
        apiKey: 'test',
        now,
        fetcher: async () => response(firstPage),
      })
    );
  }

  await assert.rejects(
    auditButtondownApiRequests({
      apiKey: 'test',
      now,
      fetcher: async (url) => response({
        count: 2,
        results: [makeRecord()],
        next:
          url.searchParams.get('page') === '1'
            ? 'https://api.buttondown.com/v1/api_requests?page=2'
            : null,
      }),
    }),
    /filtered scope validation/
  );
});

test('exceeding the five-page ceiling produces no partial success report', async () => {
  let calls = 0;
  await assert.rejects(
    auditButtondownApiRequests({
      apiKey: 'test',
      now,
      fetcher: async (url) => {
        calls++;
        const page = Number(url.searchParams.get('page'));
        const entries = Array.from({ length: 100 }, (_, i) =>
          makeRecord({ id: 'page-' + page + '-item-' + i })
        );
        return response({
          count: 501,
          results: entries,
          next: 'https://api.buttondown.com/v1/api_requests?page=' + (page + 1),
        });
      },
    }),
    /bounded page limit/
  );
  assert.equal(calls, 5);
});

test('inconsistent count or invalid next link fails closed', async () => {
  for (const next of [
    'https://api.buttondown.com/v1/api_requests?page=1',
    'https://api.buttondown.com/v1/subscribers?page=2',
    'https://other.example/v1/api_requests?page=2',
    {},
  ]) {
    await assert.rejects(
      auditButtondownApiRequests({
        apiKey: 'test',
        now,
        fetcher: async () => response({
          count: 2,
          results: [makeRecord()],
          next,
        }),
      })
    );
  }
});

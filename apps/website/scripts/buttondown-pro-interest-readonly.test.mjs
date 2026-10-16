import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRO_CAMPAIGN,
  auditButtondownProInterest,
} from './buttondown-pro-interest-readonly.mjs';

const SECRET = 'test-only-secret-never-print';
const PRIVATE_EMAIL = 'private-subscriber@example.test';

function mockedProvider({ override } = {}) {
  const calls = [];
  const fetcher = async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });

    const type = url.searchParams.get('type');
    const results =
      type === 'regular'
        ? [{ utm_campaign: PRO_CAMPAIGN, type, email_address: PRIVATE_EMAIL }]
        : type === 'unactivated'
          ? [{ utm_campaign: PRO_CAMPAIGN, type, email_address: PRIVATE_EMAIL }]
          : [
              {
                utm_campaign: PRO_CAMPAIGN,
                type: 'regular',
                email_address: PRIVATE_EMAIL,
              },
              {
                utm_campaign: PRO_CAMPAIGN,
                type: 'unactivated',
                email_address: PRIVATE_EMAIL,
              },
            ];
    const data = {
      count: type === 'regular' ? 2 : type === 'unactivated' ? 1 : 4,
      results,
    };
    return override ? override({ url, init, data }) : Response.json(data);
  };
  return { fetcher, calls };
}

test('only three fixed-origin GET requests; returns aggregate counts without PII', async () => {
  const { fetcher, calls } = mockedProvider();
  const summary = await auditButtondownProInterest({
    apiKey: SECRET,
    fetcher,
  });

  assert.deepEqual(summary, {
    schemaVersion: 1,
    source: 'buttondown-subscriber-list',
    campaign: PRO_CAMPAIGN,
    total: 4,
    confirmedRegular: 2,
    awaitingConfirmation: 1,
    otherStatuses: 1,
    filterEvidence: {
      campaign: 'first-page-match',
      regular: 'first-page-match',
      unactivated: 'first-page-match',
    },
    requests: 3,
    writes: 0,
  });
  assert.equal(calls.length, 3);
  assert.deepEqual(
    calls.map(({ url }) => url.searchParams.get('type')),
    [null, 'regular', 'unactivated']
  );

  for (const { url, init } of calls) {
    assert.equal(url.origin, 'https://api.buttondown.com');
    assert.equal(url.pathname, '/v1/subscribers');
    assert.equal(url.searchParams.get('utm_campaign'), PRO_CAMPAIGN);
    assert.equal(init.method, 'GET');
    assert.equal(init.body, undefined);
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.headers.Authorization, 'Token ' + SECRET);
  }
  assert.equal(JSON.stringify(summary).includes(SECRET), false);
  assert.equal(JSON.stringify(summary).includes(PRIVATE_EMAIL), false);
});

for (const scenario of [
  {
    name: 'campaign filter ignored',
    change: (data) => ({
      ...data,
      results: [{ utm_campaign: 'different-campaign', type: 'regular' }],
    }),
  },
  {
    name: 'type filter ignored',
    change: (data) => ({
      ...data,
      results: [{ utm_campaign: PRO_CAMPAIGN, type: 'unactivated' }],
    }),
    onlyType: 'regular',
  },
  {
    name: 'missing numeric count',
    change: (data) => ({ ...data, count: '4' }),
  },
  {
    name: 'missing results array',
    change: (data) => ({ ...data, results: null }),
  },
  {
    name: 'more rows than count',
    change: (data) => ({ ...data, count: 1 }),
  },
  {
    name: 'positive count with no verifiable first-page rows',
    change: (data) => ({ ...data, results: [] }),
  },
]) {
  test('fails closed for ' + scenario.name, async () => {
    const { fetcher } = mockedProvider({
      override: ({ url, data }) => {
        if (
          scenario.onlyType &&
          url.searchParams.get('type') !== scenario.onlyType
        ) {
          return Response.json(data);
        }
        return Response.json(scenario.change(data));
      },
    });
    await assert.rejects(
      auditButtondownProInterest({ apiKey: SECRET, fetcher }),
      (error) =>
        error.name === 'ButtondownReadOnlyAuditError' &&
        !error.message.includes(SECRET) &&
        !error.message.includes(PRIVATE_EMAIL)
    );
  });
}

test('zero matching campaign records are counted but filter proof is explicitly inconclusive', async () => {
  const { fetcher, calls } = mockedProvider({
    override: () => Response.json({ count: 0, results: [] }),
  });

  const report = await auditButtondownProInterest({ apiKey: SECRET, fetcher });
  assert.equal(report.total, 0);
  assert.equal(report.confirmedRegular, 0);
  assert.equal(report.awaitingConfirmation, 0);
  assert.deepEqual(report.filterEvidence, {
    campaign: 'inconclusive-empty',
    regular: 'inconclusive-empty',
    unactivated: 'inconclusive-empty',
  });
  assert.equal(calls.length, 3);
});

test('empty status subsets do not imply their filters are verified', async () => {
  const { fetcher } = mockedProvider({
    override: ({ url, data }) => {
      const type = url.searchParams.get('type');
      return Response.json(
        type === 'unactivated' ? { count: 0, results: [] } : data
      );
    },
  });

  const report = await auditButtondownProInterest({ apiKey: SECRET, fetcher });
  assert.equal(report.confirmedRegular, 2);
  assert.equal(report.awaitingConfirmation, 0);
  assert.equal(report.otherStatuses, 2);
  assert.deepEqual(report.filterEvidence, {
    campaign: 'first-page-match',
    regular: 'first-page-match',
    unactivated: 'inconclusive-empty',
  });
});

test('rejects inconsistent cross-filter totals without emitting subscriber details', async () => {
  const { fetcher } = mockedProvider({
    override: () =>
      Response.json({
        count: 1,
        results: [],
      }),
  });
  await assert.rejects(
    auditButtondownProInterest({ apiKey: SECRET, fetcher }),
    /inconsistent filtered counts/
  );
});

for (const status of [400, 401, 403, 429, 500]) {
  test('does not retry or expose provider body on HTTP ' + status, async () => {
    const { fetcher, calls } = mockedProvider({
      override: () =>
        Response.json(
          {
            email_address: PRIVATE_EMAIL,
            detail: SECRET + ' should never be displayed',
          },
          { status }
        ),
    });
    await assert.rejects(
      auditButtondownProInterest({ apiKey: SECRET, fetcher }),
      (error) =>
        error.name === 'ButtondownReadOnlyAuditError' &&
        error.message === 'Buttondown read-only API returned HTTP ' + status
    );
    assert.equal(calls.length, 1);
  });
}

test('rejects invalid JSON without raw payload logging', async () => {
  const { fetcher } = mockedProvider({
    override: () => new Response(SECRET, { status: 200 }),
  });
  await assert.rejects(
    auditButtondownProInterest({ apiKey: SECRET, fetcher }),
    /invalid JSON response/
  );
});

test('network failures have sanitized diagnostics and no retry', async () => {
  let calls = 0;
  await assert.rejects(
    auditButtondownProInterest({
      apiKey: SECRET,
      fetcher: async () => {
        calls += 1;
        throw new Error(SECRET + PRIVATE_EMAIL);
      },
    }),
    (error) =>
      error.name === 'ButtondownReadOnlyAuditError' &&
      error.message === 'Buttondown read-only request failed'
  );
  assert.equal(calls, 1);
});

test('missing local API key means zero provider calls', async () => {
  let calls = 0;
  await assert.rejects(
    auditButtondownProInterest({
      apiKey: undefined,
      fetcher: async () => {
        calls += 1;
        throw new Error('must not fetch');
      },
    }),
    /BUTTONDOWN_API_KEY must be set/
  );
  assert.equal(calls, 0);
});

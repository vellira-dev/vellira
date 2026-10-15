import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyProInterestLive } from './pro-interest-live-smoke.mjs';

function responses({ visible, status, code }) {
  const calls = [];
  return {
    calls,
    fetcher: async (url, options) => {
      calls.push({ url: String(url), options });
      if (new URL(url).pathname === '/') {
        return new Response(
          visible
            ? '<section id="pro-interest-title">Get Pro updates</section>'
            : '<main>Vellira</main>',
          { status: 200 }
        );
      }
      return Response.json({ ok: false, code }, { status });
    },
  };
}

test('preview verifies rendered form and rejects missing consent before any provider write', async () => {
  const { calls, fetcher } = responses({
    visible: true,
    status: 400,
    code: 'consent_required',
  });
  assert.equal(
    await verifyProInterestLive({
      siteUrl: 'https://staging.example',
      enabled: true,
      fetcher,
    }),
    'preview'
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    email: 'vellira-pro-smoke@example.invalid',
    purpose: 'pro_launch',
    consent: false,
  });
});

test('default and production OFF verify hidden form and gated API', async () => {
  const { calls, fetcher } = responses({
    visible: false,
    status: 503,
    code: 'temporarily_unavailable',
  });
  assert.equal(
    await verifyProInterestLive({
      siteUrl: 'https://vellira.dev',
      enabled: false,
      fetcher,
    }),
    'off'
  );
  assert.equal(JSON.parse(calls[1].options.body).consent, true);
});

test('fails closed on unexpected public signup visibility', async () => {
  const { fetcher } = responses({
    visible: true,
    status: 503,
    code: 'temporarily_unavailable',
  });
  await assert.rejects(
    () =>
      verifyProInterestLive({
        siteUrl: 'https://vellira.dev',
        enabled: false,
        fetcher,
      }),
    /visibility does not match/
  );
});

import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const FORM_MARKER = 'id="pro-interest-title"';
const PROBE_ADDRESS = 'vellira-pro-smoke@example.invalid';
const TIMEOUT_MS = 12_000;

export async function verifyProInterestLive({ siteUrl, enabled, fetcher = fetch }) {
  assert.equal(typeof enabled, 'boolean', 'Expected mode must be boolean');
  assert.ok(siteUrl, 'WEBSITE_URL is required');
  const origin = new URL(siteUrl);
  assert.equal(origin.protocol, 'https:', 'Live smoke requires HTTPS');

  const homepage = await fetcher(new URL('/', origin), {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  assert.equal(homepage.status, 200, 'Homepage must respond with HTTP 200');
  const html = await homepage.text();
  assert.equal(
    html.includes(FORM_MARKER),
    enabled,
    'Live Pro signup visibility does not match the approved build mode'
  );

  // Missing consent in preview and disabled purpose in OFF mode both reject
  // before contacting Buttondown. Neither check may create a subscriber.
  const response = await fetcher(
    new URL('/api/newsletter/subscribe', origin),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin.origin,
      },
      body: JSON.stringify({
        email: PROBE_ADDRESS,
        purpose: 'pro_launch',
        consent: !enabled,
      }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }
  );
  assert.equal(response.status, enabled ? 400 : 503);
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.equal(
    payload.code,
    enabled ? 'consent_required' : 'temporarily_unavailable'
  );
  return enabled ? 'preview' : 'off';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.env.PRO_INTEREST_EXPECTED_MODE;
  assert.ok(mode === '0' || mode === '1', 'Expected mode must be 0 or 1');
  const result = await verifyProInterestLive({
    siteUrl: process.env.WEBSITE_URL,
    enabled: mode === '1',
  });
  console.log(`Pro interest live smoke PASS: ${result}; no subscribers created`);
}

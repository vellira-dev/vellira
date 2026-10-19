import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const PROBE_EMAIL = 'not-an-email';
const TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 32;

/**
 * Live staging proof: only malformed addresses are sent; the existing API
 * rejects them before making any Buttondown subscriber mutation.
 */
export async function verifyNewsletterGuardLive({
  siteUrl,
  enabled,
  fetcher = fetch,
  maxAttempts = MAX_ATTEMPTS,
}) {
  assert.equal(typeof enabled, 'boolean', 'Expected mode must be boolean');
  const origin = new URL(siteUrl);
  assert.equal(origin.protocol, 'https:', 'Staging proof requires HTTPS');
  assert.equal(
    origin.hostname,
    'vellira-website-staging.vellira.workers.dev',
    'Only the canonical staging Worker can be probed'
  );
  assert.ok(
    Number.isInteger(maxAttempts) && maxAttempts > 0 && maxAttempts <= MAX_ATTEMPTS
  );

  for (let i = 0; i < (enabled ? maxAttempts : 1); i++) {
    const result = await fetcher(
      new URL('/api/newsletter/subscribe', origin),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: origin.origin,
        },
        body: JSON.stringify({ email: PROBE_EMAIL }),
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );
    assert.equal(result.headers.get('cache-control'), 'no-store');
    // No address, API key, subscriber body or provider error is ever logged.
    const payload = await result.json();
    if (result.status === 429) {
      assert.equal(enabled, true, 'Default OFF must never rate limit the probe');
      assert.equal(payload.code, 'rate_limited');
      assert.equal(result.headers.get('retry-after'), '60');
      return 'preview-denial-proven';
    }
    assert.equal(result.status, 400);
    assert.equal(payload.code, 'invalid_email');
  }

  if (enabled)
    throw new Error('Staging rate limit did not return HTTP 429 in the bounded proof');
  return 'off';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.env.NEWSLETTER_ABUSE_GUARD_EXPECTED_MODE;
  assert.ok(mode === '0' || mode === '1', 'Expected guard mode 0 or 1');
  const result = await verifyNewsletterGuardLive({
    siteUrl: process.env.WEBSITE_URL,
    enabled: mode === '1',
  });
  console.log('Newsletter abuse guard smoke PASS: ' + result + '; no writes');
}

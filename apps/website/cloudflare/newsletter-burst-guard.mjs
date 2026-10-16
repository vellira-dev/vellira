// An opt-in, Cloudflare-native burst guard for the shared newsletter endpoint.
// Deployment modes are configured by trusted Wrangler bindings, not callers.
export const NEWSLETTER_SUBSCRIBE_PATH = '/api/newsletter/subscribe';
export const NEWSLETTER_ABUSE_GUARD_VAR = 'NEWSLETTER_ABUSE_GUARD_ENABLED';

const ROUTE_KEY = 'newsletter:subscribe';
const RATE_LIMITED_MESSAGE = 'Please wait a few minutes and try again.';
const UNAVAILABLE_MESSAGE =
  'Newsletter signup is temporarily unavailable. Please try again later.';

function guardedPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  // Cover benign path aliases that a framework could canonicalize into the
  // same Next.js API route. Only POST is subject to the limiter.
  return (
    decoded.replace(/\/{2,}/g, '/').replace(/\/+$/, '') ===
    NEWSLETTER_SUBSCRIBE_PATH
  );
}

function trustedClientAddress(headers) {
  // Cloudflare sets CF-Connecting-IP on the inbound Worker request. Never use
  // caller-supplied X-Forwarded-For, Origin, email or purpose for limiter keys.
  const value = headers.get('cf-connecting-ip')?.trim() ?? '';
  if (!value || value.length > 45) return null;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
    return value.split('.').every((octet) => Number(octet) <= 255)
      ? value
      : null;
  }
  if (!value.includes(':') || !/^[a-f\d:.]+$/i.test(value)) return null;
  try {
    // WHATWG URL parsing rejects malformed IPv6 and canonicalizes valid forms.
    return new URL(`http://[${value}]/`).hostname.slice(1, -1);
  } catch {
    return null;
  }
}

function deny(status, code, message) {
  return Response.json(
    { ok: false, code, message },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        ...(status === 429 ? { 'Retry-After': '60' } : {}),
      },
    }
  );
}

function unavailable() {
  return deny(503, 'temporarily_unavailable', UNAVAILABLE_MESSAGE);
}

function limited() {
  return deny(429, 'rate_limited', RATE_LIMITED_MESSAGE);
}

async function check(limiter, key) {
  if (!limiter || typeof limiter.limit !== 'function')
    return 'unavailable';
  try {
    const result = await limiter.limit({ key });
    if (result?.success === true) return 'allowed';
    if (result?.success === false) return 'limited';
  } catch {
    // Never reveal binding failure details or forward a request on ambiguity.
  }
  return 'unavailable';
}

/**
 * Return null to continue to OpenNext, or a safe response to stop before
 * the Buttondown-backed route. Nothing is persisted or logged here.
 */
export async function maybeLimitNewsletterSubscribe(request, env) {
  if (
    request.method !== 'POST' ||
    !guardedPath(new URL(request.url).pathname)
  )
    return null;

  const mode = env?.[NEWSLETTER_ABUSE_GUARD_VAR];
  // Production has no guard bindings. All automatic staging deployments also
  // default OFF. Only an explicit staging preview selects '1'.
  if (mode == null || mode === '0') return null;
  if (mode !== '1') return unavailable();

  // Both limits must exist. Apply the actor limit first so one abusive IP
  // cannot consume the entire shared route budget after its own denial.
  if (
    typeof env.NEWSLETTER_ROUTE_RATE_LIMIT?.limit !== 'function' ||
    typeof env.NEWSLETTER_ACTOR_RATE_LIMIT?.limit !== 'function'
  )
    return unavailable();

  const actor = trustedClientAddress(request.headers) ?? 'unknown';
  const local = await check(
    env.NEWSLETTER_ACTOR_RATE_LIMIT,
    `${ROUTE_KEY}:actor:${actor}`
  );
  if (local === 'limited') return limited();
  if (local !== 'allowed') return unavailable();

  // The route key is shared for ordinary newsletter and Pro signup. Callers
  // cannot reset either budget by altering purpose or email parameters.
  const route = await check(env.NEWSLETTER_ROUTE_RATE_LIMIT, ROUTE_KEY);
  if (route === 'limited') return limited();
  if (route !== 'allowed') return unavailable();
  return null;
}

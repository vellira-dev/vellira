import { pathToFileURL } from 'node:url';

import { inspectNewsletterOwnerDeploymentReadOnly } from './newsletter-owner-deployment-readproof.mjs';

const API = 'https://api.cloudflare.com';
const ACCOUNT = /^[a-f0-9]{32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNER = 'vellira-newsletter-budget-owner';

export function makeNewsletterOwnerReadonlyReader({
  accountId,
  token,
  fetcher = fetch,
}) {
  if (!ACCOUNT.test(accountId ?? '') ||
      typeof token !== 'string' || !token.trim() ||
      typeof fetcher !== 'function') {
    throw new Error('Read-only account credentials and fetcher required');
  }
  const root = '/accounts/' + accountId + '/workers/scripts/' + OWNER;
  const list = root + '/deployments?page=1&per_page=2';

  return async (path) => {
    if (typeof path !== 'string') throw new Error('Blocked Cloudflare read path');
    const tail = path.startsWith(root + '/') ? path.slice(root.length) : '';
    if (path !== list &&
        !/^\\/deployments\\/[0-9a-f-]+$/i.test(tail) &&
        !/^\\/versions\\/[0-9a-f-]+$/i.test(tail)) {
      throw new Error('Blocked Cloudflare read path');
    }
    if (path !== list && !UUID.test(tail.split('/')[2] ?? '')) {
      throw new Error('Invalid Cloudflare version identifier');
    }
    const url = new URL('/client/v4' + path, API);
    if (url.origin !== API || url.username || url.password ||
        url.pathname !== '/client/v4' + path.split('?')[0]) {
      throw new Error('Blocked Cloudflare destination');
    }
    const response = await fetcher(url, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + token.trim(),
        Accept: 'application/json',
      },
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (response?.status !== 200) throw new Error('Cloudflare read unavailable');
    const payload = await response.json();
    if (payload?.success !== true || !Object.hasOwn(payload, 'result')) {
      throw new Error('Cloudflare response incomplete');
    }
    return payload;
  };
}

export async function inspectNewsletterOwnerWithProtectedReader({
  accountId,
  token,
  fetcher,
} = {}) {
  const reader = makeNewsletterOwnerReadonlyReader({ accountId, token, fetcher });
  return inspectNewsletterOwnerDeploymentReadOnly({
    accountId,
    cloudflareGet: reader,
  });
}

// Explicit CLI invocation only. No CI workflow automatically supplies secrets,
// no remote read on import, and no raw Cloudflare payloads in output.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await inspectNewsletterOwnerWithProtectedReader({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_WORKERS_READ_TOKEN,
    });
    console.log(JSON.stringify(result));
    if (result.status !== 'stable_single_version_observed') process.exitCode = 1;
  } catch {
    console.error('Owner read-only verification unavailable');
    process.exitCode = 1;
  }
}

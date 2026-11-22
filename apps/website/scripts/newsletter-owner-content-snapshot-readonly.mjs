import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { inspectNewsletterOwnerWithProtectedReader } from './newsletter-owner-protected-readonly.mjs';

const API = 'https://api.cloudflare.com';
const ACCOUNT = /^[a-f0-9]{32}$/;
const OWNER = 'vellira-newsletter-budget-owner';
const MAX_CONTENT_BYTES = 8 * 1024 * 1024;

// Content/v2 is script-scoped, NOT an immutable version-specific download.
// This diagnostic must never claim deployed-version source attestation.
export async function inspectNewsletterOwnerContentSnapshotReadOnly({
  accountId, token, metadataFetcher = fetch, contentFetcher = fetch,
} = {}) {
  const unverified = (reason) => ({
    status: 'unverified', reason, contentSnapshotObserved: false,
    sourceBytesVerified: false, remotelyAttested: false, cutoverAuthorized: false,
  });
  if (!ACCOUNT.test(accountId ?? '') || typeof token !== 'string' ||
      !token.trim() || typeof metadataFetcher !== 'function' ||
      typeof contentFetcher !== 'function') return unverified('invalid_reader');

  const metadata = () => inspectNewsletterOwnerWithProtectedReader({
    accountId, token, fetcher: metadataFetcher,
  });
  try {
    const before = await metadata();
    if (before.status !== 'stable_single_version_observed') {
      return unverified('deployment_precheck_unverified');
    }
    const url = new URL(
      '/client/v4/accounts/' + accountId + '/workers/scripts/' + OWNER + '/content/v2',
      API,
    );
    const response = await contentFetcher(url, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token.trim(), Accept: '*/*' },
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (response?.status !== 200) return unverified('content_read_unavailable');
    const length = response.headers?.get('content-length');
    if (length !== null && length !== undefined &&
        (!/^(0|[1-9][0-9]*)$/.test(length) || Number(length) > MAX_CONTENT_BYTES)) {
      return unverified('content_size_unverified');
    }
    // Never log or persist the downloaded script; reject empty/oversized bodies.
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1 || bytes.length > MAX_CONTENT_BYTES) {
      return unverified('content_size_unverified');
    }
    const contentSha256 = createHash('sha256').update(bytes).digest('hex');
    const after = await metadata();
    if (after.status !== 'stable_single_version_observed') {
      return unverified('deployment_postcheck_unverified');
    }
    return {
      status: 'script_scoped_content_snapshot_observed',
      contentSnapshotObserved: true,
      contentSha256,
      contentBytes: bytes.length,
      versionBoundContent: false,
      sourceBytesVerified: false,
      remotelyAttested: false,
      cutoverAuthorized: false,
    };
  } catch {
    return unverified('cloudflare_read_unavailable');
  }
}

// Explicit owner-only invocation; never auto-run with CI secrets.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await inspectNewsletterOwnerContentSnapshotReadOnly({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    token: process.env.CLOUDFLARE_WORKERS_READ_TOKEN,
  });
  console.log(JSON.stringify(result));
  if (result.status !== 'script_scoped_content_snapshot_observed') process.exitCode = 1;
}

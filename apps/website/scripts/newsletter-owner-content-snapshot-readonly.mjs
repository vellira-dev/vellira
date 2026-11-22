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

  // Capture deployment and serving-version identities privately for both
  // continuity inspections. The existing inspector deliberately redacts IDs.
  // Comparing only its public "stable" status would miss a cutover between reads.
  const deploymentIdentities = [];
  const metadata = () => inspectNewsletterOwnerWithProtectedReader({
    accountId,
    token,
    fetcher: async (url, options) => {
      const response = await metadataFetcher(url, options);
      if (url.pathname.endsWith('/deployments') && url.search === '?page=1&per_page=2' &&
          response?.status === 200) {
        const payload = await response.clone().json();
        const current = payload?.result?.deployments?.[0];
        const deploymentId = current?.id;
        const versionId = current?.versions?.[0]?.version_id;
        if (typeof deploymentId === 'string' && typeof versionId === 'string') {
          deploymentIdentities.push(deploymentId + ':' + versionId);
        }
      }
      return response;
    },
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
    // Bound the stream even if the response omits or lies about Content-Length.
    // Hash chunks without retaining or logging source bytes.
    if (!response.body || typeof response.body.getReader !== 'function') {
      return unverified('content_body_unavailable');
    }
    const reader = response.body.getReader();
    const digest = createHash('sha256');
    let contentBytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!(value instanceof Uint8Array)) return unverified('content_body_unavailable');
        contentBytes += value.byteLength;
        if (contentBytes > MAX_CONTENT_BYTES) {
          await reader.cancel();
          return unverified('content_size_unverified');
        }
        digest.update(value);
      }
    } finally {
      reader.releaseLock();
    }
    if (contentBytes < 1) return unverified('content_size_unverified');
    const contentSha256 = digest.digest('hex');
    const after = await metadata();
    if (after.status !== 'stable_single_version_observed') {
      return unverified('deployment_postcheck_unverified');
    }
    if (deploymentIdentities.length !== 4 ||
        !deploymentIdentities.every((identity) => identity === deploymentIdentities[0])) {
      return unverified('deployment_changed_during_snapshot');
    }
    return {
      status: 'script_scoped_content_snapshot_observed',
      contentSnapshotObserved: true,
      contentSha256,
      contentBytes,
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

// GET-only owner Worker deployment continuity proof. This validates remote
// deployment identities but NEVER attests Worker source bytes or permits cutover.
const OWNER = 'vellira-newsletter-budget-owner';
const ACCOUNT = /^[a-f0-9]{32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function deployment(payload) {
  if (payload?.success !== true || !Array.isArray(payload.result?.deployments) ||
      payload.result.deployments.length < 1) return null;
  const current = payload.result.deployments[0];
  if (!UUID.test(current?.id ?? '') ||
      current.strategy !== 'percentage' ||
      !Array.isArray(current.versions) ||
      current.versions.length !== 1 ||
      current.versions[0].percentage !== 100 ||
      !UUID.test(current.versions[0].version_id ?? '')) return null;
  return { deploymentId: current.id, versionId: current.versions[0].version_id };
}

export async function inspectNewsletterOwnerDeploymentReadOnly({
  accountId,
  cloudflareGet,
} = {}) {
  const denied = (reason) => ({
    status: 'unverified',
    reason,
    remotelyAttested: false,
    cutoverAuthorized: false,
  });
  if (!ACCOUNT.test(accountId ?? '') || typeof cloudflareGet !== 'function') {
    return denied('invalid_reader');
  }
  const base = '/accounts/' + accountId + '/workers/scripts/' + OWNER;
  const listPath = base + '/deployments?page=1&per_page=2';
  try {
    const first = deployment(await cloudflareGet(listPath));
    if (!first) return denied('invalid_initial_deployment');
    const detail = await cloudflareGet(base + '/deployments/' + first.deploymentId);
    if (detail?.success !== true ||
        detail.result?.id !== first.deploymentId ||
        detail.result?.strategy !== 'percentage' ||
        !Array.isArray(detail.result?.versions) ||
        detail.result.versions.length !== 1 ||
        detail.result.versions[0].percentage !== 100 ||
        detail.result.versions[0].version_id !== first.versionId) {
      return denied('deployment_detail_mismatch');
    }
    const version = await cloudflareGet(base + '/versions/' + first.versionId);
    if (version?.success !== true ||
        version.result?.id !== first.versionId ||
        typeof version.result?.resources?.script?.etag !== 'string' ||
        !version.result.resources.script.etag.trim()) {
      return denied('version_metadata_unverified');
    }
    const second = deployment(await cloudflareGet(listPath));
    if (!second || second.deploymentId !== first.deploymentId ||
        second.versionId !== first.versionId) {
      return denied('deployment_changed_during_read');
    }
    // No IDs, etags, raw script content or bindings in the public report.
    return {
      status: 'stable_single_version_observed',
      servingVersionCount: 1,
      sourceBytesVerified: false,
      remotelyAttested: false,
      cutoverAuthorized: false,
    };
  } catch {
    return denied('cloudflare_read_unavailable');
  }
}

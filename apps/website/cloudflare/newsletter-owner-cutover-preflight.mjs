// Pure, offline-only cutover gate. This cannot inspect or alter live Cloudflare.
// Evidence must come from a future independently reviewed read-only audit.
// A version fence cannot stop previously deployed code that ignores it.
const SHA = /^[0-9a-f]{40}$/;
const VERSION = /^[0-9a-f-]{36}$/i;
const REQUIRED = ['owner', 'staging', 'production'];

function validVersions(versions) {
  return (
    Array.isArray(versions) &&
    versions.length > 0 &&
    versions.length <= 4 &&
    versions.every(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        VERSION.test(entry.id ?? '') &&
        Number.isFinite(entry.percent) &&
        entry.percent > 0 &&
        entry.percent <= 100 &&
        entry.coordinator === 'cooperative-v1'
    ) &&
    new Set(versions.map((entry) => entry.id)).size === versions.length &&
    Math.abs(versions.reduce((sum, entry) => sum + entry.percent, 0) - 100) <
      0.000001
  );
}

export function evaluateNewsletterOwnerCutover(evidence) {
  const deny = (reason) => ({ ready: false, reason });
  if (!evidence || typeof evidence !== 'object') {
    return deny('missing_evidence');
  }
  if (!SHA.test(evidence.candidateSha ?? '')) {
    return deny('unverified_candidate');
  }
  if (evidence.budgetEnabled !== false || evidence.publicProEnabled !== false) {
    return deny('activation_not_off');
  }
  if (evidence.ownerWorker !== 'vellira-newsletter-budget-owner' ||
      evidence.objectName !== 'one-buttondown-account' ||
      evidence.namespaceIdentityVerified !== true) {
    return deny('owner_identity_unverified');
  }
  if (evidence.oldRequestsDrained !== true ||
      evidence.oldVersionsRollbackDisabled !== true) {
    return deny('legacy_may_still_write');
  }
  if (!evidence.snapshots ||
      !Array.isArray(evidence.snapshots) ||
      evidence.snapshots.length !== 2) {
    return deny('insufficient_snapshots');
  }
  const [first, second] = evidence.snapshots;
  if (!first || !second ||
      !Number.isSafeInteger(first.observedAt) ||
      !Number.isSafeInteger(second.observedAt) ||
      second.observedAt <= first.observedAt ||
      !evidence.minimumDrainMs ||
      !Number.isSafeInteger(evidence.minimumDrainMs) ||
      evidence.minimumDrainMs < 1 ||
      second.observedAt - first.observedAt < evidence.minimumDrainMs) {
    return deny('drain_window_unverified');
  }
  for (const snapshot of [first, second]) {
    if (!snapshot.environments || typeof snapshot.environments !== 'object') {
      return deny('serving_versions_unverified');
    }
    for (const name of REQUIRED) {
      if (!validVersions(snapshot.environments[name])) {
        return deny('serving_versions_unverified');
      }
    }
  }
  for (const name of REQUIRED) {
    const from = first.environments[name].map((x) => x.id).sort().join(',');
    const to = second.environments[name].map((x) => x.id).sort().join(',');
    if (from !== to) return deny('serving_versions_changed');
  }
  return { ready: true, reason: 'offline_preflight_only' };
}

// Even a positive offline result DOES NOT authorize owner deployment or
// admission activation: evidence authenticity and in-flight drain must be
// established by separate remote account checks and human approval.

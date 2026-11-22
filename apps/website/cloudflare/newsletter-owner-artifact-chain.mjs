// Offline-only consistency check for Git SHA -> built artifact -> reported
// Cloudflare Worker version -> serving deployment. No remote API access.
// Never treat user-provided receipts or labels as independently attested.
const SHA = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNER = 'vellira-newsletter-budget-owner';

export function evaluateNewsletterOwnerArtifactChain(chain) {
  const deny = (reason) => ({
    consistent: false,
    reason,
    remotelyAttested: false,
    cutoverAuthorized: false,
  });
  if (!chain || typeof chain !== 'object' || Array.isArray(chain)) {
    return deny('missing_evidence');
  }
  const { build, upload, serving } = chain;
  if (!SHA.test(chain.gitSha ?? '') ||
      !build || typeof build !== 'object' ||
      build.worker !== OWNER ||
      build.gitSha !== chain.gitSha ||
      !SHA256.test(build.bundleSha256 ?? '')) {
    return deny('build_identity_unverified');
  }
  if (!upload || typeof upload !== 'object' ||
      upload.worker !== OWNER ||
      upload.gitSha !== chain.gitSha ||
      upload.bundleSha256 !== build.bundleSha256 ||
      !UUID.test(upload.versionId ?? '')) {
    return deny('upload_identity_mismatch');
  }
  if (!serving || typeof serving !== 'object' ||
      serving.worker !== OWNER ||
      !Array.isArray(serving.versions) ||
      serving.versions.length < 1 ||
      serving.versions.length > 4) {
    return deny('serving_versions_unverified');
  }
  const entries = serving.versions;
  if (!entries.every((entry) =>
    entry && typeof entry === 'object' &&
    UUID.test(entry.versionId ?? '') &&
    typeof entry.percent === 'number' &&
    Number.isFinite(entry.percent) &&
    entry.percent >= 0.01 &&
    entry.percent <= 100) ||
    new Set(entries.map((entry) => entry.versionId)).size !== entries.length ||
    Math.abs(entries.reduce((sum, entry) => sum + entry.percent, 0) - 100) >= 1e-6) {
    return deny('serving_versions_unverified');
  }
  // For this single-artifact proof, ALL traffic must target its one uploaded
  // version. Even 0.01% old code is disqualifying.
  if (entries.length !== 1 ||
      entries[0].versionId !== upload.versionId ||
      entries[0].percent !== 100) {
    return deny('unmatched_serving_version');
  }
  // Consistency is not authenticity: a forged receipt can pass every comparison.
  // Source bytes, build reproducibility and CF deployment API responses still
  // require a separately trusted collector and immutable provenance.
  return {
    consistent: true,
    reason: 'untrusted_chain_consistent',
    remotelyAttested: false,
    cutoverAuthorized: false,
  };
}

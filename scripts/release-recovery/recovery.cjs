const assert = require('node:assert/strict');

const CONFIRMATION = 'RECOVER_EXISTING_RELEASE';
const REPOSITORY = 'vellira-dev/vellira';
const RELEASE_WORKFLOW = '.github/workflows/release.yml';
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

function validateInputs({ version, expectedTagSha, confirmation }) {
  assert.match(version ?? '', SEMVER, 'release_version must be valid SemVer');
  assert.match(
    expectedTagSha ?? '',
    /^[a-f0-9]{40}$/,
    'expected_tag_sha must be a lowercase 40-character Git SHA'
  );
  assert.equal(
    confirmation,
    CONFIRMATION,
    `confirmation must equal ${CONFIRMATION}`
  );
  return { version, tag: `v${version}`, expectedTagSha };
}

function assertTagState({
  tagExists,
  tagSha,
  expectedTagSha,
  reachableFromMain,
}) {
  assert.equal(tagExists, true, 'Release tag does not exist');
  assert.equal(tagSha, expectedTagSha, 'Release tag SHA does not match');
  assert.equal(
    reachableFromMain,
    true,
    'Expected tag SHA is not reachable from main'
  );
}

function assertTaggedCheckout({ checkoutSha, expectedTagSha }) {
  assert.equal(
    checkoutSha,
    expectedTagSha,
    'Package recovery must run from the exact tagged commit'
  );
}

function assertTaggedSourceChanges(paths) {
  const allowed = new Set([
    'package.json',
    'pnpm-lock.yaml',
    ...['core', 'tokens', 'types', 'icons', 'react', 'react-native'].map(
      (name) => `packages/${name}/package.json`
    ),
  ]);
  for (const changedPath of paths) {
    assert.ok(
      allowed.has(changedPath),
      `Tagged package source has an unexpected change: ${changedPath}`
    );
  }
}

function planPackageRecovery(packageNames, states) {
  const publish = [];
  const satisfied = [];
  for (const packageName of packageNames) {
    const state = states[packageName];
    assert.ok(state, `Missing registry decision for ${packageName}`);
    if (state.exists === false) {
      publish.push(packageName);
      continue;
    }
    assert.equal(
      state.exists,
      true,
      `Ambiguous registry state for ${packageName}`
    );
    assert.equal(
      state.verified,
      true,
      `${packageName} exists but integrity/provenance verification failed`
    );
    satisfied.push(packageName);
  }
  return { publish, satisfied };
}

function integrityHex(integrity) {
  assert.match(integrity ?? '', /^sha512-[A-Za-z0-9+/]+={0,2}$/);
  return Buffer.from(integrity.slice('sha512-'.length), 'base64').toString(
    'hex'
  );
}

function verifyRegistryEvidence(
  { packageName, version, dist, attestations },
  { allowedSourceShas }
) {
  assert.ok(dist?.integrity, `${packageName}@${version} has no integrity`);
  assert.ok(dist?.tarball, `${packageName}@${version} has no tarball`);
  assert.ok(Array.isArray(attestations) && attestations.length > 0);
  const expectedDigest = integrityHex(dist.integrity);
  const statements = attestations.map((entry) => {
    const envelope = entry.bundle?.dsseEnvelope;
    assert.ok(envelope?.payload, 'Attestation has no DSSE payload');
    return JSON.parse(Buffer.from(envelope.payload, 'base64').toString());
  });
  const provenance = statements.find(
    (statement) => statement.predicateType === 'https://slsa.dev/provenance/v1'
  );
  assert.ok(provenance, `${packageName}@${version} has no SLSA provenance`);
  assert.ok(
    statements.every((statement) =>
      statement.subject?.some(
        (subject) => subject.digest?.sha512 === expectedDigest
      )
    ),
    `${packageName}@${version} attestation digest differs from dist.integrity`
  );
  const definition = provenance.predicate?.buildDefinition;
  assert.equal(
    definition?.externalParameters?.workflow?.repository,
    `https://github.com/${REPOSITORY}`
  );
  assert.equal(
    definition.externalParameters.workflow.path,
    RELEASE_WORKFLOW,
    'Package was not published by the trusted Release workflow'
  );
  const sourceShas =
    definition.resolvedDependencies
      ?.map((dependency) => dependency.digest?.gitCommit)
      .filter(Boolean) ?? [];
  assert.ok(
    sourceShas.some((sha) => allowedSourceShas.includes(sha)),
    `${packageName}@${version} provenance has an unexpected source SHA`
  );
  return { integrity: dist.integrity, tarball: dist.tarball, sourceShas };
}

function assessGithubRelease(existing, expected) {
  if (!existing) return { action: 'create' };
  assert.equal(existing.tag_name, expected.tagName, 'Release tag conflicts');
  assert.equal(
    existing.draft,
    false,
    'Existing release is unexpectedly a draft'
  );
  assert.equal(
    existing.prerelease,
    false,
    'Existing release is unexpectedly a prerelease'
  );
  assert.equal(existing.name, expected.name, 'Existing release name conflicts');
  assert.equal(existing.body, expected.body, 'Existing release notes conflict');
  return { action: 'none', releaseId: existing.id };
}

function assertNoCloudflareChanges(paths) {
  for (const changedPath of paths) {
    assert.ok(
      !changedPath.includes('cloudflare') &&
        !changedPath.startsWith('apps/website/') &&
        !changedPath.includes('wrangler'),
      `Release recovery must not affect Cloudflare: ${changedPath}`
    );
  }
}

module.exports = {
  CONFIRMATION,
  RELEASE_WORKFLOW,
  REPOSITORY,
  assessGithubRelease,
  assertNoCloudflareChanges,
  assertTaggedCheckout,
  assertTaggedSourceChanges,
  assertTagState,
  planPackageRecovery,
  validateInputs,
  verifyRegistryEvidence,
};

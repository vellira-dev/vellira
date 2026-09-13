import assert from 'node:assert/strict';
import test from 'node:test';
import { validateStagingEvidence } from './cloudflare-staging-evidence.mjs';

const expected = {
  sourceSha: 'a'.repeat(40),
  runId: 123456,
  runAttempt: 2,
  repository: 'vellira-dev/vellira',
  sourceRef: 'refs/heads/main',
  eventName: 'push',
  stagingUrl: 'https://vellira-website-staging.vellira.workers.dev',
};

function evidence(overrides = {}) {
  return {
    schemaVersion: 1,
    sourceSha: expected.sourceSha,
    sourceRef: expected.sourceRef,
    eventName: expected.eventName,
    buildId: `${expected.sourceSha}-${expected.runId}-${expected.runAttempt}`,
    workerVersion: 'worker-version-1',
    stagingUrl: expected.stagingUrl,
    runId: expected.runId,
    runAttempt: expected.runAttempt,
    repository: expected.repository,
    ...overrides,
  };
}

test('accepts exact push-to-main staging evidence', () => {
  const result = validateStagingEvidence(evidence(), expected);
  assert.equal(result.sourceSha, expected.sourceSha);
});

test('rejects evidence from a different candidate SHA', () => {
  assert.throws(
    () => validateStagingEvidence(evidence({ sourceSha: 'b'.repeat(40) }), expected),
    /source SHA mismatch/
  );
});

test('rejects evidence from manual staging', () => {
  assert.throws(
    () =>
      validateStagingEvidence(
        evidence({ eventName: 'workflow_dispatch' }),
        expected
      ),
    /event mismatch/
  );
});

test('rejects evidence whose build identity is not bound to the staging run', () => {
  assert.throws(
    () => validateStagingEvidence(evidence({ buildId: 'stale-build' }), expected),
    /build ID mismatch/
  );
});

test('rejects evidence from another run attempt', () => {
  assert.throws(
    () => validateStagingEvidence(evidence({ runAttempt: 1 }), expected),
    /run attempt mismatch/
  );
});

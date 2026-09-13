import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

function requirePositiveInteger(value, label) {
  assert.ok(Number.isInteger(value) && value > 0, `${label} must be a positive integer`);
}

function requireNonEmptyString(value, label) {
  assert.equal(typeof value, 'string', `${label} must be a string`);
  assert.ok(value.length > 0, `${label} must not be empty`);
}

export function validateStagingEvidence(evidence, expected) {
  assert.ok(evidence && typeof evidence === 'object' && !Array.isArray(evidence));
  assert.equal(evidence.schemaVersion, 1, 'Unsupported staging evidence schema');

  requireNonEmptyString(expected.sourceSha, 'expected source SHA');
  assert.match(expected.sourceSha, COMMIT_SHA_PATTERN, 'Expected source SHA must be canonical');
  requirePositiveInteger(expected.runId, 'expected run ID');
  requirePositiveInteger(expected.runAttempt, 'expected run attempt');
  requireNonEmptyString(expected.repository, 'expected repository');
  requireNonEmptyString(expected.sourceRef, 'expected source ref');
  requireNonEmptyString(expected.eventName, 'expected event name');
  requireNonEmptyString(expected.stagingUrl, 'expected staging URL');

  assert.equal(evidence.sourceSha, expected.sourceSha, 'Staging evidence source SHA mismatch');
  assert.equal(evidence.sourceRef, expected.sourceRef, 'Staging evidence source ref mismatch');
  assert.equal(evidence.eventName, expected.eventName, 'Staging evidence event mismatch');
  assert.equal(evidence.runId, expected.runId, 'Staging evidence run ID mismatch');
  assert.equal(
    evidence.runAttempt,
    expected.runAttempt,
    'Staging evidence run attempt mismatch'
  );
  assert.equal(
    evidence.repository,
    expected.repository,
    'Staging evidence repository mismatch'
  );
  assert.equal(evidence.stagingUrl, expected.stagingUrl, 'Staging evidence URL mismatch');

  const expectedBuildId = `${expected.sourceSha}-${expected.runId}-${expected.runAttempt}`;
  assert.equal(evidence.buildId, expectedBuildId, 'Staging evidence build ID mismatch');
  requireNonEmptyString(evidence.workerVersion, 'staging worker version');

  return evidence;
}

export async function validateStagingEvidenceFile(filePath, expected) {
  const evidence = JSON.parse(await fs.readFile(filePath, 'utf8'));
  return validateStagingEvidence(evidence, expected);
}

function expectedFromEnvironment(env) {
  return {
    sourceSha: env.EXPECTED_SOURCE_SHA,
    runId: Number(env.EXPECTED_RUN_ID),
    runAttempt: Number(env.EXPECTED_RUN_ATTEMPT),
    repository: env.EXPECTED_REPOSITORY,
    sourceRef: env.EXPECTED_SOURCE_REF,
    eventName: env.EXPECTED_EVENT_NAME,
    stagingUrl: env.EXPECTED_STAGING_URL,
  };
}

async function main() {
  const filePath = process.argv[2];
  assert.ok(filePath, 'Usage: cloudflare-staging-evidence.mjs <staging-evidence.json>');

  const evidence = await validateStagingEvidenceFile(
    filePath,
    expectedFromEnvironment(process.env)
  );
  console.log(
    `Validated staging promotion evidence for ${evidence.sourceSha} from run ${evidence.runId}/${evidence.runAttempt}.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

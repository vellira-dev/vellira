import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{40}$/;
const OUTCOMES = new Set(['success', 'failure', 'skipped', 'cancelled']);
const MAX_ROUTE_REQUESTS = 21;

function outcome(value, name) {
  assert.ok(OUTCOMES.has(value), 'Invalid ' + name + ' outcome');
  return value;
}

export function buildReadOnlyDiagnosticReceipt({
  sourceSha, stagingRunId, stagingRunAttempt,
  diagnosticRunId, diagnosticRunAttempt,
  admissionOutcome, eligible, identityOutcome, smokeOutcome, finalIdentityOutcome,
}) {
  assert.match(sourceSha ?? '', SHA, 'Invalid staging source SHA');
  for (const [name, value] of Object.entries({
    stagingRunId, stagingRunAttempt, diagnosticRunId, diagnosticRunAttempt,
  })) {
    assert.ok(Number.isSafeInteger(value) && value > 0, 'Invalid ' + name);
  }
  assert.ok(typeof eligible === 'boolean');
  outcome(admissionOutcome, 'admission');
  outcome(identityOutcome, 'initial identity');
  outcome(smokeOutcome, 'route smoke');
  outcome(finalIdentityOutcome, 'final identity');

  let status;
  if (admissionOutcome !== 'success') {
    assert.equal(identityOutcome, 'skipped');
    assert.equal(smokeOutcome, 'skipped');
    assert.equal(finalIdentityOutcome, 'skipped');
    status = 'admission_failed';
  } else if (!eligible) {
    assert.equal(identityOutcome, 'skipped');
    assert.equal(smokeOutcome, 'skipped');
    assert.equal(finalIdentityOutcome, 'skipped');
    status = 'not_eligible';
  } else if (identityOutcome !== 'success') {
    assert.equal(smokeOutcome, 'skipped');
    assert.equal(finalIdentityOutcome, 'skipped');
    status = 'identity_unverified';
  } else if (smokeOutcome === 'failure' || smokeOutcome === 'cancelled') {
    assert.equal(finalIdentityOutcome, 'skipped');
    status = 'route_diagnostic_failed';
  } else if (smokeOutcome === 'skipped') {
    assert.equal(finalIdentityOutcome, 'skipped');
    status = 'route_diagnostic_not_run';
  } else {
    assert.equal(smokeOutcome, 'success');
    status = finalIdentityOutcome === 'success'
      ? 'route_diagnostic_verified'
      : 'final_identity_unverified';
  }

  return {
    schemaVersion: 1,
    kind: 'vellira-staging-read-only-recovery-diagnostic',
    sourceSha,
    stagingRunId,
    stagingRunAttempt,
    diagnosticRunId,
    diagnosticRunAttempt,
    status,
    admissionOutcome,
    eligible,
    identityOutcome,
    smokeOutcome,
    finalIdentityOutcome,
    budget: {
      diagnosticWorkflowAttempt: diagnosticRunAttempt,
      allowedAutomaticWorkflowAttempts: 1,
      allowedRoutePaths: 7,
      maxRequestsPerRoute: 3,
      maxRouteRequests: MAX_ROUTE_REQUESTS,
      cloudflareWriteCallsAuthorized: 0,
    },
    originalStagingConclusion: 'failure',
    productionPromotionAuthorized: false,
    note: 'Diagnostic evidence only. A successful receipt never upgrades original FAILED staging.',
  };
}

async function main() {
  assert.equal(process.env.GITHUB_REPOSITORY, 'vellira-dev/vellira');
  const receipt = buildReadOnlyDiagnosticReceipt({
    sourceSha: process.env.SOURCE_SHA,
    stagingRunId: Number(process.env.STAGING_RUN_ID),
    stagingRunAttempt: Number(process.env.STAGING_RUN_ATTEMPT),
    diagnosticRunId: Number(process.env.GITHUB_RUN_ID),
    diagnosticRunAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
    admissionOutcome: process.env.ADMISSION_OUTCOME,
    eligible: process.env.ADMISSION_ELIGIBLE === 'true',
    identityOutcome: process.env.IDENTITY_OUTCOME,
    smokeOutcome: process.env.SMOKE_OUTCOME,
    finalIdentityOutcome: process.env.FINAL_IDENTITY_OUTCOME,
  });
  const output = 'apps/website/recovery-evidence/read-only-diagnostic.json';
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ event: 'staging-read-only-diagnostic-recorded',
    status: receipt.status, stagingRunId: receipt.stagingRunId,
    diagnosticRunId: receipt.diagnosticRunId,
    productionPromotionAuthorized: false }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

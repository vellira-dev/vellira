import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReadOnlyDiagnosticReceipt } from './cloudflare-recovery-diagnostic-receipt.mjs';

const base = {
  sourceSha: 'a'.repeat(40),
  stagingRunId: 111,
  stagingRunAttempt: 1,
  diagnosticRunId: 222,
  diagnosticRunAttempt: 1,
  admissionOutcome: 'success',
  eligible: true,
  identityOutcome: 'success',
  smokeOutcome: 'success',
  finalIdentityOutcome: 'success',
};

function receipt(override = {}) {
  return buildReadOnlyDiagnosticReceipt({ ...base, ...override });
}

test('verified route receipt never grants original staging or production acceptance', () => {
  const r = receipt();
  assert.equal(r.status, 'route_diagnostic_verified');
  assert.equal(r.originalStagingConclusion, 'failure');
  assert.equal(r.productionPromotionAuthorized, false);
  assert.equal(r.budget.maxRouteRequests, 21);
  assert.equal(r.budget.cloudflareWriteCallsAuthorized, 0);
  assert.equal(r.diagnosticRunId, 222);
});

test('eligible but failed initial identity cannot report successful diagnostic', () => {
  assert.equal(receipt({
    identityOutcome: 'failure', smokeOutcome: 'skipped',
    finalIdentityOutcome: 'skipped',
  }).status, 'identity_unverified');
});

test('failed route diagnostic retains failed outcome despite continue-on-error', () => {
  assert.equal(receipt({
    smokeOutcome: 'failure', finalIdentityOutcome: 'skipped',
  }).status, 'route_diagnostic_failed');
});

test('post-smoke changed deployment cannot claim verified route diagnostic', () => {
  assert.equal(receipt({ finalIdentityOutcome: 'failure' }).status,
    'final_identity_unverified');
});

test('noneligible and admission errors have explicit distinct receipts', () => {
  assert.equal(receipt({
    eligible: false, identityOutcome: 'skipped',
    smokeOutcome: 'skipped', finalIdentityOutcome: 'skipped',
  }).status, 'not_eligible');
  assert.equal(receipt({
    admissionOutcome: 'failure', eligible: false, identityOutcome: 'skipped',
    smokeOutcome: 'skipped', finalIdentityOutcome: 'skipped',
  }).status, 'admission_failed');
});

test('inconsistent or incomplete downstream evidence fails closed', () => {
  for (const override of [
    { sourceSha: 'bad' },
    { stagingRunId: 0 },
    { diagnosticRunAttempt: 0 },
    { eligible: false },
    { identityOutcome: 'failure' },
    { smokeOutcome: 'failure' },
    { smokeOutcome: 'unknown' },
    { admissionOutcome: 'skipped', eligible: true },
  ]) {
    assert.throws(() => receipt(override));
  }
});

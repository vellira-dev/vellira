import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateNewsletterOwnerCutover } from '../cloudflare/newsletter-owner-cutover-preflight.mjs';

const versions = (id) => [
  { id, percent: 100, coordinator: 'cooperative-v1' },
];
const candidate = () => ({
  candidateSha: 'a'.repeat(40),
  budgetEnabled: false,
  publicProEnabled: false,
  ownerWorker: 'vellira-newsletter-budget-owner',
  objectName: 'one-buttondown-account',
  namespaceIdentityVerified: true,
  oldRequestsDrained: true,
  oldVersionsRollbackDisabled: true,
  minimumDrainMs: 60000,
  snapshots: [100000, 170000].map((observedAt) => ({
    observedAt,
    environments: {
      owner: versions('11111111-1111-1111-1111-111111111111'),
      staging: versions('22222222-2222-2222-2222-222222222222'),
      production: versions('33333333-3333-3333-3333-333333333333'),
    },
  })),
});

test('cooperative and stable evidence is only an offline candidate', () => {
  assert.deepEqual(evaluateNewsletterOwnerCutover(candidate()), {
    ready: true,
    reason: 'offline_preflight_only',
  });
});

test('fail-closed if old owner code can still issue permits', () => {
  for (const value of [false, undefined, null]) {
    const input = candidate();
    input.oldRequestsDrained = value;
    assert.equal(evaluateNewsletterOwnerCutover(input).ready, false);
    const rollback = candidate();
    rollback.oldVersionsRollbackDisabled = value;
    assert.equal(evaluateNewsletterOwnerCutover(rollback).ready, false);
  }
});

test('any legacy-serving version rejects cutover even with low traffic', () => {
  const input = candidate();
  input.snapshots[0].environments.owner = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      percent: 99.9,
      coordinator: 'cooperative-v1',
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      percent: 0.1,
      coordinator: 'legacy-unfenced',
    },
  ];
  assert.deepEqual(evaluateNewsletterOwnerCutover(input), {
    ready: false,
    reason: 'serving_versions_unverified',
  });
});

test('reject missing or shifting serving-version evidence', () => {
  const missing = candidate();
  delete missing.snapshots[1].environments.production;
  assert.equal(evaluateNewsletterOwnerCutover(missing).ready, false);
  const changed = candidate();
  changed.snapshots[1].environments.owner = versions(
    '55555555-5555-5555-5555-555555555555'
  );
  assert.equal(evaluateNewsletterOwnerCutover(changed).reason, 'serving_versions_changed');
  const badSplit = candidate();
  badSplit.snapshots[0].environments.staging[0].percent = 90;
  assert.equal(evaluateNewsletterOwnerCutover(badSplit).ready, false);
});

test('reject inadequate drain window and invalid object identity', () => {
  const quick = candidate();
  quick.snapshots[1].observedAt = 100001;
  assert.equal(evaluateNewsletterOwnerCutover(quick).ready, false);
  const sameNamespaceUnverified = candidate();
  sameNamespaceUnverified.namespaceIdentityVerified = false;
  assert.equal(evaluateNewsletterOwnerCutover(sameNamespaceUnverified).ready, false);
});

test('budget and Pro activation remain forbidden during preflight', () => {
  const budget = candidate();
  budget.budgetEnabled = true;
  assert.equal(evaluateNewsletterOwnerCutover(budget).ready, false);
  const pro = candidate();
  pro.publicProEnabled = true;
  assert.equal(evaluateNewsletterOwnerCutover(pro).ready, false);
});

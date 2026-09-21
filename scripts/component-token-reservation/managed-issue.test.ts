import { describe, expect, it } from 'vitest';

import { componentExpansionCatalog } from '@vellira-ui/metadata';

import { canonicalGapIssueForRequest } from '../canonical-gap/orchestrator';
import { componentTokenReservationRequest } from '../canonical-gap/token-reservation';
import {
  canonicalGapIssueMarker,
  type CanonicalGapManagedIssue,
} from '../canonical-gap/types';
import { productionSeedForTarget } from '../component-production/production-seed';
import { reservationRequestFromManagedIssue } from './managed-issue';
import { genericReservationRequest } from './test-helpers';

function managedIssue(body?: string): CanonicalGapManagedIssue {
  const request = genericReservationRequest();
  const desired = canonicalGapIssueForRequest(request);
  return {
    number: 1262,
    state: 'open',
    url: 'https://github.com/vellira-dev/vellira/issues/1262',
    requestId: request.requestId,
    title: desired.title,
    body: body ?? desired.body,
    labels: desired.labels,
  };
}

describe('managed reservation issue authorization', () => {
  it('accepts the new machine-readable authority contract', () => {
    const issue = managedIssue();
    expect(
      reservationRequestFromManagedIssue({
        issue,
        managedIssues: [issue],
        requireOpen: true,
      })
    ).toEqual(genericReservationRequest());
  });

  it('preserves strict compatibility with the pre-authority-marker #1262 body', () => {
    const target = componentExpansionCatalog.find(
      ({ name }) => name === 'Toast'
    );
    if (!target) throw new Error('Missing #1262 expansion authority.');
    const request = componentTokenReservationRequest(
      productionSeedForTarget(target),
      'component-production:Toast',
      true
    );
    const legacy: CanonicalGapManagedIssue = {
      ...managedIssue(),
      requestId: request.requestId,
      title: 'chore(tokens): reserve Toast component token family',
      body: `${canonicalGapIssueMarker(request.requestId)}\n\n- **Kind:** \`${request.kind}\`\n- **Canonical target:** \`${request.canonicalTarget}\`\n- **Owning consumer:** \`${request.consumer}\`\n- **Request ID:** \`${request.requestId}\`\n- **Launch critical:** yes\n\n## Deterministic Component Production seed\n\n\`\`\`json\n${JSON.stringify(request.productionSeed, null, 2)}\n\`\`\``,
    };
    expect(
      reservationRequestFromManagedIssue({
        issue: legacy,
        managedIssues: [legacy],
        requireOpen: true,
      })
    ).toEqual(request);
  });

  it('rejects unmanaged, ambiguous, mismatched, and closed first-use issues', () => {
    const issue = managedIssue();
    expect(() =>
      reservationRequestFromManagedIssue({
        issue: { ...issue, labels: [] },
        managedIssues: [issue],
        requireOpen: true,
      })
    ).toThrow(/not managed/);
    expect(() =>
      reservationRequestFromManagedIssue({
        issue,
        managedIssues: [issue, { ...issue, number: 1300 }],
        requireOpen: true,
      })
    ).toThrow(/ambiguous/);
    expect(() =>
      reservationRequestFromManagedIssue({
        issue: { ...issue, requestId: `${issue.requestId}-wrong` },
        managedIssues: [issue],
        requireOpen: true,
      })
    ).toThrow(/exact managed/);
    expect(() =>
      reservationRequestFromManagedIssue({
        issue: { ...issue, state: 'closed' },
        managedIssues: [{ ...issue, state: 'closed' }],
        requireOpen: true,
      })
    ).toThrow(/must be open/);
  });
});

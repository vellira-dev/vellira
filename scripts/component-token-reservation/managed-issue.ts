import { isDeepStrictEqual } from 'node:util';

import { componentTokenReservationRequest } from '../canonical-gap/token-reservation';
import {
  CanonicalGapError,
  canonicalGapIssueMarker,
  extractCanonicalGapRequestAuthority,
  extractCanonicalGapRequestId,
  type CanonicalGapManagedIssue,
  type CanonicalGapRequestV1,
} from '../canonical-gap/types';
import { parseComponentProductionSeed } from '../component-production/production-seed';
import { validateReservationRequest } from './resolver';

export function reservationRequestFromManagedIssue(params: {
  issue: CanonicalGapManagedIssue;
  managedIssues: readonly CanonicalGapManagedIssue[];
  requireOpen: boolean;
}): CanonicalGapRequestV1 {
  const { issue, managedIssues } = params;
  const requestId = extractCanonicalGapRequestId(issue.body);
  if (!requestId || requestId !== issue.requestId) {
    throw new CanonicalGapError(
      'Reservation issue is missing its exact managed canonical-gap marker.'
    );
  }
  const marker = canonicalGapIssueMarker(requestId);
  if (issue.body.split(marker).length !== 2) {
    throw new CanonicalGapError(
      'Reservation issue contains ambiguous canonical-gap markers.'
    );
  }
  if (!issue.labels.includes('canonical-gap')) {
    throw new CanonicalGapError(
      'Reservation issue is not managed by canonical-gap authority.'
    );
  }
  if (params.requireOpen && issue.state !== 'open') {
    throw new CanonicalGapError(
      'Reservation issue must be open when first creating a reservation PR.'
    );
  }
  const duplicates = managedIssues.filter(
    (candidate) => candidate.requestId === requestId
  );
  if (duplicates.length !== 1 || duplicates[0].number !== issue.number) {
    throw new CanonicalGapError(
      `Managed reservation request "${requestId}" is missing or ambiguous.`
    );
  }

  const embedded = extractCanonicalGapRequestAuthority(issue.body);
  const request = embedded ?? legacyReservationRequest(issue.body);
  if (request.requestId !== requestId) {
    throw new CanonicalGapError(
      'Managed reservation authority does not match the issue marker.'
    );
  }
  return validateReservationRequest(request);
}

function legacyReservationRequest(body: string): CanonicalGapRequestV1 {
  const kind = exactField(body, 'Kind');
  const target = exactField(body, 'Canonical target');
  const consumer = exactField(body, 'Owning consumer');
  const requestId = exactField(body, 'Request ID');
  const launchCritical = exactField(body, 'Launch critical', false);
  if (kind !== 'component-token-reservation') {
    throw new CanonicalGapError(
      'Legacy managed issue is not a component-token reservation.'
    );
  }
  if (launchCritical !== 'yes' && launchCritical !== 'no') {
    throw new CanonicalGapError(
      'Legacy reservation issue has invalid launch-critical authority.'
    );
  }
  const seedMatches = [
    ...body.matchAll(
      /## Deterministic Component Production seed\n\n```json\n([\s\S]*?)\n```/g
    ),
  ];
  if (seedMatches.length !== 1) {
    throw new CanonicalGapError(
      'Legacy reservation issue has missing or ambiguous production seed.'
    );
  }
  let seed: ReturnType<typeof parseComponentProductionSeed>;
  try {
    seed = parseComponentProductionSeed(JSON.parse(seedMatches[0][1]));
  } catch (error) {
    throw new CanonicalGapError(
      `Legacy reservation issue has invalid production seed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  const request = componentTokenReservationRequest(
    seed,
    consumer,
    launchCritical === 'yes'
  );
  if (
    target !== seed.componentName ||
    requestId !== request.requestId ||
    !isDeepStrictEqual(request.productionSeed, seed)
  ) {
    throw new CanonicalGapError(
      'Legacy reservation issue identity is not canonical.'
    );
  }
  return request;
}

function exactField(body: string, label: string, code = true): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = code
    ? new RegExp('^- \\*\\*' + escaped + ':\\*\\* `([^`]+)`$', 'gm')
    : new RegExp(`^- \\*\\*${escaped}:\\*\\* (yes|no)$`, 'gm');
  const matches = [...body.matchAll(pattern)];
  if (matches.length !== 1) {
    throw new CanonicalGapError(
      `Legacy reservation issue field "${label}" is missing or ambiguous.`
    );
  }
  return matches[0][1];
}

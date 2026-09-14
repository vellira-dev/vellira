import { createHash } from 'node:crypto';
import path from 'node:path';

import { parseComponentProductionInput } from '../component-production/contracts';
import { componentTokenReservationRequest } from './token-reservation';
import {
  resolveMissingComponentUiFinding,
  type MissingComponentResolutionV1,
} from '../component-production/missing-component-request';
import type {
  VelliraUiUsageFinding,
  VelliraUiUsageReport,
} from '../checks/vellira-ui-usage/types';
import {
  CANONICAL_GAP_SCHEMA_VERSION,
  CanonicalGapError,
  canonicalGapIssueMarker,
  parseCanonicalGapRequest,
  type CanonicalGapBatchV1,
  type CanonicalGapIssueClient,
  type CanonicalGapIssueMutationInput,
  type CanonicalGapKind,
  type CanonicalGapLabelDefinition,
  type CanonicalGapManagedIssue,
  type CanonicalGapPlanEntry,
  type CanonicalGapRequestV1,
  type CanonicalGapResultEntry,
  type CanonicalGapRunResultV1,
} from './types';

const LABELS: Record<
  | 'base'
  | 'ready'
  | 'component'
  | 'resource'
  | 'launch-blocker'
  | 'launch-path',
  CanonicalGapLabelDefinition
> = {
  base: {
    name: 'canonical-gap',
    color: '5319e7',
    description: 'Canonical Vellira component or design-resource gap',
  },
  ready: {
    name: 'canonical-gap:ready',
    color: '0e8a16',
    description: 'Canonical gap is ready for the production conveyor',
  },
  component: {
    name: 'component-gap',
    color: '1d76db',
    description: 'Canonical Vellira component or component-capability gap',
  },
  resource: {
    name: 'design-resource-gap',
    color: 'fbca04',
    description: 'Canonical Vellira icon, token, asset, or design-resource gap',
  },
  'launch-blocker': {
    name: 'launch-blocker',
    color: 'ededed',
    description: 'Blocks the current public-launch critical path',
  },
  'launch-path': {
    name: 'launch-critical-path',
    color: 'ededed',
    description: 'Part of the current public-launch critical path',
  },
};

export function canonicalGapRequestsFromUiUsageReport(
  value: unknown,
  options: { launchCritical?: boolean } = {}
): CanonicalGapBatchV1 {
  const report = parseUiUsageReport(value);
  const requests = report.findings
    .flatMap((finding) => requestFromUiFinding(finding, options.launchCritical))
    .sort((left, right) => left.requestId.localeCompare(right.requestId));

  const byId = new Map<string, CanonicalGapRequestV1>();
  for (const request of requests) {
    const existing = byId.get(request.requestId);
    if (!existing) {
      byId.set(request.requestId, request);
      continue;
    }

    if (
      existing.kind !== request.kind ||
      existing.canonicalTarget !== request.canonicalTarget
    ) {
      throw new CanonicalGapError(
        `Canonical gap request id collision for "${request.requestId}".`
      );
    }
  }

  return {
    schemaVersion: CANONICAL_GAP_SCHEMA_VERSION,
    requests: [...byId.values()].sort((left, right) =>
      left.requestId.localeCompare(right.requestId)
    ),
  };
}

export function canonicalGapRequestFromComponentResolution(
  resolution: MissingComponentResolutionV1,
  options: { launchCritical?: boolean } = {}
): CanonicalGapRequestV1 | null {
  if (resolution.productionEligibility?.hardInvalid) {
    throw new CanonicalGapError(
      'Invalid component-token lifecycle; reservation cannot override it.'
    );
  }
  if (
    resolution.productionEligibility?.reason ===
      'component-token-reservation-required' &&
    resolution.productionSeed
  ) {
    return componentTokenReservationRequest(
      resolution.productionSeed,
      resolution.request.consumer,
      options.launchCritical
    );
  }
  if (
    resolution.kind === 'reuse-existing' ||
    resolution.kind === 'no-component-required'
  ) {
    return null;
  }

  if (!resolution.requestId || !resolution.issueRequest) {
    throw new CanonicalGapError(
      `Blocked ${resolution.kind} resolution is missing its stable issue request.`
    );
  }

  const isEnhancement = resolution.kind === 'enhance-existing';
  const requestId = isEnhancement
    ? hashRequestId(
        'component-enhancement',
        resolution.requestId,
        resolution.missingPlatforms.join(','),
        resolution.missingCapabilities.join(',')
      )
    : resolution.requestId;
  const canonicalTarget =
    resolution.canonicalComponent ?? resolution.issueRequest.componentName;
  const productionSeed = resolution.productionSeed;

  if (productionSeed) {
    parseComponentProductionInput(productionSeed);
  }

  return parseCanonicalGapRequest({
    schemaVersion: CANONICAL_GAP_SCHEMA_VERSION,
    requestId,
    kind: isEnhancement ? 'component-enhancement' : 'component',
    canonicalTarget,
    requestedIntent: resolution.request.requestedIntent,
    consumer: resolution.request.consumer,
    launchCritical: options.launchCritical ?? false,
    ...(productionSeed ? { productionSeed } : {}),
  });
}

export function canonicalGapIssueForRequest(
  request: CanonicalGapRequestV1
): CanonicalGapIssueMutationInput {
  if (request.productionSeed) {
    parseComponentProductionInput(request.productionSeed);
  }

  return {
    title: issueTitle(request),
    body: issueBody(request),
    labels: labelDefinitionsForRequest(request).map(({ name }) => name),
  };
}

export async function planCanonicalGaps(
  requests: readonly CanonicalGapRequestV1[],
  client: CanonicalGapIssueClient
): Promise<readonly CanonicalGapPlanEntry[]> {
  const managed = await client.listManagedIssues();
  const byRequestId = managedIssuesByRequestId(managed);

  return [...requests]
    .sort((left, right) => left.requestId.localeCompare(right.requestId))
    .map((request): CanonicalGapPlanEntry => {
      const desired = canonicalGapIssueForRequest(request);
      const existing = byRequestId.get(request.requestId);

      if (!existing) {
        return { request, action: 'create-issue', desired };
      }

      if (existing.state === 'open') {
        return {
          request,
          action: 'link-existing',
          issue: existing,
          desired,
        };
      }

      return {
        request,
        action: 'historical',
        issue: existing,
        desired,
      };
    });
}

export async function runCanonicalGapPlan(
  requests: readonly CanonicalGapRequestV1[],
  client: CanonicalGapIssueClient
): Promise<CanonicalGapRunResultV1> {
  if (requests.length === 0) {
    return emptyResult('plan');
  }

  const plan = await planCanonicalGaps(requests, client);
  return {
    schemaVersion: CANONICAL_GAP_SCHEMA_VERSION,
    mode: 'plan',
    status: 'ok',
    requests: requests.length,
    results: plan.map(planEntryResult),
  };
}

export async function applyCanonicalGaps(
  requests: readonly CanonicalGapRequestV1[],
  client: CanonicalGapIssueClient
): Promise<CanonicalGapRunResultV1> {
  if (requests.length === 0) {
    return emptyResult('apply');
  }

  const plan = await planCanonicalGaps(requests, client);
  const createEntries = plan.filter(({ action }) => action === 'create-issue');

  if (createEntries.length > 0) {
    const definitions = uniqueLabelDefinitions(
      createEntries.flatMap(({ request }) =>
        labelDefinitionsForRequest(request)
      )
    );
    await client.ensureLabels(definitions);
  }

  const results: CanonicalGapResultEntry[] = [];
  for (const entry of plan) {
    if (entry.action === 'create-issue') {
      const created = await client.createIssue(entry.desired);
      if (created.requestId !== entry.request.requestId) {
        throw new CanonicalGapError(
          `Created issue #${created.number} returned request id "${created.requestId}" instead of "${entry.request.requestId}".`
        );
      }
      results.push(issueResult(entry.request, 'created', created, 'applied'));
      continue;
    }

    const issue = entry.issue;
    if (!issue) {
      throw new CanonicalGapError(
        `Canonical gap ${entry.request.requestId} is missing its linked issue.`
      );
    }

    results.push(
      issueResult(
        entry.request,
        entry.action,
        issue,
        entry.action === 'historical' ? 'historical' : 'existing'
      )
    );
  }

  return {
    schemaVersion: CANONICAL_GAP_SCHEMA_VERSION,
    mode: 'apply',
    status: 'ok',
    requests: requests.length,
    results,
  };
}

function requestFromUiFinding(
  finding: VelliraUiUsageFinding,
  launchCritical = false
): CanonicalGapRequestV1[] {
  if (finding.nextAction === 'request-missing-component') {
    const resolution = resolveMissingComponentUiFinding(finding);
    const request = canonicalGapRequestFromComponentResolution(resolution, {
      launchCritical,
    });
    return request ? [requestWithSource(request, finding)] : [];
  }

  if (finding.nextAction !== 'request-missing-resource') {
    return [];
  }

  if (finding.ruleId === 'vellira-ui.missing-token-resource') {
    return [
      resourceRequest({
        kind: 'token',
        canonicalTarget: finding.detected,
        requestedIntent: `canonical token ${finding.detected}`,
        finding,
        launchCritical,
        dedupeParts: ['token', finding.detected],
      }),
    ];
  }

  if (finding.ruleId === 'vellira-ui.noncanonical-token-value') {
    return [
      resourceRequest({
        kind: 'token',
        canonicalTarget: finding.detected,
        requestedIntent: `resolve a canonical semantic token for visual value ${finding.detected}`,
        finding,
        launchCritical,
        dedupeParts: ['token-value', finding.detected],
      }),
    ];
  }

  if (finding.ruleId === 'vellira-ui.noncanonical-icon') {
    return [
      resourceRequest({
        kind: 'icon',
        canonicalTarget: `icon-for-${path.basename(finding.path)}`,
        requestedIntent: `resolve the canonical icon required by ${finding.path}:${finding.line}`,
        finding,
        launchCritical,
        dedupeParts: [
          'icon',
          finding.path,
          String(finding.line),
          finding.detected,
        ],
      }),
    ];
  }

  throw new CanonicalGapError(
    `Unsupported missing-resource finding rule "${finding.ruleId}".`
  );
}

function resourceRequest(params: {
  kind: Extract<CanonicalGapKind, 'icon' | 'token' | 'design-resource'>;
  canonicalTarget: string;
  requestedIntent: string;
  finding: VelliraUiUsageFinding;
  launchCritical: boolean;
  dedupeParts: readonly string[];
}): CanonicalGapRequestV1 {
  return parseCanonicalGapRequest({
    schemaVersion: CANONICAL_GAP_SCHEMA_VERSION,
    requestId: hashRequestId(...params.dedupeParts),
    kind: params.kind,
    canonicalTarget: params.canonicalTarget,
    requestedIntent: params.requestedIntent,
    consumer: params.finding.path,
    launchCritical: params.launchCritical,
    source: sourceFromFinding(params.finding),
  });
}

function requestWithSource(
  request: CanonicalGapRequestV1,
  finding: VelliraUiUsageFinding
): CanonicalGapRequestV1 {
  return parseCanonicalGapRequest({
    ...request,
    source: sourceFromFinding(finding),
  });
}

function sourceFromFinding(finding: VelliraUiUsageFinding) {
  return {
    ruleId: finding.ruleId,
    path: finding.path,
    line: finding.line,
    column: finding.column,
    detected: finding.detected,
  };
}

function parseUiUsageReport(value: unknown): VelliraUiUsageReport {
  if (
    !isRecord(value) ||
    value.schemaVersion !== '1' ||
    !Array.isArray(value.findings)
  ) {
    throw new CanonicalGapError('Invalid Vellira UI usage report.');
  }

  const findings = value.findings.map(parseUiUsageFinding);
  return {
    schemaVersion: '1',
    mode: value.mode === 'blocking' ? 'blocking' : 'audit',
    findings,
    exceptions: [],
    summary: {
      filesScanned: 0,
      findings: findings.length,
      blockingFindings: findings.filter(({ blocking }) => blocking).length,
      exceptionsApplied: 0,
    },
  };
}

function parseUiUsageFinding(value: unknown): VelliraUiUsageFinding {
  if (!isRecord(value)) {
    throw new CanonicalGapError('Invalid Vellira UI usage finding.');
  }

  const required = ['ruleId', 'path', 'detected', 'nextAction', 'message'];
  for (const field of required) {
    if (typeof value[field] !== 'string' || String(value[field]).length === 0) {
      throw new CanonicalGapError(
        `Invalid Vellira UI usage finding field "${field}".`
      );
    }
  }

  if (!Number.isInteger(value.line) || Number(value.line) < 1) {
    throw new CanonicalGapError('Invalid Vellira UI usage finding line.');
  }
  if (!Number.isInteger(value.column) || Number(value.column) < 1) {
    throw new CanonicalGapError('Invalid Vellira UI usage finding column.');
  }

  return value as unknown as VelliraUiUsageFinding;
}

function issueTitle(request: CanonicalGapRequestV1): string {
  if (request.kind === 'component-token-reservation') {
    return `chore(tokens): reserve ${request.canonicalTarget} component token family`;
  }
  if (request.kind === 'component') {
    return `feat(components): add ${request.canonicalTarget}`;
  }
  if (request.kind === 'component-enhancement') {
    return `feat(components): extend ${request.canonicalTarget}`;
  }
  if (request.kind === 'icon') {
    return `feat(icons): resolve canonical icon for ${shortConsumer(request.consumer)}`;
  }
  if (request.kind === 'token') {
    return `feat(tokens): resolve canonical token ${request.canonicalTarget}`;
  }
  return `feat(design): add canonical resource ${request.canonicalTarget}`;
}

function issueBody(request: CanonicalGapRequestV1): string {
  const lines = [
    canonicalGapIssueMarker(request.requestId),
    '',
    '## Canonical gap',
    '',
    `- **Kind:** ${inlineCode(request.kind)}`,
    `- **Canonical target:** ${inlineCode(request.canonicalTarget)}`,
    `- **Owning consumer:** ${inlineCode(request.consumer)}`,
    `- **Request ID:** ${inlineCode(request.requestId)}`,
    `- **Launch critical:** ${request.launchCritical ? 'yes' : 'no'}`,
    '',
    '## Required intent',
    '',
    escapeMarkdown(request.requestedIntent),
  ];

  if (request.source) {
    lines.push(
      '',
      '## Detection evidence',
      '',
      `- ${inlineCode(request.source.ruleId)}`,
      `- ${inlineCode(`${request.source.path}:${request.source.line}:${request.source.column}`)}`,
      `- Detected: ${inlineCode(request.source.detected)}`
    );
  }

  if (request.productionSeed) {
    lines.push(
      '',
      '## Deterministic Component Production seed',
      '',
      '```json',
      JSON.stringify(request.productionSeed, null, 2),
      '```',
      '',
      'This seed preserves production intent, not execution permission. Token-lifecycle eligibility must pass before scaffold/plumbing; normal reviewed completion is still required.'
    );
  }

  lines.push(
    '',
    '## Safety boundary',
    '',
    'The originating consumer remains blocked until this component/resource exists canonically and passes its normal Vellira production and validation gates. This issue does not authorize a local substitute.'
  );

  return `${lines.join('\n')}\n`;
}

function labelDefinitionsForRequest(
  request: CanonicalGapRequestV1
): CanonicalGapLabelDefinition[] {
  const labels = [
    LABELS.base,
    ...(request.kind === 'component-token-reservation' ? [] : [LABELS.ready]),
    request.kind === 'component' || request.kind === 'component-enhancement'
      ? LABELS.component
      : LABELS.resource,
  ];

  if (request.launchCritical) {
    labels.push(LABELS['launch-blocker'], LABELS['launch-path']);
  }

  return labels;
}

function managedIssuesByRequestId(
  issues: readonly CanonicalGapManagedIssue[]
): Map<string, CanonicalGapManagedIssue> {
  const result = new Map<string, CanonicalGapManagedIssue>();
  for (const issue of issues) {
    const existing = result.get(issue.requestId);
    if (existing) {
      throw new CanonicalGapError(
        `Multiple managed issues exist for canonical gap "${issue.requestId}": #${existing.number} and #${issue.number}.`
      );
    }
    result.set(issue.requestId, issue);
  }
  return result;
}

function uniqueLabelDefinitions(
  labels: readonly CanonicalGapLabelDefinition[]
): CanonicalGapLabelDefinition[] {
  const result = new Map<string, CanonicalGapLabelDefinition>();
  for (const label of labels) result.set(label.name, label);
  return [...result.values()].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

function planEntryResult(
  entry: CanonicalGapPlanEntry
): CanonicalGapResultEntry {
  if (entry.issue) {
    return issueResult(
      entry.request,
      entry.action === 'historical' ? 'historical' : 'linked-existing',
      entry.issue,
      entry.action === 'historical' ? 'historical' : 'existing'
    );
  }

  return {
    requestId: entry.request.requestId,
    kind: entry.request.kind,
    action: 'planned-create',
    issue: null,
    routing: {
      labels: entry.desired.labels,
      status: 'planned',
    },
  };
}

function issueResult(
  request: CanonicalGapRequestV1,
  action: CanonicalGapResultEntry['action'] | CanonicalGapPlanEntry['action'],
  issue: CanonicalGapManagedIssue,
  status: CanonicalGapResultEntry['routing']['status']
): CanonicalGapResultEntry {
  const normalizedAction =
    action === 'link-existing' || action === 'linked-existing'
      ? 'linked-existing'
      : action === 'historical'
        ? 'historical'
        : 'created';
  return {
    requestId: request.requestId,
    kind: request.kind,
    action: normalizedAction,
    issue: {
      number: issue.number,
      state: issue.state,
      url: issue.url,
    },
    routing: {
      labels: issue.labels,
      status,
    },
  };
}

function emptyResult(mode: 'plan' | 'apply'): CanonicalGapRunResultV1 {
  return {
    schemaVersion: CANONICAL_GAP_SCHEMA_VERSION,
    mode,
    status: 'no-work',
    requests: 0,
    results: [],
  };
}

function hashRequestId(...parts: readonly string[]): string {
  const digest = createHash('sha256')
    .update(
      `vellira-canonical-gap-v1:${parts.map(normalizeIdentityPart).join(':')}`
    )
    .digest('hex')
    .slice(0, 20);
  return `canonical-gap-${digest}`;
}

function normalizeIdentityPart(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

function shortConsumer(consumer: string): string {
  return path.basename(consumer) || consumer;
}

function inlineCode(value: string): string {
  const escaped = escapeMarkdown(value)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`');
  return `\`${escaped}\``;
}

function escapeMarkdown(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

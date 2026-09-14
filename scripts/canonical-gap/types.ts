import type { ComponentProductionSeedV1 } from '../component-production/missing-component-request';

export const CANONICAL_GAP_SCHEMA_VERSION = '1' as const;
export const CANONICAL_GAP_MARKER_PREFIX = 'vellira-canonical-gap:v1:';
export const CANONICAL_GAP_KINDS = [
  'component',
  'component-enhancement',
  'icon',
  'token',
  'design-resource',
] as const;

export type CanonicalGapKind = (typeof CANONICAL_GAP_KINDS)[number];
export type CanonicalGapSourceEvidenceV1 = {
  ruleId: string;
  path: string;
  line: number;
  column: number;
  detected: string;
};
export type CanonicalGapRequestV1 = {
  schemaVersion: '1';
  requestId: string;
  kind: CanonicalGapKind;
  canonicalTarget: string;
  requestedIntent: string;
  consumer: string;
  launchCritical: boolean;
  source?: CanonicalGapSourceEvidenceV1;
  productionSeed?: ComponentProductionSeedV1;
};
export type CanonicalGapBatchV1 = {
  schemaVersion: '1';
  requests: readonly CanonicalGapRequestV1[];
};
export type CanonicalGapManagedIssue = {
  number: number;
  state: 'open' | 'closed';
  url: string;
  requestId: string;
  title: string;
  body: string;
  labels: readonly string[];
};
export type CanonicalGapIssueMutationInput = {
  title: string;
  body: string;
  labels: readonly string[];
};
export type CanonicalGapLabelDefinition = {
  name: string;
  color: string;
  description: string;
};
export type CanonicalGapPlanAction =
  'create-issue' | 'link-existing' | 'historical';
export type CanonicalGapPlanEntry = {
  request: CanonicalGapRequestV1;
  action: CanonicalGapPlanAction;
  issue?: CanonicalGapManagedIssue;
  desired: CanonicalGapIssueMutationInput;
};
export type CanonicalGapResultEntry = {
  requestId: string;
  kind: CanonicalGapKind;
  action: 'planned-create' | 'created' | 'linked-existing' | 'historical';
  issue: {
    number: number;
    state: 'open' | 'closed';
    url: string;
  } | null;
  routing: {
    labels: readonly string[];
    status: 'planned' | 'applied' | 'existing' | 'historical';
  };
};
export type CanonicalGapRunResultV1 = {
  schemaVersion: '1';
  mode: 'plan' | 'apply';
  status: 'ok' | 'no-work';
  requests: number;
  results: readonly CanonicalGapResultEntry[];
};
export interface CanonicalGapIssueClient {
  listManagedIssues(): Promise<readonly CanonicalGapManagedIssue[]>;
  ensureLabels(labels: readonly CanonicalGapLabelDefinition[]): Promise<void>;
  createIssue(
    input: CanonicalGapIssueMutationInput
  ): Promise<CanonicalGapManagedIssue>;
}
export class CanonicalGapError extends Error {
  override name = 'CanonicalGapError';
}

const REQUEST_KEYS = new Set([
  'schemaVersion',
  'requestId',
  'kind',
  'canonicalTarget',
  'requestedIntent',
  'consumer',
  'launchCritical',
  'source',
  'productionSeed',
]);
const SOURCE_KEYS = new Set(['ruleId', 'path', 'line', 'column', 'detected']);
const REQUEST_ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/;

export function canonicalGapIssueMarker(requestId: string): string {
  if (!REQUEST_ID.test(requestId)) {
    throw new CanonicalGapError(
      `Invalid canonical gap request id "${requestId}".`
    );
  }
  return `<!-- ${CANONICAL_GAP_MARKER_PREFIX}${requestId} -->`;
}

export function extractCanonicalGapRequestId(body: string): string | null {
  const escapedPrefix = CANONICAL_GAP_MARKER_PREFIX.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
  return (
    body.match(
      new RegExp(`<!--\\s*${escapedPrefix}([a-z0-9][a-z0-9._:-]{0,159})\\s*-->`)
    )?.[1] ?? null
  );
}

export function parseCanonicalGapBatch(value: unknown): CanonicalGapBatchV1 {
  if (isRecord(value) && Array.isArray(value.requests)) {
    for (const key of Object.keys(value)) {
      if (key !== 'schemaVersion' && key !== 'requests') {
        throw new CanonicalGapError(
          `Unknown canonical gap batch field "${key}".`
        );
      }
    }
    if (value.schemaVersion !== CANONICAL_GAP_SCHEMA_VERSION) {
      throw new CanonicalGapError(
        `Unsupported canonical gap batch schema version "${String(value.schemaVersion)}".`
      );
    }
    const requests = value.requests.map(parseCanonicalGapRequest);
    const seen = new Set<string>();
    for (const request of requests) {
      if (seen.has(request.requestId)) {
        throw new CanonicalGapError(
          `Canonical gap batch contains duplicate request id "${request.requestId}".`
        );
      }
      seen.add(request.requestId);
    }
    return {
      schemaVersion: CANONICAL_GAP_SCHEMA_VERSION,
      requests: sortRequests(requests),
    };
  }
  return {
    schemaVersion: CANONICAL_GAP_SCHEMA_VERSION,
    requests: [parseCanonicalGapRequest(value)],
  };
}

export function parseCanonicalGapRequest(
  value: unknown
): CanonicalGapRequestV1 {
  if (!isRecord(value)) {
    throw new CanonicalGapError('Canonical gap request must be an object.');
  }
  for (const key of Object.keys(value)) {
    if (!REQUEST_KEYS.has(key)) {
      throw new CanonicalGapError(
        `Unknown canonical gap request field "${key}".`
      );
    }
  }
  if (value.schemaVersion !== CANONICAL_GAP_SCHEMA_VERSION) {
    throw new CanonicalGapError(
      `Unsupported canonical gap schema version "${String(value.schemaVersion)}".`
    );
  }
  const requestId = requiredString(value, 'requestId', 160);
  if (!REQUEST_ID.test(requestId)) {
    throw new CanonicalGapError(
      `Invalid canonical gap request id "${requestId}".`
    );
  }
  const kind = requiredString(value, 'kind', 64);
  if (!CANONICAL_GAP_KINDS.includes(kind as CanonicalGapKind)) {
    throw new CanonicalGapError(`Unsupported canonical gap kind "${kind}".`);
  }
  const source =
    value.source === undefined ? undefined : parseSource(value.source);
  return {
    schemaVersion: CANONICAL_GAP_SCHEMA_VERSION,
    requestId,
    kind: kind as CanonicalGapKind,
    canonicalTarget: requiredString(value, 'canonicalTarget', 160),
    requestedIntent: requiredString(value, 'requestedIntent', 500),
    consumer: requiredString(value, 'consumer', 500),
    launchCritical: requiredBoolean(value, 'launchCritical'),
    ...(source ? { source } : {}),
    ...(value.productionSeed !== undefined
      ? { productionSeed: value.productionSeed as ComponentProductionSeedV1 }
      : {}),
  };
}

function parseSource(value: unknown): CanonicalGapSourceEvidenceV1 {
  if (!isRecord(value)) {
    throw new CanonicalGapError(
      'Canonical gap source evidence must be an object.'
    );
  }
  for (const key of Object.keys(value)) {
    if (!SOURCE_KEYS.has(key)) {
      throw new CanonicalGapError(
        `Unknown canonical gap source field "${key}".`
      );
    }
  }
  return {
    ruleId: requiredString(value, 'ruleId', 160),
    path: requiredString(value, 'path', 500),
    line: requiredPositiveInteger(value, 'line'),
    column: requiredPositiveInteger(value, 'column'),
    detected: requiredString(value, 'detected', 500),
  };
}

function sortRequests(requests: readonly CanonicalGapRequestV1[]) {
  return [...requests].sort((left, right) =>
    left.requestId.localeCompare(right.requestId)
  );
}

function requiredString(
  value: Record<string, unknown>,
  field: string,
  maxLength: number
): string {
  const raw = value[field];
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new CanonicalGapError(`Canonical gap field "${field}" is required.`);
  }
  const normalized = raw.trim();
  if (
    normalized.length > maxLength ||
    [...normalized].some((character) => {
      const code = character.charCodeAt(0);
      return code < 0x20 || code === 0x7f;
    })
  ) {
    throw new CanonicalGapError(`Canonical gap field "${field}" is invalid.`);
  }
  return normalized;
}

function requiredBoolean(
  value: Record<string, unknown>,
  field: string
): boolean {
  const raw = value[field];
  if (typeof raw !== 'boolean') {
    throw new CanonicalGapError(
      `Canonical gap field "${field}" must be boolean.`
    );
  }
  return raw;
}

function requiredPositiveInteger(
  value: Record<string, unknown>,
  field: string
): number {
  const raw = value[field];
  if (!Number.isInteger(raw) || Number(raw) < 1) {
    throw new CanonicalGapError(
      `Canonical gap field "${field}" must be a positive integer.`
    );
  }
  return Number(raw);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import {
  COMPONENT_PRODUCTION_STAGE_IDS,
  createComponentProductionResult,
  parseComponentProductionInput,
  type ComponentProductionFinding,
  type ComponentProductionStageResult,
} from '../component-production/contracts';

import {
  CANONICAL_GAP_SCHEMA_VERSION,
  CanonicalGapError,
  parseCanonicalGapRequest,
  type CanonicalGapBatchV1,
  type CanonicalGapKind,
  type CanonicalGapRequestV1,
} from './types';

export function canonicalGapRequestsFromComponentProductionReport(
  value: unknown,
  options: { launchCritical?: boolean } = {}
): CanonicalGapBatchV1 {
  const report = parseProductionReport(value);
  const componentName = report.input.componentName;
  const requests = report.blockingFindings.flatMap((finding) =>
    requestFromProductionFinding(
      finding,
      componentName,
      options.launchCritical ?? false
    )
  );
  const byId = new Map<string, CanonicalGapRequestV1>();
  for (const request of requests) byId.set(request.requestId, request);

  return {
    schemaVersion: CANONICAL_GAP_SCHEMA_VERSION,
    requests: [...byId.values()].sort((left, right) =>
      left.requestId.localeCompare(right.requestId)
    ),
  };
}

function parseProductionReport(value: unknown) {
  if (
    !isRecord(value) ||
    value.schemaVersion !== '1' ||
    !Array.isArray(value.stages) ||
    !(value.completeness === null || Array.isArray(value.completeness)) ||
    !(value.quality === null || isRecord(value.quality))
  ) {
    throw new CanonicalGapError('Invalid Component Production V1 result.');
  }

  // The existing production contract owns input validation, stage order and
  // derived state. Reconstruct those fields rather than copying Generator V2
  // rules or trusting a detached blockingFindings array supplied by a caller.
  const result = createComponentProductionResult({
    input: parseComponentProductionInput(value.input),
    stages: value.stages.map(parseProductionStage),
    completeness: null,
    quality: null,
  });
  for (const field of [
    'status',
    'readyForReview',
    'lifecycle',
    'blockingFindings',
    'artifacts',
    'outputs',
    'validationSummary',
  ] as const) {
    if (!isDeepStrictEqual(value[field], result[field])) {
      throw new CanonicalGapError(
        `Invalid Component Production result field "${field}".`
      );
    }
  }
  return result;
}

function parseProductionStage(value: unknown): ComponentProductionStageResult {
  if (
    !isRecord(value) ||
    !isStageId(value.id) ||
    typeof value.status !== 'string' ||
    !['passed', 'blocked', 'failed', 'skipped'].includes(value.status) ||
    typeof value.summary !== 'string' ||
    !Array.isArray(value.findings) ||
    !Array.isArray(value.artifacts) ||
    !value.artifacts.every((artifact) => typeof artifact === 'string')
  ) {
    throw new CanonicalGapError('Invalid Component Production stage.');
  }
  return {
    id: value.id,
    status: value.status as ComponentProductionStageResult['status'],
    summary: value.summary,
    findings: value.findings.map(parseProductionFinding),
    artifacts: value.artifacts,
  };
}

function parseProductionFinding(value: unknown): ComponentProductionFinding {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !value.id ||
    !isStageId(value.stage) ||
    (value.severity !== 'blocking' && value.severity !== 'warning') ||
    typeof value.message !== 'string' ||
    !value.message ||
    (value.path !== undefined && typeof value.path !== 'string') ||
    (value.ruleId !== undefined && typeof value.ruleId !== 'string') ||
    (value.platform !== undefined &&
      value.platform !== 'react' &&
      value.platform !== 'react-native')
  ) {
    throw new CanonicalGapError('Invalid Component Production finding.');
  }
  return {
    id: value.id,
    stage: value.stage,
    severity: value.severity,
    message: value.message,
    ...(value.path !== undefined ? { path: value.path } : {}),
    ...(value.ruleId !== undefined ? { ruleId: value.ruleId } : {}),
    ...(value.platform !== undefined ? { platform: value.platform } : {}),
  };
}

function isStageId(
  value: unknown
): value is ComponentProductionStageResult['id'] {
  return COMPONENT_PRODUCTION_STAGE_IDS.some((id) => id === value);
}

function requestFromProductionFinding(
  value: ComponentProductionFinding,
  componentName: string,
  launchCritical: boolean
): CanonicalGapRequestV1[] {
  const message = value.message;

  if (message.startsWith('missing-icon-resource:')) {
    const fields = quotedFields(message);
    const name = fields.get('name');
    const purpose = fields.get('purpose');
    const platform = fields.get('platform');
    if (!name || !purpose || !isResourcePlatform(platform)) {
      throw new CanonicalGapError(
        `Malformed missing-icon-resource finding: ${message}`
      );
    }
    return [
      resourceRequest({
        kind: 'icon',
        target: name,
        intent: `${purpose} for ${componentName} on ${platform}`,
        componentName,
        launchCritical,
        identity: ['icon', name, purpose, platform],
      }),
    ];
  }

  if (message.startsWith('missing-design-token:')) {
    const fields = quotedFields(message);
    const token = fields.get('path');
    const part = fields.get('part');
    const platform = fields.get('platform');
    if (!token || !part || !isResourcePlatform(platform)) {
      throw new CanonicalGapError(
        `Malformed missing-design-token finding: ${message}`
      );
    }
    return [
      resourceRequest({
        kind: 'token',
        target: token,
        intent: `canonical token for ${componentName}/${part} on ${platform}`,
        componentName,
        launchCritical,
        identity: ['token', token],
      }),
    ];
  }

  if (message.startsWith('missing-design-asset:')) {
    const fields = quotedFields(message);
    const assetPath = fields.get('path');
    const purpose = fields.get('purpose');
    if (!assetPath || !purpose) {
      throw new CanonicalGapError(
        `Malformed missing-design-asset finding: ${message}`
      );
    }
    return [
      resourceRequest({
        kind: 'design-resource',
        target: assetPath,
        intent: `${purpose} for ${componentName}`,
        componentName,
        launchCritical,
        identity: ['asset', assetPath],
      }),
    ];
  }

  if (message.startsWith('missing-icon-resource-registry:')) {
    const fields = quotedFields(message);
    const platform = fields.get('platform');
    if (
      !isResourcePlatform(platform) ||
      !fields.get('component') ||
      !fields.get('registry')
    ) {
      throw new CanonicalGapError(
        `Malformed missing-icon-resource-registry finding: ${message}`
      );
    }
    return [
      resourceRequest({
        kind: 'design-resource',
        target: `@vellira-ui/icons:${platform}`,
        intent: `restore the canonical icon registry for ${platform}`,
        componentName,
        launchCritical,
        identity: ['icon-registry', platform],
      }),
    ];
  }

  if (message.startsWith('missing-design-token-registry:')) {
    const fields = quotedFields(message);
    if (!fields.get('component') || !fields.get('registry')) {
      throw new CanonicalGapError(
        `Malformed missing-design-token-registry finding: ${message}`
      );
    }
    return [
      resourceRequest({
        kind: 'design-resource',
        target: '@vellira-ui/tokens:registry',
        intent: 'restore the canonical token registry',
        componentName,
        launchCritical,
        identity: ['token-registry'],
      }),
    ];
  }

  return [];
}

function isResourcePlatform(value: unknown): value is 'react' | 'react-native' {
  return value === 'react' || value === 'react-native';
}

function resourceRequest(params: {
  kind: Extract<CanonicalGapKind, 'icon' | 'token' | 'design-resource'>;
  target: string;
  intent: string;
  componentName: string;
  launchCritical: boolean;
  identity: readonly string[];
}) {
  return parseCanonicalGapRequest({
    schemaVersion: CANONICAL_GAP_SCHEMA_VERSION,
    requestId: requestId(...params.identity),
    kind: params.kind,
    canonicalTarget: params.target,
    requestedIntent: params.intent,
    consumer: `component-production:${params.componentName}`,
    launchCritical: params.launchCritical,
  });
}

function requestId(...parts: readonly string[]): string {
  const digest = createHash('sha256')
    .update(
      `vellira-canonical-gap-v1:${parts
        .map((part) => part.trim().toLocaleLowerCase('en-US'))
        .join(':')}`
    )
    .digest('hex')
    .slice(0, 20);
  return `canonical-gap-${digest}`;
}

function quotedFields(message: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of message.matchAll(/([A-Za-z][A-Za-z0-9_-]*)="([^"]*)"/g)) {
    if (result.has(match[1])) {
      throw new CanonicalGapError(
        `Duplicate Component Production resource field "${match[1]}".`
      );
    }
    result.set(match[1], match[2]);
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

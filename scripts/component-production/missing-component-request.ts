import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  componentCapabilities,
  componentExpansionCatalog,
  componentMetadata,
  type ComponentCapability,
  type ComponentExpansionTarget,
  type ComponentMetadata,
  type ComponentPlatform,
} from '@vellira-ui/metadata';

import type { VelliraUiUsageFinding } from '../checks/vellira-ui-usage/types';
import {
  COMPONENT_PRODUCTION_SCHEMA_VERSION,
  type ComponentProductionInputV1,
} from './contracts';

export const MISSING_COMPONENT_REQUEST_SCHEMA_VERSION = '1' as const;

const PLATFORM_ORDER = ['react', 'react-native'] as const;
const REQUEST_KEYS = new Set([
  'schemaVersion',
  'requestedComponent',
  'requestedIntent',
  'consumer',
  'platforms',
  'reusable',
  'requiredCapabilities',
]);

const UI_FINDING_REQUESTS = {
  textarea: {
    requestedComponent: 'Textarea',
    requestedIntent: 'multiline text entry',
  },
} as const;

export type MissingComponentRequestV1 = {
  schemaVersion: typeof MISSING_COMPONENT_REQUEST_SCHEMA_VERSION;
  requestedComponent?: string;
  requestedIntent: string;
  consumer: string;
  platforms: readonly ComponentPlatform[];
  reusable: boolean;
  requiredCapabilities: readonly ComponentCapability[];
};

export type ComponentProductionSeedV1 = Pick<
  ComponentProductionInputV1,
  | 'schemaVersion'
  | 'componentName'
  | 'platform'
  | 'layer'
  | 'category'
  | 'profile'
>;

export type MissingComponentResolutionKind =
  | 'reuse-existing'
  | 'enhance-existing'
  | 'missing-component'
  | 'no-component-required';

export type MissingComponentResolutionNextAction =
  | 'none'
  | 'reuse-existing'
  | 'link-or-create-component-enhancement-issue'
  | 'link-or-create-component-issue';

export type MissingComponentIssueRequestV1 = {
  requestId: string;
  kind: 'new-component' | 'enhancement';
  componentName: string;
  title: string;
};

export type MissingComponentResolutionV1 = {
  schemaVersion: typeof MISSING_COMPONENT_REQUEST_SCHEMA_VERSION;
  kind: MissingComponentResolutionKind;
  blocked: boolean;
  nextAction: MissingComponentResolutionNextAction;
  request: MissingComponentRequestV1;
  existingCandidates: readonly string[];
  canonicalComponent?: string;
  missingPlatforms: readonly ComponentPlatform[];
  missingCapabilities: readonly ComponentCapability[];
  requestId?: string;
  issueRequest?: MissingComponentIssueRequestV1;
  productionSeed?: ComponentProductionSeedV1;
};

export type MissingComponentAuthorities = {
  components: readonly ComponentMetadata[];
  targets: readonly ComponentExpansionTarget[];
};

export type MissingComponentRequestCliDependencies = {
  root?: string;
  readFile?: (filePath: string) => string;
  resolve?: (value: unknown) => MissingComponentResolutionV1;
  write?: (message: string) => void;
  writeError?: (message: string) => void;
};

const DEFAULT_AUTHORITIES: MissingComponentAuthorities = {
  components: componentMetadata,
  targets: componentExpansionCatalog,
};

export function parseMissingComponentRequest(
  value: unknown
): MissingComponentRequestV1 {
  if (!isRecord(value)) {
    throw new Error('Missing-component request must be an object.');
  }

  for (const key of Object.keys(value)) {
    if (!REQUEST_KEYS.has(key)) {
      throw new Error(`Unknown missing-component request field "${key}".`);
    }
  }

  if (value.schemaVersion !== MISSING_COMPONENT_REQUEST_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported missing-component request schema version "${String(
        value.schemaVersion
      )}". Expected "${MISSING_COMPONENT_REQUEST_SCHEMA_VERSION}".`
    );
  }

  const requestedIntent = requiredString(value, 'requestedIntent');
  const consumer = requiredString(value, 'consumer');
  const reusable = requiredBoolean(value, 'reusable');
  const requestedComponent = optionalString(value, 'requestedComponent');
  const platforms = requiredPlatforms(value, 'platforms');
  const requiredCapabilities = optionalCapabilities(
    value,
    'requiredCapabilities'
  );

  if (reusable && !requestedComponent) {
    throw new Error(
      'Reusable missing-component requests require "requestedComponent".'
    );
  }

  if (!reusable && requestedComponent) {
    throw new Error(
      'Non-reusable layout/composition requests must not declare "requestedComponent".'
    );
  }

  return {
    schemaVersion: MISSING_COMPONENT_REQUEST_SCHEMA_VERSION,
    ...(requestedComponent ? { requestedComponent } : {}),
    requestedIntent,
    consumer,
    platforms,
    reusable,
    requiredCapabilities,
  };
}

export function resolveMissingComponentRequest(
  value: unknown,
  authorities: MissingComponentAuthorities = DEFAULT_AUTHORITIES
): MissingComponentResolutionV1 {
  const request = parseMissingComponentRequest(value);

  if (!request.reusable) {
    return baseResolution({
      request,
      kind: 'no-component-required',
      blocked: false,
      nextAction: 'none',
    });
  }

  const requestedComponent = request.requestedComponent!;
  const target = findByName(authorities.targets, requestedComponent);
  const candidates = canonicalCandidates(
    authorities.components,
    requestedComponent,
    target
  );
  const canonical = candidates[0];

  if (canonical) {
    const missingPlatforms = request.platforms.filter(
      (platform) => !canonical.platforms.includes(platform)
    );
    const capabilitySet = new Set(canonical.capabilities ?? []);
    const missingCapabilities = request.requiredCapabilities.filter(
      (capability) => !capabilitySet.has(capability)
    );

    if (missingPlatforms.length === 0 && missingCapabilities.length === 0) {
      return {
        ...baseResolution({
          request,
          kind: 'reuse-existing',
          blocked: false,
          nextAction: 'reuse-existing',
          existingCandidates: candidates.map((component) => component.name),
        }),
        canonicalComponent: canonical.name,
      };
    }

    const requestId = componentGapRequestId(canonical.name);
    return {
      ...baseResolution({
        request,
        kind: 'enhance-existing',
        blocked: true,
        nextAction: 'link-or-create-component-enhancement-issue',
        existingCandidates: candidates.map((component) => component.name),
        missingPlatforms,
        missingCapabilities,
      }),
      canonicalComponent: canonical.name,
      requestId,
      issueRequest: {
        requestId,
        kind: 'enhancement',
        componentName: canonical.name,
        title: `feat(components): extend ${canonical.name}`,
      },
    };
  }

  const requestId = componentGapRequestId(requestedComponent);
  return {
    ...baseResolution({
      request,
      kind: 'missing-component',
      blocked: true,
      nextAction: 'link-or-create-component-issue',
    }),
    requestId,
    issueRequest: {
      requestId,
      kind: 'new-component',
      componentName: target?.name ?? requestedComponent,
      title: `feat(components): add ${target?.name ?? requestedComponent}`,
    },
    ...(target ? { productionSeed: productionSeedForTarget(target) } : {}),
  };
}

export function missingComponentRequestFromUiFinding(
  finding: VelliraUiUsageFinding
): MissingComponentRequestV1 {
  if (
    finding.ruleId !== 'vellira-ui.missing-component' ||
    finding.nextAction !== 'request-missing-component'
  ) {
    throw new Error(
      `Vellira UI usage finding "${finding.ruleId}" is not a missing-component request.`
    );
  }

  const mapped =
    UI_FINDING_REQUESTS[finding.detected as keyof typeof UI_FINDING_REQUESTS];

  if (!mapped) {
    throw new Error(
      `No deterministic missing-component mapping exists for detected UI "${finding.detected}".`
    );
  }

  return {
    schemaVersion: MISSING_COMPONENT_REQUEST_SCHEMA_VERSION,
    requestedComponent: mapped.requestedComponent,
    requestedIntent: mapped.requestedIntent,
    consumer: finding.path,
    platforms: [platformForConsumer(finding.path)],
    reusable: true,
    requiredCapabilities: [],
  };
}

export function resolveMissingComponentUiFinding(
  finding: VelliraUiUsageFinding,
  authorities: MissingComponentAuthorities = DEFAULT_AUTHORITIES
): MissingComponentResolutionV1 {
  return resolveMissingComponentRequest(
    missingComponentRequestFromUiFinding(finding),
    authorities
  );
}

export async function runMissingComponentRequestCli(
  args: readonly string[],
  dependencies: MissingComponentRequestCliDependencies = {}
): Promise<number> {
  const write = dependencies.write ?? console.log;
  const writeError = dependencies.writeError ?? console.error;

  try {
    const specFile = parseCliArgs(args);
    const root = path.resolve(dependencies.root ?? process.cwd());
    const readFile =
      dependencies.readFile ??
      ((filePath: string) => fs.readFileSync(filePath, 'utf8'));
    const resolve = dependencies.resolve ?? resolveMissingComponentRequest;
    const specPath = path.resolve(root, specFile);

    let rawInput: unknown;
    try {
      rawInput = JSON.parse(readFile(specPath));
    } catch (error) {
      throw new Error(
        `Unable to read missing-component request "${specFile}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const result = resolve(rawInput);
    write(JSON.stringify(result, null, 2));
    return result.blocked ? 1 : 0;
  } catch (error) {
    writeError(
      JSON.stringify(
        {
          schemaVersion: MISSING_COMPONENT_REQUEST_SCHEMA_VERSION,
          status: 'error',
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        },
        null,
        2
      )
    );
    return 2;
  }
}

function baseResolution(params: {
  request: MissingComponentRequestV1;
  kind: MissingComponentResolutionKind;
  blocked: boolean;
  nextAction: MissingComponentResolutionNextAction;
  existingCandidates?: readonly string[];
  missingPlatforms?: readonly ComponentPlatform[];
  missingCapabilities?: readonly ComponentCapability[];
}): MissingComponentResolutionV1 {
  return {
    schemaVersion: MISSING_COMPONENT_REQUEST_SCHEMA_VERSION,
    kind: params.kind,
    blocked: params.blocked,
    nextAction: params.nextAction,
    request: params.request,
    existingCandidates: params.existingCandidates ?? [],
    missingPlatforms: params.missingPlatforms ?? [],
    missingCapabilities: params.missingCapabilities ?? [],
  };
}

function canonicalCandidates(
  components: readonly ComponentMetadata[],
  requestedComponent: string,
  target: ComponentExpansionTarget | undefined
): ComponentMetadata[] {
  const candidateNames = new Set<string>([requestedComponent]);
  for (const represented of target?.representedBy ?? []) {
    candidateNames.add(represented);
  }

  return components
    .filter((component) =>
      [...candidateNames].some((name) => sameName(name, component.name))
    )
    .sort((left, right) => left.name.localeCompare(right.name));
}

function productionSeedForTarget(
  target: ComponentExpansionTarget
): ComponentProductionSeedV1 {
  return {
    schemaVersion: COMPONENT_PRODUCTION_SCHEMA_VERSION,
    componentName: target.name,
    platform: productionPlatform(target.platforms),
    layer: target.layer,
    category: target.category,
    profile: target.profile,
  };
}

function productionPlatform(
  platforms: readonly ComponentPlatform[]
): ComponentProductionInputV1['platform'] {
  const hasWeb = platforms.includes('react');
  const hasNative = platforms.includes('react-native');

  if (hasWeb && hasNative) {
    return 'both';
  }
  if (hasWeb) {
    return 'web';
  }
  if (hasNative) {
    return 'native';
  }

  throw new Error(
    'Component expansion target must declare at least one platform.'
  );
}

function componentGapRequestId(componentName: string): string {
  const digest = createHash('sha256')
    .update(`vellira-component-gap-v1:${normalizeName(componentName)}`)
    .digest('hex')
    .slice(0, 16);
  return `component-gap-${digest}`;
}

function findByName<T extends { name: string }>(
  values: readonly T[],
  name: string
): T | undefined {
  return values.find((value) => sameName(value.name, name));
}

function sameName(left: string, right: string): boolean {
  return normalizeName(left) === normalizeName(right);
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

function platformForConsumer(filePath: string): ComponentPlatform {
  if (
    filePath.startsWith('apps/native-playground/') ||
    filePath.startsWith('apps/native-storybook/')
  ) {
    return 'react-native';
  }

  if (filePath.startsWith('apps/')) {
    return 'react';
  }

  throw new Error(
    `Cannot infer a component platform from consumer path "${filePath}".`
  );
}

function requiredPlatforms(
  value: Record<string, unknown>,
  field: string
): readonly ComponentPlatform[] {
  const raw = value[field];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(
      `Missing-component request field "${field}" must be non-empty.`
    );
  }

  const seen = new Set<ComponentPlatform>();
  for (const entry of raw) {
    if (!PLATFORM_ORDER.includes(entry as ComponentPlatform)) {
      throw new Error(
        `Missing-component request field "${field}" contains unsupported platform "${String(
          entry
        )}".`
      );
    }
    const platform = entry as ComponentPlatform;
    if (seen.has(platform)) {
      throw new Error(
        `Missing-component request field "${field}" must not contain duplicates.`
      );
    }
    seen.add(platform);
  }

  return PLATFORM_ORDER.filter((platform) => seen.has(platform));
}

function optionalCapabilities(
  value: Record<string, unknown>,
  field: string
): readonly ComponentCapability[] {
  const raw = value[field];
  if (raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new Error(
      `Missing-component request field "${field}" must be an array.`
    );
  }

  const supported = new Set<ComponentCapability>(componentCapabilities);
  const seen = new Set<ComponentCapability>();
  for (const entry of raw) {
    if (
      typeof entry !== 'string' ||
      !supported.has(entry as ComponentCapability)
    ) {
      throw new Error(
        `Missing-component request field "${field}" contains unsupported capability "${String(
          entry
        )}".`
      );
    }
    const capability = entry as ComponentCapability;
    if (seen.has(capability)) {
      throw new Error(
        `Missing-component request field "${field}" must not contain duplicates.`
      );
    }
    seen.add(capability);
  }

  return componentCapabilities.filter((capability) => seen.has(capability));
}

function requiredString(value: Record<string, unknown>, field: string): string {
  const raw = value[field];
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new Error(`Missing-component request field "${field}" is required.`);
  }
  return raw.trim();
}

function optionalString(
  value: Record<string, unknown>,
  field: string
): string | undefined {
  const raw = value[field];
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new Error(
      `Missing-component request field "${field}" must be a non-empty string.`
    );
  }
  return raw.trim();
}

function requiredBoolean(
  value: Record<string, unknown>,
  field: string
): boolean {
  const raw = value[field];
  if (typeof raw !== 'boolean') {
    throw new Error(`Missing-component request field "${field}" is required.`);
  }
  return raw;
}

function parseCliArgs(args: readonly string[]): string {
  let specFile: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg !== '--spec') {
      throw new Error(`Unknown missing-component request option "${arg}".`);
    }

    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error('Expected a file path after --spec.');
    }
    if (specFile) {
      throw new Error('Provide --spec exactly once.');
    }

    specFile = value;
    index += 1;
  }

  if (!specFile) {
    throw new Error(
      'Usage: pnpm component-request:json --spec <component-request.json>'
    );
  }

  return specFile;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await runMissingComponentRequestCli(process.argv.slice(2));
}

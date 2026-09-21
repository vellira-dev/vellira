import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { componentExpansionCatalog } from '@vellira-ui/metadata';

import { componentTokenReservationRequest } from '../canonical-gap/token-reservation';
import {
  CanonicalGapError,
  parseCanonicalGapRequest,
  type CanonicalGapRequestV1,
} from '../canonical-gap/types';
import { productionSeedForTarget } from '../component-production/production-seed';
import { validateComponentProductionRepositorySafety } from '../component-production/repository-safety';
import { readTokenLifecycleAuthority } from '../token-lifecycle/authority';

export const COMPONENT_TOKEN_RESERVATION_SCHEMA_VERSION = '1' as const;
export const COMPONENT_TOKEN_RESERVATION_REGISTRY =
  'packages/metadata/src/tokenLifecycle.ts' as const;

export type ComponentTokenReservationEntryV1 = {
  status: 'reserved';
  public: true;
  owner: string;
  purpose: string;
};

export type ComponentTokenReservationMutationV1 = {
  schemaVersion: typeof COMPONENT_TOKEN_RESERVATION_SCHEMA_VERSION;
  sourceRevision: string;
  request: CanonicalGapRequestV1;
  action: 'reserved' | 'no-op';
  registryPath: typeof COMPONENT_TOKEN_RESERVATION_REGISTRY;
  entry: ComponentTokenReservationEntryV1;
  mutationOccurred: boolean;
  previousSource: string;
  nextSource: string;
};

export function reserveComponentTokenFamily(params: {
  root: string;
  sourceRevision: string;
  request: unknown;
  write?: boolean;
}): ComponentTokenReservationMutationV1 {
  const request = validateReservationRequest(params.request);
  assertExactSourceRevision(params.root, params.sourceRevision);
  assertSafeCleanWorktree(params.root);

  const authority = readTokenLifecycleAuthority(params.root);
  const registryPath = repositoryPath(params.root, authority.file);
  if (registryPath !== COMPONENT_TOKEN_RESERVATION_REGISTRY) {
    throw new CanonicalGapError(
      `Unexpected component-token lifecycle registry "${registryPath}".`
    );
  }

  const componentName = request.productionSeed!.componentName;
  const entry = desiredEntry(componentName);
  const existing = authority.components[componentName];

  if (existing) {
    if (isExactReservedEntry(existing, entry)) {
      return {
        schemaVersion: COMPONENT_TOKEN_RESERVATION_SCHEMA_VERSION,
        sourceRevision: params.sourceRevision,
        request,
        action: 'no-op',
        registryPath,
        entry,
        mutationOccurred: false,
        previousSource: authority.source,
        nextSource: authority.source,
      };
    }
    throw new CanonicalGapError(
      `Component-token lifecycle entry "${componentName}" already exists as ${existing.status}; reservation resolution cannot overwrite it.`
    );
  }

  const nextSource = insertReservedEntry(authority, componentName, entry);
  if (params.write !== false) {
    fs.writeFileSync(authority.file, nextSource);
    const written = readTokenLifecycleAuthority(params.root);
    if (
      !isExactReservedEntry(written.components[componentName], entry) ||
      !isDeepStrictEqual(written.semantics, authority.semantics)
    ) {
      throw new CanonicalGapError(
        'Component-token reservation mutation did not preserve lifecycle authority.'
      );
    }
  }

  return {
    schemaVersion: COMPONENT_TOKEN_RESERVATION_SCHEMA_VERSION,
    sourceRevision: params.sourceRevision,
    request,
    action: 'reserved',
    registryPath,
    entry,
    mutationOccurred: params.write !== false,
    previousSource: authority.source,
    nextSource,
  };
}

function isExactReservedEntry(
  value:
    | { status: string; public: boolean; owner: string; purpose: string }
    | undefined,
  expected: ComponentTokenReservationEntryV1
) {
  return (
    value?.status === expected.status &&
    value.public === expected.public &&
    value.owner === expected.owner &&
    value.purpose === expected.purpose &&
    Object.keys(value).length === 4
  );
}

export function validateReservationRequest(
  value: unknown
): CanonicalGapRequestV1 {
  const request = parseCanonicalGapRequest(value);
  if (request.kind !== 'component-token-reservation') {
    throw new CanonicalGapError(
      'Reservation resolver requires component-token-reservation authority.'
    );
  }
  if (
    !request.productionSeed ||
    request.productionSeed.componentTokens === false ||
    request.canonicalTarget !== request.productionSeed.componentName ||
    request.reservation?.registryPath !== COMPONENT_TOKEN_RESERVATION_REGISTRY
  ) {
    throw new CanonicalGapError(
      'Invalid component-token reservation authority.'
    );
  }

  const target = componentExpansionCatalog.find(
    ({ name }) => name === request.productionSeed!.componentName
  );
  if (!target) {
    throw new CanonicalGapError(
      `Component-token reservation target "${request.productionSeed.componentName}" is not in the expansion catalog.`
    );
  }
  const canonicalSeed = productionSeedForTarget(target);
  if (!isDeepStrictEqual(request.productionSeed, canonicalSeed)) {
    throw new CanonicalGapError(
      'Component-token reservation production seed disagrees with expansion-catalog intent.'
    );
  }
  const expected = componentTokenReservationRequest(
    canonicalSeed,
    request.consumer,
    request.launchCritical
  );
  if (!isDeepStrictEqual(request, expected)) {
    throw new CanonicalGapError(
      'Component-token reservation request identity is not canonical.'
    );
  }
  return request;
}

function desiredEntry(componentName: string): ComponentTokenReservationEntryV1 {
  return {
    status: 'reserved',
    public: true,
    owner: componentName,
    purpose: `Reserved for the canonical ${componentName} component token contract.`,
  };
}

function insertReservedEntry(
  authority: ReturnType<typeof readTokenLifecycleAuthority>,
  componentName: string,
  entry: ComponentTokenReservationEntryV1
): string {
  const first = authority.componentObject.properties[0];
  const insertion = [
    '',
    `  ${componentName}: {`,
    `    status: '${entry.status}',`,
    `    public: ${String(entry.public)},`,
    `    owner: '${entry.owner}',`,
    `    purpose: '${entry.purpose}',`,
    '  },',
    '',
  ].join('\n');
  const offset = first
    ? first.getFullStart()
    : authority.componentObject.getEnd() - 1;
  return (
    authority.source.slice(0, offset) +
    insertion +
    authority.source.slice(offset)
  );
}

function assertExactSourceRevision(root: string, expected: string) {
  if (!/^[0-9a-f]{40}$/.test(expected)) {
    throw new CanonicalGapError(
      'Component-token reservation requires an exact source revision.'
    );
  }
  const actual = git(root, ['rev-parse', 'HEAD']).trim();
  if (actual !== expected) {
    throw new CanonicalGapError(
      `Stale component-token reservation source: expected ${expected}, found ${actual}.`
    );
  }
}

function assertSafeCleanWorktree(root: string) {
  const safety = validateComponentProductionRepositorySafety(root);
  if (!safety.ok) throw new CanonicalGapError(safety.reason);
  const status = git(root, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ]).trim();
  if (status) {
    throw new CanonicalGapError(
      'Component-token reservation requires a clean working tree.'
    );
  }
}

function repositoryPath(root: string, file: string) {
  return path.relative(path.resolve(root), file).replaceAll('\\', '/');
}

function git(root: string, args: readonly string[]): string {
  try {
    return execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {
      cwd: root,
      encoding: 'utf8',
      shell: false,
    });
  } catch (error) {
    throw new CanonicalGapError(
      `Unable to verify component-token reservation repository state: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

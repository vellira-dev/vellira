import fs from 'node:fs';
import path from 'node:path';

import {
  componentTokenWebCompatibilityAliases,
} from '../../../packages/tokens/src/platform-output/component-token-web-compatibility';
import {
  legacyPublicExportAliasesV1,
  tokenPackagePublicSurfaceV1,
} from '../../../packages/tokens/src/public-api-policy';
import type { FindingInput } from './contract';

function finding(
  code: string,
  evidence: string,
  expected: string,
  migrationStatus = 'not-applicable'
): FindingInput {
  return {
    ruleId: 'tokens.public-api',
    code,
    severity: 'error',
    sourcePath: 'packages/tokens/package.json',
    tokenPath: null,
    line: null,
    column: null,
    layer: 'platform-output',
    theme: null,
    platform: null,
    evidence,
    expected,
    migrationStatus,
    suggestedAction:
      'Restore the canonical #889 package export surface or remove expired compatibility aliases at their recorded release boundary.',
  };
}

type PackageJsonPublicSurface = {
  version?: unknown;
  main?: unknown;
  types?: unknown;
  exports?: unknown;
};

type RemovalAlias = {
  kind: 'public-export' | 'css-variable';
  name: string;
  removeIn: string;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right)
    );
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function parseVersion(version: string): readonly [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])] as const;
}

export function isVersionAtOrAfter(
  version: string,
  boundary: string
): boolean | null {
  const current = parseVersion(version);
  const target = parseVersion(boundary);
  if (!current || !target) return null;

  for (let index = 0; index < 3; index += 1) {
    const currentPart = current[index]!;
    const targetPart = target[index]!;
    if (currentPart > targetPart) return true;
    if (currentPart < targetPart) return false;
  }
  return true;
}

export function auditRemovalBoundary(
  currentVersion: string,
  aliases: readonly RemovalAlias[]
): FindingInput[] {
  const findings: FindingInput[] = [];

  for (const alias of aliases) {
    const expired = isVersionAtOrAfter(currentVersion, alias.removeIn);
    if (expired === null) {
      findings.push(
        finding(
          'invalid-public-api-release-boundary',
          `Cannot compare package version ${currentVersion} with ${alias.removeIn} for ${alias.name}.`,
          'Package and removal versions must use comparable semver core versions.'
        )
      );
      continue;
    }
    if (expired) {
      findings.push(
        finding(
          alias.kind === 'public-export'
            ? 'expired-public-export-alias'
            : 'expired-css-compatibility-alias',
          `${alias.name} remains registered at package version ${currentVersion} despite removeIn ${alias.removeIn}.`,
          'Compatibility aliases must be removed no later than their canonical #889 release boundary.',
          'expired'
        )
      );
    }
  }

  return findings;
}

export function auditTokenPackagePublicSurface(
  packageJson: PackageJsonPublicSurface
): FindingInput[] {
  const findings: FindingInput[] = [];

  if (packageJson.main !== tokenPackagePublicSurfaceV1.main) {
    findings.push(
      finding(
        'package-main-entry-drift',
        `package.json main is ${JSON.stringify(packageJson.main)}.`,
        `main must remain ${tokenPackagePublicSurfaceV1.main} under the canonical #889 surface.`
      )
    );
  }

  if (packageJson.types !== tokenPackagePublicSurfaceV1.types) {
    findings.push(
      finding(
        'package-types-entry-drift',
        `package.json types is ${JSON.stringify(packageJson.types)}.`,
        `types must remain ${tokenPackagePublicSurfaceV1.types} under the canonical #889 surface.`
      )
    );
  }

  const actualExports =
    typeof packageJson.exports === 'object' && packageJson.exports !== null
      ? (packageJson.exports as Record<string, unknown>)
      : {};
  const expectedExports = tokenPackagePublicSurfaceV1.exports;
  const actualSubpaths = Object.keys(actualExports).sort();
  const expectedSubpaths = Object.keys(expectedExports).sort();

  if (stableJson(actualSubpaths) !== stableJson(expectedSubpaths)) {
    findings.push(
      finding(
        'package-export-subpath-drift',
        `Export subpaths are ${actualSubpaths.join(', ') || '(none)'}.`,
        `Export subpaths must be exactly ${expectedSubpaths.join(', ')} unless the canonical #889 policy is deliberately revised.`
      )
    );
  }

  for (const subpath of expectedSubpaths) {
    const expected = expectedExports[subpath as keyof typeof expectedExports];
    if (stableJson(actualExports[subpath]) !== stableJson(expected)) {
      findings.push(
        finding(
          'package-export-target-drift',
          `${subpath} export targets diverge from tokenPackagePublicSurfaceV1.`,
          'Every condition/target under a public package subpath must match the canonical #889 export inventory.'
        )
      );
    }
  }

  return findings;
}

export function checkTokenPackagePublicSurface(root: string): {
  checked: number;
  findings: FindingInput[];
} {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(root, 'packages/tokens/package.json'), 'utf8')
  ) as PackageJsonPublicSurface;
  const findings = auditTokenPackagePublicSurface(packageJson);
  const expectedSubpathCount = Object.keys(
    tokenPackagePublicSurfaceV1.exports
  ).length;
  let checked = 2 + expectedSubpathCount;

  if (typeof packageJson.version !== 'string') {
    checked += 1;
    findings.push(
      finding(
        'package-version-missing',
        `package.json version is ${JSON.stringify(packageJson.version)}.`,
        'A concrete package version is required to enforce #889 removal boundaries.'
      )
    );
    return { checked, findings };
  }

  const removalAliases: RemovalAlias[] = [
    ...legacyPublicExportAliasesV1.map((alias) => ({
      kind: 'public-export' as const,
      name: alias.exportName,
      removeIn: alias.removeIn,
    })),
    ...componentTokenWebCompatibilityAliases.map((alias) => ({
      kind: 'css-variable' as const,
      name: alias.variable,
      removeIn: alias.removeIn,
    })),
  ];
  checked += removalAliases.length;
  findings.push(...auditRemovalBoundary(packageJson.version, removalAliases));

  return { checked, findings };
}

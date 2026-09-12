import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { generateTokenCss } from '../../../packages/tokens/scripts/token-css-output';
import { darkTheme } from '../../../packages/tokens/src/dark/theme';
import {
  componentTokenPaths,
  themeCssVariableNames,
  themeNames,
} from '../../../packages/tokens/src/generated/token-types';
import { highContrastTheme } from '../../../packages/tokens/src/highContrast/theme';
import { theme } from '../../../packages/tokens/src/index';
import { lightTheme } from '../../../packages/tokens/src/light/theme';
import { componentTokenWebCompatibilityAliases } from '../../../packages/tokens/src/platform-output/component-token-web-compatibility';
import { tokenMigrationManifestV1 } from '../../../packages/tokens/src/preservation/token-migrations';
import {
  legacyPublicExportAliasesV1,
  publicThemeContractsV1,
  tokenPublicApiDeprecationPolicyV1,
  tokenPublicPackageSubpathsV1,
  tokenPublicSymbolsV1,
} from '../../../packages/tokens/src/public-api-policy';
import type { FindingInput, RuleResult } from './contract';

function finding(
  code: string,
  sourcePath: string,
  evidence: string,
  expected: string,
  migrationStatus = 'not-applicable'
): FindingInput {
  return {
    ruleId: 'tokens.public-api',
    code,
    severity: 'error',
    sourcePath,
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
      'Restore the bounded #889 public API/deprecation contract and its canonical replacement evidence.',
  };
}

export function escapeRegExpLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sameSortedValues(
  left: readonly string[],
  right: readonly string[]
): boolean {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index])
  );
}

function hasExportModifier(statement: ts.Statement): boolean {
  return Boolean(
    ts.canHaveModifiers(statement) &&
      ts
        .getModifiers(statement)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  );
}

function collectBindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) =>
    ts.isBindingElement(element) ? collectBindingNames(element.name) : []
  );
}

function resolveExportPath(fromPath: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;

  const rawPath = path.resolve(path.dirname(fromPath), specifier);
  const extension = path.extname(rawPath);
  const candidates: string[] = [];

  if (extension === '.js') {
    const withoutExtension = rawPath.slice(0, -extension.length);
    candidates.push(`${withoutExtension}.ts`, `${withoutExtension}.tsx`);
  }

  candidates.push(
    rawPath,
    `${rawPath}.ts`,
    `${rawPath}.tsx`,
    path.join(rawPath, 'index.ts'),
    path.join(rawPath, 'index.tsx')
  );

  return (
    candidates.find(
      (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
    ) ?? null
  );
}

function collectPublicSymbols(entryPath: string, seen = new Set<string>()): string[] {
  const normalizedEntryPath = path.normalize(entryPath);
  if (seen.has(normalizedEntryPath)) return [];
  seen.add(normalizedEntryPath);

  const sourceFile = ts.createSourceFile(
    normalizedEntryPath,
    fs.readFileSync(normalizedEntryPath, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const symbols = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          symbols.add(element.name.text);
        }
        continue;
      }

      const specifier = ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : null;
      const resolvedPath = specifier
        ? resolveExportPath(normalizedEntryPath, specifier)
        : null;
      if (resolvedPath) {
        for (const symbol of collectPublicSymbols(resolvedPath, seen)) {
          symbols.add(symbol);
        }
      }
      continue;
    }

    if (!hasExportModifier(statement)) continue;

    if (
      (ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name
    ) {
      symbols.add(statement.name.text);
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        for (const name of collectBindingNames(declaration.name)) {
          symbols.add(name);
        }
      }
    }
  }

  return [...symbols].sort();
}

export function auditTokenPublicPackageSurface(input: {
  packageName: string;
  actualSubpaths: readonly string[];
  actualSymbols: readonly string[];
}): FindingInput[] {
  const findings: FindingInput[] = [];

  if (input.packageName !== '@vellira-ui/tokens') {
    findings.push(
      finding(
        'token-package-name-drift',
        'packages/tokens/package.json',
        `Package name is ${JSON.stringify(input.packageName)}.`,
        'The canonical public token package must remain @vellira-ui/tokens.'
      )
    );
  }

  if (!sameSortedValues(input.actualSubpaths, tokenPublicPackageSubpathsV1)) {
    findings.push(
      finding(
        'token-package-subpath-surface-drift',
        'packages/tokens/package.json',
        `Public package subpaths are ${JSON.stringify([...input.actualSubpaths].sort())}.`,
        `Public package subpaths must exactly match ${JSON.stringify([...tokenPublicPackageSubpathsV1].sort())}.`
      )
    );
  }

  if (!sameSortedValues(input.actualSymbols, tokenPublicSymbolsV1)) {
    findings.push(
      finding(
        'token-package-symbol-surface-drift',
        'packages/tokens/src/index.ts',
        `Public root symbols are ${JSON.stringify([...input.actualSymbols].sort())}.`,
        'Public root symbols must exactly match tokenPublicSymbolsV1.'
      )
    );
  }

  return findings;
}

type SemverCore = readonly [major: number, minor: number, patch: number];

function parseSemverCore(value: string): SemverCore | null {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(
    value
  );
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemverCore(left: SemverCore, right: SemverCore): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index]! - right[index]!;
    if (difference !== 0) return difference;
  }
  return 0;
}

export function auditTokenPublicApiReleaseBoundary(input: {
  currentVersion: string;
  removalRelease: string;
  exportAliases: readonly { exportName: string; removeIn: string }[];
  cssAliases: readonly { variable: string; removeIn: string }[];
}): FindingInput[] {
  const findings: FindingInput[] = [];
  const current = parseSemverCore(input.currentVersion);
  const policyBoundary = parseSemverCore(input.removalRelease);

  if (!current) {
    findings.push(
      finding(
        'invalid-token-package-version',
        'packages/tokens/package.json',
        `Package version ${JSON.stringify(input.currentVersion)} is not valid semver.`,
        'The public token package version must be a deterministic semver value.'
      )
    );
    return findings;
  }

  if (!policyBoundary) {
    findings.push(
      finding(
        'invalid-public-api-removal-version',
        'packages/tokens/src/public-api-policy.ts',
        `Removal release ${JSON.stringify(input.removalRelease)} is not valid semver.`,
        'The #889 removal boundary must be a deterministic semver value.'
      )
    );
    return findings;
  }

  const auditAlias = (
    identity: string,
    removeIn: string,
    sourcePath: string,
    code: string
  ) => {
    const boundary = parseSemverCore(removeIn);
    if (!boundary) {
      findings.push(
        finding(
          'invalid-alias-removal-version',
          sourcePath,
          `${identity} removal release ${JSON.stringify(removeIn)} is not valid semver.`,
          'Every compatibility alias must declare a deterministic semver removal boundary.',
          'recorded'
        )
      );
      return;
    }

    if (compareSemverCore(current, boundary) >= 0) {
      findings.push(
        finding(
          code,
          sourcePath,
          `${identity} remains present at package version ${input.currentVersion} after its ${removeIn} removal boundary.`,
          'Expired compatibility aliases must be removed from the public contract at or before their recorded major-version boundary.',
          'expired'
        )
      );
    }
  };

  for (const alias of input.exportAliases) {
    auditAlias(
      alias.exportName,
      alias.removeIn,
      'packages/tokens/src/public-api-policy.ts',
      'expired-public-export-alias'
    );
  }
  for (const alias of input.cssAliases) {
    auditAlias(
      alias.variable,
      alias.removeIn,
      'packages/tokens/src/platform-output/component-token-web-compatibility.ts',
      'expired-css-compatibility-alias'
    );
  }

  return findings;
}

export function auditPublicCompatibilityAlias(input: {
  alias: {
    path: string;
    replacementPath: string;
    variable: string;
    replacementVariable: string;
    issue: string;
    removeIn: string;
    migrationId: string;
  };
  migrationIds: ReadonlySet<string>;
  canonicalPaths: readonly string[];
  cssVariables: readonly string[];
}): FindingInput[] {
  const { alias } = input;
  const findings: FindingInput[] = [];

  if (
    alias.issue !== tokenPublicApiDeprecationPolicyV1.issue ||
    alias.removeIn !== tokenPublicApiDeprecationPolicyV1.removalRelease
  ) {
    findings.push(
      finding(
        'unbounded-css-compatibility-alias',
        'packages/tokens/src/platform-output/component-token-web-compatibility.ts',
        `${alias.variable} is not bounded by the canonical #889 removal policy.`,
        `Compatibility aliases must reference ${tokenPublicApiDeprecationPolicyV1.issue} and removal release ${tokenPublicApiDeprecationPolicyV1.removalRelease}.`,
        'recorded'
      )
    );
  }

  if (!input.migrationIds.has(alias.migrationId)) {
    findings.push(
      finding(
        'css-alias-migration-missing',
        'packages/tokens/src/platform-output/component-token-web-compatibility.ts',
        `${alias.variable} references unknown migration ${alias.migrationId}.`,
        'Every compatibility alias must point to a canonical migration record.',
        'untracked'
      )
    );
  }

  if (input.canonicalPaths.includes(alias.path)) {
    findings.push(
      finding(
        'deprecated-path-reentered-canonical-api',
        'packages/tokens/src/generated/token-types.ts',
        `${alias.path} appears in canonical componentTokenPaths.`,
        'Deprecated compatibility paths must stay outside canonical token path unions.',
        'recorded'
      )
    );
  }

  if (!input.canonicalPaths.includes(alias.replacementPath)) {
    findings.push(
      finding(
        'css-alias-replacement-path-missing',
        'packages/tokens/src/generated/token-types.ts',
        `${alias.replacementPath} is missing from canonical componentTokenPaths.`,
        'A compatibility alias replacement must be a canonical component token path.',
        'recorded'
      )
    );
  }

  if (
    !input.cssVariables.includes(alias.variable) ||
    !input.cssVariables.includes(alias.replacementVariable)
  ) {
    findings.push(
      finding(
        'css-alias-output-missing',
        'packages/tokens/src/generated/token-types.ts',
        `${alias.variable} or ${alias.replacementVariable} is missing from generated CSS variable names.`,
        'Compatibility and replacement CSS variables must both remain emitted during the bounded deprecation window.',
        'recorded'
      )
    );
  }

  return findings;
}

export function checkTokenPublicApi(root: string): RuleResult {
  const findings: FindingInput[] = [];
  let checked = 0;
  const themesByExport = {
    lightTheme,
    darkTheme,
    highContrastTheme,
  } as const;

  checked += 2;
  if (tokenPublicApiDeprecationPolicyV1.issue !== '#889') {
    findings.push(
      finding(
        'public-api-policy-issue-drift',
        'packages/tokens/src/public-api-policy.ts',
        `Public API policy points to ${tokenPublicApiDeprecationPolicyV1.issue}.`,
        'Token Architecture Normalization V1 public API policy is owned by #889.'
      )
    );
  }
  if (tokenPublicApiDeprecationPolicyV1.removalRelease !== '3.0.0') {
    findings.push(
      finding(
        'public-api-removal-boundary-drift',
        'packages/tokens/src/public-api-policy.ts',
        `Removal release is ${tokenPublicApiDeprecationPolicyV1.removalRelease}.`,
        'Normalization V1 compatibility aliases remain bounded to 3.0.0 unless the canonical policy is deliberately revised.'
      )
    );
  }

  for (const contract of publicThemeContractsV1) {
    checked += 1;
    if (themesByExport[contract.exportName].name !== contract.themeName) {
      findings.push(
        finding(
          'named-theme-identity-drift',
          'packages/tokens/src/public-api-policy.ts',
          `${contract.exportName} does not identify as ${contract.themeName}.`,
          'Named theme exports must match their runtime theme.name identity.'
        )
      );
    }
  }

  checked += 1;
  if (
    JSON.stringify([...themeNames].sort()) !==
    JSON.stringify(
      publicThemeContractsV1.map(({ themeName }) => themeName).sort()
    )
  ) {
    findings.push(
      finding(
        'generated-theme-name-contract-drift',
        'packages/tokens/src/generated/token-types.ts',
        'Generated themeNames diverge from publicThemeContractsV1.',
        'Generated theme names and named public theme contracts must stay in lockstep.'
      )
    );
  }

  const css = generateTokenCss();
  checked += 4;
  const expectedRoot = tokenPublicApiDeprecationPolicyV1.cssRootTheme;
  if (expectedRoot !== 'light') {
    findings.push(
      finding(
        'css-root-theme-policy-drift',
        'packages/tokens/src/public-api-policy.ts',
        `CSS root theme is ${expectedRoot}.`,
        'Generated CSS :root must remain Light under the #889 policy.'
      )
    );
  }
  for (const selector of [
    ":root,\n[data-theme='light'],\n[data-vellira-theme='light'] {",
    "[data-theme='dark'],\n[data-vellira-theme='dark'] {",
    "[data-theme='high-contrast'],\n[data-vellira-theme='high-contrast'] {",
  ]) {
    if (!css.includes(selector)) {
      findings.push(
        finding(
          'generated-theme-selector-missing',
          'packages/tokens/scripts/token-css-output.ts',
          `Generated CSS is missing selector contract ${JSON.stringify(selector)}.`,
          'Generated CSS must expose the three explicit #889 theme selector contracts.'
        )
      );
    }
  }

  const packageJsonPath = path.join(root, 'packages/tokens/package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    name?: unknown;
    version?: unknown;
    exports?: unknown;
  };
  const packageExports =
    packageJson.exports !== null &&
    typeof packageJson.exports === 'object' &&
    !Array.isArray(packageJson.exports)
      ? Object.keys(packageJson.exports)
      : [];
  const indexPath = path.join(root, 'packages/tokens/src/index.ts');
  const actualSymbols = collectPublicSymbols(indexPath);
  checked +=
    3 + tokenPublicPackageSubpathsV1.length + tokenPublicSymbolsV1.length;
  findings.push(
    ...auditTokenPublicPackageSurface({
      packageName:
        typeof packageJson.name === 'string' ? packageJson.name : String(packageJson.name),
      actualSubpaths: packageExports,
      actualSymbols,
    })
  );

  const indexSource = fs.readFileSync(indexPath, 'utf8');
  for (const alias of legacyPublicExportAliasesV1) {
    checked += 3;
    if (
      alias.issue !== tokenPublicApiDeprecationPolicyV1.issue ||
      alias.removeIn !== tokenPublicApiDeprecationPolicyV1.removalRelease ||
      !alias.replacementExport.trim()
    ) {
      findings.push(
        finding(
          'unbounded-public-export-alias',
          'packages/tokens/src/public-api-policy.ts',
          `${alias.exportName} lacks canonical replacement/removal evidence.`,
          'Deprecated public exports must be bounded by the #889 policy and name a replacement.',
          'recorded'
        )
      );
    }
    const annotationPattern = new RegExp(
      `@deprecated[\\s\\S]*Use [^\\n]*${escapeRegExpLiteral(alias.replacementExport)}[^\\n]*directly[\\s\\S]*${escapeRegExpLiteral(alias.removeIn)}[\\s\\S]*export const ${escapeRegExpLiteral(alias.exportName)}\\b`
    );
    if (!annotationPattern.test(indexSource)) {
      findings.push(
        finding(
          'public-export-deprecation-annotation-missing',
          'packages/tokens/src/index.ts',
          `${alias.exportName} is not source-annotated with its replacement/removal boundary.`,
          'Deprecated public exports must carry source-level @deprecated replacement/removal evidence.',
          'recorded'
        )
      );
    }
  }

  checked += 1;
  if (
    JSON.stringify(theme) !==
      JSON.stringify({
        semantic: darkTheme.semantic,
        components: darkTheme.components,
        tokens: darkTheme.tokens,
      }) ||
    'name' in theme ||
    'colors' in theme
  ) {
    findings.push(
      finding(
        'historical-theme-export-contract-drift',
        'packages/tokens/src/index.ts',
        'Historical theme export no longer matches its bounded partial Dark-theme compatibility contract.',
        'The deprecated theme export must stay exact until its recorded major-version removal.'
      )
    );
  }

  const migrationIds = new Set(tokenMigrationManifestV1.map(({ id }) => id));
  for (const alias of componentTokenWebCompatibilityAliases) {
    checked += 5;
    findings.push(
      ...auditPublicCompatibilityAlias({
        alias,
        migrationIds,
        canonicalPaths: componentTokenPaths,
        cssVariables: themeCssVariableNames,
      })
    );
  }

  checked +=
    2 + legacyPublicExportAliasesV1.length + componentTokenWebCompatibilityAliases.length;
  findings.push(
    ...auditTokenPublicApiReleaseBoundary({
      currentVersion:
        typeof packageJson.version === 'string'
          ? packageJson.version
          : String(packageJson.version),
      removalRelease: tokenPublicApiDeprecationPolicyV1.removalRelease,
      exportAliases: legacyPublicExportAliasesV1,
      cssAliases: componentTokenWebCompatibilityAliases,
    })
  );

  return {
    coverage: 'complete',
    scope:
      'Canonical #889 named theme identities, generated path/name alignment, CSS theme selectors, exhaustive @vellira-ui/tokens package subpaths and root public symbols, bounded legacy export and Web compatibility migration evidence, canonical path exclusion, generated variable presence, and fail-closed semver removal enforcement at the recorded 3.0.0 boundary.',
    checked,
    findings,
  };
}

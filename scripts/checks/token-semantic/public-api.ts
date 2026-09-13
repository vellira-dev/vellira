import fs from 'node:fs';
import path from 'node:path';

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

  const indexSource = fs.readFileSync(
    path.join(root, 'packages/tokens/src/index.ts'),
    'utf8'
  );
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

  return {
    coverage: 'partial',
    scope:
      'Canonical #889 theme identities, generated CSS theme selectors, bounded legacy root export, Web compatibility alias migration evidence, canonical path exclusion, and generated variable presence. Exhaustive package export-surface enumeration and release-boundary removal automation remain to be connected.',
    checked,
    findings,
  };
}

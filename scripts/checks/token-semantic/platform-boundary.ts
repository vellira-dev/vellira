import { darkTheme } from '../../../packages/tokens/src/dark/theme';
import { highContrastTheme } from '../../../packages/tokens/src/highContrast/theme';
import { lightTheme } from '../../../packages/tokens/src/light/theme';
import {
  type ComponentTokenBoundaryFinding,
  scanCanonicalComponentTokens,
} from '../../../packages/tokens/src/platform-output/component-token-boundary';
import type { FindingInput, RuleResult } from './contract';

const scope =
  'Shared #884 resolved-component check; broader source and representation coverage remains open.';

export function auditComponentPlatformBoundary(
  components: unknown,
  theme: string,
  sourcePath: string
): RuleResult {
  if (
    typeof components !== 'object' ||
    components === null ||
    Array.isArray(components) ||
    Object.keys(components).length === 0
  ) {
    throw new Error('A non-empty component-family inventory is required.');
  }
  const violations: ComponentTokenBoundaryFinding[] = [];
  scanCanonicalComponentTokens(components, 'components', violations);
  const findings: FindingInput[] = violations.map((finding) => ({
    ruleId: 'tokens.platform-boundary',
    code: 'renderer-specific-component-contract',
    severity: 'error',
    sourcePath,
    tokenPath: finding.path,
    line: null,
    column: null,
    layer: 'component',
    theme,
    platform: null,
    evidence: finding.reason,
    expected: 'Renderer-neutral keys and validated platform intents.',
    migrationStatus: 'untracked',
    suggestedAction: 'Move renderer representation into the canonical adapter.',
  }));
  return {
    coverage: 'partial',
    scope,
    checked: Object.keys(components).length,
    findings,
  };
}

export function checkTokenPlatformBoundary(): RuleResult {
  const themes = [
    ['light', 'light', lightTheme],
    ['dark', 'dark', darkTheme],
    ['high-contrast', 'highContrast', highContrastTheme],
  ] as const;
  const results = themes.map(([name, directory, theme]) =>
    auditComponentPlatformBoundary(
      theme.components,
      name,
      `packages/tokens/src/${directory}/components/index.ts`
    )
  );
  return {
    coverage: 'partial',
    scope,
    checked: results.reduce((total, result) => total + result.checked, 0),
    findings: results.flatMap((result) => result.findings),
  };
}

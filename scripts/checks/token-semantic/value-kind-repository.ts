import { darkTheme } from '../../../packages/tokens/src/dark/theme';
import { highContrastTheme } from '../../../packages/tokens/src/highContrast/theme';
import { lightTheme } from '../../../packages/tokens/src/light/theme';
import { controlSizes } from '../../../packages/tokens/src/tokens/controlSizes';
import type { RuleResult } from './contract';
import { auditTokenValueKinds, tokenValueKindAuditScope } from './value-kind';

/** Includes shared control sizes, which are not exported by theme.tokens. */
export function checkTokenValueKinds(): RuleResult {
  const themes = [
    ['light', 'light', lightTheme],
    ['dark', 'dark', darkTheme],
    ['high-contrast', 'highContrast', highContrastTheme],
  ] as const;
  const results = themes.flatMap(([name, directory, theme]) =>
    (['colors', 'semantic', 'components', 'tokens'] as const).map((layer) =>
      auditTokenValueKinds(
        theme[layer],
        layer,
        name,
        `packages/tokens/src/${directory}/theme.ts`
      )
    )
  );
  results.push(
    auditTokenValueKinds(
      controlSizes,
      'tokens.controlSizes',
      null,
      'packages/tokens/src/tokens/controlSizes.ts'
    )
  );
  return {
    coverage: 'partial',
    scope: tokenValueKindAuditScope,
    checked: results.reduce((total, result) => total + result.checked, 0),
    findings: results.flatMap((result) => result.findings),
  };
}

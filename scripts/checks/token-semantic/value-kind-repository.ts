import fs from 'node:fs';
import path from 'node:path';

import { generateTokenCss } from '../../../packages/tokens/scripts/token-css-output';
import { darkTheme } from '../../../packages/tokens/src/dark/theme';
import { highContrastTheme } from '../../../packages/tokens/src/highContrast/theme';
import { lightTheme } from '../../../packages/tokens/src/light/theme';
import { controlSizes } from '../../../packages/tokens/src/tokens/controlSizes';
import type { FindingInput, RuleResult } from './contract';
import { auditTokenValueKinds } from './value-kind';

const generatedCssPath = 'packages/tokens/src/generated/tokens.css';
const scope =
  'Complete #881 value-kind authority: every maintained scalar/intent across all theme layers and shared control sizes is validated through the canonical kind resolver and CSS serializer, including duration/easing string grammar and unitless numeric rules, and the committed generated CSS must be byte-identical to fresh canonical generation.';

export function auditGeneratedTokenCssFreshness(root: string): {
  checked: number;
  findings: FindingInput[];
} {
  const committed = fs.readFileSync(path.join(root, generatedCssPath), 'utf8');
  const generated = generateTokenCss();

  if (committed === generated) {
    return { checked: 1, findings: [] };
  }

  return {
    checked: 1,
    findings: [
      {
        ruleId: 'tokens.value-kind',
        code: 'generated-css-out-of-date',
        severity: 'error',
        sourcePath: generatedCssPath,
        tokenPath: null,
        line: null,
        column: null,
        layer: 'platform-output',
        theme: null,
        platform: 'web',
        evidence:
          'Committed generated tokens.css differs from fresh output of the canonical #881 CSS generator.',
        expected:
          'packages/tokens/src/generated/tokens.css must be byte-identical to generateTokenCss().',
        migrationStatus: 'not-applicable',
        suggestedAction:
          'Regenerate token CSS from the canonical value-kind serializer; do not hand-edit the generated artifact.',
      },
    ],
  };
}

/** Includes shared control sizes, which are not exported by theme.tokens. */
export function checkTokenValueKinds(root = process.cwd()): RuleResult {
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

  const generatedCss = auditGeneratedTokenCssFreshness(root);

  return {
    coverage: 'complete',
    scope,
    checked:
      results.reduce((total, result) => total + result.checked, 0) +
      generatedCss.checked,
    findings: [
      ...results.flatMap((result) => result.findings),
      ...generatedCss.findings,
    ],
  };
}

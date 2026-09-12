import fs from 'node:fs';
import path from 'node:path';

import {
  collectBaseCssOutput,
  collectThemeCssOutput,
  generateTokenCss,
} from '../../../packages/tokens/scripts/token-css-output';
import { darkTheme } from '../../../packages/tokens/src/dark/theme';
import { highContrastTheme } from '../../../packages/tokens/src/highContrast/theme';
import { lightTheme } from '../../../packages/tokens/src/light/theme';
import { controlSizes } from '../../../packages/tokens/src/tokens/controlSizes';
import type { FindingInput, RuleResult } from './contract';
import { auditTokenValueKinds } from './value-kind';

const generatorSourcePath = 'packages/tokens/scripts/generate-css.ts';
const tokenPackagePath = 'packages/tokens/package.json';
const scope =
  'Complete #881 value-kind authority: every maintained scalar/intent across all theme layers and shared control sizes is validated through the canonical kind resolver and CSS serializer, including duration/easing string grammar and unitless numeric rules. Emitted Web CSS is reconstructed from canonical output maps and must match generateTokenCss(), while package build wiring must generate both source and published CSS artifacts from that same authority.';

type CssOutputEntry = {
  variable: string;
  value: string;
};

type TokenPackage = {
  scripts?: Record<string, unknown>;
  exports?: Record<string, unknown>;
};

function finding(
  code: string,
  sourcePath: string,
  evidence: string,
  expected: string
): FindingInput {
  return {
    ruleId: 'tokens.value-kind',
    code,
    severity: 'error',
    sourcePath,
    tokenPath: null,
    line: null,
    column: null,
    layer: 'platform-output',
    theme: null,
    platform: 'web',
    evidence,
    expected,
    migrationStatus: 'not-applicable',
    suggestedAction:
      'Restore the canonical #881 CSS serializer/generator wiring; do not add a parallel output path or bypass the value-kind authority.',
  };
}

function renderVariables(
  output: ReadonlyMap<string, CssOutputEntry>
): string {
  let css = '';
  for (const { variable, value } of output.values()) {
    css += `  ${variable}: ${value};\n`;
  }
  return css;
}

function expectedThemeBlock(
  selector: string,
  output: ReadonlyMap<string, CssOutputEntry>
): string {
  return `${selector} {\n${renderVariables(output)}}\n`;
}

export function createExpectedGeneratedTokenCss(): string {
  let css = `/**
 * AUTO-GENERATED FILE
 * DO NOT EDIT MANUALLY
 */

:root {
${renderVariables(collectBaseCssOutput())}}
`;

  css += '\n';
  css += expectedThemeBlock(
    `:root,\n[data-theme='light'],\n[data-vellira-theme='light']`,
    collectThemeCssOutput(lightTheme)
  );
  css += '\n';
  css += expectedThemeBlock(
    `[data-theme='dark'],\n[data-vellira-theme='dark']`,
    collectThemeCssOutput(darkTheme)
  );
  css += '\n';
  css += expectedThemeBlock(
    `[data-theme='high-contrast'],\n[data-vellira-theme='high-contrast']`,
    collectThemeCssOutput(highContrastTheme)
  );

  return css;
}

export function auditGeneratedTokenCssOutput(
  generated = generateTokenCss()
): { checked: number; findings: FindingInput[] } {
  const expected = createExpectedGeneratedTokenCss();
  if (generated === expected) return { checked: 1, findings: [] };

  return {
    checked: 1,
    findings: [
      finding(
        'generated-css-output-drift',
        'packages/tokens/scripts/token-css-output.ts',
        'generateTokenCss() no longer matches independently reconstructed canonical base/theme CSS output.',
        'Generated CSS must be assembled exclusively from collectBaseCssOutput()/collectThemeCssOutput() values serialized by the canonical #881 authority.'
      ),
    ],
  };
}

export function auditTokenCssGenerationWiring(root: string): {
  checked: number;
  findings: FindingInput[];
} {
  const findings: FindingInput[] = [];
  const generatorSource = fs.readFileSync(
    path.join(root, generatorSourcePath),
    'utf8'
  );
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(root, tokenPackagePath), 'utf8')
  ) as TokenPackage;
  const buildTokens = packageJson.scripts?.['build:tokens'];
  const cssExport = packageJson.exports?.['./css'];

  const checks = [
    {
      ok: /\bgenerateTokenCss\s*\(\s*\)/.test(generatorSource),
      code: 'css-generator-bypasses-canonical-output',
      sourcePath: generatorSourcePath,
      evidence: 'generate-css.ts does not call generateTokenCss().',
      expected:
        'The file-writing generator must consume generateTokenCss() from token-css-output.ts.',
    },
    {
      ok: generatorSource.includes("'../src/generated/tokens.css'"),
      code: 'source-css-output-path-missing',
      sourcePath: generatorSourcePath,
      evidence:
        'generate-css.ts no longer declares the source generated tokens.css path.',
      expected:
        'The generator must retain ../src/generated/tokens.css for build-time source consumers.',
    },
    {
      ok: generatorSource.includes("'../dist/css/tokens.css'"),
      code: 'published-css-output-path-missing',
      sourcePath: generatorSourcePath,
      evidence:
        'generate-css.ts no longer declares the published dist CSS path.',
      expected:
        'The generator must retain ../dist/css/tokens.css as the package CSS artifact.',
    },
    {
      ok:
        typeof buildTokens === 'string' &&
        buildTokens.includes('scripts/generate-css.ts'),
      code: 'package-build-skips-css-generation',
      sourcePath: tokenPackagePath,
      evidence: `build:tokens is ${JSON.stringify(buildTokens)}.`,
      expected:
        'The @vellira-ui/tokens build:tokens script must invoke scripts/generate-css.ts.',
    },
    {
      ok:
        typeof cssExport === 'object' &&
        cssExport !== null &&
        (cssExport as Record<string, unknown>).default ===
          './dist/css/tokens.css',
      code: 'package-css-export-bypasses-generated-artifact',
      sourcePath: tokenPackagePath,
      evidence: `./css export is ${JSON.stringify(cssExport)}.`,
      expected:
        'The public ./css export must resolve to ./dist/css/tokens.css generated by the canonical #881 pipeline.',
    },
  ];

  for (const check of checks) {
    if (!check.ok) {
      findings.push(
        finding(
          check.code,
          check.sourcePath,
          check.evidence,
          check.expected
        )
      );
    }
  }

  return { checked: checks.length, findings };
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

  const generatedCss = auditGeneratedTokenCssOutput();
  const generationWiring = auditTokenCssGenerationWiring(root);

  return {
    coverage: 'complete',
    scope,
    checked:
      results.reduce((total, result) => total + result.checked, 0) +
      generatedCss.checked +
      generationWiring.checked,
    findings: [
      ...results.flatMap((result) => result.findings),
      ...generatedCss.findings,
      ...generationWiring.findings,
    ],
  };
}

import fs from 'node:fs';
import path from 'node:path';

import {
  collectBaseCssOutput,
  collectThemeCssOutput,
  generateTokenCss,
} from '../../../packages/tokens/scripts/token-css-output';
import { darkTheme } from '../../../packages/tokens/src/dark/theme';
import {
  baseCssVariableNames,
  cssVariableNames,
  themeCssVariableNames,
} from '../../../packages/tokens/src/generated/token-types';
import { highContrastTheme } from '../../../packages/tokens/src/highContrast/theme';
import { lightTheme } from '../../../packages/tokens/src/light/theme';
import { requireGeneratedComponentNumericValueKind } from '../../generators/component/token-value-kinds';
import { renderComponentTokenFactoryTemplate } from '../../generators/component/templates/component-tokens';
import type { FindingInput, RuleResult } from './contract';

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
      'Repair the canonical #881 value-kind authority, generated registry, CSS output, or Generator V2 delegation instead of adding serializer exceptions.',
  };
}

function normalize(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}

export function auditRegistryParity(params: {
  code: string;
  sourcePath: string;
  label: string;
  actual: readonly string[];
  expected: readonly string[];
}): FindingInput[] {
  const actual = normalize(params.actual);
  const expected = normalize(params.expected);
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((value) => !actualSet.has(value));
  const extra = actual.filter((value) => !expectedSet.has(value));

  if (missing.length === 0 && extra.length === 0) return [];

  return [
    finding(
      params.code,
      params.sourcePath,
      `${params.label} registry drift: missing=${JSON.stringify(missing.slice(0, 12))}, extra=${JSON.stringify(extra.slice(0, 12))}.`,
      `${params.label} generated registry must exactly match variables emitted by the canonical #881 Web collector.`
    ),
  ];
}

type CssOutput = Map<string, { variable: string; value: string }>;

function renderDeclarations(output: CssOutput): string {
  return [...output.values()]
    .map(({ variable, value }) => `  ${variable}: ${value};\n`)
    .join('');
}

export function auditGeneratedCssOutput(params: {
  generated: string;
  blocks: readonly { selector: string; output: CssOutput }[];
}): FindingInput[] {
  const findings: FindingInput[] = [];

  for (const { selector, output } of params.blocks) {
    const expectedBlock = `${selector} {\n${renderDeclarations(output)}}\n`;
    if (!params.generated.includes(expectedBlock)) {
      findings.push(
        finding(
          'generated-css-output-drift',
          'packages/tokens/scripts/token-css-output.ts',
          `Generated CSS block for ${JSON.stringify(selector)} is not exact with the canonical collected variable/value map.`,
          'Every generated CSS selector block must serialize the complete collector output byte-for-byte with value-kind-aware values.'
        )
      );
    }
  }

  const expectedDeclarations = params.blocks.reduce(
    (count, { output }) => count + output.size,
    0
  );
  const actualDeclarations = params.generated.match(/^  --[^:]+: .*;$/gm)?.length ?? 0;
  if (actualDeclarations !== expectedDeclarations) {
    findings.push(
      finding(
        'generated-css-declaration-count-drift',
        'packages/tokens/scripts/token-css-output.ts',
        `Generated CSS contains ${actualDeclarations} declarations; canonical output maps require ${expectedDeclarations}.`,
        'Generated CSS must contain exactly the declarations represented by base and all maintained theme collector maps.'
      )
    );
  }

  return findings;
}

export function auditGeneratorValueKindIntegration(
  source: string
): FindingInput[] {
  const sourcePath = 'scripts/generators/component/templates/component-tokens.ts';
  const findings: FindingInput[] = [];

  if (!source.includes('requireGeneratedComponentNumericValueKind({')) {
    findings.push(
      finding(
        'generator-value-kind-wiring-missing',
        sourcePath,
        'Generator V2 token template no longer calls requireGeneratedComponentNumericValueKind.',
        'Generator V2 numeric component-token templates must delegate classification to the shared #881 token value-kind authority.'
      )
    );
  }

  try {
    const widthKind = requireGeneratedComponentNumericValueKind({
      componentName: 'SwitchAuditProbe',
      section: 'geometry',
      role: 'trackWidth',
      value: 44,
    });
    const scaleKind = requireGeneratedComponentNumericValueKind({
      componentName: 'SwitchAuditProbe',
      section: 'geometry',
      role: 'pressScale',
      value: 0.98,
    });

    if (widthKind !== 'length' || scaleKind !== 'scale') {
      findings.push(
        finding(
          'generator-value-kind-contract-drift',
          sourcePath,
          `Generator V2 classified trackWidth=${widthKind} and pressScale=${scaleKind}.`,
          'Representative generated geometry must preserve length vs unitless scale semantics through the shared #881 authority.'
        )
      );
    }
  } catch (error) {
    findings.push(
      finding(
        'generator-value-kind-contract-error',
        sourcePath,
        error instanceof Error ? error.message : String(error),
        'Representative Generator V2 numeric roles must be accepted by the canonical #881 authority.'
      )
    );
  }

  try {
    requireGeneratedComponentNumericValueKind({
      componentName: 'SwitchAuditProbe',
      section: 'geometry',
      role: 'unknownNumericRole',
      value: 0.7,
    });
    findings.push(
      finding(
        'generator-unknown-numeric-role-accepted',
        sourcePath,
        'Generator V2 accepted unknownNumericRole=0.7 without an explicit canonical value kind.',
        'Unknown generated numeric roles must fail closed instead of inheriting an incidental CSS unit.'
      )
    );
  } catch {
    // Expected: unknown generated numeric roles fail closed.
  }

  try {
    const rendered = renderComponentTokenFactoryTemplate({
      componentName: 'SwitchAuditProbe',
      profile: 'form-control',
      control: 'boolean',
    });
    if (
      !rendered.includes('trackWidth: 44,') ||
      !rendered.includes('pressScale: 0.98,') ||
      rendered.includes('pressScale: 0.98px')
    ) {
      findings.push(
        finding(
          'generator-value-representation-drift',
          sourcePath,
          'Generated boolean-control geometry no longer preserves numeric length/scale source representations.',
          'Generator V2 must emit numeric contracts and let #881 renderer serialization apply units by value kind.'
        )
      );
    }
  } catch (error) {
    findings.push(
      finding(
        'generator-value-template-error',
        sourcePath,
        error instanceof Error ? error.message : String(error),
        'The maintained boolean-control token template must render through the shared #881 classification contract.'
      )
    );
  }

  return findings;
}

function variablesFromOutput(output: CssOutput): string[] {
  return [...output.values()].map(({ variable }) => variable);
}

export function checkTokenValueKindOutputs(root: string): RuleResult {
  const findings: FindingInput[] = [];
  const baseOutput = collectBaseCssOutput();
  const lightOutput = collectThemeCssOutput(lightTheme);
  const darkOutput = collectThemeCssOutput(darkTheme);
  const highContrastOutput = collectThemeCssOutput(highContrastTheme);
  const themeOutputs = [lightOutput, darkOutput, highContrastOutput];
  const baseVariables = variablesFromOutput(baseOutput);
  const themeVariables = normalize(
    themeOutputs.flatMap((output) => variablesFromOutput(output))
  );
  const allVariables = normalize([...baseVariables, ...themeVariables]);

  findings.push(
    ...auditRegistryParity({
      code: 'base-css-variable-registry-drift',
      sourcePath: 'packages/tokens/src/generated/token-types.ts',
      label: 'Base CSS variable',
      actual: baseVariables,
      expected: baseCssVariableNames,
    }),
    ...auditRegistryParity({
      code: 'theme-css-variable-registry-drift',
      sourcePath: 'packages/tokens/src/generated/token-types.ts',
      label: 'Theme CSS variable',
      actual: themeVariables,
      expected: themeCssVariableNames,
    }),
    ...auditRegistryParity({
      code: 'css-variable-registry-drift',
      sourcePath: 'packages/tokens/src/generated/token-types.ts',
      label: 'Combined CSS variable',
      actual: allVariables,
      expected: cssVariableNames,
    })
  );

  findings.push(
    ...auditGeneratedCssOutput({
      generated: generateTokenCss(),
      blocks: [
        { selector: ':root', output: baseOutput },
        {
          selector: ":root,\n[data-theme='light'],\n[data-vellira-theme='light']",
          output: lightOutput,
        },
        {
          selector: "[data-theme='dark'],\n[data-vellira-theme='dark']",
          output: darkOutput,
        },
        {
          selector:
            "[data-theme='high-contrast'],\n[data-vellira-theme='high-contrast']",
          output: highContrastOutput,
        },
      ],
    })
  );

  const generatorTemplatePath = path.join(
    root,
    'scripts/generators/component/templates/component-tokens.ts'
  );
  const generatorSource = fs.existsSync(generatorTemplatePath)
    ? fs.readFileSync(generatorTemplatePath, 'utf8')
    : '';
  findings.push(...auditGeneratorValueKindIntegration(generatorSource));

  return {
    coverage: 'complete',
    scope:
      'Complete #881 output/generator proof: canonical Web collectors must exactly match generated CSS variable registries, every generated CSS selector block and declaration count must be exact with the collector maps, and Generator V2 must delegate numeric roles to the shared value-kind authority. Canonical scalar semantics remain owned by the companion repository inventory and value preservation by tokens.visual-preservation (#880).',
    checked:
      baseVariables.length + themeVariables.length + allVariables.length + 8,
    findings,
  };
}

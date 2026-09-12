import { darkTheme } from '../../../packages/tokens/src/dark/theme';
import { highContrastTheme } from '../../../packages/tokens/src/highContrast/theme';
import { lightTheme } from '../../../packages/tokens/src/light/theme';
import { isComponentPlatformIntent } from '../../../packages/tokens/src/platform-output/component-token-intents';
import type { FindingInput } from './contract';

const requiredShadowConsumers = [
  ['tooltip', 'content', 'shadow'],
  ['popover', 'content', 'shadow'],
  ['modal', 'content', 'shadow'],
  ['dropdown', 'content', 'shadow'],
  ['select', 'dropdown', 'shadow'],
] as const;

const rendererShadowFields = new Set([
  'shadowColor',
  'shadowOffset',
  'shadowOpacity',
  'shadowRadius',
  'elevation',
]);

function finding(
  code: string,
  sourcePath: string,
  tokenPath: string,
  theme: string,
  evidence: string,
  expected: string
): FindingInput {
  return {
    ruleId: 'tokens.shadow-authority',
    code,
    severity: 'error',
    sourcePath,
    tokenPath,
    line: null,
    column: null,
    layer: 'component',
    theme,
    platform: null,
    evidence,
    expected,
    migrationStatus: 'not-applicable',
    suggestedAction:
      'Use canonical ComponentShadowIntent values so Web and React Native resolve through the unified #885 shadow authority.',
  };
}

function readPath(value: unknown, segments: readonly string[]): unknown {
  let current = value;
  for (const segment of segments) {
    if (
      typeof current !== 'object' ||
      current === null ||
      Array.isArray(current)
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function auditComponentShadowConsumers(
  components: unknown,
  theme: string,
  sourcePath: string
): { checked: number; findings: FindingInput[] } {
  const findings: FindingInput[] = [];
  let checked = 0;

  for (const segments of requiredShadowConsumers) {
    checked += 1;
    const tokenPath = `components.${segments.join('.')}`;
    const value = readPath(components, segments);
    if (!(isComponentPlatformIntent(value) && value.kind === 'shadow')) {
      findings.push(
        finding(
          'required-component-shadow-not-intent',
          sourcePath,
          tokenPath,
          theme,
          `${tokenPath} is not a canonical shadow intent.`,
          'Tooltip, Popover, Modal, Dropdown and Select shadow consumers required by #885 must use canonical ComponentShadowIntent values.'
        )
      );
    }
  }

  function visit(value: unknown, tokenPath: string) {
    if (isComponentPlatformIntent(value)) return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${tokenPath}.${index}`));
      return;
    }
    if (typeof value !== 'object' || value === null) return;

    for (const [key, entry] of Object.entries(value)) {
      const childPath = `${tokenPath}.${key}`;

      if (rendererShadowFields.has(key)) {
        checked += 1;
        findings.push(
          finding(
            'renderer-shadow-field-in-component-token',
            sourcePath,
            childPath,
            theme,
            `Canonical component tokens contain renderer shadow field "${key}".`,
            'Renderer shadowColor/shadowOffset/shadowOpacity/shadowRadius/elevation fields must be emitted only by the #885 platform adapter.'
          )
        );
      }

      if (/shadow$/i.test(key)) {
        checked += 1;
        if (!(isComponentPlatformIntent(entry) && entry.kind === 'shadow')) {
          findings.push(
            finding(
              'authored-component-shadow-value',
              sourcePath,
              childPath,
              theme,
              `Canonical component shadow key "${childPath}" does not contain a shadow intent.`,
              'Canonical component shadow keys must carry ComponentShadowIntent values, never authored Web strings or native shadow objects.'
            )
          );
        }
      }

      visit(entry, childPath);
    }
  }

  visit(components, 'components');
  return { checked, findings };
}

export function checkComponentShadowConsumers(): {
  checked: number;
  findings: FindingInput[];
} {
  const themes = [
    ['light', 'light', lightTheme],
    ['dark', 'dark', darkTheme],
    ['high-contrast', 'highContrast', highContrastTheme],
  ] as const;
  const findings: FindingInput[] = [];
  let checked = 0;

  for (const [themeName, directory, theme] of themes) {
    const result = auditComponentShadowConsumers(
      theme.components,
      themeName,
      `packages/tokens/src/${directory}/components/index.ts`
    );
    checked += result.checked;
    findings.push(...result.findings);
  }

  return { checked, findings };
}

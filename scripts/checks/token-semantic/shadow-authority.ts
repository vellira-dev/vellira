import fs from 'node:fs';
import path from 'node:path';

import { darkTheme } from '../../../packages/tokens/src/dark/theme';
import {
  canonicalShadowEffects,
  createFocusRingShadowToken,
  createReactNativeShadowTokens,
  createSemanticShadowTokens,
  elevationShadowLevels,
  resolveReactNativeElevationShadow,
  serializeShadowEffectForWeb,
  shadowThemeNames,
  type ReactNativeShadowOutput,
  type ShadowEffect,
  type ShadowThemeName,
} from '../../../packages/tokens/src/effects/shadow-system';
import { highContrastTheme } from '../../../packages/tokens/src/highContrast/theme';
import { lightTheme } from '../../../packages/tokens/src/light/theme';
import type { FindingInput, RuleResult } from './contract';

function finding(
  code: string,
  sourcePath: string,
  tokenPath: string | null,
  theme: string | null,
  platform: string | null,
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
    layer: platform ? 'platform-output' : 'semantic',
    theme,
    platform,
    evidence,
    expected,
    migrationStatus: 'not-applicable',
    suggestedAction:
      'Derive shadow output from effects/shadow-system.ts instead of authoring a parallel shadow authority.',
  };
}

export function auditCanonicalShadowEffect(
  effect: ShadowEffect,
  tokenPath: string,
  theme: string | null
): FindingInput[] {
  try {
    serializeShadowEffectForWeb(effect);
    return [];
  } catch (error) {
    return [
      finding(
        'invalid-canonical-shadow-effect',
        'packages/tokens/src/effects/shadow-system.ts',
        tokenPath,
        theme,
        null,
        error instanceof Error ? error.message : String(error),
        'Canonical shadow effects must contain valid structured layers serializable by the #885 authority.'
      ),
    ];
  }
}

function auditNativeShadow(
  value: ReactNativeShadowOutput,
  level: string
): FindingInput[] {
  const valid =
    [value.x, value.y, value.blur, value.opacity, value.elevation].every(
      Number.isFinite
    ) &&
    value.blur >= 0 &&
    value.opacity >= 0 &&
    value.opacity <= 1 &&
    /^#[0-9a-f]{6}$/i.test(value.color);

  return valid
    ? []
    : [
        finding(
          'invalid-react-native-shadow-output',
          'packages/tokens/src/effects/shadow-system.ts',
          `tokens.shadows.${level}`,
          null,
          'react-native',
          `React Native ${level} shadow output is malformed.`,
          'React Native shadow approximations must resolve to finite structured output from the canonical #885 table.'
        ),
      ];
}

function readSource(root: string, sourcePath: string): string {
  return fs.readFileSync(path.join(root, sourcePath), 'utf8');
}

export function auditShadowDerivedSource(
  sourcePath: string,
  source: string
): FindingInput[] {
  const findings: FindingInput[] = [];

  if (
    /\/semantic\/(?:shadow|focus)\.ts$/.test(sourcePath) &&
    /rgba\(/.test(source)
  ) {
    findings.push(
      finding(
        'authored-semantic-shadow-string',
        sourcePath,
        null,
        null,
        'web',
        'Semantic shadow/focus source contains an authored rgba() shadow fragment.',
        'Semantic Web shadow strings must be serialized from canonicalShadowEffects.'
      )
    );
  }

  if (
    sourcePath.endsWith('/tokens/shadows.ts') &&
    /\b(?:x|y|blur|color|opacity|elevation)\s*:/.test(source)
  ) {
    findings.push(
      finding(
        'authored-native-shadow-output',
        sourcePath,
        null,
        null,
        'react-native',
        'Native compatibility shadow source authors renderer fields directly.',
        'Native compatibility output must be derived from the canonical #885 approximation table.'
      )
    );
  }

  if (
    sourcePath.endsWith('/platform-output/component-token-intents.ts') &&
    /theme\.(?:semantic\.shadow|tokens\.shadows)/.test(source)
  ) {
    findings.push(
      finding(
        'component-output-shadow-authority-bypass',
        sourcePath,
        null,
        null,
        null,
        'Component output adapter reaches a parallel theme shadow surface.',
        'Component shadow intents must resolve through the canonical #885 authority.'
      )
    );
  }

  return findings;
}

export function checkTokenShadowAuthority(root: string): RuleResult {
  const findings: FindingInput[] = [];
  let checked = 0;

  for (const level of elevationShadowLevels) {
    for (const themeName of shadowThemeNames) {
      checked += 1;
      findings.push(
        ...auditCanonicalShadowEffect(
          canonicalShadowEffects.elevation[level].themes[themeName],
          `shadow.elevation.${level}`,
          themeName
        )
      );
    }
  }

  for (const themeName of shadowThemeNames) {
    checked += 2;
    findings.push(
      ...auditCanonicalShadowEffect(
        canonicalShadowEffects.inset.themes[themeName],
        'shadow.inset',
        themeName
      ),
      ...auditCanonicalShadowEffect(
        canonicalShadowEffects.focusRing.themes[themeName],
        'shadow.focusRing',
        themeName
      )
    );
  }

  const themes = [
    ['light', lightTheme],
    ['dark', darkTheme],
    ['high-contrast', highContrastTheme],
  ] as const;

  for (const [themeName, theme] of themes) {
    const expectedShadows = createSemanticShadowTokens(
      themeName as ShadowThemeName
    );
    const expectedFocusRing = createFocusRingShadowToken(
      themeName as ShadowThemeName
    );

    for (const [role, expected] of Object.entries(expectedShadows)) {
      checked += 1;
      if (
        theme.semantic.shadow[role as keyof typeof expectedShadows] !== expected
      ) {
        findings.push(
          finding(
            'semantic-shadow-not-derived',
            `packages/tokens/src/${themeName === 'high-contrast' ? 'highContrast' : themeName}/theme.ts`,
            `semantic.shadow.${role}`,
            themeName,
            'web',
            `semantic.shadow.${role} does not equal the canonical #885 serializer output.`,
            'Semantic shadow roles must be generated from canonicalShadowEffects.'
          )
        );
      }
    }

    checked += 1;
    if (theme.semantic.focus.ring.shadow !== expectedFocusRing) {
      findings.push(
        finding(
          'focus-shadow-not-derived',
          `packages/tokens/src/${themeName === 'high-contrast' ? 'highContrast' : themeName}/theme.ts`,
          'semantic.focus.ring.shadow',
          themeName,
          'web',
          'Focus ring shadow does not equal the canonical #885 serializer output.',
          'Focus ring shadow must be generated from canonicalShadowEffects.focusRing.'
        )
      );
    }
  }

  const nativeShadows = createReactNativeShadowTokens();
  for (const [level, value] of Object.entries(nativeShadows)) {
    checked += 1;
    findings.push(...auditNativeShadow(value, level));
  }

  for (const level of elevationShadowLevels) {
    checked += 1;
    const approximation =
      canonicalShadowEffects.elevation[level].reactNativeApproximation;
    if (approximation.kind === 'reference') {
      const referenced = resolveReactNativeElevationShadow(approximation.level);
      const resolved = resolveReactNativeElevationShadow(level);
      if (JSON.stringify(resolved) !== JSON.stringify(referenced)) {
        findings.push(
          finding(
            'native-shadow-reference-mismatch',
            'packages/tokens/src/effects/shadow-system.ts',
            `shadow.elevation.${level}`,
            null,
            'react-native',
            `${level} does not resolve to its declared ${approximation.level} approximation.`,
            'Reference approximations must resolve through the canonical #885 table.'
          )
        );
      }
    } else {
      findings.push(...auditNativeShadow(approximation.output, level));
    }
  }

  const derivedSources = [
    'packages/tokens/src/light/semantic/shadow.ts',
    'packages/tokens/src/dark/semantic/shadow.ts',
    'packages/tokens/src/highContrast/semantic/shadow.ts',
    'packages/tokens/src/light/semantic/focus.ts',
    'packages/tokens/src/dark/semantic/focus.ts',
    'packages/tokens/src/highContrast/semantic/focus.ts',
    'packages/tokens/src/tokens/shadows.ts',
    'packages/tokens/src/platform-output/component-token-intents.ts',
  ];

  for (const sourcePath of derivedSources) {
    checked += 1;
    findings.push(
      ...auditShadowDerivedSource(sourcePath, readSource(root, sourcePath))
    );
  }

  return {
    coverage: 'partial',
    scope:
      'Canonical #885 structured effects, Web semantic/focus derivation, React Native approximation resolution, and known compatibility/output source bypasses. Exhaustive component-intent consumption and every downstream renderer representation remain covered by platform/preservation rules rather than duplicated here.',
    checked,
    findings,
  };
}

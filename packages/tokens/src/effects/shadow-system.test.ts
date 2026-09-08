import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  canonicalShadowEffects,
  createFocusRingShadowToken,
  createReactNativeShadowTokens,
  createSemanticShadowTokens,
  resolveReactNativeElevationShadow,
  serializeShadowEffectForWeb,
  type ShadowThemeName,
} from './shadow-system.js';

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);

const webPreservationCases = [
  {
    themeName: 'light',
    shadows: {
      sm: '0 1px 2px rgba(24, 21, 33, 0.08)',
      md: '0 4px 12px rgba(24, 21, 33, 0.12)',
      lg: '0 12px 40px rgba(24, 21, 33, 0.16), 0 2px 8px rgba(24, 21, 33, 0.1)',
      xl: '0 20px 60px rgba(24, 21, 33, 0.2), 0 4px 16px rgba(24, 21, 33, 0.14)',
      inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.55)',
    },
    focusRing: '0 0 8px rgba(99, 70, 232, 0.14)',
  },
  {
    themeName: 'dark',
    shadows: {
      sm: '0 1px 2px rgba(0, 0, 0, 0.12)',
      md: '0 4px 12px rgba(0, 0, 0, 0.22)',
      lg: '0 12px 40px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.25)',
      xl: '0 20px 60px rgba(0, 0, 0, 0.45), 0 4px 16px rgba(0, 0, 0, 0.3)',
      inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
    },
    focusRing: '0 0 8px rgba(184, 168, 255, 0.14)',
  },
  {
    themeName: 'high-contrast',
    shadows: {
      sm: '0 1px 2px rgba(0, 0, 0, 0.5)',
      md: '0 4px 12px rgba(0, 0, 0, 0.6)',
      lg: '0 12px 40px rgba(0, 0, 0, 0.7)',
      xl: '0 20px 60px rgba(0, 0, 0, 0.8)',
      inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.14)',
    },
    focusRing: '0 0 0 1px rgba(255, 255, 255, 0.28)',
  },
] as const satisfies readonly {
  themeName: ShadowThemeName;
  shadows: Readonly<Record<'sm' | 'md' | 'lg' | 'xl' | 'inset', string>>;
  focusRing: string;
}[];

describe('canonical shadow/elevation system', () => {
  for (const { themeName, shadows, focusRing } of webPreservationCases) {
    it(`preserves exact Web shadow output for ${themeName}`, () => {
      expect(createSemanticShadowTokens(themeName)).toEqual(shadows);
      expect(createFocusRingShadowToken(themeName)).toBe(focusRing);
    });
  }

  it('represents multi-layer, spread, and inset effects structurally', () => {
    expect(
      canonicalShadowEffects.elevation.lg.themes.light.layers
    ).toHaveLength(2);
    expect(canonicalShadowEffects.elevation.xl.themes.dark.layers).toHaveLength(
      2
    );
    expect(canonicalShadowEffects.inset.themes.light.layers[0]).toMatchObject({
      inset: true,
      spread: 0,
    });
    expect(
      canonicalShadowEffects.focusRing.themes['high-contrast'].layers[0]
    ).toMatchObject({ blur: 0, spread: 1, inset: false });
  });

  it('preserves the existing native shadow outputs from one canonical approximation table', () => {
    const expected = {
      sm: {
        x: 0,
        y: 1,
        blur: 3,
        color: '#000000',
        opacity: 0.04,
        elevation: 1,
      },
      md: {
        x: 0,
        y: 6,
        blur: 16,
        color: '#000000',
        opacity: 0.08,
        elevation: 4,
      },
      lg: {
        x: 0,
        y: 12,
        blur: 32,
        color: '#000000',
        opacity: 0.1,
        elevation: 8,
      },
    } as const;

    expect(createReactNativeShadowTokens()).toEqual(expected);
    expect(resolveReactNativeElevationShadow('xl')).toEqual(expected.lg);
    expect(
      canonicalShadowEffects.elevation.xl.reactNativeApproximation
    ).toMatchObject({ kind: 'reference', level: 'lg' });
  });

  it('rejects malformed structured effects instead of emitting invalid CSS', () => {
    expect(() => serializeShadowEffectForWeb({ layers: [] })).toThrow(
      /at least one layer/
    );
    expect(() =>
      serializeShadowEffectForWeb({
        layers: [
          {
            x: 0,
            y: 1,
            blur: 2,
            spread: 0,
            color: '#000000',
            opacity: 1.1,
            inset: false,
          },
        ],
      })
    ).toThrow(/opacity/);
    expect(() =>
      serializeShadowEffectForWeb({
        layers: [
          {
            x: 0,
            y: 1,
            blur: 2,
            spread: 0,
            color: 'black',
            opacity: 0.1,
            inset: false,
          },
        ],
      })
    ).toThrow(/six-digit hex/);
  });

  it('keeps legacy Web/native compatibility surfaces derived instead of authored', () => {
    const semanticSources = [
      'src/light/semantic/shadow.ts',
      'src/dark/semantic/shadow.ts',
      'src/highContrast/semantic/shadow.ts',
      'src/light/semantic/focus.ts',
      'src/dark/semantic/focus.ts',
      'src/highContrast/semantic/focus.ts',
    ];

    for (const sourcePath of semanticSources) {
      const source = fs.readFileSync(
        path.join(packageRoot, sourcePath),
        'utf8'
      );
      expect(source, sourcePath).not.toMatch(/rgba\(/);
    }

    const nativeCompatibilitySource = fs.readFileSync(
      path.join(packageRoot, 'src/tokens/shadows.ts'),
      'utf8'
    );
    expect(nativeCompatibilitySource).not.toMatch(
      /\b(?:x|y|blur|color|opacity|elevation):/
    );

    const componentOutputSource = fs.readFileSync(
      path.join(packageRoot, 'src/platform-output/component-token-intents.ts'),
      'utf8'
    );
    expect(componentOutputSource).not.toContain('theme.semantic.shadow');
    expect(componentOutputSource).not.toContain('theme.tokens.shadows');
  });
});

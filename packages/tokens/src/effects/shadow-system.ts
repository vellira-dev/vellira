import { colors } from '../primitives/colors.js';

export const shadowThemeNames = ['light', 'dark', 'high-contrast'] as const;
export type ShadowThemeName = (typeof shadowThemeNames)[number];

export const elevationShadowLevels = ['sm', 'md', 'lg', 'xl'] as const;
export type ElevationShadowLevel = (typeof elevationShadowLevels)[number];

export type ShadowLayer = Readonly<{
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
  inset: boolean;
}>;

export type ShadowEffect = Readonly<{
  layers: readonly ShadowLayer[];
}>;

export type ReactNativeShadowOutput = Readonly<{
  x: number;
  y: number;
  blur: number;
  color: string;
  opacity: number;
  elevation: number;
}>;

type ReactNativeDirectApproximation = Readonly<{
  kind: 'direct';
  output: ReactNativeShadowOutput;
}>;

type ReactNativeReferenceApproximation = Readonly<{
  kind: 'reference';
  level: Exclude<ElevationShadowLevel, 'xl'>;
  reason: string;
}>;

type ReactNativeElevationApproximation =
  ReactNativeDirectApproximation | ReactNativeReferenceApproximation;

type ThemedShadowEffect = Readonly<Record<ShadowThemeName, ShadowEffect>>;

type CanonicalElevationRole = Readonly<{
  themes: ThemedShadowEffect;
  reactNativeApproximation: ReactNativeElevationApproximation;
}>;

type CanonicalShadowEffects = Readonly<{
  elevation: Readonly<Record<ElevationShadowLevel, CanonicalElevationRole>>;
  inset: Readonly<{ themes: ThemedShadowEffect }>;
  focusRing: Readonly<{ themes: ThemedShadowEffect }>;
}>;

const effect = (...layers: ShadowLayer[]): ShadowEffect => ({ layers });

const layer = (
  x: number,
  y: number,
  blur: number,
  spread: number,
  color: string,
  opacity: number,
  inset = false
): ShadowLayer => ({ x, y, blur, spread, color, opacity, inset });

const nativeShadow = (
  x: number,
  y: number,
  blur: number,
  color: string,
  opacity: number,
  elevation: number
): ReactNativeShadowOutput => ({ x, y, blur, color, opacity, elevation });

const nativeSm = nativeShadow(0, 1, 3, colors.mono[950], 0.04, 1);
const nativeMd = nativeShadow(0, 6, 16, colors.mono[950], 0.08, 4);
const nativeLg = nativeShadow(0, 12, 32, colors.mono[950], 0.1, 8);

export const canonicalShadowEffects = {
  elevation: {
    sm: {
      themes: {
        light: effect(layer(0, 1, 2, 0, colors.vellira[950], 0.08)),
        dark: effect(layer(0, 1, 2, 0, colors.mono[950], 0.12)),
        'high-contrast': effect(layer(0, 1, 2, 0, colors.mono[950], 0.5)),
      },
      reactNativeApproximation: { kind: 'direct', output: nativeSm },
    },
    md: {
      themes: {
        light: effect(layer(0, 4, 12, 0, colors.vellira[950], 0.12)),
        dark: effect(layer(0, 4, 12, 0, colors.mono[950], 0.22)),
        'high-contrast': effect(layer(0, 4, 12, 0, colors.mono[950], 0.6)),
      },
      reactNativeApproximation: { kind: 'direct', output: nativeMd },
    },
    lg: {
      themes: {
        light: effect(
          layer(0, 12, 40, 0, colors.vellira[950], 0.16),
          layer(0, 2, 8, 0, colors.vellira[950], 0.1)
        ),
        dark: effect(
          layer(0, 12, 40, 0, colors.mono[950], 0.35),
          layer(0, 2, 8, 0, colors.mono[950], 0.25)
        ),
        'high-contrast': effect(layer(0, 12, 40, 0, colors.mono[950], 0.7)),
      },
      reactNativeApproximation: { kind: 'direct', output: nativeLg },
    },
    xl: {
      themes: {
        light: effect(
          layer(0, 20, 60, 0, colors.vellira[950], 0.2),
          layer(0, 4, 16, 0, colors.vellira[950], 0.14)
        ),
        dark: effect(
          layer(0, 20, 60, 0, colors.mono[950], 0.45),
          layer(0, 4, 16, 0, colors.mono[950], 0.3)
        ),
        'high-contrast': effect(layer(0, 20, 60, 0, colors.mono[950], 0.8)),
      },
      reactNativeApproximation: {
        kind: 'reference',
        level: 'lg',
        reason:
          'React Native preserves the pre-unification Modal output by approximating xl with lg.',
      },
    },
  },
  inset: {
    themes: {
      light: effect(layer(0, 1, 0, 0, colors.mono[50], 0.55, true)),
      dark: effect(layer(0, 1, 0, 0, colors.mono[50], 0.06, true)),
      'high-contrast': effect(layer(0, 1, 0, 0, colors.mono[50], 0.14, true)),
    },
  },
  focusRing: {
    themes: {
      light: effect(layer(0, 0, 8, 0, colors.primary[600], 0.14)),
      dark: effect(layer(0, 0, 8, 0, colors.primary[300], 0.14)),
      'high-contrast': effect(layer(0, 0, 0, 1, colors.mono[50], 0.28)),
    },
  },
} as const satisfies CanonicalShadowEffects;

function parseHexColor(color: string): readonly [number, number, number] {
  const match = color.match(/^#([0-9a-f]{6})$/i);

  if (!match) {
    throw new Error(
      `Shadow layer color must be a six-digit hex value, received ${color}.`
    );
  }

  const value = match[1]!;
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function formatLength(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Shadow length must be finite, received ${value}.`);
  }

  return value === 0 ? '0' : `${value}px`;
}

function serializeLayerForWeb(value: ShadowLayer): string {
  if (!Number.isFinite(value.blur) || value.blur < 0) {
    throw new Error(
      `Shadow blur must be finite and non-negative, received ${value.blur}.`
    );
  }

  if (
    !Number.isFinite(value.opacity) ||
    value.opacity < 0 ||
    value.opacity > 1
  ) {
    throw new Error(
      `Shadow opacity must be finite and within [0, 1], received ${value.opacity}.`
    );
  }

  const [red, green, blue] = parseHexColor(value.color);
  const lengths = [
    formatLength(value.x),
    formatLength(value.y),
    formatLength(value.blur),
  ];

  if (value.spread !== 0) {
    lengths.push(formatLength(value.spread));
  }

  const color = `rgba(${red}, ${green}, ${blue}, ${value.opacity})`;
  return `${value.inset ? 'inset ' : ''}${lengths.join(' ')} ${color}`;
}

export function serializeShadowEffectForWeb(value: ShadowEffect): string {
  if (value.layers.length === 0) {
    throw new Error('Shadow effect must contain at least one layer.');
  }

  return value.layers.map(serializeLayerForWeb).join(', ');
}

export function createSemanticShadowTokens(themeName: ShadowThemeName) {
  return {
    sm: serializeShadowEffectForWeb(
      canonicalShadowEffects.elevation.sm.themes[themeName]
    ),
    md: serializeShadowEffectForWeb(
      canonicalShadowEffects.elevation.md.themes[themeName]
    ),
    lg: serializeShadowEffectForWeb(
      canonicalShadowEffects.elevation.lg.themes[themeName]
    ),
    xl: serializeShadowEffectForWeb(
      canonicalShadowEffects.elevation.xl.themes[themeName]
    ),
    inset: serializeShadowEffectForWeb(
      canonicalShadowEffects.inset.themes[themeName]
    ),
  } as const;
}

export function createFocusRingShadowToken(themeName: ShadowThemeName): string {
  return serializeShadowEffectForWeb(
    canonicalShadowEffects.focusRing.themes[themeName]
  );
}

export function resolveReactNativeElevationShadow(
  level: ElevationShadowLevel
): ReactNativeShadowOutput {
  const approximation =
    canonicalShadowEffects.elevation[level].reactNativeApproximation;

  if (approximation.kind === 'direct') {
    return approximation.output;
  }

  return resolveReactNativeElevationShadow(approximation.level);
}

export function createReactNativeShadowTokens() {
  return {
    sm: resolveReactNativeElevationShadow('sm'),
    md: resolveReactNativeElevationShadow('md'),
    lg: resolveReactNativeElevationShadow('lg'),
  } as const;
}

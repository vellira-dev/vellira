import type { NativeTheme } from './themes';

const componentShadowLevels = ['sm', 'md', 'lg', 'xl'] as const;

type ComponentShadowLevel = (typeof componentShadowLevels)[number];

type ComponentElevationShadowIntent = Readonly<{
  kind: 'shadow';
  role: 'elevation';
  level: ComponentShadowLevel;
}>;

type ComponentFocusRingShadowIntent = Readonly<{
  kind: 'shadow';
  role: 'focus-ring';
}>;

type ComponentNoShadowIntent = Readonly<{
  kind: 'shadow';
  role: 'none';
}>;

type ComponentViewportHeightIntent = Readonly<{
  kind: 'viewport-height';
  ratio: number;
}>;

type ComponentPlatformIntent =
  | ComponentElevationShadowIntent
  | ComponentFocusRingShadowIntent
  | ComponentNoShadowIntent
  | ComponentViewportHeightIntent;

type ReactNativeShadowOutput =
  NativeTheme['tokens']['shadows'][keyof NativeTheme['tokens']['shadows']];

type ReactNativeShadowLevel = keyof NativeTheme['tokens']['shadows'];

const reactNativeShadowApproximationLevel = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'lg',
} as const satisfies Readonly<
  Record<ComponentShadowLevel, ReactNativeShadowLevel>
>;

type WebAdaptedIntent<T> = T extends ComponentPlatformIntent ? string : never;

type ReactNativeAdaptedIntent<T> = T extends ComponentElevationShadowIntent
  ? ReactNativeShadowOutput
  : T extends ComponentFocusRingShadowIntent | ComponentNoShadowIntent
    ? null
    : T extends ComponentViewportHeightIntent
      ? string
      : never;

type WebComponentTokens<T> = T extends ComponentPlatformIntent
  ? WebAdaptedIntent<T>
  : T extends readonly (infer TEntry)[]
    ? readonly WebComponentTokens<TEntry>[]
    : T extends object
      ? { readonly [K in keyof T]: WebComponentTokens<T[K]> }
      : T;

type ReactNativeComponentTokens<T> = T extends ComponentPlatformIntent
  ? ReactNativeAdaptedIntent<T>
  : T extends readonly (infer TEntry)[]
    ? readonly ReactNativeComponentTokens<TEntry>[]
    : T extends object
      ? { readonly [K in keyof T]: ReactNativeComponentTokens<T[K]> }
      : T;

function hasExactKeys(
  candidate: Record<string, unknown>,
  expectedKeys: readonly string[]
): boolean {
  const actualKeys = Object.keys(candidate);

  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key) => expectedKeys.includes(key))
  );
}

function isComponentPlatformIntent(
  value: unknown
): value is ComponentPlatformIntent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (candidate.kind === 'shadow') {
    if (candidate.role === 'focus-ring' || candidate.role === 'none') {
      return hasExactKeys(candidate, ['kind', 'role']);
    }

    return (
      candidate.role === 'elevation' &&
      hasExactKeys(candidate, ['kind', 'role', 'level']) &&
      typeof candidate.level === 'string' &&
      componentShadowLevels.includes(candidate.level as ComponentShadowLevel)
    );
  }

  return (
    candidate.kind === 'viewport-height' &&
    hasExactKeys(candidate, ['kind', 'ratio']) &&
    typeof candidate.ratio === 'number' &&
    Number.isFinite(candidate.ratio) &&
    candidate.ratio > 0 &&
    candidate.ratio <= 1
  );
}

function formatPercentage(ratio: number): string {
  const percentage = ratio * 100;

  return Number.isInteger(percentage)
    ? String(percentage)
    : String(Number(percentage.toFixed(4)));
}

function resolveIntentForWeb(
  theme: NativeTheme,
  intent: ComponentPlatformIntent
): string {
  if (intent.kind === 'viewport-height') {
    return `${formatPercentage(intent.ratio)}vh`;
  }

  if (intent.role === 'focus-ring') return theme.semantic.focus.ring.shadow;
  if (intent.role === 'none') return 'none';
  return theme.semantic.shadow[intent.level];
}

function resolveIntentForReactNative(
  theme: NativeTheme,
  intent: ComponentPlatformIntent
): string | ReactNativeShadowOutput | null {
  if (intent.kind === 'viewport-height') {
    return `${formatPercentage(intent.ratio)}%`;
  }

  if (intent.role === 'focus-ring' || intent.role === 'none') return null;

  // The numeric output is derived from the canonical #885 shadow model inside
  // @vellira-ui/tokens. This renderer-owned map only expresses the documented
  // RN approximation policy: xl preserves the historical lg native effect.
  const nativeLevel = reactNativeShadowApproximationLevel[intent.level];
  return theme.tokens.shadows[nativeLevel];
}

function adaptComponentTokenTree(
  value: unknown,
  resolveIntent: (intent: ComponentPlatformIntent) => unknown
): unknown {
  if (isComponentPlatformIntent(value)) {
    return resolveIntent(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => adaptComponentTokenTree(entry, resolveIntent));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        adaptComponentTokenTree(entry, resolveIntent),
      ])
    );
  }

  return value;
}

export function resolveComponentTokenPlatformOutputs<T>(
  theme: NativeTheme,
  componentTokens: T
) {
  return {
    web: adaptComponentTokenTree(componentTokens, (intent) =>
      resolveIntentForWeb(theme, intent)
    ) as WebComponentTokens<T>,
    reactNative: adaptComponentTokenTree(componentTokens, (intent) =>
      resolveIntentForReactNative(theme, intent)
    ) as ReactNativeComponentTokens<T>,
  } as const;
}

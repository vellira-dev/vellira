import {
  createFocusRingShadowToken,
  createSemanticShadowTokens,
  type ElevationShadowLevel,
  elevationShadowLevels,
  type ReactNativeShadowOutput as CanonicalReactNativeShadowOutput,
  resolveReactNativeElevationShadow,
  type ShadowThemeName,
} from '../effects/shadow-system.js';

export const componentShadowLevels = elevationShadowLevels;

export type ComponentShadowLevel = ElevationShadowLevel;

export type ComponentElevationShadowIntent = Readonly<{
  kind: 'shadow';
  role: 'elevation';
  level: ComponentShadowLevel;
}>;

export type ComponentFocusRingShadowIntent = Readonly<{
  kind: 'shadow';
  role: 'focus-ring';
}>;

export type ComponentNoShadowIntent = Readonly<{
  kind: 'shadow';
  role: 'none';
}>;

export type ComponentShadowIntent =
  | ComponentElevationShadowIntent
  | ComponentFocusRingShadowIntent
  | ComponentNoShadowIntent;

export type ComponentViewportHeightIntent = Readonly<{
  kind: 'viewport-height';
  ratio: number;
}>;

export type ComponentPlatformIntent =
  ComponentShadowIntent | ComponentViewportHeightIntent;

export type ReactNativeShadowOutput = CanonicalReactNativeShadowOutput;

export type ComponentPlatformOutputSources = Readonly<{
  web: {
    shadow: Readonly<Record<ComponentShadowLevel, string>>;
    focusRingShadow: string;
  };
  reactNative: {
    shadow: Readonly<Record<ComponentShadowLevel, ReactNativeShadowOutput>>;
  };
}>;

type ComponentOutputThemeSources = Readonly<{
  name: ShadowThemeName;
}>;

type WebAdaptedIntent<T> = T extends ComponentPlatformIntent ? string : never;

type ReactNativeAdaptedIntent<T> = T extends ComponentElevationShadowIntent
  ? ReactNativeShadowOutput
  : T extends ComponentFocusRingShadowIntent | ComponentNoShadowIntent
    ? null
    : T extends ComponentViewportHeightIntent
      ? string
      : never;

export type WebComponentTokens<T> = T extends ComponentPlatformIntent
  ? WebAdaptedIntent<T>
  : T extends readonly (infer TEntry)[]
    ? readonly WebComponentTokens<TEntry>[]
    : T extends object
      ? { readonly [K in keyof T]: WebComponentTokens<T[K]> }
      : T;

export type ReactNativeComponentTokens<T> = T extends ComponentPlatformIntent
  ? ReactNativeAdaptedIntent<T>
  : T extends readonly (infer TEntry)[]
    ? readonly ReactNativeComponentTokens<TEntry>[]
    : T extends object
      ? { readonly [K in keyof T]: ReactNativeComponentTokens<T[K]> }
      : T;

export function createComponentShadowIntent(
  level: ComponentShadowLevel
): ComponentElevationShadowIntent {
  return { kind: 'shadow', role: 'elevation', level };
}

export function createComponentFocusRingShadowIntent(): ComponentFocusRingShadowIntent {
  return { kind: 'shadow', role: 'focus-ring' };
}

export function createComponentNoShadowIntent(): ComponentNoShadowIntent {
  return { kind: 'shadow', role: 'none' };
}

export function createComponentViewportHeightIntent(
  ratio: number
): ComponentViewportHeightIntent {
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1) {
    throw new Error(
      `Component viewport-height ratio must be finite and within (0, 1], received ${ratio}.`
    );
  }

  return { kind: 'viewport-height', ratio };
}

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

export function isComponentPlatformIntent(
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

export function createComponentPlatformOutputSources(
  theme: ComponentOutputThemeSources
): ComponentPlatformOutputSources {
  const shadow = createSemanticShadowTokens(theme.name);

  return {
    web: {
      shadow: {
        sm: shadow.sm,
        md: shadow.md,
        lg: shadow.lg,
        xl: shadow.xl,
      },
      focusRingShadow: createFocusRingShadowToken(theme.name),
    },
    reactNative: {
      shadow: {
        sm: resolveReactNativeElevationShadow('sm'),
        md: resolveReactNativeElevationShadow('md'),
        lg: resolveReactNativeElevationShadow('lg'),
        xl: resolveReactNativeElevationShadow('xl'),
      },
    },
  };
}

function formatPercentage(ratio: number): string {
  const percentage = ratio * 100;
  return Number.isInteger(percentage)
    ? String(percentage)
    : String(Number(percentage.toFixed(4)));
}

export function resolveComponentIntentForWeb(
  intent: ComponentPlatformIntent,
  sources: ComponentPlatformOutputSources
): string {
  if (intent.kind === 'viewport-height') {
    return `${formatPercentage(intent.ratio)}vh`;
  }

  if (intent.role === 'focus-ring') return sources.web.focusRingShadow;
  if (intent.role === 'none') return 'none';
  return sources.web.shadow[intent.level];
}

export function resolveComponentIntentForReactNative(
  intent: ComponentPlatformIntent,
  sources: ComponentPlatformOutputSources
): string | ReactNativeShadowOutput | null {
  if (intent.kind === 'viewport-height') {
    return `${formatPercentage(intent.ratio)}%`;
  }

  if (intent.role === 'focus-ring' || intent.role === 'none') return null;
  return sources.reactNative.shadow[intent.level];
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

export function adaptComponentTokensForWeb<T>(
  components: T,
  sources: ComponentPlatformOutputSources
): WebComponentTokens<T> {
  return adaptComponentTokenTree(components, (intent) =>
    resolveComponentIntentForWeb(intent, sources)
  ) as WebComponentTokens<T>;
}

export function adaptComponentTokensForReactNative<T>(
  components: T,
  sources: ComponentPlatformOutputSources
): ReactNativeComponentTokens<T> {
  return adaptComponentTokenTree(components, (intent) =>
    resolveComponentIntentForReactNative(intent, sources)
  ) as ReactNativeComponentTokens<T>;
}

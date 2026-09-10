import { darkTheme } from '../src/dark/theme.js';
import { highContrastTheme } from '../src/highContrast/theme.js';
import { lightTheme } from '../src/light/theme.js';
import {
  adaptComponentTokensForWeb,
  createComponentPlatformOutputSources,
} from '../src/platform-output/component-token-intents.js';
import { componentTokenWebCompatibilityAliases } from '../src/platform-output/component-token-web-compatibility.js';
import {
  requireTokenValueKind,
  tokenValueKindWebContract,
} from '../src/token-architecture.js';
import { radius } from '../src/tokens/radius';
import { shadows } from '../src/tokens/shadows';
import { spacing } from '../src/tokens/spacing';
import { typography } from '../src/tokens/typography';
import { zIndex } from '../src/tokens/zIndex';

type Theme = typeof lightTheme | typeof darkTheme | typeof highContrastTheme;

type CssOutputEntry = {
  variable: string;
  value: string;
};

type ShadowToken = {
  x: number;
  y: number;
  blur: number;
  opacity: number;
  color: string;
};

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d+)/g, '$1-$2')
    .toLowerCase();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateStringValue(tokenPath: string, value: string): void {
  const kind = requireTokenValueKind(tokenPath, value);

  if (['unitless-number', 'opacity', 'scale', 'z-index'].includes(kind)) {
    throw new Error(
      `${tokenPath} is a numeric ${kind} token stored as a string. Use a number so renderer adapters can serialize it correctly.`
    );
  }

  if (kind === 'duration' && !/^\d*\.?\d+(?:ms|s)$/.test(value.trim())) {
    throw new Error(
      `${tokenPath} must use a valid CSS duration such as "150ms" or "0.2s".`
    );
  }

  if (
    kind === 'easing' &&
    !/^(?:linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\([^)]*\)|steps\([^)]*\))$/.test(
      value.trim()
    )
  ) {
    throw new Error(
      `${tokenPath} must use a valid canonical CSS easing representation.`
    );
  }
}

export function serializeCssTokenValue(
  tokenPath: string,
  value: string | number
): string {
  const kind = requireTokenValueKind(tokenPath, value);

  if (typeof value === 'string') {
    validateStringValue(tokenPath, value);
    return value;
  }

  if (!Number.isFinite(value)) {
    throw new Error(`${tokenPath} must be a finite numeric token value.`);
  }

  if (kind === 'opacity' && (value < 0 || value > 1)) {
    throw new Error(`${tokenPath} opacity must be between 0 and 1.`);
  }

  if (kind === 'scale' && value < 0) {
    throw new Error(`${tokenPath} scale must be zero or greater.`);
  }

  if (kind === 'z-index' && !Number.isInteger(value)) {
    throw new Error(`${tokenPath} z-index/order must be an integer.`);
  }

  if (kind === 'duration' && value < 0) {
    throw new Error(`${tokenPath} duration must be zero or greater.`);
  }

  const numericUnit = tokenValueKindWebContract[kind].numericUnit;

  if (numericUnit === null) {
    throw new Error(
      `${tokenPath} has numeric value ${value}, but ${kind} does not define numeric Web serialization.`
    );
  }

  return `${value}${numericUnit}`;
}

function collectVariables(
  obj: Record<string, unknown>,
  cssPrefix: string,
  tokenPrefix: string,
  output: Map<string, CssOutputEntry>
): void {
  for (const [key, value] of Object.entries(obj)) {
    const cssName = cssPrefix
      ? `${cssPrefix}-${toKebabCase(key)}`
      : toKebabCase(key);
    const tokenPath = tokenPrefix ? `${tokenPrefix}.${key}` : key;

    if (typeof value === 'string' || typeof value === 'number') {
      output.set(tokenPath, {
        variable: `--${cssName}`,
        value: serializeCssTokenValue(tokenPath, value),
      });
      continue;
    }

    if (isPlainObject(value)) {
      collectVariables(value, cssName, tokenPath, output);
    }
  }
}

function collectShadowVariables(
  source: Record<string, ShadowToken>,
  output: Map<string, CssOutputEntry>
): void {
  for (const [key, shadow] of Object.entries(source)) {
    const tokenPath = `tokens.shadows.${key}`;
    const x = serializeCssTokenValue(`${tokenPath}.x`, shadow.x);
    const y = serializeCssTokenValue(`${tokenPath}.y`, shadow.y);
    const blur = serializeCssTokenValue(`${tokenPath}.blur`, shadow.blur);
    const opacity = serializeCssTokenValue(
      `${tokenPath}.opacity`,
      shadow.opacity
    );
    const shadowColor = serializeCssTokenValue(
      `${tokenPath}.color`,
      shadow.color
    );
    const color =
      shadowColor === '#000' || shadowColor === '#000000'
        ? `rgba(0,0,0,${opacity})`
        : shadowColor;

    output.set(tokenPath, {
      variable: `--shadow-${key}`,
      value: `${x} ${y} ${blur} ${color}`,
    });
  }
}

export function collectBaseCssOutput(): Map<string, CssOutputEntry> {
  const output = new Map<string, CssOutputEntry>();

  collectVariables(spacing, 'space', 'tokens.spacing', output);
  collectVariables(radius, 'radius', 'tokens.radius', output);
  collectVariables(zIndex, 'z-index', 'tokens.zIndex', output);
  collectVariables(
    typography.family,
    'font-family',
    'tokens.typography.family',
    output
  );
  collectVariables(
    typography.weight,
    'font-weight',
    'tokens.typography.weight',
    output
  );
  collectVariables(
    typography.size,
    'font-size',
    'tokens.typography.size',
    output
  );
  collectVariables(
    typography.lineHeight,
    'line-height',
    'tokens.typography.lineHeight',
    output
  );
  collectShadowVariables(shadows, output);

  return output;
}

function collectComponentWebCompatibilityAliases(
  theme: Theme,
  output: Map<string, CssOutputEntry>
): void {
  const nativeShadow = shadows.lg;
  const legacyValues = new Map<string, string | number>([
    ['components.modal.content.nativeMaxHeight', '90%'],
    ['components.popover.content.shadow.web', theme.semantic.shadow.lg],
    ['components.popover.content.shadow.native.x', nativeShadow.x],
    ['components.popover.content.shadow.native.y', nativeShadow.y],
    ['components.popover.content.shadow.native.blur', nativeShadow.blur],
    ['components.popover.content.shadow.native.color', nativeShadow.color],
    ['components.popover.content.shadow.native.opacity', nativeShadow.opacity],
    [
      'components.popover.content.shadow.native.elevation',
      nativeShadow.elevation,
    ],
  ]);

  for (const alias of componentTokenWebCompatibilityAliases) {
    const value = legacyValues.get(alias.path);

    if (value === undefined) {
      throw new Error(`Missing Web compatibility value for ${alias.path}.`);
    }

    output.set(alias.path, {
      variable: alias.variable,
      value: serializeCssTokenValue(alias.path, value),
    });
  }
}

export function collectThemeCssOutput(
  theme: Theme
): Map<string, CssOutputEntry> {
  const output = new Map<string, CssOutputEntry>();

  collectVariables(theme.colors, 'color', 'colors', output);
  collectVariables(theme.semantic, '', 'semantic', output);
  const webComponents = adaptComponentTokensForWeb(
    theme.components,
    createComponentPlatformOutputSources(theme)
  );
  collectVariables(webComponents, '', 'components', output);
  collectComponentWebCompatibilityAliases(theme, output);

  return output;
}

export function collectResolvedWebCssOutput(theme: Theme): Map<string, string> {
  return new Map(
    [...collectBaseCssOutput(), ...collectThemeCssOutput(theme)].map(
      ([path, entry]) => [path, JSON.stringify([entry.variable, entry.value])]
    )
  );
}

function renderVariables(output: Map<string, CssOutputEntry>): string {
  let css = '';

  for (const { variable, value } of output.values()) {
    css += `  ${variable}: ${value};\n`;
  }

  return css;
}

function generateThemeBlock(selector: string, theme: Theme): string {
  return `${selector} {\n${renderVariables(collectThemeCssOutput(theme))}}\n`;
}

export function generateTokenCss(): string {
  let css = `/**
 * AUTO-GENERATED FILE
 * DO NOT EDIT MANUALLY
 */

:root {
${renderVariables(collectBaseCssOutput())}}
`;

  css += '\n';
  css += generateThemeBlock(
    `:root,\n[data-theme='light'],\n[data-vellira-theme='light']`,
    lightTheme
  );
  css += '\n';
  css += generateThemeBlock(
    `[data-theme='dark'],\n[data-vellira-theme='dark']`,
    darkTheme
  );
  css += '\n';
  css += generateThemeBlock(
    `[data-theme='high-contrast'],\n[data-vellira-theme='high-contrast']`,
    highContrastTheme
  );

  return css;
}

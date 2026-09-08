import { darkTheme } from './dark/theme.js';
import { highContrastTheme } from './highContrast/theme.js';
import { lightTheme } from './light/theme.js';

export { darkTheme, highContrastTheme, lightTheme };

export type {
  BaseCssVariableName,
  BaseTokenPath,
  ColorTokenPath,
  ComponentTokenPath,
  CssVariableName,
  DarkTheme,
  HighContrastTheme,
  LightTheme,
  SemanticTokenPath,
  ThemeCssVariableName,
  ThemeName,
  TokenPath,
  VelliraBaseTokens,
  VelliraColors,
  VelliraComponentTokens,
  VelliraSemanticTokens,
  VelliraTheme,
  WidenTokenValues,
} from './generated/token-types.js';
export {
  baseCssVariableNames,
  baseTokenPaths,
  colorTokenPaths,
  componentTokenPaths,
  cssVariableNames,
  semanticTokenPaths,
  themeCssVariableNames,
  themeNames,
  tokenPaths,
} from './generated/token-types.js';
export { overlay } from './primitives/overlay.js';
export type { ControlSize } from './tokens/controlSizes.js';
export { controlSizes } from './tokens/controlSizes.js';
export type { FontWeight } from './tokens/typography.js';
export { fontWeights } from './tokens/typography.js';

/**
 * @deprecated Historical compatibility export. `theme` is a partial view of
 * `darkTheme`, not a default/current theme contract. Use `darkTheme` directly.
 * This alias is scheduled for removal in Vellira 3.0.0.
 */
export const theme = {
  semantic: darkTheme.semantic,
  components: darkTheme.components,
  tokens: darkTheme.tokens,
} as const;

export type CheckboxTokensConfig = Readonly<Record<string, unknown>>;

export const createCheckboxTokens = <
  const TTokens extends CheckboxTokensConfig,
>(tokens: TTokens) => tokens;

export { createCheckboxPalette } from './createCheckboxPalette.js';
export type {
  CheckboxPaletteConfig,
  CheckboxState,
} from './createCheckboxPalette.js';

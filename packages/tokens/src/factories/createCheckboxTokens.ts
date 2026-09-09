export type CheckboxTokensConfig = Readonly<Record<string, unknown>>;

export const createCheckboxTokens = <
  const TTokens extends CheckboxTokensConfig,
>(tokens: TTokens) => tokens;

export {
  createCheckboxIntentPalette,
  createCheckboxIntentPalette as createCheckboxPalette,
} from './palettes/createCheckboxIntentPalette.js';
export type {
  CheckboxPaletteConfig,
  CheckboxState,
} from './palettes/createCheckboxIntentPalette.js';

export type CheckboxTokensConfig = Readonly<Record<string, unknown>>;

export function createCheckboxTokens<
  const TTokens extends CheckboxTokensConfig,
>(tokens: TTokens): TTokens {
  return tokens;
}

export type {
  CheckboxPaletteConfig,
  CheckboxState,
} from '../palettes/createCheckboxIntentPalette.js';
export {
  createCheckboxIntentPalette,
  createCheckboxIntentPalette as createCheckboxPalette,
} from '../palettes/createCheckboxIntentPalette.js';

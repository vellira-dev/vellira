export type ButtonTokensConfig = Readonly<Record<string, unknown>>;

export const createButtonTokens = <const TTokens extends ButtonTokensConfig>(
  tokens: TTokens
) => tokens;

export {
  createButtonIntentPalette,
  transparent,
} from './palettes/createButtonIntentPalette.js';
export type {
  ButtonPaletteConfig,
  ButtonState,
} from './palettes/createButtonIntentPalette.js';

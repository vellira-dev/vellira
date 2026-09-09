export type ButtonTokensConfig = Readonly<Record<string, unknown>>;

export const createButtonTokens = <const TTokens extends ButtonTokensConfig>(
  tokens: TTokens
) => tokens;

export {
  createButtonPalette,
  transparent,
} from './createButtonPalette.js';
export type {
  ButtonPaletteConfig,
  ButtonState,
} from './createButtonPalette.js';

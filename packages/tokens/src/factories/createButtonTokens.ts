export type ButtonTokensConfig = Readonly<Record<string, unknown>>;

export function createButtonTokens<const TTokens extends ButtonTokensConfig>(
  tokens: TTokens
): TTokens {
  return tokens;
}

export {
  createButtonIntentPalette,
  createButtonIntentPalette as createButtonPalette,
  transparent,
} from './palettes/createButtonIntentPalette.js';
export type {
  ButtonPaletteConfig,
  ButtonState,
} from './palettes/createButtonIntentPalette.js';

export type RadioTokensConfig = Readonly<Record<string, unknown>>;

export const createRadioTokens = <const TTokens extends RadioTokensConfig>(
  tokens: TTokens
) => tokens;

export {
  createRadioIntentPalette,
  radioMotionTokens,
  radioSizeTokens,
} from './palettes/createRadioIntentPalette.js';
export type {
  RadioPaletteConfig,
  RadioState,
} from './palettes/createRadioIntentPalette.js';

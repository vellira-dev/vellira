export type RadioTokensConfig = Readonly<Record<string, unknown>>;

export function createRadioTokens<const TTokens extends RadioTokensConfig>(
  tokens: TTokens
): TTokens {
  return tokens;
}

export type {
  RadioPaletteConfig,
  RadioState,
} from '../palettes/createRadioIntentPalette.js';
export {
  createRadioIntentPalette,
  createRadioIntentPalette as createRadioPalette,
  radioMotionTokens,
  radioSizeTokens,
} from '../palettes/createRadioIntentPalette.js';

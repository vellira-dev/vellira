export type RadioTokensConfig = Readonly<Record<string, unknown>>;

export const createRadioTokens = <const TTokens extends RadioTokensConfig>(
  tokens: TTokens
) => tokens;

export {
  createRadioPalette,
  radioMotionTokens,
  radioSizeTokens,
} from './createRadioPalette.js';
export type {
  RadioPaletteConfig,
  RadioState,
} from './createRadioPalette.js';

export type InputTokensConfig = Readonly<Record<string, unknown>>;

export const createInputTokens = <const TTokens extends InputTokensConfig>(
  tokens: TTokens
) => tokens;

export {
  createInputColorPalette,
  createInputPalette,
} from './createInputPalette.js';
export type {
  InputColorPaletteConfig,
  InputPaletteConfig,
  InputState,
} from './createInputPalette.js';

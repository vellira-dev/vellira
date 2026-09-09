export type InputTokensConfig = Readonly<Record<string, unknown>>;

export const createInputTokens = <const TTokens extends InputTokensConfig>(
  tokens: TTokens
) => tokens;

export {
  createInputColorPalette,
  createInputIntentPalette,
} from './palettes/createInputIntentPalette.js';
export type {
  InputColorPaletteConfig,
  InputPaletteConfig,
  InputState,
} from './palettes/createInputIntentPalette.js';

export type InputTokensConfig = Readonly<Record<string, unknown>>;

export function createInputTokens<const TTokens extends InputTokensConfig>(
  tokens: TTokens
): TTokens {
  return tokens;
}

export {
  createInputColorPalette,
  createInputIntentPalette,
  createInputIntentPalette as createInputPalette,
} from './palettes/createInputIntentPalette.js';
export type {
  InputColorPaletteConfig,
  InputPaletteConfig,
  InputState,
} from './palettes/createInputIntentPalette.js';

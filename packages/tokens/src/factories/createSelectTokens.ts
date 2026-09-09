export type SelectTokensConfig = Readonly<Record<string, unknown>>;

export const createSelectTokens = <const TTokens extends SelectTokensConfig>(
  tokens: TTokens
) => tokens;

export {
  createSelectIntentPalette,
  createSelectIntentPalette as createSelectPalette,
} from './palettes/createSelectIntentPalette.js';

export type SelectTokensConfig = Readonly<Record<string, unknown>>;

export function createSelectTokens<const TTokens extends SelectTokensConfig>(
  tokens: TTokens
): TTokens {
  return tokens;
}

export {
  createSelectIntentPalette,
  createSelectIntentPalette as createSelectPalette,
} from './palettes/createSelectIntentPalette.js';

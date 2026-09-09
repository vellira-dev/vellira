export type DropdownTokensConfig = Readonly<Record<string, unknown>>;

export function createDropdownTokens<
  const TTokens extends DropdownTokensConfig,
>(tokens: TTokens): TTokens {
  return tokens;
}

export {
  createDropdownIntentPalette,
  createDropdownIntentPalette as createDropdownPalette,
} from './palettes/createDropdownIntentPalette.js';

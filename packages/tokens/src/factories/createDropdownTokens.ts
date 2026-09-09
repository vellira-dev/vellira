export type DropdownTokensConfig = Readonly<Record<string, unknown>>;

export const createDropdownTokens = <const TTokens extends DropdownTokensConfig>(
  tokens: TTokens
) => tokens;

export {
  createDropdownIntentPalette,
  createDropdownIntentPalette as createDropdownPalette,
} from './palettes/createDropdownIntentPalette.js';

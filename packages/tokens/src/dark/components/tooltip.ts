import { createTooltipTokensFromTheme } from '../../factories/components/createTooltipTokens.js';
import { radius } from '../../tokens/radius.js';
import { spacing } from '../../tokens/spacing.js';
import { typography } from '../../tokens/typography.js';
import { overlay } from '../semantic/overlay.js';

export const tooltip = createTooltipTokensFromTheme({
  overlay,
  radius,
  spacing,
  typography,
});

import { createPopoverTokensFromTheme } from '../../factories/components/createPopoverTokens.js';
import { radius } from '../../tokens/radius.js';
import { spacing } from '../../tokens/spacing.js';
import { overlay } from '../semantic/overlay.js';
import { text } from '../semantic/text.js';

export const popover = createPopoverTokensFromTheme({
  overlay,
  text,
  radius,
  spacing,
});

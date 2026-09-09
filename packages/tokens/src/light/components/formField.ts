import { createFormFieldTokensFromTheme } from '../../factories/components/createFormFieldTokens.js';
import { radius } from '../../tokens/radius.js';
import { spacing } from '../../tokens/spacing.js';
import { typography } from '../../tokens/typography.js';
import { status } from '../semantic/status.js';
import { text } from '../semantic/text.js';

export const formField = createFormFieldTokensFromTheme({
  radius,
  spacing,
  typography,
  status,
  text,
});

import { createModalTokensFromSemantics } from '../../factories/components/createModalTokens.js';
import { radius } from '../../tokens/radius.js';
import { spacing } from '../../tokens/spacing.js';
import { focus } from '../semantic/focus.js';
import { overlay } from '../semantic/overlay.js';
import { surface } from '../semantic/surface.js';
import { text } from '../semantic/text.js';

const closeButtonHoverBg = surface.elevated;
const closeButtonPressedBg = surface.pressed;

export const modal = createModalTokensFromSemantics({
  closeButtonHoverBg,
  closeButtonPressedBg,
  focus,
  overlay,
  radius,
  spacing,
  surface,
  text,
});

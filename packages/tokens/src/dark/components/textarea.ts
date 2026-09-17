import { createTextareaTokens } from '../../factories/components/createTextareaTokens.js';
import { control } from '../semantic/control.js';
import { focus } from '../semantic/focus.js';
import { status } from '../semantic/status.js';

export const textareaTokens = createTextareaTokens({
  default: control.default,
  hover: control.hover,
  pressed: control.pressed,
  focusRing: focus.ring.color,
  error: {
    fg: status.error.fg,
    border: status.error.border,
    ring: status.error.ring,
  },
  disabled: control.disabled,
});

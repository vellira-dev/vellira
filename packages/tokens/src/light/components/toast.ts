import { createToastTokensFromSemantics } from '../../factories/components/createToastTokens.js';
import { control } from '../semantic/control.js';
import { focus } from '../semantic/focus.js';
import { status } from '../semantic/status.js';

export const toastTokens = createToastTokensFromSemantics({
  control,
  focus,
  status,
});

import { createTextareaTokensFromSemantics } from '../../factories/components/createTextareaTokens.js';
import { control } from '../semantic/control.js';
import { focus } from '../semantic/focus.js';
import { status } from '../semantic/status.js';

export const textareaTokens = createTextareaTokensFromSemantics({
  control,
  focus,
  status,
});

import { createSwitchTokensFromSemantics } from '../../factories/components/createSwitchTokens.js';
import { control } from '../semantic/control.js';
import { focus } from '../semantic/focus.js';
import { status } from '../semantic/status.js';

export const switchTokens = createSwitchTokensFromSemantics({
  control,
  focus,
  status,
});

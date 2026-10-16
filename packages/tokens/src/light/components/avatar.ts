import { createAvatarTokensFromSemantics } from '../../factories/components/createAvatarTokens.js';
import { control } from '../semantic/control.js';
import { focus } from '../semantic/focus.js';
import { status } from '../semantic/status.js';

export const avatarTokens = createAvatarTokensFromSemantics({
  control,
  focus,
  status,
});

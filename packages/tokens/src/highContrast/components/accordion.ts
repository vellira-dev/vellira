import { createAccordionTokensFromSemantics } from '../../factories/components/createAccordionTokens.js';
import { border } from '../semantic/border.js';
import { focus } from '../semantic/focus.js';
import { surface } from '../semantic/surface.js';
import { text } from '../semantic/text.js';

export const accordionTokens = createAccordionTokensFromSemantics({
  border,
  focus,
  surface,
  text,
});

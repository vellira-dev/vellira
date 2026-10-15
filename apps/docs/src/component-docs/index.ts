import { buttonDocs } from './Button.docs';
import { checkboxDocs } from './Checkbox.docs';
import { switchDocs } from './Switch.docs';
import { accordionDocs } from './Accordion.docs';
import { textareaDocs } from './Textarea.docs';

export const componentDocsContracts = [
  buttonDocs,
  checkboxDocs,
  switchDocs,
  accordionDocs,
  textareaDocs,
] as const;

export { switchDocs };
export * from './defineComponentDocs';
export * from './navigation';
export * from './types';
export * from './validateComponentDocs';

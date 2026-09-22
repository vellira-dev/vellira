import { switchDocs } from './Switch.docs';
import { accordionDocs } from './Accordion.docs';
import { textareaDocs } from './Textarea.docs';
import { toastDocs } from './Toast.docs';

export const componentDocsContracts = [
  switchDocs,
  accordionDocs,
  textareaDocs,
  toastDocs,
] as const;

export { switchDocs };
export * from './defineComponentDocs';
export * from './navigation';
export * from './types';
export * from './validateComponentDocs';

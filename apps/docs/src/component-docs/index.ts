import { switchDocs } from './Switch.docs';
import { accordionDocs } from './Accordion.docs';
import { textareaDocs } from './Textarea.docs';
import { avatarDocs } from './Avatar.docs';

export const componentDocsContracts = [
  switchDocs,
  accordionDocs,
  textareaDocs,
  avatarDocs,
] as const;

export { switchDocs };
export * from './defineComponentDocs';
export * from './navigation';
export * from './types';
export * from './validateComponentDocs';

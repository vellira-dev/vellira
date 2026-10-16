import { formFieldDocs } from './FormField.docs';
import { tooltipDocs } from './Tooltip.docs';
import { popoverDocs } from './Popover.docs';
import { modalDocs } from './Modal.docs';
import { dropdownDocs } from './Dropdown.docs';
import { tabsDocs } from './Tabs.docs';
import { selectDocs } from './Select.docs';
import { inputDocs } from './Input.docs';
import { buttonDocs } from './Button.docs';
import { checkboxDocs } from './Checkbox.docs';
import { switchDocs } from './Switch.docs';
import { accordionDocs } from './Accordion.docs';
import { textareaDocs } from './Textarea.docs';

export const componentDocsContracts = [
  formFieldDocs,
  tooltipDocs,
  popoverDocs,
  modalDocs,
  dropdownDocs,
  tabsDocs,
  selectDocs,
  inputDocs,
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

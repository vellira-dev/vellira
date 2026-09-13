import { accordionMetadata } from './Accordion.metadata';
import { buttonMetadata } from './Button.metadata';
import { checkboxMetadata } from './Checkbox.metadata';
import { dropdownMetadata } from './Dropdown.metadata';
import { formFieldMetadata } from './FormField.metadata';
import { inputMetadata } from './Input.metadata';
import { modalMetadata } from './Modal.metadata';
import { popoverMetadata } from './Popover.metadata';
import { radioMetadata } from './Radio.metadata';
import { radioGroupMetadata } from './RadioGroup.metadata';
import { selectMetadata } from './Select.metadata';
import { switchMetadata } from './Switch.metadata';
import { tabsMetadata } from './Tabs.metadata';
import { tooltipMetadata } from './Tooltip.metadata';

export {
  accordionMetadata,
  buttonMetadata,
  checkboxMetadata,
  dropdownMetadata,
  formFieldMetadata,
  inputMetadata,
  modalMetadata,
  popoverMetadata,
  radioGroupMetadata,
  radioMetadata,
  selectMetadata,
  switchMetadata,
  tabsMetadata,
  tooltipMetadata,
};

export const componentMetadata = [
  buttonMetadata,
  inputMetadata,
  checkboxMetadata,
  radioMetadata,
  radioGroupMetadata,
  selectMetadata,
  formFieldMetadata,
  tabsMetadata,
  dropdownMetadata,
  modalMetadata,
  popoverMetadata,
  tooltipMetadata,
  switchMetadata,
  accordionMetadata,
] as const;

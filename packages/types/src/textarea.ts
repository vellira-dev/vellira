import type { InputSize } from './input';

export type TextareaSize = InputSize;

export interface BaseTextareaProps {
  /** Visible field label. */
  label?: string;
  /** Supporting text rendered with the field. */
  description?: string;
  /** Error message. Also implies invalid state. */
  error?: string;
  /** Placeholder shown when the value is empty. */
  placeholder?: string;
  /** Field size. Inherits from FormField when omitted by compatible controls. */
  size?: TextareaSize;

  /** Controlled value. */
  value?: string;
  /** Initial value for uncontrolled usage. */
  defaultValue?: string;
  /** Disables interaction. Also inherited from FormField by compatible controls. */
  disabled?: boolean;
  /** Marks the control as required. Also inherited from FormField. */
  required?: boolean;
  /** Marks the control as invalid. Also inherited from FormField. */
  invalid?: boolean;
  /** Called when the value changes. */
  onValueChange?: (value: string) => void;
}

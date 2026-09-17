export interface BaseTextareaProps {
  /** Controlled value. */
  value?: string;
  /** Initial value for uncontrolled usage. */
  defaultValue?: string;
  /** Disables interaction. */
  disabled?: boolean;
  /** Marks the control as required. */
  required?: boolean;
  /** Marks the control as invalid. */
  invalid?: boolean;
  /** Called when the value changes. */
  onValueChange?: (value: string) => void;
}

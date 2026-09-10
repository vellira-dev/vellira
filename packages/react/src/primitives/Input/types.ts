import type {
  InputAdornmentTone,
  InputBaseProps,
  InputFormatter,
  InputMask,
  InputParser,
  InputVariant,
} from '@vellira-ui/types';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export interface InputProps
  extends
    Omit<InputBaseProps, 'variant'>,
    Omit<
      ComponentPropsWithoutRef<'input'>,
      'color' | 'onChange' | 'prefix' | 'size'
    > {
  /** Native input type. Search automatically adds a start search icon. */
  type?: ComponentPropsWithoutRef<'input'>['type'];
  /** Controlled value. */
  value?: ComponentPropsWithoutRef<'input'>['value'];
  /** Initial uncontrolled value. */
  defaultValue?: ComponentPropsWithoutRef<'input'>['defaultValue'];
  /** Called with the next string value. */
  onValueChange?: (value: string) => void;

  /** Visual variant. `bare` preserves Input behavior while composition owns field chrome. */
  variant?: InputVariant | 'bare';
  /** Control id. Inherits the generated FormField id when omitted. */
  id?: string;
  /** Native input name. */
  name?: string;

  /** Icon rendered at the start of the control. */
  startIcon?: ReactNode;
  /** Icon rendered in the right slot when no higher-priority action is active. */
  endIcon?: ReactNode;
  /** Segmented addon rendered before the input. */
  startAddon?: ReactNode;
  /** Segmented addon rendered after the input. */
  endAddon?: ReactNode;
  /** Inline prefix rendered inside the input chrome. */
  prefix?: ReactNode;
  /** Inline suffix rendered inside the input chrome. */
  suffix?: ReactNode;
  /** Custom clear action content. Defaults to the canonical Vellira Close icon. */
  clearIcon?: ReactNode;
  /** Input mask. String masks use # as a digit placeholder. */
  mask?: InputMask;
  /** Formats the displayed value without changing the controlled value. */
  format?: InputFormatter;
  /** Parses a formatted display value before mask/onValueChange. */
  parse?: InputParser;

  /** Tone for startIcon. */
  startIconTone?: InputAdornmentTone;
  /** Tone for endIcon. */
  endIconTone?: InputAdornmentTone;
  /** Tone for clearIcon. */
  clearIconTone?: InputAdornmentTone;

  /** Class name applied to the outer FormField wrapper in shorthand mode. */
  wrapperClassName?: string;
  /** Class name applied to the native input element. */
  className?: string;
  /** Native autocomplete value. When omitted, sensible values are derived from type. */
  autoComplete?: string;
}

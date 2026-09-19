import type { BaseTextareaProps } from '@vellira-ui/types';
import type { ComponentPropsWithoutRef } from 'react';

export interface TextareaProps
  extends
    BaseTextareaProps,
    Omit<
      ComponentPropsWithoutRef<'textarea'>,
      | 'defaultValue'
      | 'disabled'
      | 'placeholder'
      | 'required'
      | 'size'
      | 'value'
    > {
  /** Class name applied to the outer FormField wrapper in shorthand mode. */
  wrapperClassName?: string;
}

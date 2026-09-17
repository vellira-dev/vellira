import { forwardRef, useId } from 'react';

import { controlSizes } from '@vellira-ui/tokens';
import type { ChangeEvent, CSSProperties } from 'react';

import { FormField, useFormFieldContext } from '#patterns/FormField';
import { cn } from '#utils/cn';

import styles from './Textarea.module.scss';
import type { TextareaProps } from './types';

type TextareaSizeStyle = CSSProperties & {
  '--textarea-font-size': string;
  '--textarea-line-height': string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      id: providedId,
      label,
      description,
      error,
      placeholder,
      value,
      defaultValue,
      size,
      disabled = false,
      required = false,
      invalid = false,
      wrapperClassName,
      className,
      style,
      rows = 3,
      onChange,
      onValueChange,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      'aria-labelledby': ariaLabelledBy,
      ...textareaProps
    },
    ref
  ) => {
    const generatedId = useId();
    const field = useFormFieldContext();
    const hasOwnField = Boolean(label || description || error);
    const id =
      providedId ??
      (!hasOwnField ? field?.controlId : undefined) ??
      generatedId;
    const resolvedSize = size ?? field?.size ?? 'md';
    const controlSize = controlSizes[resolvedSize];
    const sizeStyle: TextareaSizeStyle = {
      '--textarea-font-size': `${controlSize.fontSize}px`,
      '--textarea-line-height': `${controlSize.lineHeight}px`,
    };
    const isInvalid =
      invalid || Boolean(error) || (!hasOwnField && Boolean(field?.invalid));
    const isDisabled = disabled || (!hasOwnField && Boolean(field?.disabled));
    const isRequired = required || (!hasOwnField && Boolean(field?.required));
    const descriptionId = description ? `${id}-description` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [
      ariaDescribedBy,
      !hasOwnField && !ariaDescribedBy ? field?.ariaDescribedBy : undefined,
      descriptionId,
      errorId,
    ]
      .filter(Boolean)
      .join(' ');

    const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
      onValueChange?.(event.currentTarget.value);
      onChange?.(event);
    };

    const control = (
      <textarea
        {...textareaProps}
        ref={ref}
        id={id}
        rows={rows}
        className={cn(styles.textarea, styles[resolvedSize], className)}
        style={{ ...sizeStyle, ...style }}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={isDisabled}
        required={isRequired}
        aria-invalid={isInvalid ? true : ariaInvalid}
        aria-labelledby={
          ariaLabelledBy ?? (!hasOwnField ? field?.ariaLabelledBy : undefined)
        }
        aria-describedby={describedBy || undefined}
        onChange={handleChange}
      />
    );

    if (!hasOwnField && field) {
      return control;
    }

    return (
      <FormField
        id={id}
        label={label}
        description={description}
        error={error}
        required={isRequired}
        disabled={isDisabled}
        invalid={isInvalid}
        size={resolvedSize}
        className={wrapperClassName}
        bindControl={false}
      >
        {control}
      </FormField>
    );
  }
);

Textarea.displayName = 'Textarea';

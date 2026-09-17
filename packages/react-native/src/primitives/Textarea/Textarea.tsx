import { forwardRef, useState } from 'react';

import { controlSizes } from '@vellira-ui/tokens';
import type { TextInputProps } from 'react-native';
import { TextInput } from 'react-native';

import { FormField, useFormFieldContext } from '../../patterns/FormField';
import { useTheme, useThemeStyles } from '../../theme';

import { createStyles } from './Textarea.styles';
import type { TextareaProps } from './types';

export const Textarea = forwardRef<TextInput, TextareaProps>(
  (
    {
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
      containerStyle,
      inputStyle,
      numberOfLines = 3,
      onValueChange,
      onFocus,
      onBlur,
      accessibilityLabel,
      accessibilityHint,
      accessibilityState,
      ...props
    },
    ref
  ) => {
    const { theme } = useTheme();
    const styles = useThemeStyles(createStyles);
    const field = useFormFieldContext();
    const hasOwnField = Boolean(label || description || error);
    const [isFocused, setIsFocused] = useState(false);
    const resolvedSize = size ?? field?.size ?? 'md';
    const controlSize = controlSizes[resolvedSize];
    const isInvalid =
      invalid || Boolean(error) || (!hasOwnField && Boolean(field?.invalid));
    const isDisabled = disabled || (!hasOwnField && Boolean(field?.disabled));
    const isRequired = required || (!hasOwnField && Boolean(field?.required));
    const resolvedNumberOfLines = Math.max(1, numberOfLines);
    const resolvedAccessibilityHint = [
      accessibilityHint,
      hasOwnField && typeof description === 'string' ? description : undefined,
      isRequired ? 'Required.' : undefined,
      isInvalid ? 'Invalid.' : undefined,
      hasOwnField && typeof error === 'string' ? error : undefined,
    ]
      .filter((item): item is string => Boolean(item))
      .join(' ');

    const handleFocus: NonNullable<TextInputProps['onFocus']> = (event) => {
      setIsFocused(true);
      onFocus?.(event);
    };

    const handleBlur: NonNullable<TextInputProps['onBlur']> = (event) => {
      setIsFocused(false);
      onBlur?.(event);
    };

    const control = (
      <TextInput
        {...props}
        ref={ref}
        nativeID={
          props.nativeID ?? (!hasOwnField ? field?.controlId : undefined)
        }
        value={value}
        defaultValue={defaultValue}
        editable={!isDisabled}
        multiline
        numberOfLines={resolvedNumberOfLines}
        placeholder={placeholder}
        placeholderTextColor={
          isDisabled
            ? theme.components.textarea.disabled.fg
            : theme.semantic.text.secondary
        }
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={resolvedAccessibilityHint || undefined}
        accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
        accessibilityLabelledBy={!hasOwnField ? field?.labelId : undefined}
        aria-describedby={!hasOwnField ? field?.ariaDescribedBy : undefined}
        onChangeText={onValueChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={[
          styles.textarea,
          styles[resolvedSize],
          {
            minHeight:
              controlSize.lineHeight * resolvedNumberOfLines +
              theme.tokens.spacing[6],
            fontSize: controlSize.fontSize,
            lineHeight: controlSize.lineHeight,
          },
          inputStyle,
          isFocused && !isDisabled && styles.focused,
          isInvalid && styles.invalid,
          isFocused && isInvalid && !isDisabled && styles.invalidFocused,
          isDisabled && styles.disabled,
        ]}
      />
    );

    if (!hasOwnField && field) {
      return control;
    }

    return (
      <FormField
        label={label}
        description={description}
        error={error}
        required={isRequired}
        disabled={isDisabled}
        invalid={isInvalid}
        size={resolvedSize}
        style={containerStyle}
      >
        {control}
      </FormField>
    );
  }
);

Textarea.displayName = 'Textarea';

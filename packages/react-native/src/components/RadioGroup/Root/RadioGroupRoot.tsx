import { forwardRef } from 'react';

import { View } from 'react-native';
import type { ViewInstance } from 'react-native';

import { useControllableState } from '../../../hooks';
import { FormField } from '../../../patterns/FormField';
import { useTheme, useThemeStyles } from '../../../theme';
import { RadioGroupProvider } from '../internal/RadioGroupContext';
import { createStyles } from '../RadioGroup.styles';

import type { RadioGroupProps } from './types';

export const RadioGroupRoot = forwardRef<ViewInstance, RadioGroupProps>(
  (
    {
      value,
      defaultValue = '',
      onValueChange,
      disabled = false,
      required = false,
      invalid = false,
      size = 'md',
      color = 'primary',
      orientation = 'vertical',
      label,
      description,
      error,
      children,
      style,
      itemsStyle,
      labelStyle,
      descriptionStyle,
      errorStyle,
      accessibilityLabel,
      accessibilityHint,
      ...rest
    },
    ref
  ) => {
    const { theme } = useTheme();
    const styles = useThemeStyles(createStyles);
    const radioGroupSizeTokens = theme.components.radioGroup.size[size];

    const [selectedValue, setSelectedValue] = useControllableState({
      value,
      defaultValue,
      onChange: onValueChange,
    });

    const isInvalid = invalid || Boolean(error);

    const resolvedAccessibilityLabel =
      accessibilityLabel ?? (typeof label === 'string' ? label : undefined);

    const resolvedAccessibilityHint =
      (accessibilityHint ??
        [
          typeof description === 'string' ? description : undefined,
          required ? 'Required.' : undefined,
          isInvalid && !error ? 'Invalid.' : undefined,
          typeof error === 'string' ? error : undefined,
        ]
          .filter(Boolean)
          .join(' ')) ||
      undefined;

    return (
      <FormField
        label={label}
        description={description}
        error={error}
        required={required}
        disabled={disabled}
        size={size}
        accessibilityRole='radiogroup'
        accessibilityLabel={resolvedAccessibilityLabel}
        accessibilityHint={resolvedAccessibilityHint}
        labelStyle={labelStyle}
        descriptionStyle={descriptionStyle}
        errorStyle={errorStyle}
        style={[{ alignSelf: 'auto' }, style]}
      >
        <RadioGroupProvider
          value={{
            value: selectedValue,
            disabled,
            required,
            invalid: isInvalid,
            size,
            color,
            onValueChange: setSelectedValue,
          }}
        >
          <View
            {...rest}
            ref={ref}
            style={[
              styles.items,
              orientation === 'horizontal'
                ? [
                    styles.horizontal,
                    {
                      columnGap: radioGroupSizeTokens.horizontalGap,
                      rowGap: radioGroupSizeTokens.itemGap,
                    },
                  ]
                : { gap: radioGroupSizeTokens.itemGap },
              itemsStyle,
            ]}
          >
            {children}
          </View>
        </RadioGroupProvider>
      </FormField>
    );
  }
);

RadioGroupRoot.displayName = 'RadioGroup.Root';

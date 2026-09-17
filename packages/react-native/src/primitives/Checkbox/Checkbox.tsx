import { forwardRef, useEffect } from 'react';

import { Check } from '@vellira-ui/icons';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ViewInstance } from 'react-native';

import { useControllableState } from '../../hooks';
import { useTheme, useThemeStyles } from '../../theme';
import { devWarning } from '../../utils/devWarning';

import { createStyles } from './Checkbox.styles';
import type { CheckboxProps } from './types';

const iconSizeBySize = {
  sm: 10,
  md: 12,
  lg: 14,
} as const;

export const Checkbox: ForwardRefExoticComponent<
  CheckboxProps & RefAttributes<ViewInstance>
> = forwardRef<ViewInstance, CheckboxProps>(
  (
    {
      label,
      description,
      icon,
      indeterminateIcon,
      checked,
      defaultChecked = false,
      disabled = false,
      required = false,
      indeterminate = false,
      size = 'md',
      color = 'primary',
      labelPosition = 'end',
      onCheckedChange,
      error,
      style,
      accessibilityLabel,
      accessibilityHint,
      ...PressableProps
    },
    ref
  ) => {
    const { theme } = useTheme();
    const styles = useThemeStyles(createStyles);
    const checkboxColor = theme.components.checkbox[color];

    const boxSizeStyle = {
      sm: styles.boxSm,
      md: styles.boxMd,
      lg: styles.boxLg,
    };

    const labelSizeStyle = {
      sm: styles.labelSm,
      md: styles.labelMd,
      lg: styles.labelLg,
    };

    const helperTextSizeStyle = {
      sm: styles.errorTextSm,
      md: styles.errorTextMd,
      lg: styles.errorTextLg,
    } as const;

    const hasError = Boolean(error);

    const [isChecked, setIsChecked] = useControllableState({
      value: checked,
      defaultValue: defaultChecked,
      onChange: onCheckedChange,
    });

    const handlePress = () => {
      if (disabled) return;

      setIsChecked(indeterminate ? true : !isChecked);
    };

    const resolvedAccessibilityLabel = accessibilityLabel ?? label;

    const resolvedAccessibilityHint = [
      accessibilityHint,
      description,
      required ? 'Required.' : undefined,
      error,
    ]
      .filter((item): item is string => Boolean(item))
      .join(' ');

    const accessibilityChecked = indeterminate ? 'mixed' : isChecked;

    useEffect(() => {
      devWarning(
        Boolean(resolvedAccessibilityLabel),
        'Checkbox: an accessible label must be provided through label or accessibilityLabel.'
      );
    }, [resolvedAccessibilityLabel]);

    return (
      <View style={styles.container}>
        <Pressable
          {...PressableProps}
          ref={ref}
          onPress={handlePress}
          disabled={disabled}
          accessibilityRole='checkbox'
          accessibilityState={{
            checked: accessibilityChecked,
            disabled,
          }}
          accessibilityHint={resolvedAccessibilityHint || undefined}
          accessibilityLabel={resolvedAccessibilityLabel}
          style={[
            styles.wrapper,
            labelPosition === 'start' && styles.wrapperLabelStart,
            !label && styles.iconOnly,
            disabled && styles.disabled,
            style,
          ]}
        >
          {({ pressed }) => {
            const isSelected = isChecked || indeterminate;

            const checkColor = disabled
              ? theme.components.checkbox.disabled.fg
              : pressed && isSelected
                ? checkboxColor.pressed.fg
                : checkboxColor.default.fg;

            return (
              <>
                <View
                  style={[
                    styles.box,
                    boxSizeStyle[size],
                    isSelected && {
                      backgroundColor: checkboxColor.default.bg,
                      borderColor: checkboxColor.default.border,
                    },
                    isSelected &&
                      pressed && {
                        backgroundColor: checkboxColor.pressed.bg,
                        borderColor: checkboxColor.pressed.border,
                        transform: [{ scale: 0.96 }],
                      },
                    hasError && styles.boxError,
                    disabled && styles.boxDisabled,
                  ]}
                >
                  {indeterminate
                    ? (indeterminateIcon ?? (
                        <View
                          style={[
                            styles.indeterminateMark,
                            {
                              backgroundColor: pressed
                                ? checkboxColor.pressed.fg
                                : checkboxColor.default.fg,
                            },
                          ]}
                        />
                      ))
                    : isChecked &&
                      (icon ?? (
                        <Check size={iconSizeBySize[size]} color={checkColor} />
                      ))}
                </View>

                {Boolean(label) && (
                  <Text
                    style={[
                      styles.label,
                      labelSizeStyle[size],
                      isSelected && { color: checkboxColor.default.labelFg },
                      isSelected &&
                        pressed && {
                          color: checkboxColor.pressed.labelFg,
                        },
                      disabled && styles.labelDisabled,
                    ]}
                  >
                    {label}

                    {required && <Text style={styles.requiredMark}> *</Text>}
                  </Text>
                )}
              </>
            );
          }}
        </Pressable>

        {Boolean(description) && (
          <Text
            style={[
              styles.descriptionText,
              helperTextSizeStyle[size],
              disabled && styles.descriptionTextDisabled,
            ]}
          >
            {description}
          </Text>
        )}

        {hasError && (
          <Text style={[styles.errorText, helperTextSizeStyle[size]]}>
            {error}
          </Text>
        )}
      </View>
    );
  }
);

Checkbox.displayName = 'Checkbox';

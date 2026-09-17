import { forwardRef, useEffect } from 'react';

import {
  Platform,
  Pressable,
  type PressableStateCallbackType,
  type StyleProp,
  Text,
  View,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';

import { useRadioGroupContext } from '../../components/RadioGroup/internal/RadioGroupContext';
import { useControllableState } from '../../hooks';
import { useTheme } from '../../theme';

import { createStyles } from './Radio.styles';
import type { RadioProps } from './types';

const nativePointerEventsNone =
  Platform.OS === 'web' ? undefined : ({ pointerEvents: 'none' } as const);
const webPointerEventsNone =
  Platform.OS === 'web' ? { pointerEvents: 'none' as const } : undefined;

export const Radio = forwardRef<ViewInstance, RadioProps>(
  (
    {
      value,
      checked,
      defaultChecked = false,
      disabled: disabledProp = false,
      required: requiredProp = false,
      size: sizeProp,
      color: colorProp,
      onCheckedChange,
      label,
      description,
      icon,
      error,
      accessibilityLabel,
      accessibilityHint,
      containerStyle,
      labelStyle,
      descriptionStyle,
      errorStyle,
      style,
      ...rest
    },
    ref
  ) => {
    const { theme } = useTheme();
    const styles = createStyles(theme);

    const group = useRadioGroupContext();
    const isInsideGroup = group !== null;

    const [standaloneChecked, setStandaloneChecked] = useControllableState({
      value: checked,
      defaultValue: defaultChecked,
      onChange: onCheckedChange,
    });

    const resolvedChecked = isInsideGroup
      ? group.value === value
      : standaloneChecked;

    const resolvedDisabled = Boolean(group?.disabled) || disabledProp;
    const resolvedRequired = Boolean(group?.required) || requiredProp;
    const resolvedInvalid = Boolean(group?.invalid) || Boolean(error);
    const resolvedSize = sizeProp ?? group?.size ?? 'md';
    const resolvedColor = colorProp ?? group?.color ?? 'primary';
    const radioColor = theme.components.radio[resolvedColor];
    const radioSize = theme.components.radio.size[resolvedSize];

    const controlMarginTop =
      (radioSize.labelLineHeight - radioSize.controlSize) / 2;
    const visualHeight = Math.max(
      radioSize.labelLineHeight,
      radioSize.controlSize
    );
    const hitSlop = Math.max(0, (32 - visualHeight) / 2);

    useEffect(() => {
      if (
        typeof __DEV__ !== 'undefined' &&
        __DEV__ &&
        !label &&
        !accessibilityLabel
      ) {
        console.warn(
          'Radio requires either a visible label or accessibilityLabel.'
        );
      }
    }, [accessibilityLabel, label]);

    const resolvedAccessibilityLabel =
      accessibilityLabel ?? (typeof label === 'string' ? label : undefined);

    const resolvedAccessibilityHint =
      (accessibilityHint ??
        [
          typeof description === 'string' ? description : undefined,
          resolvedRequired ? 'Required.' : undefined,
          error,
        ]
          .filter((item): item is string => Boolean(item))
          .join(' ')) ||
      undefined;

    const handlePress = () => {
      if (resolvedDisabled || resolvedChecked) {
        return;
      }

      if (isInsideGroup) {
        group.onValueChange(value);
        return;
      }

      setStandaloneChecked(true);
    };

    const resolvePressableStyle = (
      state: PressableStateCallbackType
    ): StyleProp<ViewStyle> => [
      styles.pressable,
      resolvedDisabled && styles.pressableDisabled,
      state.pressed && !resolvedDisabled && styles.pressablePressed,
      typeof style === 'function' ? style(state) : style,
    ];

    return (
      <View style={[styles.root, containerStyle]}>
        <Pressable
          {...rest}
          ref={ref}
          accessibilityRole='radio'
          accessibilityLabel={resolvedAccessibilityLabel}
          accessibilityHint={resolvedAccessibilityHint}
          accessibilityState={{
            checked: resolvedChecked,
            disabled: resolvedDisabled,
          }}
          disabled={resolvedDisabled}
          hitSlop={Platform.OS === 'web' ? undefined : hitSlop}
          onPress={handlePress}
          style={resolvePressableStyle}
        >
          {(state) => (
            <>
              <View
                {...nativePointerEventsNone}
                style={[
                  styles.control,
                  webPointerEventsNone,
                  {
                    width: radioSize.controlSize,
                    height: radioSize.controlSize,
                    marginTop: controlMarginTop,
                  },
                  resolvedChecked && {
                    backgroundColor: radioColor.default.bg,
                    borderColor: radioColor.default.border,
                  },
                  resolvedChecked &&
                    state.pressed &&
                    !resolvedDisabled && {
                      backgroundColor: radioColor.pressed.bg,
                      borderColor: radioColor.pressed.border,
                      transform: [
                        { scale: theme.components.radio.motion.pressedScale },
                      ],
                    },
                  resolvedInvalid && styles.controlInvalid,
                  resolvedDisabled && styles.controlDisabled,
                  resolvedChecked &&
                    resolvedDisabled &&
                    styles.controlCheckedDisabled,
                ]}
              >
                {resolvedChecked &&
                  (icon ?? (
                    <View
                      style={[
                        styles.indicator,
                        {
                          width: radioSize.indicatorSize,
                          height: radioSize.indicatorSize,
                          backgroundColor:
                            state.pressed && !resolvedDisabled
                              ? radioColor.pressed.fg
                              : radioColor.default.fg,
                        },
                        resolvedDisabled && styles.indicatorDisabled,
                      ]}
                    />
                  ))}
              </View>

              {(label || description) && (
                <View
                  {...nativePointerEventsNone}
                  style={[styles.content, webPointerEventsNone]}
                >
                  {label &&
                    (typeof label === 'string' ? (
                      <Text
                        style={[
                          styles.label,
                          {
                            fontSize: radioSize.labelFontSize,
                            lineHeight: radioSize.labelLineHeight,
                          },
                          resolvedChecked && {
                            color: radioColor.default.labelFg,
                          },
                          resolvedChecked &&
                            state.pressed &&
                            !resolvedDisabled && {
                              color: radioColor.pressed.labelFg,
                            },
                          resolvedInvalid && styles.labelInvalid,
                          resolvedDisabled && styles.textDisabled,
                          labelStyle,
                        ]}
                      >
                        {label}
                      </Text>
                    ) : (
                      label
                    ))}

                  {description &&
                    (typeof description === 'string' ? (
                      <Text
                        style={[
                          styles.description,
                          {
                            fontSize: radioSize.descriptionFontSize,
                            lineHeight: radioSize.descriptionLineHeight,
                          },
                          resolvedDisabled && styles.textDisabled,
                          descriptionStyle,
                        ]}
                      >
                        {description}
                      </Text>
                    ) : (
                      description
                    ))}
                </View>
              )}
            </>
          )}
        </Pressable>

        {Boolean(error) && (
          <Text
            accessibilityLiveRegion='polite'
            style={[
              styles.error,
              {
                marginLeft: radioSize.controlSize + theme.tokens.spacing[2],
                fontSize: radioSize.descriptionFontSize,
                lineHeight: radioSize.descriptionLineHeight,
              },
              errorStyle,
            ]}
          >
            {error}
          </Text>
        )}
      </View>
    );
  }
);

Radio.displayName = 'Radio';

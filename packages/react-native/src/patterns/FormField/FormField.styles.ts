import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import type { NativeTheme } from '../../theme';

const fontWeight = (value: string): TextStyle['fontWeight'] =>
  value as TextStyle['fontWeight'];

type FormFieldStyles = {
  root: ViewStyle;
  label: TextStyle;
  labelRow: ViewStyle;
  labelAction: ViewStyle;
  labelDisabled: TextStyle;
  required: TextStyle;
  optional: TextStyle;
  labelInfo: TextStyle;
  description: TextStyle;
  descriptionDisabled: TextStyle;
  customLabel: ViewStyle;
  control: ViewStyle;
  message: TextStyle;
  messageSuccess: TextStyle;
  messageWarning: TextStyle;
  messageDanger: TextStyle;
  helperTextDisabled: TextStyle;
};

export const createStyles = (theme: NativeTheme): FormFieldStyles =>
  StyleSheet.create<FormFieldStyles>({
    root: {
      width: '100%',
      minWidth: 0,
      alignSelf: 'auto',
      gap: theme.components.formField.size.md.gap,
    },

    label: {
      color: theme.components.formField.label.fg,
      fontFamily: theme.tokens.typography.family.medium,
      fontSize: theme.components.formField.size.md.labelFontSize,
      fontWeight: fontWeight(theme.tokens.typography.weight.medium),
      lineHeight: theme.components.formField.size.md.labelLineHeight,
    },

    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: theme.components.formField.size.md.gap,
    },

    labelAction: {
      flexShrink: 0,
    },

    labelDisabled: {
      color: theme.components.formField.disabled.labelFg,
    },

    required: {
      marginLeft: theme.tokens.spacing[1],
      color: theme.components.formField.requiredMark.fg,
    },

    optional: {
      marginLeft: theme.components.formField.size.md.gap,
      color: theme.components.formField.optional.fg,
      fontFamily: theme.tokens.typography.family.regular,
      fontSize: theme.components.formField.size.md.optionalFontSize,
      lineHeight: theme.components.formField.size.md.optionalLineHeight,
    },

    labelInfo: {
      marginLeft: theme.components.formField.size.md.gap,
      color: theme.components.formField.labelInfo.fg,
      fontFamily: theme.tokens.typography.family.medium,
      fontSize: theme.components.formField.size.md.labelInfoFontSize,
      lineHeight: theme.components.formField.size.md.labelInfoSize,
    },

    description: {
      color: theme.components.formField.description.fg,
      fontFamily: theme.tokens.typography.family.regular,
      fontSize: theme.components.formField.size.md.descriptionFontSize,
      lineHeight: theme.components.formField.size.md.descriptionLineHeight,
    },

    descriptionDisabled: {
      color: theme.components.formField.disabled.descriptionFg,
    },

    customLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.tokens.spacing[1],
    },

    control: {
      width: '100%',
      minWidth: 0,
      alignSelf: 'stretch',
    },

    message: {
      color: theme.components.formField.helperText.default.fg,
      fontFamily: theme.tokens.typography.family.regular,
      fontSize: theme.components.formField.size.md.helperTextFontSize,
      lineHeight: theme.components.formField.size.md.helperTextLineHeight,
    },

    messageSuccess: {
      color: theme.components.formField.helperText.success.fg,
    },

    messageWarning: {
      color: theme.components.formField.helperText.warning.fg,
    },

    messageDanger: {
      color: theme.components.formField.helperText.error.fg,
    },

    helperTextDisabled: {
      color: theme.components.formField.disabled.helperTextFg,
    },
  });

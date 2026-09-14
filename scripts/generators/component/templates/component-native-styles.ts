import type { ComponentProfileArg, FormControlKindArg } from '../cli';
import type { ComponentTemplateParams } from './component-types';

export type NativeStylesTemplateParams = ComponentTemplateParams & {
  profile?: ComponentProfileArg;
  control?: FormControlKindArg;
};

export function renderNativeStylesTemplate({
  componentName,
  profile = 'base',
  control = 'value',
}: NativeStylesTemplateParams) {
  if (profile === 'form-control' && control === 'boolean') {
    const tokenName = `${componentName[0].toLowerCase()}${componentName.slice(1)}`;
    return `import { StyleSheet } from 'react-native';

import type { NativeTheme } from '../../theme';

export const createStyles = (theme: NativeTheme) =>
  StyleSheet.create({
    root: {
      width: theme.components.${tokenName}.geometry.trackWidth,
      height: theme.components.${tokenName}.geometry.trackHeight,
      borderRadius: theme.tokens.radius.full,
      borderWidth: theme.components.${tokenName}.geometry.borderWidth,
      padding: theme.components.${tokenName}.geometry.padding,
      justifyContent: 'center',
      backgroundColor: theme.components.${tokenName}.off.trackBg,
      borderColor: theme.components.${tokenName}.off.trackBorder,
    },
    checked: {
      backgroundColor: theme.components.${tokenName}.on.default.trackBg,
      borderColor: theme.components.${tokenName}.on.default.trackBorder,
    },
    pressed: {
      transform: [{ scale: theme.components.${tokenName}.geometry.pressScale }],
    },
    checkedPressed: {
      backgroundColor: theme.components.${tokenName}.on.pressed.trackBg,
      borderColor: theme.components.${tokenName}.on.pressed.trackBorder,
    },
    invalid: {
      borderColor: theme.components.${tokenName}.errorBorder,
    },
    disabled: {
      backgroundColor: theme.components.${tokenName}.disabled.trackBg,
      borderColor: theme.components.${tokenName}.disabled.trackBorder,
    },
    thumb: {
      width: theme.components.${tokenName}.geometry.thumbSize,
      height: theme.components.${tokenName}.geometry.thumbSize,
      borderRadius: theme.tokens.radius.full,
      backgroundColor: theme.components.${tokenName}.off.thumbBg,
      transform: [{ translateX: 0 }],
    },
    thumbChecked: {
      backgroundColor: theme.components.${tokenName}.on.default.thumbBg,
      transform: [
        { translateX: theme.components.${tokenName}.geometry.thumbTravel },
      ],
    },
    thumbCheckedPressed: {
      backgroundColor: theme.components.${tokenName}.on.pressed.thumbBg,
    },
    thumbDisabled: {
      backgroundColor: theme.components.${tokenName}.disabled.thumbBg,
    },
  });
`;
  }

  const className = `${componentName[0].toLowerCase()}${componentName.slice(1)}`;

  return `import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  ${className}: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
`;
}

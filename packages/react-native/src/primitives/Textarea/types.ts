import type { BaseTextareaProps } from '@vellira-ui/types';
import type { TextInputProps, TextStyle, ViewStyle } from 'react-native';

export interface TextareaProps
  extends
    BaseTextareaProps,
    Omit<
      TextInputProps,
      | 'defaultValue'
      | 'editable'
      | 'multiline'
      | 'onChangeText'
      | 'placeholder'
      | 'value'
    > {
  /** Style applied to the outer FormField wrapper in shorthand mode. */
  containerStyle?: ViewStyle;
  /** Style applied to the native multiline TextInput. */
  inputStyle?: TextStyle;
}

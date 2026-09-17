import { TextInput } from 'react-native';

import type { TextareaProps } from './types';

export function Textarea({
  value,
  defaultValue,
  disabled = false,
  required = false,
  invalid = false,
  onValueChange,
}: TextareaProps) {
  return (
    <TextInput
      value={value}
      defaultValue={defaultValue}
      editable={!disabled}
      multiline
      accessibilityState={{ disabled }}
      accessibilityHint={
        [required ? 'Required.' : undefined, invalid ? 'Invalid.' : undefined]
          .filter(Boolean)
          .join(' ') || undefined
      }
      onChangeText={onValueChange}
    />
  );
}

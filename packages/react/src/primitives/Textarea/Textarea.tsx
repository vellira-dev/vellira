import type { ChangeEvent } from 'react';

import type { TextareaProps } from './types';

export function Textarea({
  value,
  defaultValue,
  disabled = false,
  required = false,
  invalid = false,
  onValueChange,
}: TextareaProps) {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onValueChange?.(event.currentTarget.value);
  };

  return (
    <textarea
      value={value}
      defaultValue={defaultValue}
      disabled={disabled}
      required={required}
      aria-invalid={invalid || undefined}
      onChange={handleChange}
    />
  );
}

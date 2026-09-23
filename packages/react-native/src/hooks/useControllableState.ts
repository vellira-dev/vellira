import { useCallback, useLayoutEffect, useRef, useState } from 'react';

// Provides a shared API for controlled and uncontrolled state.
interface UseControllableStateProps<T> {
  value?: T;
  defaultValue: T;
  onChange?: (value: T) => void;
}

export const useControllableState = <T>({
  value,
  defaultValue,
  onChange,
}: UseControllableStateProps<T>) => {
  const [internalValue, setInternalValue] = useState<T>(defaultValue);
  const onChangeRef = useRef(onChange);

  // Publish only committed callbacks, without changing the setter identity.
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const isControlled = value !== undefined;

  const currentValue = isControlled ? value : internalValue;

  const setValue = useCallback(
    (next: T) => {
      if (!isControlled) {
        setInternalValue(next);
      }
      onChangeRef.current?.(next);
    },
    [isControlled]
  );

  return [currentValue, setValue] as const;
};

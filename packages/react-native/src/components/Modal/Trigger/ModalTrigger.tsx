import { cloneElement, isValidElement } from 'react';

import type { Ref } from 'react';
import type { GestureResponderEvent, ViewInstance } from 'react-native';
import { Pressable, Text } from 'react-native';

import { useModalContext } from '../internal/ModalContext';

import type { ModalTriggerChild, ModalTriggerProps } from './types';

const composeRefs =
  <T,>(...refs: Array<Ref<T> | undefined>) =>
  (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') {
        ref(node);
        continue;
      }

      if (ref) {
        ref.current = node;
      }
    }
  };

export const ModalTrigger = ({
  children,
  asChild = false,
  disabled = false,
  accessibilityLabel,
  style,
  testID,
}: ModalTriggerProps) => {
  const root = useModalContext();
  const child =
    asChild && isValidElement(children)
      ? (children as ModalTriggerChild)
      : undefined;

  const composedTriggerRef = child
    ? composeRefs<ViewInstance>(root.triggerRef, child.props.ref)
    : root.triggerRef;

  const handlePress = (event: GestureResponderEvent) => {
    if (disabled || child?.props.disabled) return;

    child?.props.onPress?.(event);
    root.setOpen(true);
  };

  if (child) {
    return cloneElement(child, {
      ref: composedTriggerRef,
      onPress: handlePress,
      accessibilityRole: child.props.accessibilityRole ?? 'button',
      accessibilityState: {
        ...child.props.accessibilityState,
        expanded: root.open,
        disabled: disabled || child.props.disabled,
      },
      accessibilityLabel: accessibilityLabel ?? child.props.accessibilityLabel,
      disabled: disabled || child.props.disabled,
      style: child.props.style,
    });
  }

  return (
    <Pressable
      ref={root.triggerRef}
      accessibilityRole='button'
      accessibilityState={{ expanded: root.open, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={handlePress}
      style={style}
      testID={testID}
    >
      {typeof children === 'string' ? <Text>{children}</Text> : children}
    </Pressable>
  );
};

ModalTrigger.displayName = 'Modal.Trigger';

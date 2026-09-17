import type { ReactElement, Ref } from 'react';
import type {
  GestureResponderEvent,
  PressableProps,
  ViewInstance,
} from 'react-native';

export interface PopoverTriggerChildProps {
  /** Ref forwarded to the composed trigger child. */
  ref?: Ref<ViewInstance>;
  /** Press handler injected into the composed trigger child. */
  onPress?: (event: GestureResponderEvent) => void;
}

export interface PopoverTriggerProps extends Omit<PressableProps, 'children'> {
  /** Trigger element. */
  children: ReactElement<PopoverTriggerChildProps>;
  /** Composes trigger behavior onto a single child element. */
  asChild?: boolean;
}

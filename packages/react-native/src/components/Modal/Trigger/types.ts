import type { ReactElement, ReactNode, Ref } from 'react';
import type {
  PressableProps,
  StyleProp,
  ViewInstance,
  ViewStyle,
} from 'react-native';

export type ModalTriggerProps = {
  /** Trigger content. */
  children: ReactNode;
  /** Composes trigger behavior onto a single child element. */
  asChild?: boolean;
  /** Disables trigger interaction. */
  disabled?: boolean;
  /** Style applied to the trigger. */
  style?: StyleProp<ViewStyle>;
} & Pick<PressableProps, 'accessibilityLabel' | 'testID'>;

export type ModalTriggerChildProps = {
  /** Ref forwarded to the composed trigger child. */
  ref?: Ref<ViewInstance>;
  /** Press handler injected into the composed trigger child. */
  onPress?: PressableProps['onPress'];
  /** Disables trigger interaction on the composed child. */
  disabled?: boolean;
  /** Accessibility role injected into the composed child. */
  accessibilityRole?: PressableProps['accessibilityRole'];
  /** Accessibility state injected into the composed child. */
  accessibilityState?: PressableProps['accessibilityState'];
  /** Accessible name injected into the composed child. */
  accessibilityLabel?: string;
  /** Style injected into the composed child. */
  style?: StyleProp<ViewStyle>;
};

export type ModalTriggerChild = ReactElement<ModalTriggerChildProps>;

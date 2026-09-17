import type { MutableRefObject } from 'react';
import type { Animated, ViewInstance } from 'react-native';

import type {
  OverlayOutsidePressProps,
  OverlayOutsidePressPropsOptions,
} from '../../../hooks';
import type { ModalAnimation } from '../types';

export interface ModalContextValue {
  animation: ModalAnimation;
  animationProgress: Animated.Value;
  zIndex: number;
  onClose: () => void;
  getOutsidePressProps: (
    options?: OverlayOutsidePressPropsOptions
  ) => OverlayOutsidePressProps;
  open: boolean;
  setOpen: (open: boolean) => void;
  shouldRender: boolean;
  triggerRef: MutableRefObject<ViewInstance | null>;
}

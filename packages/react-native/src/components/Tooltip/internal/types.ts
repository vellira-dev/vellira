import type { FloatingPlacement, TooltipDelay } from '@vellira-ui/types';
import type { RefObject } from 'react';
import type { LayoutChangeEvent, ViewInstance } from 'react-native';

import type {
  OverlayOutsidePressProps,
  OverlayOutsidePressPropsOptions,
} from '../../../hooks';

export type NativeTooltipDelay = Partial<TooltipDelay>;

export type TooltipContextValue = {
  contentId: string;
  open: boolean;
  disabled: boolean;
  placement: FloatingPlacement;
  position: {
    top: number;
    left: number;
  };
  arrowPosition: {
    top?: number;
    left?: number;
  };
  triggerRef: RefObject<ViewInstance | null>;
  setOpen: (open: boolean) => void;
  show: () => void;
  hide: () => void;
  zIndex: number;
  requestClose: () => void;
  getOutsidePressProps: (
    options?: OverlayOutsidePressPropsOptions
  ) => OverlayOutsidePressProps;
  onFloatingLayout: (event: LayoutChangeEvent) => void;
};

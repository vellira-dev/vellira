import type {
  BasePopoverPositioningProps,
  FloatingPlacement,
  PopoverOpenChangeDetails,
} from '@vellira-ui/types';
import type { MutableRefObject } from 'react';
import type { LayoutChangeEvent, ViewInstance, ViewStyle } from 'react-native';

import type {
  OverlayOutsidePressProps,
  OverlayOutsidePressPropsOptions,
} from '../../../hooks';

export interface PopoverContextValue {
  open: boolean;

  triggerRef: MutableRefObject<ViewInstance | null>;
  anchorRef: MutableRefObject<ViewInstance | null>;

  side: NonNullable<BasePopoverPositioningProps['side']>;
  align: NonNullable<BasePopoverPositioningProps['align']>;

  placement: FloatingPlacement;
  zIndex: number;
  position: Pick<ViewStyle, 'top' | 'left'>;
  arrowPosition: Pick<ViewStyle, 'top' | 'left'>;

  onFloatingLayout: (event: LayoutChangeEvent) => void;
  updatePosition: (containerRef?: MutableRefObject<ViewInstance | null>) => void;

  setOpen: (open: boolean, details: PopoverOpenChangeDetails) => void;

  requestClose: () => void;
  getOutsidePressProps: (
    options?: OverlayOutsidePressPropsOptions
  ) => OverlayOutsidePressProps;
}

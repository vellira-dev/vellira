import { type LayoutChangeEvent, useWindowDimensions } from 'react-native';

import { SELECT_PRESENTATION_VIEWPORT_RATIO } from './SelectPresentation.styles';

// Keep the sheet and modal bounded against the actual native window rather
// than against an intrinsic-height shadow wrapper with an indefinite percent.
export const useSelectPresentationViewport = (presentation: 'sheet' | 'modal') => {
  const { height } = useWindowDimensions();
  const maxHeight = height * SELECT_PRESENTATION_VIEWPORT_RATIO;

  const onLayout = (event: LayoutChangeEvent) => {
    if (
      (
        globalThis as typeof globalThis & {
          __VELLIRA_SELECT_LAYOUT_PROOF__?: boolean;
        }
      ).__VELLIRA_SELECT_LAYOUT_PROOF__
    ) {
      console.warn(
        `[VELLIRA_SELECT_LAYOUT] ${presentation} height=${event.nativeEvent.layout.height} viewportCap=${maxHeight}`
      );
    }
  };

  return { maxHeight, onLayout };
};

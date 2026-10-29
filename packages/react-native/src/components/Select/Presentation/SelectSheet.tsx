import { Modal, Platform, useWindowDimensions, View } from 'react-native';

import { useThemeStyles } from '../../../theme';

import { SelectBackdrop } from './SelectBackdrop';
import { SelectHandle } from './SelectHandle';
import {
  createPresentationStyles,
  SELECT_PRESENTATION_VIEWPORT_RATIO,
} from './SelectPresentation.styles';
import type { SelectPresentationProps } from './types';

export const SelectSheet = ({
  visible,
  onClose,
  outsidePressProps,
  zIndex,
  contentStyle,
  children,
}: SelectPresentationProps) => {
  const styles = useThemeStyles(createPresentationStyles);
  const { height } = useWindowDimensions();
  const maxHeight = height * SELECT_PRESENTATION_VIEWPORT_RATIO;

  return (
    <Modal
      transparent
      visible={visible}
      animationType='slide'
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.modalRoot,
          styles.sheetRoot,
          Platform.OS === 'web' && { zIndex },
        ]}
        testID='select-content-root'
      >
        <SelectBackdrop outsidePressProps={outsidePressProps} />
        <View style={[styles.surface, styles.sheetSurface]}>
          <View
            style={[styles.content, styles.sheet, { maxHeight }, contentStyle]}
            onLayout={(event) => {
              if (
                (
                  globalThis as typeof globalThis & {
                    __VELLIRA_SELECT_LAYOUT_PROOF__?: boolean;
                  }
                ).__VELLIRA_SELECT_LAYOUT_PROOF__
              ) {
                console.warn(
                  `[VELLIRA_SELECT_LAYOUT] sheet height=${event.nativeEvent.layout.height} viewportCap=${maxHeight}`
                );
              }
            }}
            testID='select-sheet'
          >
            <SelectHandle />
            {children}
          </View>
        </View>
      </View>
    </Modal>
  );
};

SelectSheet.displayName = 'Select.Sheet';

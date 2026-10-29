import { Modal, Platform, View } from 'react-native';

import { useThemeStyles } from '../../../theme';

import { SelectBackdrop } from './SelectBackdrop';
import { SelectHandle } from './SelectHandle';
import { createPresentationStyles } from './SelectPresentation.styles';
import type { SelectPresentationProps } from './types';
import { useSelectPresentationViewport } from './useSelectPresentationViewport';

export const SelectSheet = ({
  visible,
  onClose,
  outsidePressProps,
  zIndex,
  contentStyle,
  children,
}: SelectPresentationProps) => {
  const styles = useThemeStyles(createPresentationStyles);
  const { maxHeight, onLayout } = useSelectPresentationViewport('sheet');

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
            onLayout={onLayout}
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

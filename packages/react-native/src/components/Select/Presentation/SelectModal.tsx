import { Modal, Platform, View } from 'react-native';

import { useThemeStyles } from '../../../theme';

import { SelectBackdrop } from './SelectBackdrop';
import { createPresentationStyles } from './SelectPresentation.styles';
import type { SelectPresentationProps } from './types';
import { useSelectPresentationViewport } from './useSelectPresentationViewport';

export const SelectModal = ({
  visible,
  onClose,
  outsidePressProps,
  zIndex,
  contentStyle,
  children,
}: SelectPresentationProps) => {
  const styles = useThemeStyles(createPresentationStyles);
  const { maxHeight, onLayout } = useSelectPresentationViewport('modal');

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
          styles.modalPresentationRoot,
          Platform.OS === 'web' && { zIndex },
        ]}
        testID='select-content-root'
      >
        <SelectBackdrop outsidePressProps={outsidePressProps} />
        <View style={[styles.surface, styles.modalSurface]}>
          <View
            style={[
              styles.content,
              styles.modalPresentation,
              { maxHeight },
              contentStyle,
            ]}
            onLayout={onLayout}
            testID='select-modal'
          >
            {children}
          </View>
        </View>
      </View>
    </Modal>
  );
};

SelectModal.displayName = 'Select.Modal';

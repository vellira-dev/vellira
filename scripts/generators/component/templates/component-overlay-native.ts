import type { ComponentTemplateParams } from './component-types';

export function renderNativeOverlayTypesTemplate({
  componentName,
}: ComponentTemplateParams) {
  return `import type { Base${componentName}Props } from '@vellira-ui/types';
import type { ReactNode } from 'react';

export type ${componentName}Props = Base${componentName}Props & {
  children?: ReactNode;
  closeOnOutsidePress?: boolean;
  restoreFocus?: boolean;
};
`;
}

export function renderNativeOverlayComponentTemplate({
  componentName,
}: ComponentTemplateParams) {
  return `import { View } from 'react-native';

import { useControllableState } from '../../hooks';
import type { ${componentName}Props } from './types';

export function ${componentName}({
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  closeOnOutsidePress = true,
  restoreFocus = true,
}: ${componentName}Props) {
  const [resolvedOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  void closeOnOutsidePress;
  void restoreFocus;
  void setOpen;

  return <View>{resolvedOpen ? children : null}</View>;
}
`;
}

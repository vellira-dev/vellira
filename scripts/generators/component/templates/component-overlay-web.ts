import type { ComponentTemplateParams } from './component-types';

export function renderWebOverlayTypesTemplate({
  componentName,
}: ComponentTemplateParams) {
  return `import type { Base${componentName}Props } from '@vellira-ui/types';
import type { ReactNode } from 'react';

export type ${componentName}Props = Base${componentName}Props & {
  children?: ReactNode;
  closeOnEscape?: boolean;
  closeOnOutsidePress?: boolean;
  restoreFocus?: boolean;
};
`;
}

export function renderWebOverlayComponentTemplate({
  componentName,
}: ComponentTemplateParams) {
  return `import { useControllableState } from '#hooks';

import type { ${componentName}Props } from './types';

export function ${componentName}({
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  closeOnEscape = true,
  closeOnOutsidePress = true,
  restoreFocus = true,
}: ${componentName}Props) {
  const [resolvedOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  void closeOnEscape;
  void closeOnOutsidePress;
  void restoreFocus;
  void setOpen;

  return (
    <div data-state={resolvedOpen ? 'open' : 'closed'}>
      {children}
    </div>
  );
}
`;
}

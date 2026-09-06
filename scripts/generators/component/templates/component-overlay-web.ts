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
  return `import { useState } from 'react';

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
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);

  const isControlled = open !== undefined;
  const resolvedOpen = isControlled ? open : uncontrolledOpen;

  const setOpen = (nextOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  };

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

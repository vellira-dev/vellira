import type { ComponentTemplateParams } from './component-types';

export type OverlayPartTemplateParams = ComponentTemplateParams & {
  partName: string;
};

export function renderWebOverlayPartTypesTemplate({
  componentName,
  partName,
}: OverlayPartTemplateParams) {
  switch (partName) {
    case 'Root':
      return `// ${componentName}Root consumes the component-level ${componentName}Props contract.
export {};
`;

    case 'Trigger':
      return `import type { ReactNode } from 'react';

export type ${componentName}TriggerProps = {
  children?: ReactNode;
  disabled?: boolean;
};
`;

    case 'Close':
      return `import type { ReactNode } from 'react';

export type ${componentName}CloseProps = {
  children?: ReactNode;
  disabled?: boolean;
  onActivate?: () => void;
};
`;

    case 'Content':
    case 'Overlay':
    case 'Backdrop':
    case 'Title':
    case 'Description':
    case 'Anchor':
    case 'Arrow':
      return `import type { ReactNode } from 'react';

export type ${componentName}${partName}Props = {
  children?: ReactNode;
};
`;

    default:
      return `import type { ReactNode } from 'react';

export type ${componentName}${partName}Props = {
  children?: ReactNode;
};
`;
  }
}

export function renderWebOverlayPartComponentTemplate({
  componentName,
  partName,
}: OverlayPartTemplateParams) {
  switch (partName) {
    case 'Root':
      return `import type { ${componentName}Props } from '../types';

export function ${componentName}Root({ children }: ${componentName}Props) {
  return <>{children}</>;
}
`;

    case 'Trigger':
      return `import type { ${componentName}TriggerProps } from './types';

export function ${componentName}Trigger({
  children,
  disabled = false,
}: ${componentName}TriggerProps) {
  return (
    <button
      type='button'
      disabled={disabled}
      aria-haspopup='dialog'
    >
      {children}
    </button>
  );
}
`;

    case 'Close':
      return `import type { ${componentName}CloseProps } from './types';

export function ${componentName}Close({
  children,
  disabled = false,
  onActivate,
}: ${componentName}CloseProps) {
  return (
    <button type='button' disabled={disabled} onClick={onActivate}>
      {children}
    </button>
  );
}
`;

    case 'Content':
      return `import type { ${componentName}ContentProps } from './types';

export function ${componentName}Content({
  children,
}: ${componentName}ContentProps) {
  return (
    <div role='dialog' tabIndex={-1}>
      {children}
    </div>
  );
}
`;

    case 'Overlay':
    case 'Backdrop':
      return `import type { ${componentName}${partName}Props } from './types';

export function ${componentName}${partName}({
  children,
}: ${componentName}${partName}Props) {
  return <div aria-hidden='true'>{children}</div>;
}
`;

    case 'Title':
      return `import type { ${componentName}TitleProps } from './types';

export function ${componentName}Title({
  children,
}: ${componentName}TitleProps) {
  return <h2>{children}</h2>;
}
`;

    case 'Description':
      return `import type { ${componentName}DescriptionProps } from './types';

export function ${componentName}Description({
  children,
}: ${componentName}DescriptionProps) {
  return <p>{children}</p>;
}
`;

    case 'Anchor':
      return `import type { ${componentName}AnchorProps } from './types';

export function ${componentName}Anchor({
  children,
}: ${componentName}AnchorProps) {
  return <span>{children}</span>;
}
`;

    case 'Arrow':
      return `import type { ${componentName}ArrowProps } from './types';

export function ${componentName}Arrow({
  children,
}: ${componentName}ArrowProps) {
  return <span aria-hidden='true'>{children}</span>;
}
`;

    default:
      return `import type { ${componentName}${partName}Props } from './types';

export function ${componentName}${partName}({
  children,
}: ${componentName}${partName}Props) {
  return <div>{children}</div>;
}
`;
  }
}

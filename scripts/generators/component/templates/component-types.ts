export type ComponentTemplateParams = {
  componentName: string;
  parts?: readonly string[];
};

export function renderTypesTemplate({
  componentName,
}: ComponentTemplateParams) {
  return `import type { ReactNode } from 'react';

export type ${componentName}Props = {
  children?: ReactNode;
};
`;
}

export function renderSharedBaseTypesTemplate({
  componentName,
}: ComponentTemplateParams) {
  return `/**
 * Shared cross-platform API contract for ${componentName}.
 * Semantic completion may replace this empty contract with explicit props.
 */
export type Base${componentName}Props = unknown;
`;
}

function renderSharedCompoundPartType(params: {
  componentName: string;
  partName: string;
}) {
  const { componentName, partName } = params;
  const typeName = `Base${componentName}${partName}Props`;

  if (partName === 'Trigger') {
    return `export type ${typeName} = {
  disabled?: boolean;
  onActivate?: () => void;
};`;
  }

  if (partName === 'Content') {
    return `export type ${typeName} = {
  hidden?: boolean;
};`;
  }

  return `export type ${typeName} = unknown;`;
}

export function renderSharedCompoundTypesTemplate({
  componentName,
  parts = [],
}: ComponentTemplateParams) {
  const partTypes = parts
    .filter((partName) => partName !== 'Root')
    .map((partName) =>
      renderSharedCompoundPartType({ componentName, partName })
    )
    .join('\n\n');

  return `/**
 * Shared cross-platform API contract for ${componentName}.
 * Component-specific platform-neutral props belong in this file.
 */
export type Base${componentName}Props = unknown;
${partTypes ? `\n\n${partTypes}` : ''}
`;
}

export function renderSharedOverlayTypesTemplate({
  componentName,
}: ComponentTemplateParams) {
  return `/** Shared cross-platform controlled/uncontrolled overlay state. */
export interface Base${componentName}Props {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}
`;
}

export function renderSharedRendererTypesTemplate({
  componentName,
}: ComponentTemplateParams) {
  return `import type { Base${componentName}Props } from '@vellira-ui/types';
import type { ReactNode } from 'react';

type WithChildren<T> = T extends unknown
  ? T & {
      children?: ReactNode;
    }
  : never;

export type ${componentName}Props = WithChildren<Base${componentName}Props>;
`;
}

export const renderCompoundTypesTemplate = renderSharedRendererTypesTemplate;

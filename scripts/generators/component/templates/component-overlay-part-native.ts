import type { ComponentTemplateParams } from './component-types';

export type NativeOverlayPartTemplateParams = ComponentTemplateParams & {
  partName: string;
};

export function renderNativeOverlayPartTypesTemplate({
  componentName,
  partName,
}: NativeOverlayPartTemplateParams) {
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
  accessibilityLabel?: string;
};
`;

    case 'Close':
      return `import type { ReactNode } from 'react';

export type ${componentName}CloseProps = {
  children?: ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
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

export function renderNativeOverlayPartComponentTemplate({
  componentName,
  partName,
}: NativeOverlayPartTemplateParams) {
  switch (partName) {
    case 'Root':
      return `import type { ${componentName}Props } from '../types';

export function ${componentName}Root({ children }: ${componentName}Props) {
  return <>{children}</>;
}
`;

    case 'Trigger':
      return `import { Pressable } from 'react-native';

import type { ${componentName}TriggerProps } from './types';

export function ${componentName}Trigger({
  children,
  disabled = false,
  accessibilityLabel,
}: ${componentName}TriggerProps) {
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole='button'
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Pressable>
  );
}
`;

    case 'Close':
      return `import { Pressable } from 'react-native';

import type { ${componentName}CloseProps } from './types';

export function ${componentName}Close({
  children,
  disabled = false,
  accessibilityLabel,
  onActivate,
}: ${componentName}CloseProps) {
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole='button'
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel}
      onPress={onActivate}
    >
      {children}
    </Pressable>
  );
}
`;

    case 'Content':
      return `import { View } from 'react-native';

import type { ${componentName}ContentProps } from './types';

export function ${componentName}Content({
  children,
}: ${componentName}ContentProps) {
  return <View accessibilityViewIsModal>{children}</View>;
}
`;

    case 'Overlay':
    case 'Backdrop':
      return `import { View } from 'react-native';

import type { ${componentName}${partName}Props } from './types';

export function ${componentName}${partName}({
  children,
}: ${componentName}${partName}Props) {
  return (
    <View accessibilityElementsHidden importantForAccessibility='no-hide-descendants'>
      {children}
    </View>
  );
}
`;

    case 'Title':
      return `import { Text } from 'react-native';

import type { ${componentName}TitleProps } from './types';

export function ${componentName}Title({
  children,
}: ${componentName}TitleProps) {
  return <Text accessibilityRole='header'>{children}</Text>;
}
`;

    case 'Description':
      return `import { Text } from 'react-native';

import type { ${componentName}DescriptionProps } from './types';

export function ${componentName}Description({
  children,
}: ${componentName}DescriptionProps) {
  return <Text>{children}</Text>;
}
`;

    case 'Anchor':
      return `import { View } from 'react-native';

import type { ${componentName}AnchorProps } from './types';

export function ${componentName}Anchor({
  children,
}: ${componentName}AnchorProps) {
  return <View>{children}</View>;
}
`;

    case 'Arrow':
      return `import { View } from 'react-native';

import type { ${componentName}ArrowProps } from './types';

export function ${componentName}Arrow({
  children,
}: ${componentName}ArrowProps) {
  return (
    <View accessible={false} importantForAccessibility='no'>
      {children}
    </View>
  );
}
`;

    default:
      return `import { View } from 'react-native';

import type { ${componentName}${partName}Props } from './types';

export function ${componentName}${partName}({
  children,
}: ${componentName}${partName}Props) {
  return <View>{children}</View>;
}
`;
  }
}

import type {
  AccessibilityItem,
  ExtractedProp,
  GeneratedExample,
  GeneratedPageModel,
  Platform,
} from './types';

export function buildGeneratedPageModel(params: {
  componentName: string;
  slug: string;
  platforms: readonly Platform[];
  discovery?: GeneratedPageModel['discovery'];
  catalogPreview?: GeneratedPageModel['catalogPreview'];
  reactStaticDemoProps: string;
  nativeStaticDemoProps: string;
  reactDemoChildren: string;
  nativeDemoChildren: string;
  reactImports: readonly string[];
  nativeImports: readonly string[];
  nativeResponsivePresentation: boolean;
  playgroundProps: readonly ExtractedProp[];
  playgroundInitialValues: Record<string, string | boolean | number>;
  reactUsageChildren: string;
  nativeUsageChildren: string;
  generatedExamples: readonly GeneratedExample[];
  reactAccessibilityItems: readonly AccessibilityItem[];
  nativeAccessibilityItems: readonly AccessibilityItem[];
  reactApiSections: readonly {
    name: string;
    ownedProps: ExtractedProp[];
  }[];
  nativeApiSections: readonly {
    name: string;
    ownedProps: ExtractedProp[];
  }[];
  reactInheritedProps: readonly ExtractedProp[];
  nativeInheritedProps: readonly ExtractedProp[];
  relatedComponents: readonly string[];
}): GeneratedPageModel {
  return {
    componentName: params.componentName,
    slug: params.slug,
    platforms: params.platforms,
    discovery: params.discovery,
    catalogPreview: params.catalogPreview,
    demo: {
      staticProps: {
        react: params.reactStaticDemoProps,
        'react-native': params.nativeStaticDemoProps,
      },
      children: {
        react: params.reactDemoChildren,
        'react-native': params.nativeDemoChildren,
      },
      imports: {
        react: params.reactImports,
        'react-native': params.nativeImports,
      },
      responsivePresentation: params.nativeResponsivePresentation,
    },
    playground: {
      props: params.playgroundProps,
      initialValues: params.playgroundInitialValues,
    },
    usage: {
      children: {
        react: params.reactUsageChildren,
        'react-native': params.nativeUsageChildren,
      },
    },
    examples: params.generatedExamples,
    accessibility: {
      react: params.reactAccessibilityItems,
      'react-native': params.nativeAccessibilityItems,
    },
    api: {
      react: {
        sections: params.reactApiSections.map((section) => ({
          name: section.name,
          props: section.ownedProps,
        })),
        inheritedProps: params.reactInheritedProps,
      },
      'react-native': {
        sections: params.nativeApiSections.map((section) => ({
          name: section.name,
          props: section.ownedProps,
        })),
        inheritedProps: params.nativeInheritedProps,
      },
    },
    related: params.relatedComponents,
  };
}

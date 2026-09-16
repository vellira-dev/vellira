export type ComponentCatalogPlatform = 'react' | 'react-native';

export type ComponentCatalogProfile =
  | 'primitive'
  | 'form-control'
  | 'selection-control'
  | 'compound'
  | 'overlay'
  | 'navigation';

export type ComponentPlatformMetadata = {
  demoProps?: string;
  children?: string;
  childPropBindings?: readonly ComponentChildPropBinding[];
  imports?: readonly string[];
  setup?: readonly string[];
  responsivePresentation?: boolean;
};

export type ComponentChildPropBinding = {
  target: string;
  props: readonly string[];
};

export type ComponentDemoMetadata = {
  label?: string;
  description?: string;
  excludeControls?: readonly string[];
  initialValues?: Record<string, string | boolean | number>;
  /**
   * Static root prop expressions shared by generated demos. `children` is not
   * supported here; put inner JSX in `react.children` / `native.children`.
   */
  staticProps?: Record<string, string>;
  satisfiedRequiredProps?: readonly string[];
  previewWidth?: 'auto' | 'field' | 'full';
};

export type ComponentExampleMetadata = {
  title: string;
  description: string;
  /**
   * JSX prop fragments applied on every supported platform.
   * Bare identifiers are boolean shorthand only; non-boolean props need an
   * explicit assignment such as `size='lg'` or `value={value}`.
   */
  props: readonly string[];
  /** Whether this example inherits the component's configured demo props. */
  inheritDemoProps?: boolean;
  imports?: readonly string[];
  reactImports?: readonly string[];
  nativeImports?: readonly string[];
  /**
   * Executable statements scoped to this example's generated preview
   * component and included in the displayed code sample.
   */
  setup?: readonly string[];
  /** React-only executable setup statements appended after `setup`. */
  reactSetup?: readonly string[];
  /** React Native-only executable setup statements appended after `setup`. */
  nativeSetup?: readonly string[];
  /** React-only JSX prop fragments using the same rules as `props`. */
  reactProps?: readonly string[];
  /** React Native-only JSX prop fragments using the same rules as `props`. */
  nativeProps?: readonly string[];
  /** Inner React child markup inserted inside the generated component root. */
  reactChildren?: string;
  /**
   * Inner React Native child markup inserted inside the generated component
   * root.
   */
  nativeChildren?: string;
  platforms?: readonly ComponentCatalogPlatform[];
};

export type ComponentApiMetadata = {
  sections?: readonly {
    name: string;
    exportName: string | Partial<Record<ComponentCatalogPlatform, string>>;
  }[];
  descriptions?: Record<string, string>;
};

export type ComponentAccessibilityMetadata = {
  react?: readonly {
    title: string;
    description: string;
    props?: readonly string[];
  }[];
  native?: readonly {
    title: string;
    description: string;
    props?: readonly string[];
  }[];
};

export type ComponentDiscoveryPatternMetadata = {
  id: string;
  title: string;
  description: string;
};

export type ComponentDiscoveryMetadata = {
  status?: 'complete' | 'needs-authored-intent';
  summary?: string;
  description?: string;
  whenToUse?: readonly string[];
  patterns?: readonly ComponentDiscoveryPatternMetadata[];
  platformNotes?: Partial<
    Record<ComponentCatalogPlatform, readonly string[]>
  >;
  missingEvidence?: readonly string[];
};

export type ComponentPageMetadata = {
  profile?: ComponentCatalogProfile;
  react?: ComponentPlatformMetadata;
  native?: ComponentPlatformMetadata;
  demo?: ComponentDemoMetadata;
  defaults?: {
    shared?: Record<string, string | boolean | number>;
    react?: Record<string, string | boolean | number>;
    native?: Record<string, string | boolean | number>;
  };
  discovery?: ComponentDiscoveryMetadata;
  examples?: readonly ComponentExampleMetadata[];
  api?: ComponentApiMetadata;
  accessibility?: ComponentAccessibilityMetadata;
  related?: readonly string[];
};

export function defineComponentPageMetadata(metadata: ComponentPageMetadata) {
  return metadata;
}

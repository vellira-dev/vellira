export type ComponentPlatform = 'react' | 'react-native';

export type ComponentLayer = 'primitives' | 'components' | 'patterns';

export type ComponentStatus = 'experimental' | 'stable' | 'deprecated';

export type ComponentCategory =
  | 'action'
  | 'form'
  | 'navigation'
  | 'overlay'
  | 'feedback'
  | 'data-display'
  | 'layout'
  | 'utility';

export type ComponentCapability =
  | 'controlled'
  | 'uncontrolled'
  | 'disabled'
  | 'required'
  | 'invalid'
  | 'loading'
  | 'keyboard'
  | 'focus-management'
  | 'compound-api'
  | 'multiple'
  | 'collapsible'
  | 'portal'
  | 'responsive';

export type ComponentProfile = 'base' | 'form-control' | 'compound' | 'overlay';

export interface ComponentDependencySet {
  packages?: readonly string[];
  components?: readonly string[];
}

export interface ComponentDependencies extends ComponentDependencySet {
  platforms?: Partial<Record<ComponentPlatform, ComponentDependencySet>>;
}

export interface ComponentIconRequirement {
  name: string;
  purpose: string;
}

export interface ComponentAssetRequirement {
  path: string;
  purpose: string;
}

export type ComponentTokenContract =
  'standard' | 'boolean-control' | 'disclosure';

export interface ComponentRequirements {
  tests: boolean;
  storybook: boolean;
  docs: boolean;
  accessibility: boolean;
  componentTokens?: ComponentTokenContract | false;
  tokens?: readonly string[];
  icons?: readonly ComponentIconRequirement[];
  assets?: readonly ComponentAssetRequirement[];
}

export interface ComponentMetadata {
  name: string;
  layer: ComponentLayer;
  category: ComponentCategory;
  platforms: readonly ComponentPlatform[];
  profile: ComponentProfile;
  status: ComponentStatus;
  capabilities?: readonly ComponentCapability[];
  dependencies?: ComponentDependencies;
  requirements: ComponentRequirements;
}

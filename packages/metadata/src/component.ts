export type ComponentPlatform = 'react' | 'react-native';

export type ComponentLayer = 'primitives' | 'components' | 'patterns';

/** Canonical public component lifecycle, ordered from earliest to latest. */
export const componentLifecycleStatuses = [
  'experimental',
  'beta',
  'stable',
  'deprecated',
] as const;

export type ComponentLifecycle = (typeof componentLifecycleStatuses)[number];

/** Backwards-compatible name for consumers that render lifecycle status. */
export type ComponentStatus = ComponentLifecycle;

export const componentLifecycleDefinitions: Record<
  ComponentLifecycle,
  { description: string }
> = {
  experimental: {
    description:
      'Scaffolded or incomplete; not yet ready for public production use.',
  },
  beta: {
    description:
      'Public and production-reviewable, but the Stable graduation contract is not yet satisfied.',
  },
  stable: {
    description:
      'Passed the deterministic Stable graduation contract and has explicit human approval.',
  },
  deprecated: {
    description:
      'Deprecated by an explicit lifecycle decision; quality failure never infers this state.',
  },
};

export type ComponentCategory =
  | 'action'
  | 'form'
  | 'navigation'
  | 'overlay'
  | 'feedback'
  | 'data-display'
  | 'layout'
  | 'utility';

export const componentCapabilities = [
  'controlled',
  'uncontrolled',
  'disabled',
  'required',
  'invalid',
  'loading',
  'keyboard',
  'focus-management',
  'compound-api',
  'multiple',
  'collapsible',
  'portal',
  'responsive',
] as const;

export type ComponentCapability = (typeof componentCapabilities)[number];

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

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

/**
 * Existing generator/quality capability vocabulary. These capabilities may
 * drive deterministic scaffold, test, quality, and Stable contracts.
 */
export const componentCapabilities = [
  'controlled',
  'uncontrolled',
  'indeterminate',
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

/**
 * Small V1 vocabulary for approved product semantics that are intentionally
 * more specific than Generator V2's structural/behavior capability model.
 */
export const componentSemanticCapabilities = [
  'accessible-name',
  'accessible-value',
  'announcement',
  'auto-dismiss',
  'dismissible',
  'fallback',
  'image-source',
  'multiline',
  'reduced-motion',
  'size-variants',
  'stacking',
  'value-range',
] as const;

export type ComponentSemanticCapability =
  (typeof componentSemanticCapabilities)[number];

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
  /** Existing Generator/Quality capabilities implemented by the component. */
  capabilities?: readonly ComponentCapability[];
  /** Product-semantic evidence implemented across every declared platform. */
  semanticCapabilities?: readonly ComponentSemanticCapability[];
  /** Product-semantic evidence that is intentionally platform-scoped. */
  platformSemanticCapabilities?: Partial<
    Record<ComponentPlatform, readonly ComponentSemanticCapability[]>
  >;
  dependencies?: ComponentDependencies;
  requirements: ComponentRequirements;
}

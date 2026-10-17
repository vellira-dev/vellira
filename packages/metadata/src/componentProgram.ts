import type { ComponentPlatform } from './component';
import type { ComponentIntentCapability } from './componentIntent';
import type {
  ComponentQualityDimension,
  ComponentQualityEvaluationKind,
} from './quality';

/** Public semantic language, not a runtime interpreter or a component catalog. */
export const COMPONENT_PROGRAM_SCHEMA_VERSION = '1' as const;

export const componentAnatomyRoles = [
  'root',
  'trigger',
  'content',
  'item',
  'indicator',
  'label',
  'description',
  'icon',
  'image',
  'fallback',
  'action',
  'close',
  'portal',
  'overlay',
  'viewport',
  'group',
  'input',
  'list',
  'search',
  'header',
  'body',
  'footer',
  'anchor',
] as const;
export const componentStateDomains = [
  'boolean',
  'text',
  'selection',
  'multi-selection',
  'selection-union',
  'number',
  'collection',
  'image-status',
  'deadline',
  'pause-reasons',
] as const;
export const componentStateOwners = [
  'controlled',
  'uncontrolled',
  'controlled-uncontrolled',
  'derived',
  'read-only',
  'internal',
] as const;
export const componentProgramEvents = [
  'press',
  'value-change',
  'pointer-enter',
  'pointer-leave',
  'focus',
  'blur',
  'keyboard',
  'escape',
  'back',
  'outside',
  'timeout',
  'source-change',
  'load',
  'error',
  'mount',
  'unmount',
  'open',
  'close',
  'motion-preference',
] as const;
export const componentTransitionActions = [
  'request-change',
  'open',
  'close',
  'resolve',
  'reject',
  'reset',
  'cleanup',
  'pause',
  'resume',
  'update',
  'derive',
] as const;
export const componentApiConventions = [
  'none',
  'review-required',
  'open',
  'checked',
  'value',
] as const;

export type ComponentAnatomyRole = (typeof componentAnatomyRoles)[number];
export type ComponentStateDomain = (typeof componentStateDomains)[number];
export type ComponentStateOwner = (typeof componentStateOwners)[number];
export type ComponentProgramEvent = (typeof componentProgramEvents)[number];
export type ComponentTransitionAction =
  (typeof componentTransitionActions)[number];
export type ComponentApiConvention = (typeof componentApiConventions)[number];

/** Opt-in Boolean callback semantics. Omission retains the original flat API. */
export interface ComponentStateChangeV1 {
  schemaVersion: '1';
  platforms: readonly ComponentPlatform[];
  transitions: readonly ('to-false' | 'to-true')[];
  emitTransitions: readonly ('to-false' | 'to-true')[];
  reasonDomain: {
    id: string;
    values: readonly {
      value: string;
      transitions: readonly ('to-false' | 'to-true')[];
    }[];
  };
}

/** Finite review-only references, never inline datasets or module parameters. */
export interface ComponentProgramNumericBindingSlotsV1 {
  schemaVersion: '1';
  /** Fingerprint of the unchanged compiled program without this proposal. */
  baseProgramFingerprint: string;
  slots: readonly Readonly<{
    id: string;
    kind: 'bounded-numeric-series';
    platform: 'react';
    ownerRootId: string;
    bindingFingerprint: string;
    authorityFingerprint: string;
  }>[];
}

export interface ComponentProgramDecisionsV1 {
  schemaVersion: '1';
  anatomy: readonly {
    id: string;
    role: ComponentAnatomyRole;
    parent: string | null;
  }[];
  states: readonly {
    id: string;
    domain: ComponentStateDomain;
    ownership: ComponentStateOwner;
    api: ComponentApiConvention;
    change?: ComponentStateChangeV1;
  }[];
  transitions: readonly {
    state: string;
    event: ComponentProgramEvent;
    action: ComponentTransitionAction;
    platforms: readonly ComponentPlatform[];
  }[];
  modules: readonly {
    id: string;
    platforms: readonly ComponentPlatform[];
    bindings: Readonly<Record<string, string>>;
    /** Only keys and scalar types declared by the selected public module. */
    parameters?: Readonly<Record<string, string | number>>;
  }[];
  /** Review-only numeric slots. A nonempty proposal cannot compile in V1. */
  numericBindingSlots?: ComponentProgramNumericBindingSlotsV1;
}

/** Derived from existing metadata/intent/spec, never separately authored. */
export interface ComponentProgramSourceV1 {
  platforms: readonly ComponentPlatform[];
  capabilities: readonly {
    capability: ComponentIntentCapability;
    platforms: readonly ComponentPlatform[];
  }[];
  parts: readonly string[];
  resources: {
    componentTokens: string | false;
    tokens: readonly string[];
    icons: readonly { name: string; purpose: string }[];
    assets: readonly { path: string; purpose: string }[];
  };
}

export interface ComponentProgramFindingV1 {
  code:
    | 'missing-grammar-capability'
    | 'semantic-decision-required'
    | 'invalid-composition';
  subject: string;
  reason: string;
}

export interface ComponentProgramProofObligationV1 {
  id: string;
  module: string;
  platform: ComponentPlatform;
  dimension: ComponentQualityDimension;
  evaluation: ComponentQualityEvaluationKind;
  /** Existing checker owner where applicable; a reference is not a passing proof. */
  ruleId: string | null;
  statement: string;
}

export interface ComponentProgramV1 {
  schemaVersion: '1';
  grammarFingerprint: string;
  source: ComponentProgramSourceV1;
  decisions: ComponentProgramDecisionsV1;
  order: readonly string[];
  capabilityTraces: readonly {
    capability: ComponentIntentCapability;
    platform: ComponentPlatform;
    module: string;
    obligationIds: readonly string[];
  }[];
  apiConsequences: readonly {
    state: string;
    name: string;
    kind: 'value' | 'initial' | 'change';
    valueType: string;
    required: boolean;
    /** Present only for an explicitly selected reason-bearing change API. */
    change?: ComponentStateChangeV1;
    /** Exact public type projection for the opt-in callback. */
    typeExpression?: string;
  }[];
  platformPlans: readonly {
    platform: ComponentPlatform;
    modules: readonly { id: string; adapter: string }[];
  }[];
  obligations: readonly ComponentProgramProofObligationV1[];
}

export interface ComponentProgramCompilationV1 {
  schemaVersion: '1';
  disposition:
    'compiled' | 'review-required' | 'missing-grammar-capability' | 'blocked';
  findings: readonly ComponentProgramFindingV1[];
  program: ComponentProgramV1 | null;
  fingerprint: string | null;
}

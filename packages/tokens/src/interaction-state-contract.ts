import type { CanonicalInteractionState } from './token-architecture.js';

export type CompoundInteractionResolution = {
  readonly strategy:
    | 'selected-variant'
    | 'disabled-wins'
    | 'orthogonal-focus'
    | 'domain-specific-active';
  readonly semanticPath: string | null;
  readonly meaning: string;
};

/**
 * Companion contract for Interaction State Vocabulary V1 (#882).
 *
 * State names and their meanings remain owned by token-architecture.ts. This
 * contract only defines how selected composes with every other canonical state
 * so renderers and generators cannot invent precedence rules independently.
 */
export const selectedCompoundStateGrammarV1 = {
  default: {
    strategy: 'selected-variant',
    semanticPath: 'semantic.control.selected.default',
    meaning: 'Selected resting presentation.',
  },
  hover: {
    strategy: 'selected-variant',
    semanticPath: 'semantic.control.selected.hover',
    meaning: 'Selected plus pointer hover when the platform supports hover.',
  },
  pressed: {
    strategy: 'selected-variant',
    semanticPath: 'semantic.control.selected.pressed',
    meaning: 'Selected plus transient physical pointer/key press.',
  },
  active: {
    strategy: 'domain-specific-active',
    semanticPath: null,
    meaning:
      'Selected may combine with active only in a registered persistent/current active domain; active is never physical press.',
  },
  selected: {
    strategy: 'selected-variant',
    semanticPath: 'semantic.control.selected.default',
    meaning: 'Idempotent selected state resolves to the selected baseline.',
  },
  disabled: {
    strategy: 'disabled-wins',
    semanticPath: 'semantic.control.disabled',
    meaning:
      'Disabled suppresses transient hover/press interaction. Components may preserve selected identity with component-level selected+disabled paint.',
  },
  focus: {
    strategy: 'orthogonal-focus',
    semanticPath: 'semantic.focus.ring',
    meaning:
      'Focus indication composes orthogonally with selection and does not replace the selected paint state.',
  },
} as const satisfies Record<
  CanonicalInteractionState,
  CompoundInteractionResolution
>;

export type PlatformInteractionStateMapping = {
  readonly support: 'required' | 'optional';
  readonly signal: string;
  readonly meaning: string;
};

/**
 * Platform event/state mapping for the canonical vocabulary.
 *
 * React Native hover is deliberately optional: pointer-capable RN targets may
 * expose it, but native parity never requires hover where the platform has no
 * hover capability.
 */
export const interactionStatePlatformContractV1 = {
  web: {
    default: {
      support: 'required',
      signal: 'rest',
      meaning: 'Resting enabled presentation.',
    },
    hover: {
      support: 'required',
      signal: ':hover',
      meaning: 'Pointer hover only.',
    },
    pressed: {
      support: 'required',
      signal: ':active',
      meaning: 'Transient pointer/key activation while held.',
    },
    active: {
      support: 'required',
      signal: 'domain-current',
      meaning: 'Persistent/current domain state, never the CSS :active press.',
    },
    selected: {
      support: 'required',
      signal: ':checked-or-aria-selected',
      meaning: 'Persistent chosen/checked/selected state.',
    },
    disabled: {
      support: 'required',
      signal: ':disabled-or-aria-disabled',
      meaning: 'Unavailable interaction state.',
    },
    focus: {
      support: 'required',
      signal: ':focus-visible-or-focus',
      meaning: 'Current input focus indication.',
    },
  },
  'react-native': {
    default: {
      support: 'required',
      signal: 'rest',
      meaning: 'Resting enabled presentation.',
    },
    hover: {
      support: 'optional',
      signal: 'pointer-hover-when-capable',
      meaning: 'Optional pointer hover on targets that expose hover capability.',
    },
    pressed: {
      support: 'required',
      signal: 'PressableStateCallbackType.pressed',
      meaning: 'Transient physical press reported by Pressable state.',
    },
    active: {
      support: 'required',
      signal: 'domain-current',
      meaning: 'Persistent/current domain state, never Pressable.pressed.',
    },
    selected: {
      support: 'required',
      signal: 'accessibilityState.checked-or-selected',
      meaning: 'Persistent chosen/checked/selected state.',
    },
    disabled: {
      support: 'required',
      signal: 'disabled-and-accessibilityState.disabled',
      meaning: 'Unavailable interaction state.',
    },
    focus: {
      support: 'optional',
      signal: 'focus-when-capable',
      meaning:
        'Focus indication on keyboard/TV/pointer-capable targets; not fabricated on targets without focus presentation.',
    },
  },
} as const satisfies Record<
  'web' | 'react-native',
  Record<CanonicalInteractionState, PlatformInteractionStateMapping>
>;

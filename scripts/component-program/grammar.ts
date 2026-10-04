import type { ComponentPlatform } from '../../packages/metadata/src/component';
import type { ComponentIntentCapability } from '../../packages/metadata/src/componentIntent';
import type {
  ComponentAnatomyRole,
  ComponentStateDomain,
  ComponentStateOwner,
  ComponentProgramEvent,
  ComponentTransitionAction,
  ComponentProgramProofObligationV1,
} from '../../packages/metadata/src/componentProgram';

type Obligation = Omit<
  ComponentProgramProofObligationV1,
  'module' | 'platform'
> & { platforms: readonly ComponentPlatform[] };
export interface GrammarModuleV1 {
  id: string;
  capabilities: readonly ComponentIntentCapability[];
  platforms: readonly ComponentPlatform[];
  requires: readonly string[];
  implies: readonly string[];
  conflicts: readonly string[];
  roles: readonly ComponentAnatomyRole[];
  parameters: readonly (
    | { id: string; kind: 'choice'; choices: readonly string[] }
    | { id: string; kind: 'integer'; minimum: number; maximum: number }
  )[];
  slots: readonly {
    id: string;
    domains: readonly ComponentStateDomain[];
    owners: readonly ComponentStateOwner[];
    platforms: readonly ComponentPlatform[];
  }[];
  transitions: readonly {
    slot: string;
    event: ComponentProgramEvent;
    action: ComponentTransitionAction;
    platforms: readonly ComponentPlatform[];
  }[];
  adapters: Readonly<Partial<Record<ComponentPlatform, string>>>;
  obligations: readonly Obligation[];
}
const BOTH = ['react', 'react-native'] as const;
const INTERNAL = ['internal'] as const;
const ANY_OWNER = [
  'controlled',
  'uncontrolled',
  'controlled-uncontrolled',
  'derived',
  'read-only',
  'internal',
] as const;
const proof = (
  id: string,
  statement: string,
  dimension: Obligation['dimension'] = 'behavior',
  ruleId: string | null = null,
  platforms: readonly ComponentPlatform[] = BOTH
): Obligation => ({
  id,
  statement,
  dimension,
  ruleId,
  platforms,
  evaluation: ruleId === null ? 'human-review' : 'automated',
});
const module = (
  id: string,
  capabilities: readonly ComponentIntentCapability[],
  overrides: Partial<GrammarModuleV1> = {}
): GrammarModuleV1 => ({
  id,
  capabilities,
  platforms: BOTH,
  requires: [],
  implies: [],
  conflicts: [],
  roles: [],
  parameters: [],
  slots: [],
  transitions: [],
  adapters: { react: 'semantic-contract', 'react-native': 'semantic-contract' },
  ...overrides,
  obligations: (
    overrides.obligations ?? [
      proof(
        'implementation',
        'Demonstrate the declared semantic behavior independently of generated implementation assertions.'
      ),
    ]
  ).flatMap((item) =>
    item.ruleId === null
      ? [item]
      : [
          { ...item, evaluation: 'human-review' as const, ruleId: null },
          {
            ...item,
            id: `${item.id}-structural`,
            statement: `Run canonical rule ${item.ruleId}; this is structural evidence, not independent behavioral proof.`,
          },
        ]
  ),
});
const slot = (
  id: string,
  domains: readonly ComponentStateDomain[],
  owners: readonly ComponentStateOwner[] = ANY_OWNER,
  platforms: readonly ComponentPlatform[] = BOTH
) => ({ id, domains, owners, platforms });
const transition = (
  slot: string,
  event: ComponentProgramEvent,
  action: ComponentTransitionAction,
  platforms: readonly ComponentPlatform[] = BOTH
) => ({ slot, event, action, platforms });

/**
 * Reviewed reusable semantics; never select by component name, category or path.
 * Evidence and derivation rationale are in component-program-v1.md. These laws
 * are obligations, not assertions that existing regex quality checks prove them.
 */
export const componentGrammarV1: readonly GrammarModuleV1[] = [
  module('state-control', ['controlled', 'uncontrolled'], {
    obligations: [
      proof(
        'ownership',
        'One state authority; controlled values are never silently shadowed by internal state.'
      ),
      proof(
        'api',
        'Approved controlled/default/change API is preserved.',
        'public-api',
        'api.controlled-contract'
      ),
    ],
  }),
  module('field-state', ['disabled', 'required', 'invalid'], {
    adapters: {
      react: 'form-attributes-and-label-association',
      'react-native': 'accessibility-state-and-field-association',
    },
    obligations: [
      proof(
        'field-state',
        'Disabled, required and invalid state must agree between interaction, visual treatment and accessibility.',
        'accessibility',
        'platform.accessibility-semantics'
      ),
    ],
  }),
  module('mixed-state', ['indeterminate'], {
    requires: ['field-state'],
    slots: [slot('value', ['boolean'])],
    obligations: [
      proof(
        'mixed',
        'Mixed presentation must not create a second checked-state owner.',
        'accessibility'
      ),
    ],
  }),
  module('loading', ['loading'], {
    obligations: [
      proof(
        'loading',
        'Loading state must preserve the approved interaction and accessibility contract.'
      ),
    ],
  }),
  module('compound', ['compound-api'], {
    roles: ['root'],
    obligations: [
      proof(
        'parts',
        'Public root and part ownership agree across platforms.',
        'public-api',
        'api.shared-type-contract'
      ),
    ],
  }),
  module('selection', [], {
    slots: [slot('value', ['selection', 'multi-selection', 'selection-union'])],
    roles: ['item'],
    obligations: [
      proof(
        'identity',
        'Item identities are stable; selected value and active focus are distinct authorities.'
      ),
    ],
  }),
  module('multiple-selection', ['multiple'], {
    implies: ['selection'],
    conflicts: ['radio-semantics'],
    slots: [slot('value', ['multi-selection', 'selection-union'])],
    obligations: [
      proof(
        'cardinality',
        'Multi-selection has one value owner; single-only collapsibility is not applied to the multiple branch.'
      ),
    ],
  }),
  module('radio-semantics', [], {
    requires: ['selection'],
    conflicts: ['multiple-selection'],
    slots: [slot('value', ['selection'])],
    adapters: {
      react: 'radiogroup-and-radio',
      'react-native': 'radio-accessibility-state',
    },
    obligations: [
      proof(
        'exclusive',
        'Exactly the declared single-selection policy is exposed to assistive technology.',
        'accessibility'
      ),
    ],
  }),
  module('disclosure', ['collapsible'], {
    roles: ['trigger', 'content'],
    obligations: [
      proof(
        'visibility',
        'Expanded state, trigger accessibility and content visibility share one authority.'
      ),
    ],
  }),
  module('keyboard-navigation', ['keyboard'], {
    adapters: {
      react: 'keyboard-navigation',
      'react-native': 'native-touch-and-supported-keyboard',
    },
    obligations: [
      proof(
        'navigation',
        'Respect approved orientation, disabled items, activation mode and platform input mechanisms.',
        'interaction',
        'platform.interaction'
      ),
    ],
  }),
  module('focus-management', ['focus-management'], {
    adapters: {
      react: 'dom-focus-scope-and-restore',
      'react-native': 'native-focus-and-presentation-restore',
    },
    obligations: [
      proof(
        'focus',
        'Focus ownership, nesting and restore obey the approved interaction model.',
        'accessibility',
        'platform.focus-management'
      ),
    ],
  }),
  module('presentation', ['portal'], {
    requires: ['compound'],
    roles: ['content'],
    adapters: { react: 'dom-portal', 'react-native': 'native-presentation' },
    obligations: [
      proof(
        'presentation',
        'Platform-specific presentation preserves shared open/close semantics.',
        'platform-quality',
        'platform.overlay-presentation'
      ),
    ],
  }),
  module('responsive-layout', ['responsive'], {
    adapters: {
      react: 'responsive-layout',
      'react-native': 'native-layout-measurement',
    },
    obligations: [
      proof(
        'layout',
        'Layout changes preserve semantic order and focus.',
        'platform-quality'
      ),
    ],
  }),
  module('accessible-name', ['accessible-name'], {
    adapters: {
      react: 'accessible-name-computation',
      'react-native': 'accessibility-label',
    },
    obligations: [
      proof(
        'name',
        'Provide a human-readable accessible name without duplicate announcements.',
        'accessibility',
        'platform.accessibility-semantics'
      ),
    ],
  }),
  module('value-range', ['value-range', 'accessible-value'], {
    slots: [slot('value', ['number'], ['read-only', 'derived', 'controlled'])],
    adapters: {
      react: 'aria-value-range',
      'react-native': 'accessibility-value',
    },
    obligations: [
      proof(
        'range',
        'Accessible current/min/max values obey approved bounds; unknown bounds require review.',
        'accessibility'
      ),
    ],
  }),
  module('image-source', ['image-source'], {
    roles: ['image'],
    slots: [slot('image', ['image-status'], INTERNAL)],
    transitions: [
      transition('image', 'source-change', 'reset'),
      transition('image', 'load', 'resolve'),
      transition('image', 'error', 'reject'),
    ],
    adapters: {
      react: 'html-image-events',
      'react-native': 'native-image-events',
    },
    obligations: [
      proof(
        'lifecycle',
        'Source changes reset image lifecycle; stale load/error events cannot replace the current source.'
      ),
    ],
  }),
  module('image-fallback', ['fallback'], {
    requires: ['image-source'],
    roles: ['fallback'],
    slots: [slot('image', ['image-status'], INTERNAL)],
    obligations: [
      proof(
        'fallback',
        'Loading and failed source states select the approved deterministic fallback.'
      ),
    ],
  }),
  module('size-variants', ['size-variants'], {
    obligations: [
      proof(
        'geometry',
        'Approved sizes use exact canonical component/global token authority; never fabricated token paths.',
        'tokens-theming'
      ),
      proof(
        'size-proof',
        'Every approved size resolves to deterministic geometry on each platform.',
        'tests'
      ),
    ],
  }),
  module('multiline', ['multiline'], {
    slots: [slot('value', ['text'])],
    roles: ['input'],
    adapters: { react: 'textarea', 'react-native': 'multiline-text-input' },
    obligations: [
      proof(
        'editing',
        'Multiline editing preserves the approved value and accessible naming contracts.'
      ),
    ],
  }),
  module('dismissible', ['dismissible'], {
    slots: [
      slot(
        'open',
        ['boolean'],
        ['controlled', 'uncontrolled', 'controlled-uncontrolled', 'internal']
      ),
    ],
    obligations: [
      proof(
        'close-once',
        'Manual dismissal requests one close and does not steal focus.'
      ),
      proof(
        'affordance',
        'Dismiss/action affordances remain named and keyboard- or touch-accessible.',
        'accessibility'
      ),
    ],
  }),
  module('auto-dismiss', ['auto-dismiss'], {
    parameters: [
      {
        id: 'default-duration-ms',
        kind: 'integer',
        minimum: 1,
        maximum: 600000,
      },
    ],
    implies: ['dismissible'],
    slots: [
      slot(
        'open',
        ['boolean'],
        ['controlled', 'uncontrolled', 'controlled-uncontrolled', 'internal']
      ),
      slot('clock', ['deadline'], INTERNAL),
      slot('pause', ['pause-reasons'], INTERNAL, ['react']),
    ],
    transitions: [
      transition('open', 'timeout', 'close'),
      transition('clock', 'open', 'reset'),
      transition('clock', 'close', 'cleanup'),
      transition('clock', 'unmount', 'cleanup'),
      transition('pause', 'pointer-enter', 'pause', ['react']),
      transition('pause', 'pointer-leave', 'resume', ['react']),
      transition('pause', 'focus', 'pause', ['react']),
      transition('pause', 'blur', 'resume', ['react']),
    ],
    adapters: {
      react: 'deadline-with-independent-pointer-focus-pauses',
      'react-native': 'native-lifecycle-deadline',
    },
    obligations: [
      proof(
        'deadline-stability',
        'Unrelated or callback-only rerenders do not restart an active deadline.'
      ),
      proof(
        'remaining-budget',
        'Pause reasons compose independently; resume only after all reasons clear, preserving remaining duration.',
        'behavior',
        null,
        ['react']
      ),
      proof(
        'timeout-once',
        'Emit at most one timeout close request per open lifecycle.'
      ),
      proof(
        'reset-cleanup',
        'Reopen resets timing; close/unmount clean up timers and stale callbacks.'
      ),
      proof(
        'deadline-mutation',
        'Independent fake-clock tests must detect restarted deadlines, overlapping-pause errors and stale callbacks.',
        'tests'
      ),
    ],
  }),
  module('stacking', ['stacking'], {
    parameters: [
      { id: 'maximum-visible', kind: 'integer', minimum: 1, maximum: 1024 },
      {
        id: 'overflow',
        kind: 'choice',
        choices: ['drop-oldest', 'drop-newest', 'queue'],
      },
    ],
    slots: [
      slot('items', ['collection'], ['internal', 'controlled', 'read-only']),
    ],
    roles: ['viewport'],
    obligations: [
      proof(
        'order-overflow',
        'Rapid insertion preserves deterministic order and the explicitly approved maximum/overflow policy.'
      ),
    ],
  }),
  module('announcement', ['announcement'], {
    adapters: {
      react: 'bounded-dom-live-region',
      'react-native': 'native-accessibility-announcement',
    },
    obligations: [
      proof(
        'announcement',
        'One event produces the expected platform announcement without duplicate emission, focus theft or unnecessary disruption.',
        'accessibility'
      ),
    ],
  }),
  module('reduced-motion', ['reduced-motion'], {
    adapters: {
      react: 'prefers-reduced-motion',
      'react-native': 'native-reduce-motion-preference',
    },
    obligations: [
      proof(
        'presentation-only',
        'Motion preference changes presentation only, never semantic open/close behavior or an active deadline.'
      ),
      proof(
        'motion-mutation',
        'Preference resolution must not restart an active auto-dismiss deadline.',
        'tests'
      ),
    ],
  }),
];

export const componentGrammarInteractionsV1 = [
  {
    kind: 'shared-state',
    left: 'image-source',
    right: 'image-fallback',
    slot: 'image',
  },
  {
    kind: 'shared-state',
    left: 'selection',
    right: 'multiple-selection',
    slot: 'value',
  },
  {
    kind: 'shared-state',
    left: 'selection',
    right: 'radio-semantics',
    slot: 'value',
  },
  {
    kind: 'shared-state',
    left: 'auto-dismiss',
    right: 'dismissible',
    slot: 'open',
  },
  {
    kind: 'event-cannot-write',
    left: 'auto-dismiss',
    right: 'reduced-motion',
    slot: 'clock',
    event: 'motion-preference',
  },
] as const;

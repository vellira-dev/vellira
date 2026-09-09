export type TokenLifecycleStatus = 'current' | 'reserved' | 'deprecated';

export type ComponentTokenLifecycleEntry = {
  status: TokenLifecycleStatus;
  public: boolean;
  owner: string;
  purpose: string;
};

export type SemanticTokenLifecycleEntry = {
  status: TokenLifecycleStatus;
  public: boolean;
  authority: 'component-input' | 'shared-lower-level' | 'compatibility';
  owner: string;
  purpose: string;
  /** Component contracts (components.Name) or repository source paths with semantic access. */
  consumerEvidence: readonly string[];
};

/**
 * Canonical lifecycle authority for public component-token families.
 *
 * `current` entries must correspond to real canonical component metadata.
 * `reserved` entries are the only future families Generator V2 may materialize.
 * `deprecated` entries are compatibility contracts or tombstones and must never
 * be treated as canonical component ownership.
 */
export const componentTokenLifecycle = {
  Accordion: {
    status: 'current',
    public: true,
    owner: 'Accordion',
    purpose: 'Canonical Accordion component token contract.',
  },
  Button: {
    status: 'current',
    public: true,
    owner: 'Button',
    purpose: 'Canonical Button component token contract.',
  },
  Checkbox: {
    status: 'current',
    public: true,
    owner: 'Checkbox',
    purpose: 'Canonical Checkbox component token contract.',
  },
  ContextMenu: {
    status: 'deprecated',
    public: true,
    owner: 'token-compatibility',
    purpose:
      'Legacy public family without canonical component metadata; retained only as an explicit compatibility contract.',
  },
  Dropdown: {
    status: 'current',
    public: true,
    owner: 'Dropdown',
    purpose: 'Canonical Dropdown component token contract.',
  },
  FormField: {
    status: 'current',
    public: true,
    owner: 'FormField',
    purpose: 'Canonical FormField component token contract.',
  },
  Input: {
    status: 'current',
    public: true,
    owner: 'Input',
    purpose: 'Canonical Input component token contract.',
  },
  Modal: {
    status: 'current',
    public: true,
    owner: 'Modal',
    purpose: 'Canonical Modal component token contract.',
  },
  Popover: {
    status: 'current',
    public: true,
    owner: 'Popover',
    purpose: 'Canonical Popover component token contract.',
  },
  Radio: {
    status: 'current',
    public: true,
    owner: 'Radio',
    purpose: 'Canonical Radio component token contract.',
  },
  RadioGroup: {
    status: 'current',
    public: true,
    owner: 'RadioGroup',
    purpose: 'Canonical RadioGroup component token contract.',
  },
  Select: {
    status: 'current',
    public: true,
    owner: 'Select',
    purpose: 'Canonical Select component token contract.',
  },
  Switch: {
    status: 'current',
    public: true,
    owner: 'Switch',
    purpose: 'Canonical Switch component token contract.',
  },
  Tabs: {
    status: 'current',
    public: true,
    owner: 'Tabs',
    purpose: 'Canonical Tabs component token contract.',
  },
  Tooltip: {
    status: 'current',
    public: true,
    owner: 'Tooltip',
    purpose: 'Canonical Tooltip component token contract.',
  },
} as const satisfies Record<string, ComponentTokenLifecycleEntry>;

/**
 * Canonical lifecycle and authority classification for semantic namespaces.
 * The registry intentionally includes removed tombstones so deleted authorities
 * cannot silently reappear merely because generated shape parity stays green.
 */
export const semanticTokenLifecycle = {
  action: {
    status: 'deprecated',
    public: true,
    authority: 'compatibility',
    owner: 'token-compatibility',
    purpose:
      'Legacy generic action palette; retained explicitly for compatibility while component intent tokens remain canonical.',
    consumerEvidence: ['apps/native-playground/App.tsx'],
  },
  border: {
    status: 'current',
    public: true,
    authority: 'shared-lower-level',
    owner: 'semantic-foundation',
    purpose:
      'Shared semantic border roles consumed by component token families.',
    consumerEvidence: [
      'components.Button',
      'components.Dropdown',
      'components.Tabs',
    ],
  },
  control: {
    status: 'current',
    public: true,
    authority: 'component-input',
    owner: 'form-controls',
    purpose:
      'Shared control-state roles for form-control component token families.',
    consumerEvidence: ['components.Checkbox', 'components.Radio'],
  },
  divider: {
    status: 'deprecated',
    public: true,
    authority: 'compatibility',
    owner: 'token-compatibility',
    purpose:
      'Legacy public divider roles without internal consumers; retained only for compatibility.',
    consumerEvidence: [],
  },
  focus: {
    status: 'current',
    public: true,
    authority: 'shared-lower-level',
    owner: 'interaction-foundation',
    purpose: 'Canonical shared focus-ring semantics.',
    consumerEvidence: [
      'components.Checkbox',
      'components.Dropdown',
      'components.Tabs',
    ],
  },
  icons: {
    status: 'current',
    public: true,
    authority: 'shared-lower-level',
    owner: 'icon-foundation',
    purpose: 'Canonical semantic icon color roles.',
    consumerEvidence: ['components.Input', 'components.Select'],
  },
  menu: {
    status: 'current',
    public: true,
    authority: 'component-input',
    owner: 'menu-patterns',
    purpose:
      'Shared menu roles consumed by menu-like component token families.',
    consumerEvidence: ['components.Dropdown', 'components.ContextMenu'],
  },
  navigation: {
    status: 'deprecated',
    public: false,
    authority: 'compatibility',
    owner: 'removed-semantic-tombstone',
    purpose:
      'Removed parallel navigation authority; tombstoned so tab/option/trigger roles cannot silently return.',
    consumerEvidence: [],
  },
  overlay: {
    status: 'current',
    public: true,
    authority: 'shared-lower-level',
    owner: 'overlay-foundation',
    purpose: 'Shared overlay/backdrop semantic roles.',
    consumerEvidence: [
      'components.Modal',
      'components.Popover',
      'components.Tooltip',
    ],
  },
  shadow: {
    status: 'current',
    public: true,
    authority: 'shared-lower-level',
    owner: 'semantic-foundation',
    purpose: 'Shared semantic elevation/shadow roles.',
    consumerEvidence: [
      'packages/react-native/src/theme/componentTokenOutput.ts',
    ],
  },
  skeleton: {
    status: 'deprecated',
    public: true,
    authority: 'compatibility',
    owner: 'token-compatibility',
    purpose:
      'Legacy public skeleton roles without internal consumers; retained only for compatibility.',
    consumerEvidence: [],
  },
  status: {
    status: 'current',
    public: true,
    authority: 'shared-lower-level',
    owner: 'status-foundation',
    purpose: 'Canonical success/warning/error/status semantic roles.',
    consumerEvidence: ['components.Checkbox', 'components.FormField'],
  },
  surface: {
    status: 'current',
    public: true,
    authority: 'shared-lower-level',
    owner: 'surface-foundation',
    purpose: 'Canonical semantic surface/background roles.',
    consumerEvidence: [
      'components.Button',
      'components.Dropdown',
      'components.Input',
    ],
  },
  text: {
    status: 'current',
    public: true,
    authority: 'shared-lower-level',
    owner: 'typography-foundation',
    purpose: 'Canonical semantic text color roles.',
    consumerEvidence: [
      'components.Button',
      'components.Checkbox',
      'components.Dropdown',
    ],
  },
} as const satisfies Record<string, SemanticTokenLifecycleEntry>;

export type ComponentTokenLifecycleName = keyof typeof componentTokenLifecycle;
export type SemanticTokenLifecycleName = keyof typeof semanticTokenLifecycle;

export function getComponentTokenLifecycle(
  componentName: string
): ComponentTokenLifecycleEntry | undefined {
  if (!Object.hasOwn(componentTokenLifecycle, componentName)) return undefined;

  return componentTokenLifecycle[
    componentName as ComponentTokenLifecycleName
  ] as ComponentTokenLifecycleEntry | undefined;
}

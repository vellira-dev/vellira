/**
 * Canonical lifecycle and ownership registry for public semantic/component
 * token namespaces.
 *
 * This registry is architecture metadata only. It must not change resolved
 * visual values. Generator V2 and token ownership checks consume the same
 * records so a public namespace cannot become an implicit orphan again.
 */

export const tokenLifecycleStatuses = [
  'current',
  'reserved',
  'deprecated',
] as const;

export type TokenLifecycleStatus = (typeof tokenLifecycleStatuses)[number];

export type ComponentTokenFamilyOwnership = {
  readonly lifecycle: TokenLifecycleStatus;
  readonly owner: 'component-metadata' | 'tokens-compatibility';
  readonly metadataComponent: string | null;
  readonly authority: string;
  readonly presentInTheme: boolean;
};

export type SemanticTokenNamespaceOwnership = {
  readonly lifecycle: TokenLifecycleStatus;
  readonly owner:
    | 'shared-semantic-authority'
    | 'component-authority'
    | 'tokens-compatibility';
  readonly authority: string;
  readonly consumerEvidence: readonly string[];
  readonly presentInTheme: boolean;
};

export const componentTokenFamilyOwnershipV1 = {
  accordion: {
    lifecycle: 'current',
    owner: 'component-metadata',
    metadataComponent: 'Accordion',
    authority: 'Accordion component token contract',
    presentInTheme: true,
  },
  button: {
    lifecycle: 'current',
    owner: 'component-metadata',
    metadataComponent: 'Button',
    authority: 'Button component token contract',
    presentInTheme: true,
  },
  checkbox: {
    lifecycle: 'current',
    owner: 'component-metadata',
    metadataComponent: 'Checkbox',
    authority: 'Checkbox component token contract',
    presentInTheme: true,
  },
  contextMenu: {
    lifecycle: 'deprecated',
    owner: 'tokens-compatibility',
    metadataComponent: null,
    authority:
      'Compatibility-only token family; no canonical ContextMenu component metadata/catalog owner exists.',
    presentInTheme: true,
  },
  dropdown: {
    lifecycle: 'current',
    owner: 'component-metadata',
    metadataComponent: 'Dropdown',
    authority: 'Dropdown component token contract',
    presentInTheme: true,
  },
  formField: {
    lifecycle: 'current',
    owner: 'component-metadata',
    metadataComponent: 'FormField',
    authority: 'FormField component token contract',
    presentInTheme: true,
  },
  input: {
    lifecycle: 'current',
    owner: 'component-metadata',
    metadataComponent: 'Input',
    authority: 'Input component token contract',
    presentInTheme: true,
  },
  modal: {
    lifecycle: 'current',
    owner: 'component-metadata',
    metadataComponent: 'Modal',
    authority: 'Modal component token contract',
    presentInTheme: true,
  },
  popover: {
    lifecycle: 'current',
    owner: 'component-metadata',
    metadataComponent: 'Popover',
    authority: 'Popover component token contract',
    presentInTheme: true,
  },
  radio: {
    lifecycle: 'current',
    owner: 'component-metadata',
    metadataComponent: 'Radio',
    authority: 'Radio component token contract',
    presentInTheme: true,
  },
  radioGroup: {
    lifecycle: 'current',
    owner: 'component-metadata',
    metadataComponent: 'RadioGroup',
    authority: 'RadioGroup component token contract',
    presentInTheme: true,
  },
  select: {
    lifecycle: 'current',
    owner: 'component-metadata',
    metadataComponent: 'Select',
    authority: 'Select component token contract',
    presentInTheme: true,
  },
  switch: {
    lifecycle: 'current',
    owner: 'component-metadata',
    metadataComponent: 'Switch',
    authority: 'Switch component token contract',
    presentInTheme: true,
  },
  tabs: {
    lifecycle: 'current',
    owner: 'component-metadata',
    metadataComponent: 'Tabs',
    authority: 'Tabs component token contract',
    presentInTheme: true,
  },
  tooltip: {
    lifecycle: 'current',
    owner: 'component-metadata',
    metadataComponent: 'Tooltip',
    authority: 'Tooltip component token contract',
    presentInTheme: true,
  },
} as const satisfies Record<string, ComponentTokenFamilyOwnership>;

export const semanticTokenNamespaceOwnershipV1 = {
  action: {
    lifecycle: 'deprecated',
    owner: 'tokens-compatibility',
    authority:
      'Compatibility palette only; canonical component intent palettes are authored by their component token contracts.',
    consumerEvidence: [],
    presentInTheme: true,
  },
  border: {
    lifecycle: 'current',
    owner: 'shared-semantic-authority',
    authority: 'Shared structural and interactive border roles.',
    consumerEvidence: ['components.button', 'components.dropdown', 'components.tabs'],
    presentInTheme: true,
  },
  control: {
    lifecycle: 'current',
    owner: 'shared-semantic-authority',
    authority: 'Shared form-control state paint.',
    consumerEvidence: ['components.checkbox', 'components.radio'],
    presentInTheme: true,
  },
  divider: {
    lifecycle: 'current',
    owner: 'shared-semantic-authority',
    authority: 'Shared non-interactive separator roles.',
    consumerEvidence: ['public semantic contract'],
    presentInTheme: true,
  },
  focus: {
    lifecycle: 'current',
    owner: 'shared-semantic-authority',
    authority: 'Shared input-focus ring semantics.',
    consumerEvidence: ['components.checkbox', 'components.dropdown', 'components.tabs'],
    presentInTheme: true,
  },
  icons: {
    lifecycle: 'current',
    owner: 'shared-semantic-authority',
    authority: 'Shared icon foreground hierarchy.',
    consumerEvidence: ['public semantic contract'],
    presentInTheme: true,
  },
  menu: {
    lifecycle: 'current',
    owner: 'shared-semantic-authority',
    authority: 'Shared menu surface/item state roles.',
    consumerEvidence: ['components.dropdown', 'components.contextMenu'],
    presentInTheme: true,
  },
  navigation: {
    lifecycle: 'deprecated',
    owner: 'component-authority',
    authority:
      'Removed parallel namespace; Tabs owns tab/trigger presentation through components.tabs.',
    consumerEvidence: ['components.tabs'],
    presentInTheme: false,
  },
  overlay: {
    lifecycle: 'current',
    owner: 'shared-semantic-authority',
    authority: 'Shared overlay presentation roles.',
    consumerEvidence: ['components.modal', 'components.popover', 'components.tooltip'],
    presentInTheme: true,
  },
  shadow: {
    lifecycle: 'current',
    owner: 'shared-semantic-authority',
    authority: 'Shared structured semantic shadow references.',
    consumerEvidence: ['component platform-output shadow intents'],
    presentInTheme: true,
  },
  skeleton: {
    lifecycle: 'current',
    owner: 'shared-semantic-authority',
    authority: 'Shared loading-placeholder paint roles.',
    consumerEvidence: ['public semantic contract'],
    presentInTheme: true,
  },
  status: {
    lifecycle: 'current',
    owner: 'shared-semantic-authority',
    authority: 'Shared success/error/warning/info intent paint.',
    consumerEvidence: ['components.checkbox', 'components.formField'],
    presentInTheme: true,
  },
  surface: {
    lifecycle: 'current',
    owner: 'shared-semantic-authority',
    authority: 'Shared surface/layer and interaction backgrounds.',
    consumerEvidence: ['components.button', 'components.dropdown', 'components.tabs'],
    presentInTheme: true,
  },
  text: {
    lifecycle: 'current',
    owner: 'shared-semantic-authority',
    authority: 'Shared text foreground hierarchy.',
    consumerEvidence: ['components.button', 'components.checkbox', 'components.dropdown'],
    presentInTheme: true,
  },
} as const satisfies Record<string, SemanticTokenNamespaceOwnership>;

export type ComponentTokenFamily = keyof typeof componentTokenFamilyOwnershipV1;
export type SemanticTokenNamespace = keyof typeof semanticTokenNamespaceOwnershipV1;

export function getComponentTokenFamilyOwnership(
  family: string
): ComponentTokenFamilyOwnership | undefined {
  return componentTokenFamilyOwnershipV1[
    family as ComponentTokenFamily
  ] as ComponentTokenFamilyOwnership | undefined;
}

export function getSemanticTokenNamespaceOwnership(
  namespace: string
): SemanticTokenNamespaceOwnership | undefined {
  return semanticTokenNamespaceOwnershipV1[
    namespace as SemanticTokenNamespace
  ] as SemanticTokenNamespaceOwnership | undefined;
}

export const componentTokenDependencyPolicyV1 = {
  semanticRoles: {
    default: 'required',
    rule: 'Select semantic roles by meaning, never by resolved color equality.',
  },
  primitiveColors: {
    default: 'prohibited',
    allowedContexts: [
      'intent-palette-construction',
      'component-owned-presentation',
    ],
  },
  baseTokens: {
    allowed: [
      'spacing',
      'radius',
      'typography',
      'motion',
      'z-index',
      'shadow-intent',
    ],
  },
  componentToComponent: {
    default: 'prohibited',
    rule: 'Another component token family may be consumed only through an explicitly registered architectural edge.',
  },
  transparentPrimitive:
    'transparent is an implementation primitive for absent paint and does not require semantic ownership.',
  generatorRule:
    'Generated component tokens must prefer canonical semantic roles by meaning; primitive colors are allowed only in explicit intent/palette construction or documented component-owned presentation, and another component token family may not be consumed unless the edge is explicitly architectural.',
} as const;

export type ComponentPrimitiveColorUsage =
  'none' | 'intent-palette-construction' | 'component-owned-presentation';

export const allowedComponentFactoryDependencyEdgesV1 = [
  {
    from: 'dropdown',
    to: 'input',
    symbol: 'createInputColorPalette',
    reason:
      'Dropdown trigger intentionally shares the established field-control intent palette contract.',
  },
  {
    from: 'select',
    to: 'input',
    symbol: 'createInputColorPalette',
    reason:
      'Select trigger intentionally shares the established field-control intent palette contract.',
  },
] as const;

export const componentTokenDependencyAuditV1 = [
  {
    factory: 'createAccordionTokens',
    component: 'accordion',
    file: 'accordion.ts',
    primitiveColorUsage: ['none'],
    unresolved: [],
  },
  {
    factory: 'createButtonTokens',
    component: 'button',
    file: 'button.ts',
    primitiveColorUsage: ['intent-palette-construction'],
    unresolved: [],
  },
  {
    factory: 'createCheckboxTokens',
    component: 'checkbox',
    file: 'checkbox.ts',
    primitiveColorUsage: ['intent-palette-construction'],
    unresolved: [],
  },
  {
    factory: 'createContextMenuTokens',
    component: 'contextMenu',
    file: 'contextMenu.ts',
    primitiveColorUsage: ['none'],
    unresolved: [],
  },
  {
    factory: 'createDropdownTokens',
    component: 'dropdown',
    file: 'dropdown.ts',
    primitiveColorUsage: ['intent-palette-construction'],
    unresolved: [],
  },
  {
    factory: 'createFormFieldTokens',
    component: 'formField',
    file: 'formField.ts',
    primitiveColorUsage: ['component-owned-presentation'],
    unresolved: [],
  },
  {
    factory: 'createInputTokens',
    component: 'input',
    file: 'input.ts',
    primitiveColorUsage: [
      'intent-palette-construction',
      'component-owned-presentation',
    ],
    unresolved: [],
  },
  {
    factory: 'createModalTokens',
    component: 'modal',
    file: 'modal.ts',
    primitiveColorUsage: ['none'],
    unresolved: [],
  },
  {
    factory: 'createPopoverTokens',
    component: 'popover',
    file: 'popover.ts',
    primitiveColorUsage: ['none'],
    unresolved: [],
  },
  {
    factory: 'createRadioGroupTokens',
    component: 'radioGroup',
    file: 'radioGroup.ts',
    primitiveColorUsage: ['none'],
    unresolved: [],
  },
  {
    factory: 'createRadioTokens',
    component: 'radio',
    file: 'radio.ts',
    primitiveColorUsage: ['intent-palette-construction'],
    unresolved: [],
  },
  {
    factory: 'createSelectTokens',
    component: 'select',
    file: 'select.ts',
    primitiveColorUsage: [
      'intent-palette-construction',
      'component-owned-presentation',
    ],
    unresolved: [],
  },
  {
    factory: 'createSwitchTokens',
    component: 'switch',
    file: 'switch.ts',
    primitiveColorUsage: ['none'],
    unresolved: [],
  },
  {
    factory: 'createTabsTokens',
    component: 'tabs',
    file: 'tabs.ts',
    primitiveColorUsage: [
      'intent-palette-construction',
      'component-owned-presentation',
    ],
    unresolved: [],
  },
  {
    factory: 'createTooltipTokens',
    component: 'tooltip',
    file: 'tooltip.ts',
    primitiveColorUsage: ['none'],
    unresolved: [],
  },
] as const;

export const semanticDependencyRepairsV1 = [
  {
    component: 'formField',
    paths: ['requiredMark.fg', 'labelInfo.border'],
    repair:
      'Move component-specific presentation paint out of unrelated status/text semantic roles while preserving the resolved theme values.',
  },
  {
    component: 'input',
    paths: ['clearButton.hoverFg', 'clearButton.hoverBg'],
    repair:
      'Use canonical danger icon semantics for the foreground and explicit component-owned presentation for the destructive hover surface, preserving resolved values without depending on deprecated action semantics.',
  },
  {
    component: 'input',
    paths: ['error.ring'],
    repair:
      'Use status.error.ring rather than a coincidentally equal status.error.fg value.',
  },
  {
    component: 'select',
    paths: ['clearButton.hoverFg', 'clearButton.hoverBg'],
    repair:
      'Use canonical danger icon semantics for the foreground and explicit component-owned presentation for the destructive hover surface, preserving resolved values without depending on deprecated action semantics.',
  },
] as const;

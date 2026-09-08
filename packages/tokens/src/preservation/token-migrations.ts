export const tokenPreservationBaselineRevisionV1 =
  'c218cd97244cf5738bb22b9fb1e5ce172c0f516a' as const;

export const tokenMigrationKinds = [
  'rename',
  'alias',
  'remove',
  'addition',
  'representation-change',
  'visual-change',
] as const;

export type TokenMigrationKind = (typeof tokenMigrationKinds)[number];

export const tokenMigrationThemeNames = [
  'light',
  'dark',
  'high-contrast',
] as const;

export type TokenMigrationThemeName = (typeof tokenMigrationThemeNames)[number];

export const tokenMigrationPlatforms = ['web', 'react-native'] as const;

export type TokenMigrationPlatform = (typeof tokenMigrationPlatforms)[number];

type TokenMigrationBase = {
  id: string;
  issue: `#${number}`;
  reason: string;
  themes?: readonly TokenMigrationThemeName[];
  platforms?: readonly TokenMigrationPlatform[];
};

export type TokenRenameMigration = TokenMigrationBase & {
  kind: 'rename';
  from: string;
  to: string;
};

export type TokenAliasMigration = TokenMigrationBase & {
  kind: 'alias';
  from: string;
  to: string;
};

export type TokenRemovalMigration = TokenMigrationBase & {
  kind: 'remove';
  from: string;
};

export type TokenAdditionMigration = TokenMigrationBase & {
  kind: 'addition';
  to: string;
};

type TokenRepresentationMigrationBase = Omit<
  TokenMigrationBase,
  'platforms'
> & {
  kind: 'representation-change';
  from: string;
  to?: string;
  equivalence: string;
  evidence: string;
};

// Canonical migrations change renderer-neutral representation; platform-output
// migrations change only a named renderer's serialized representation.
export type TokenCanonicalRepresentationMigration =
  TokenRepresentationMigrationBase & {
    layer: 'canonical';
    platforms?: never;
  };

export type TokenPlatformRepresentationMigration =
  TokenRepresentationMigrationBase & {
    layer: 'platform-output';
    platforms: readonly [TokenMigrationPlatform, ...TokenMigrationPlatform[]];
  };

export type TokenRepresentationMigration =
  TokenCanonicalRepresentationMigration | TokenPlatformRepresentationMigration;

export type TokenVisualChangeMigration = TokenMigrationBase & {
  kind: 'visual-change';
  from?: string;
  to?: string;
  approved: true;
  approvalEvidence: string;
};

export type TokenMigrationEntry =
  | TokenRenameMigration
  | TokenAliasMigration
  | TokenRemovalMigration
  | TokenAdditionMigration
  | TokenRepresentationMigration
  | TokenVisualChangeMigration;

const valueKindWebFixApproval =
  '#881 explicitly requires correcting invalid unitless CSS serialization; targeted serializer regressions and the pinned Linux visual suite are the approval evidence.';

const stateVocabularyVisualApproval =
  '#879/#882 explicitly authorizes removal of pressed/active semantic conflation; the change stays inside the existing Vellira palette and requires pinned Linux visual regression.';

const semanticVocabularyVisualApproval =
  '#879/#883 explicitly authorizes Semantic Vocabulary V1 normalization and the narrowly scoped hierarchy/status corrections inside existing Vellira palettes; token preservation plus pinned Linux visual regression are required evidence.';

const stateVocabularyRenamePairsV1 = [
  [
    'control-active-bg',
    'semantic.control.active.bg',
    'semantic.control.pressed.bg',
  ],
  [
    'control-active-fg',
    'semantic.control.active.fg',
    'semantic.control.pressed.fg',
  ],
  [
    'control-active-border',
    'semantic.control.active.border',
    'semantic.control.pressed.border',
  ],
  [
    'control-selected-active-bg',
    'semantic.control.selected.active.bg',
    'semantic.control.selected.pressed.bg',
  ],
  [
    'control-selected-active-fg',
    'semantic.control.selected.active.fg',
    'semantic.control.selected.pressed.fg',
  ],
  [
    'control-selected-active-border',
    'semantic.control.selected.active.border',
    'semantic.control.selected.pressed.border',
  ],
  [
    'action-primary-active-bg',
    'semantic.action.primary.active.bg',
    'semantic.action.primary.pressed.bg',
  ],
  [
    'action-primary-active-fg',
    'semantic.action.primary.active.fg',
    'semantic.action.primary.pressed.fg',
  ],
  [
    'action-primary-active-border',
    'semantic.action.primary.active.border',
    'semantic.action.primary.pressed.border',
  ],
  [
    'action-danger-active-bg',
    'semantic.action.danger.active.bg',
    'semantic.action.danger.pressed.bg',
  ],
  [
    'action-danger-active-fg',
    'semantic.action.danger.active.fg',
    'semantic.action.danger.pressed.fg',
  ],
  [
    'action-danger-active-border',
    'semantic.action.danger.active.border',
    'semantic.action.danger.pressed.border',
  ],
  [
    'text-interactive-active',
    'semantic.text.interactiveActive',
    'semantic.text.interactivePressed',
  ],
] as const;

const stateVocabularyRenameMigrationsV1 = stateVocabularyRenamePairsV1.flatMap(
  ([id, from, to]) => [
    {
      id: `882-${id}-rename`,
      kind: 'rename',
      issue: '#882',
      reason:
        'Rename a transient physical-interaction role to canonical pressed while preserving its resolved design value.',
      platforms: ['react-native'],
      from,
      to,
    } as const,
    {
      id: `882-${id}-web-identity`,
      kind: 'representation-change',
      layer: 'platform-output',
      issue: '#882',
      reason:
        'Align the public Web CSS variable identity with the canonical pressed state name.',
      platforms: ['web'],
      from,
      to,
      equivalence:
        'The paired canonical #882 rename preserves the resolved design value; only the Web CSS variable identity changes from active to pressed.',
      evidence:
        'Token preservation validates the canonical/RN value-preserving rename; generated CSS checks and pinned Linux visual regression validate Web output.',
    } as const,
  ]
) satisfies readonly TokenMigrationEntry[];

const semanticActionRoleRenamePairsV1 = (
  [
    ['secondary', 'accent'],
    ['close', 'neutral'],
  ] as const
).flatMap(([fromRole, toRole]) =>
  (['default', 'hover', 'active', 'muted', 'subtle'] as const).flatMap(
    (fromState) =>
      (['bg', 'fg', 'border'] as const).map((field) => {
        const toState = fromState === 'active' ? 'pressed' : fromState;
        return [
          `action-${fromRole}-${fromState}-${field}`,
          `semantic.action.${fromRole}.${fromState}.${field}`,
          `semantic.action.${toRole}.${toState}.${field}`,
        ] as const;
      })
  )
);

const semanticStatusEmphasisRenamePairsV1 = (
  ['success', 'error', 'warning', 'info'] as const
).map(
  (status) =>
    [
      `status-${status}-strong`,
      `semantic.status.${status}.strong`,
      `semantic.status.${status}.emphasisFg`,
    ] as const
);

const semanticVocabularySimpleRenamePairsV1 = [
  ['icons-primary', 'semantic.icons.primary', 'semantic.icons.interactive'],
  ['icons-hover', 'semantic.icons.hover', 'semantic.icons.interactiveHover'],
  ['border-focus', 'semantic.border.focus', 'semantic.border.interactive'],
  [
    'focus-ring-offset',
    'semantic.focus.ring.offset',
    'semantic.focus.ring.offsetColor',
  ],
  [
    'overlay-popover-bg',
    'semantic.overlay.popover.bg',
    'semantic.overlay.floating.bg',
  ],
  [
    'overlay-popover-border',
    'semantic.overlay.popover.border',
    'semantic.overlay.floating.border',
  ],
  [
    'overlay-modal-bg',
    'semantic.overlay.modal.bg',
    'semantic.overlay.dialog.bg',
  ],
  [
    'overlay-modal-border',
    'semantic.overlay.modal.border',
    'semantic.overlay.dialog.border',
  ],
] as const;

const semanticVocabularyRenamePairsV1 = [
  ...semanticActionRoleRenamePairsV1,
  ...semanticStatusEmphasisRenamePairsV1,
  ...semanticVocabularySimpleRenamePairsV1,
] as const;

const semanticVocabularyRenameMigrationsV1 =
  semanticVocabularyRenamePairsV1.flatMap(([id, from, to]) => [
    {
      id: `883-${id}-rename`,
      kind: 'rename',
      issue: '#883',
      reason:
        'Rename a public semantic role to Semantic Vocabulary V1 while preserving its resolved design value.',
      platforms: ['react-native'],
      from,
      to,
    } as const,
    {
      id: `883-${id}-web-identity`,
      kind: 'representation-change',
      layer: 'platform-output',
      issue: '#883',
      reason:
        'Align the public Web CSS variable identity with the normalized Semantic Vocabulary V1 role.',
      platforms: ['web'],
      from,
      to,
      equivalence:
        'The paired canonical #883 rename preserves the resolved design value; only the public Web CSS variable identity changes.',
      evidence:
        'Token preservation validates the canonical/RN rename; generated CSS and pinned Linux visual regression validate Web output identity.',
    } as const,
  ]) satisfies readonly TokenMigrationEntry[];

const semanticVocabularyRemovalPathsV1 = [
  'semantic.surface.background',
  'semantic.navigation.hover.bg',
  'semantic.navigation.hover.fg',
  'semantic.navigation.active.bg',
  'semantic.navigation.active.fg',
  'semantic.navigation.brandHover.bg',
  'semantic.navigation.brandHover.fg',
  'semantic.navigation.tabHover.fg',
  'semantic.navigation.tabFocus.ring',
  'semantic.navigation.optionHover.bg',
  'semantic.navigation.optionHover.fg',
  'semantic.navigation.optionActive.bg',
  'semantic.navigation.optionActive.fg',
  'semantic.navigation.triggerHover.bg',
  'semantic.navigation.triggerHover.fg',
  'semantic.navigation.border',
] as const;

const semanticVocabularyRemovalMigrationsV1 =
  semanticVocabularyRemovalPathsV1.map(
    (from) =>
      ({
        id: `883-remove-${from.replaceAll('.', '-')}`,
        kind: 'remove',
        issue: '#883',
        reason:
          from === 'semantic.surface.background'
            ? 'Remove ambiguous surface.background after consumers are split by purpose: application roots use surface.canvas and bounded neutral containers use the explicit surface.panel role introduced by #912.'
            : 'Remove the unused legacy semantic.navigation namespace instead of preserving a duplicate component-history vocabulary.',
        from,
      }) as const
  ) satisfies readonly TokenMigrationEntry[];

const semanticPanelAdditionV1 = {
  id: '912-surface-panel-addition',
  kind: 'addition',
  issue: '#912',
  reason:
    'Add an explicit bounded neutral panel/chrome role after the #883 audit missed authored CSS consumers of the removed surface.background variable; panel preserves those historical bounded-container values without changing canvas or elevated semantics.',
  to: 'semantic.surface.panel',
} as const satisfies TokenMigrationEntry;

const semanticVocabularyVisualMigrationsV1 = [
  {
    id: '883-dark-text-muted-hierarchy',
    kind: 'visual-change',
    issue: '#883',
    themes: ['dark'],
    reason:
      'Correct the Dark text hierarchy so muted remains stronger than subtle using only existing Vellira palette values.',
    from: 'semantic.text.muted',
    approved: true,
    approvalEvidence: semanticVocabularyVisualApproval,
  },
  {
    id: '883-dark-text-subtle-hierarchy',
    kind: 'visual-change',
    issue: '#883',
    themes: ['dark'],
    reason:
      'Correct the Dark text hierarchy so subtle remains below muted using only existing Vellira palette values.',
    from: 'semantic.text.subtle',
    approved: true,
    approvalEvidence: semanticVocabularyVisualApproval,
  },
  {
    id: '883-high-contrast-icons-muted-hierarchy',
    kind: 'visual-change',
    issue: '#883',
    themes: ['high-contrast'],
    reason:
      'Correct the High Contrast icon hierarchy so muted remains stronger than subtle using the existing gray scale.',
    from: 'semantic.icons.muted',
    approved: true,
    approvalEvidence: semanticVocabularyVisualApproval,
  },
  {
    id: '883-high-contrast-icons-subtle-hierarchy',
    kind: 'visual-change',
    issue: '#883',
    themes: ['high-contrast'],
    reason:
      'Correct the High Contrast icon hierarchy so subtle remains below muted using the existing gray scale.',
    from: 'semantic.icons.subtle',
    approved: true,
    approvalEvidence: semanticVocabularyVisualApproval,
  },
  {
    id: '883-dark-warning-ring-own-palette',
    kind: 'visual-change',
    issue: '#883',
    themes: ['dark'],
    reason:
      'Correct warning.ring to use the existing warning palette instead of the unrelated error palette.',
    from: 'semantic.status.warning.ring',
    approved: true,
    approvalEvidence: semanticVocabularyVisualApproval,
  },
  {
    id: '883-dark-info-ring-own-palette',
    kind: 'visual-change',
    issue: '#883',
    themes: ['dark'],
    reason:
      'Correct info.ring to use the existing info palette instead of the unrelated error palette.',
    from: 'semantic.status.info.ring',
    approved: true,
    approvalEvidence: semanticVocabularyVisualApproval,
  },
] as const satisfies readonly TokenMigrationEntry[];

/**
 * Migration/test metadata only. This is not a runtime token registry.
 *
 * Every #879 token rename, alias, removal, addition, representation-only
 * change, or intentionally approved visual change must be recorded here before
 * the preservation baseline is allowed to accept it.
 */

const semanticVocabularyDownstreamVisualMigrationsV1 = [
  {
    id: '883-dark-dropdown-separator-muted-hierarchy',
    kind: 'visual-change',
    issue: '#883',
    themes: ['dark'],
    reason:
      'Dropdown separator follows the corrected Dark muted text hierarchy without introducing a new palette value.',
    from: 'components.dropdown.separator.fg',
    approved: true,
    approvalEvidence: semanticVocabularyVisualApproval,
  },
  {
    id: '883-dark-form-field-helper-muted-hierarchy',
    kind: 'visual-change',
    issue: '#883',
    themes: ['dark'],
    reason:
      'FormField helper text follows the corrected Dark muted text hierarchy without introducing a new palette value.',
    from: 'components.formField.helperText.default.fg',
    approved: true,
    approvalEvidence: semanticVocabularyVisualApproval,
  },
  {
    id: '883-dark-input-readonly-placeholder-muted-hierarchy',
    kind: 'visual-change',
    issue: '#883',
    themes: ['dark'],
    reason:
      'Input read-only placeholder follows the corrected Dark muted text hierarchy without introducing a new palette value.',
    from: 'components.input.readOnly.placeholder',
    approved: true,
    approvalEvidence: semanticVocabularyVisualApproval,
  },
  {
    id: '883-dark-modal-close-button-pressed-state',
    kind: 'visual-change',
    issue: '#883',
    themes: ['dark'],
    reason:
      'Modal close-button physical press now consumes the canonical surface.pressed state instead of the persistent surface.active state.',
    from: 'components.modal.closeButton.pressed.bg',
    approved: true,
    approvalEvidence: semanticVocabularyVisualApproval,
  },
  {
    id: '883-high-contrast-input-clear-button-icon-hierarchy',
    kind: 'visual-change',
    issue: '#883',
    themes: ['high-contrast'],
    reason:
      'Input clear-button foreground follows the corrected High Contrast muted icon hierarchy.',
    from: 'components.input.clearButton.fg',
    approved: true,
    approvalEvidence: semanticVocabularyVisualApproval,
  },
  {
    id: '883-high-contrast-input-muted-icon-hierarchy',
    kind: 'visual-change',
    issue: '#883',
    themes: ['high-contrast'],
    reason:
      'Input muted icon follows the corrected High Contrast muted/subtle icon hierarchy.',
    from: 'components.input.icon.muted',
    approved: true,
    approvalEvidence: semanticVocabularyVisualApproval,
  },
  {
    id: '883-high-contrast-input-readonly-icon-hierarchy',
    kind: 'visual-change',
    issue: '#883',
    themes: ['high-contrast'],
    reason:
      'Input read-only icon follows the corrected High Contrast muted icon hierarchy.',
    from: 'components.input.readOnly.icon',
    approved: true,
    approvalEvidence: semanticVocabularyVisualApproval,
  },
  {
    id: '883-high-contrast-input-spinner-icon-hierarchy',
    kind: 'visual-change',
    issue: '#883',
    themes: ['high-contrast'],
    reason:
      'Input spinner foreground follows the corrected High Contrast muted icon hierarchy.',
    from: 'components.input.spinner.fg',
    approved: true,
    approvalEvidence: semanticVocabularyVisualApproval,
  },
  {
    id: '883-high-contrast-select-clear-button-icon-hierarchy',
    kind: 'visual-change',
    issue: '#883',
    themes: ['high-contrast'],
    reason:
      'Select clear-button foreground follows the corrected High Contrast muted icon hierarchy.',
    from: 'components.select.clearButton.fg',
    approved: true,
    approvalEvidence: semanticVocabularyVisualApproval,
  },
] as const satisfies readonly TokenMigrationEntry[];

const platformNeutralComponentRepresentationPathsV1 = [
  'components.contextMenu.content.shadow',
  'components.contextMenu.item.focus.ring.shadow',
  'components.contextMenu.trigger.focus.ring.shadow',
  'components.dropdown.content.shadow',
  'components.dropdown.item.focus.ring.shadow',
  'components.dropdown.trigger.focus.ring.shadow',
  'components.modal.closeButton.focus.ring.shadow',
  'components.modal.content.maxHeight',
  'components.modal.content.shadow',
  'components.select.dropdown.shadow',
  'components.select.option.selected.shadow',
  'components.tooltip.content.shadow',
] as const;

const platformNeutralComponentRepresentationMigrationsV1 =
  platformNeutralComponentRepresentationPathsV1.map(
    (from) =>
      ({
        id: `884-representation-${from.replaceAll('.', '-')}`,
        kind: 'representation-change',
        layer: 'canonical',
        issue: '#884',
        reason:
          'Replace renderer-shaped canonical component storage with a renderer-neutral intent at the same logical token path.',
        from,
        equivalence:
          'The canonical representation changes only; Web resolves the intent to the pre-#884 CSS value and React Native resolves consumed elevation/layout intents to the pre-#884 native presentation output.',
        evidence:
          '#880 preservation locks serialized Web output while component-token-output-equivalence regressions cover Web and React Native adapters for Light, Dark, and High Contrast themes.',
      }) as const
  ) satisfies readonly TokenMigrationEntry[];

const platformNeutralLegacyCanonicalRemovalsV1 = [
  'components.modal.content.nativeMaxHeight',
  'components.popover.content.shadow.native.x',
  'components.popover.content.shadow.native.y',
  'components.popover.content.shadow.native.blur',
  'components.popover.content.shadow.native.color',
  'components.popover.content.shadow.native.opacity',
  'components.popover.content.shadow.native.elevation',
] as const;

const platformNeutralLegacyCanonicalRemovalMigrationsV1 =
  platformNeutralLegacyCanonicalRemovalsV1.map(
    (from) =>
      ({
        id: `884-remove-${from.replaceAll('.', '-')}`,
        kind: 'remove',
        issue: '#884',
        reason:
          'Remove renderer-specific canonical storage after the same renderer output moved behind the platform-output adapter; the Web identity remains a compatibility alias until #889.',
        platforms: ['react-native'],
        from,
      }) as const
  ) satisfies readonly TokenMigrationEntry[];

const platformNeutralPopoverShadowMigrationV1 = {
  id: '884-popover-shadow-web-to-canonical-intent',
  kind: 'representation-change',
  layer: 'canonical',
  issue: '#884',
  reason:
    'Collapse the old Popover shadow.web branch into one renderer-neutral canonical shadow intent.',
  from: 'components.popover.content.shadow.web',
  to: 'components.popover.content.shadow',
  equivalence:
    'The new canonical lg elevation intent resolves to the same semantic lg Web shadow and the same structured native lg shadow used before #884.',
  evidence:
    '#880 preservation retains the legacy Web output identity and component-token-output-equivalence regressions lock the Web/RN adapter results for all three themes.',
} as const satisfies TokenMigrationEntry;

const platformNeutralPopoverWebAdditionV1 = {
  id: '884-popover-normalized-web-shadow-output',
  kind: 'addition',
  issue: '#884',
  reason:
    'Expose the normalized Popover shadow path in Web platform output while retaining the old renderer-shaped CSS identities as compatibility aliases until #889.',
  platforms: ['web'],
  to: 'components.popover.content.shadow',
} as const satisfies TokenMigrationEntry;

const boldFontWeightAdditionV1 = {
  id: '927-font-weight-bold-addition',
  kind: 'addition',
  issue: '#927',
  reason:
    'Add the canonical 700 bold weight already represented by the VelliraSans-Bold family so first-party consumers do not need a raw value or local token alias.',
  to: 'tokens.typography.weight.bold',
} as const satisfies TokenMigrationEntry;

export const tokenMigrationManifestV1 = [
  ...stateVocabularyRenameMigrationsV1,
  boldFontWeightAdditionV1,
  ...platformNeutralComponentRepresentationMigrationsV1,
  ...platformNeutralLegacyCanonicalRemovalMigrationsV1,
  platformNeutralPopoverShadowMigrationV1,
  platformNeutralPopoverWebAdditionV1,
  ...semanticVocabularyRenameMigrationsV1,
  ...semanticVocabularyRemovalMigrationsV1,
  semanticPanelAdditionV1,
  ...semanticVocabularyVisualMigrationsV1,
  ...semanticVocabularyDownstreamVisualMigrationsV1,
  {
    id: '882-radio-active-scale-remove',
    kind: 'remove',
    issue: '#882',
    reason:
      'Remove activeScale because it encoded transient physical press rather than a persistent active state.',
    from: 'components.radio.motion.activeScale',
  },
  {
    id: '882-radio-pressed-scale-own-effective-press',
    kind: 'visual-change',
    issue: '#882',
    reason:
      'Move the existing effective Radio press scale of 0.92 from misleading activeScale ownership to the canonical pressedScale token.',
    from: 'components.radio.motion.pressedScale',
    approved: true,
    approvalEvidence: stateVocabularyVisualApproval,
  },
  {
    id: '882-input-clear-button-pressed-surface',
    kind: 'visual-change',
    issue: '#882',
    reason:
      'Map Input clear-button physical press to surface.pressed instead of the persistent/current surface.active role.',
    from: 'components.input.clearButton.pressedBg',
    approved: true,
    approvalEvidence: stateVocabularyVisualApproval,
  },
  {
    id: '882-select-clear-button-pressed-surface',
    kind: 'visual-change',
    issue: '#882',
    reason:
      'Map Select clear-button physical press to surface.pressed instead of the persistent/current surface.active role.',
    from: 'components.select.clearButton.pressedBg',
    approved: true,
    approvalEvidence: stateVocabularyVisualApproval,
  },
  {
    id: '881-modal-z-index-offset-number',
    kind: 'representation-change',
    layer: 'canonical',
    issue: '#881',
    reason:
      'Remove a stringified-number workaround now that z-index/order has a canonical unitless numeric kind.',
    from: 'components.modal.content.zIndexOffset',
    equivalence:
      'Canonical "1" and numeric 1 represent the same stack offset; Web serialization remains the literal value 1.',
    evidence:
      'The value-kind serializer regression locks Web output to 1 and current first-party Modal renderers do not consume the old string representation directly.',
  },
  {
    id: '881-radio-pressed-opacity-web',
    kind: 'visual-change',
    issue: '#881',
    platforms: ['web'],
    reason:
      'Correct Radio pressed opacity from invalid px-suffixed output to the intended unitless opacity.',
    from: 'components.radio.motion.pressedOpacity',
    approved: true,
    approvalEvidence: valueKindWebFixApproval,
  },
  {
    id: '881-tooltip-scale-web',
    kind: 'visual-change',
    issue: '#881',
    platforms: ['web'],
    reason:
      'Correct Tooltip content scale from invalid px-suffixed transform input to the intended unitless scale.',
    from: 'components.tooltip.content.scale',
    approved: true,
    approvalEvidence: valueKindWebFixApproval,
  },
  {
    id: '881-popover-native-shadow-opacity-web',
    kind: 'visual-change',
    issue: '#881',
    platforms: ['web'],
    reason:
      'Publish the native Popover shadow opacity with its canonical unitless representation instead of an invalid px suffix.',
    from: 'components.popover.content.shadow.native.opacity',
    approved: true,
    approvalEvidence: valueKindWebFixApproval,
  },
  {
    id: '881-popover-native-shadow-elevation-web',
    kind: 'visual-change',
    issue: '#881',
    platforms: ['web'],
    reason:
      'Publish the native Popover shadow elevation with its canonical unitless representation instead of an invalid px suffix.',
    from: 'components.popover.content.shadow.native.elevation',
    approved: true,
    approvalEvidence: valueKindWebFixApproval,
  },
] satisfies readonly TokenMigrationEntry[];

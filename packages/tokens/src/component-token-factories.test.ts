import { describe, expect, it } from 'vitest';

import {
  createContextMenuTokens,
  createContextMenuTokensFromSemantics,
} from './factories/components/createContextMenuTokens.js';
import {
  createModalTokens,
  createModalTokensFromSemantics,
} from './factories/components/createModalTokens.js';
import { createComponentFocusRing } from './factories/shared/componentFocusRing.js';
import { focus as lightFocus } from './light/semantic/focus.js';
import { menu as lightMenu } from './light/semantic/menu.js';
import { text as lightText } from './light/semantic/text.js';
import { radius } from './tokens/radius.js';
import { spacing } from './tokens/spacing.js';

const modalFocusRing = {
  color: 'synthetic-focus-color',
  width: 'synthetic-focus-width',
  shadow: 'synthetic-focus-shadow',
  offsetColor: 'synthetic-focus-offset',
};

const modalOverlay = {
  backdrop: 'synthetic-overlay-backdrop',
  dialog: {
    bg: 'synthetic-modal-bg',
    border: 'synthetic-modal-border',
  },
};

const modalSurface = {
  hover: 'synthetic-surface-hover',
  elevated: 'synthetic-surface-elevated',
  active: 'synthetic-surface-active',
  pressed: 'synthetic-surface-pressed',
};

const modalText = {
  primary: 'synthetic-text-primary',
  secondary: 'synthetic-text-secondary',
  disabled: 'synthetic-text-disabled',
};

describe('component token semantic factories', () => {
  it('centralizes ContextMenu semantic mapping without changing output', () => {
    expect(
      createContextMenuTokensFromSemantics({
        focus: lightFocus,
        menu: lightMenu,
        text: lightText,
      })
    ).toEqual(
      createContextMenuTokens({
        contentBg: lightMenu.background,
        contentBorder: lightMenu.border,
        itemDefault: lightMenu.item.default,
        itemHover: lightMenu.item.hover,
        itemActive: lightMenu.item.active,
        itemPressed: lightMenu.item.pressed,
        itemFocusRing: createComponentFocusRing(lightFocus.ring),
        itemDisabled: lightMenu.item.disabled,
        itemDanger: lightMenu.item.danger,
        triggerDefaultFg: lightText.interactive,
        triggerHoverBg: lightMenu.item.hover.bg,
        triggerHoverFg: lightText.interactiveHover,
        triggerFocusFg: lightText.interactive,
        triggerFocusRing: createComponentFocusRing(lightFocus.ring),
        triggerDisabledFg: lightText.disabled,
        groupLabelFg: lightText.secondary,
      })
    );
  });

  it('defaults Modal hover and pressed backgrounds from distinct surface semantics', () => {
    expect(
      createModalTokensFromSemantics({
        focus: { ring: modalFocusRing },
        overlay: modalOverlay,
        radius,
        spacing,
        surface: modalSurface,
        text: modalText,
      })
    ).toEqual(
      createModalTokens({
        overlayBg: modalOverlay.backdrop,
        contentBg: modalOverlay.dialog.bg,
        contentFg: modalText.primary,
        contentBorder: modalOverlay.dialog.border,
        titleFg: modalText.primary,
        descriptionFg: modalText.secondary,
        closeButtonDefaultFg: modalText.secondary,
        closeButtonHoverBg: modalSurface.hover,
        closeButtonHoverFg: modalText.primary,
        closeButtonPressedBg: modalSurface.pressed,
        closeButtonPressedFg: modalText.primary,
        closeButtonDisabledFg: modalText.disabled,
        closeButtonFocusRing: createComponentFocusRing(modalFocusRing),
        radiusLg: radius.lg,
        radiusFull: radius.full,
        spacing1: spacing[1],
        spacing3: spacing[3],
        spacing4: spacing[4],
        spacing8: spacing[8],
        spacing10: spacing[10],
      })
    );
  });

  it('keeps Dark Modal pressed overrides on the canonical pressed surface state', () => {
    expect(
      createModalTokensFromSemantics({
        closeButtonHoverBg: modalSurface.elevated,
        closeButtonPressedBg: modalSurface.active,
        focus: { ring: modalFocusRing },
        overlay: modalOverlay,
        radius,
        spacing,
        surface: modalSurface,
        text: modalText,
      })
    ).toEqual(
      createModalTokens({
        overlayBg: modalOverlay.backdrop,
        contentBg: modalOverlay.dialog.bg,
        contentFg: modalText.primary,
        contentBorder: modalOverlay.dialog.border,
        titleFg: modalText.primary,
        descriptionFg: modalText.secondary,
        closeButtonDefaultFg: modalText.secondary,
        closeButtonHoverBg: modalSurface.elevated,
        closeButtonHoverFg: modalText.primary,
        closeButtonPressedBg: modalSurface.active,
        closeButtonPressedFg: modalText.primary,
        closeButtonDisabledFg: modalText.disabled,
        closeButtonFocusRing: createComponentFocusRing(modalFocusRing),
        radiusLg: radius.lg,
        radiusFull: radius.full,
        spacing1: spacing[1],
        spacing3: spacing[3],
        spacing4: spacing[4],
        spacing8: spacing[8],
        spacing10: spacing[10],
      })
    );
  });
});

import { createComponentShadowIntent } from '../../platform-output/component-token-intents.js';
import {
  createComponentFocusRing,
  type SemanticFocusRing,
} from '../shared/componentFocusRing.js';

type ContextMenuState = {
  readonly bg: string;
  readonly fg: string;
};

type ContextMenuDangerStates = {
  readonly default: ContextMenuState;
  readonly hover: ContextMenuState;
  readonly active: ContextMenuState;
  readonly disabled: ContextMenuState;
};

type ContextMenuFocusRing = ReturnType<typeof createComponentFocusRing>;

type ContextMenuTokensConfig = {
  contentBg: string;
  contentBorder: string;
  itemDefault: ContextMenuState;
  itemHover: ContextMenuState;
  itemActive: ContextMenuState;
  itemPressed: ContextMenuState;
  itemFocusRing: ContextMenuFocusRing;
  itemDisabled: ContextMenuState;
  itemDanger: ContextMenuDangerStates;
  triggerDefaultFg: string;
  triggerHoverBg: string;
  triggerHoverFg: string;
  triggerFocusFg: string;
  triggerFocusRing: ContextMenuFocusRing;
  triggerDisabledFg: string;
  groupLabelFg: string;
};

export type ContextMenuThemeSemantics = {
  focus: {
    ring: SemanticFocusRing;
  };
  menu: {
    background: string;
    border: string;
    item: {
      default: ContextMenuState;
      hover: ContextMenuState;
      active: ContextMenuState;
      pressed: ContextMenuState;
      disabled: ContextMenuState;
      danger: ContextMenuDangerStates;
    };
  };
  text: {
    interactive: string;
    interactiveHover: string;
    disabled: string;
    secondary: string;
  };
};

export const createContextMenuTokens = (config: ContextMenuTokensConfig) =>
  ({
    content: {
      bg: config.contentBg,
      border: config.contentBorder,
      shadow: createComponentShadowIntent('lg'),
    },

    item: {
      default: config.itemDefault,
      hover: config.itemHover,
      active: {
        ...config.itemActive,
        ring: 'transparent',
      },
      pressed: config.itemPressed,
      focus: {
        ring: config.itemFocusRing,
      },
      disabled: config.itemDisabled,
      danger: config.itemDanger,
    },

    trigger: {
      default: {
        bg: 'transparent',
        fg: config.triggerDefaultFg,
        border: 'transparent',
      },
      hover: {
        bg: config.triggerHoverBg,
        fg: config.triggerHoverFg,
        border: 'transparent',
        ring: 'transparent',
      },
      focus: {
        bg: 'transparent',
        fg: config.triggerFocusFg,
        border: 'transparent',
        ring: config.triggerFocusRing,
      },
      disabled: {
        bg: 'transparent',
        fg: config.triggerDisabledFg,
        border: 'transparent',
      },
    },

    groupLabel: {
      fg: config.groupLabelFg,
    },
  }) as const;

export const createContextMenuTokensFromSemantics = ({
  focus,
  menu,
  text,
}: ContextMenuThemeSemantics) =>
  createContextMenuTokens({
    contentBg: menu.background,
    contentBorder: menu.border,
    itemDefault: menu.item.default,
    itemHover: menu.item.hover,
    itemActive: menu.item.active,
    itemPressed: menu.item.pressed,
    itemFocusRing: createComponentFocusRing(focus.ring),
    itemDisabled: menu.item.disabled,
    itemDanger: menu.item.danger,
    triggerDefaultFg: text.interactive,
    triggerHoverBg: menu.item.hover.bg,
    triggerHoverFg: text.interactiveHover,
    triggerFocusFg: text.interactive,
    triggerFocusRing: createComponentFocusRing(focus.ring),
    triggerDisabledFg: text.disabled,
    groupLabelFg: text.secondary,
  });

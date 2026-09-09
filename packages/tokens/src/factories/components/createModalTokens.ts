import {
  createComponentShadowIntent,
  createComponentViewportHeightIntent,
} from '../../platform-output/component-token-intents.js';
import {
  createComponentFocusRing,
  type SemanticFocusRing,
} from '../shared/componentFocusRing.js';

type ModalFocusRing = ReturnType<typeof createComponentFocusRing>;

type ModalTokensConfig = {
  overlayBg: string;
  contentBg: string;
  contentFg: string;
  contentBorder: string;
  titleFg: string;
  descriptionFg: string;
  closeButtonDefaultFg: string;
  closeButtonHoverBg: string;
  closeButtonHoverFg: string;
  closeButtonPressedBg: string;
  closeButtonPressedFg: string;
  closeButtonDisabledFg: string;
  closeButtonFocusRing: ModalFocusRing;
  radiusLg: number;
  radiusFull: number;
  spacing1: number;
  spacing3: number;
  spacing4: number;
  spacing8: number;
  spacing10: number;
};

export type ModalThemeSemantics = {
  closeButtonHoverBg?: string;
  closeButtonPressedBg?: string;
  focus: {
    ring: SemanticFocusRing;
  };
  overlay: {
    backdrop: string;
    dialog: {
      bg: string;
      border: string;
    };
  };
  radius: {
    lg: number;
    full: number;
  };
  spacing: {
    1: number;
    3: number;
    4: number;
    8: number;
    10: number;
  };
  surface: {
    hover: string;
    pressed: string;
  };
  text: {
    primary: string;
    secondary: string;
    disabled: string;
  };
};

const modalLayout = {
  maxHeight: createComponentViewportHeightIntent(0.9),
  zIndexOffset: 1,
} as const;

const modalMotion = {
  closeDuration: '150ms',
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  openDuration: '180ms',
} as const;

export const createModalTokens = (config: ModalTokensConfig) =>
  ({
    overlay: {
      bg: config.overlayBg,
      blur: 4,
      animationDuration: modalMotion.openDuration,
    },

    content: {
      bg: config.contentBg,
      fg: config.contentFg,
      border: config.contentBorder,
      shadow: createComponentShadowIntent('xl'),
      borderWidth: 1,
      radius: config.radiusLg,
      padding: config.spacing4,
      gap: config.spacing4,
      minWidth: 320,
      maxHeight: modalLayout.maxHeight,
      viewportMargin: config.spacing8,
      topOffset: config.spacing10,
      zIndexOffset: modalLayout.zIndexOffset,
      animationDuration: modalMotion.openDuration,

      size: {
        sm: 400,
        md: 560,
        lg: 720,
        xl: 960,
      },
    },

    title: {
      fg: config.titleFg,
    },

    description: {
      fg: config.descriptionFg,
    },

    header: {
      gap: config.spacing4,
      paddingBottom: config.spacing4,
      textGap: config.spacing1,
    },

    body: {
      paddingBottom: config.spacing4,
    },

    footer: {
      gap: config.spacing3,
      paddingTop: config.spacing4,
    },

    closeButton: {
      size: 32,
      iconSize: 16,
      radius: config.radiusFull,

      default: {
        bg: 'transparent',
        fg: config.closeButtonDefaultFg,
        border: 'transparent',
      },

      hover: {
        bg: config.closeButtonHoverBg,
        fg: config.closeButtonHoverFg,
        border: 'transparent',
      },

      pressed: {
        bg: config.closeButtonPressedBg,
        fg: config.closeButtonPressedFg,
        border: 'transparent',
      },

      focus: {
        ring: config.closeButtonFocusRing,
      },

      disabled: {
        bg: 'transparent',
        fg: config.closeButtonDisabledFg,
        border: 'transparent',
      },
    },

    motion: modalMotion,
  }) as const;

export const createModalTokensFromSemantics = ({
  closeButtonHoverBg,
  closeButtonPressedBg,
  focus,
  overlay,
  radius,
  spacing,
  surface,
  text,
}: ModalThemeSemantics) =>
  createModalTokens({
    overlayBg: overlay.backdrop,
    contentBg: overlay.dialog.bg,
    contentFg: text.primary,
    contentBorder: overlay.dialog.border,
    titleFg: text.primary,
    descriptionFg: text.secondary,
    closeButtonDefaultFg: text.secondary,
    closeButtonHoverBg: closeButtonHoverBg ?? surface.hover,
    closeButtonHoverFg: text.primary,
    closeButtonPressedBg: closeButtonPressedBg ?? surface.pressed,
    closeButtonPressedFg: text.primary,
    closeButtonDisabledFg: text.disabled,
    closeButtonFocusRing: createComponentFocusRing(focus.ring),
    radiusLg: radius.lg,
    radiusFull: radius.full,
    spacing1: spacing[1],
    spacing3: spacing[3],
    spacing4: spacing[4],
    spacing8: spacing[8],
    spacing10: spacing[10],
  });

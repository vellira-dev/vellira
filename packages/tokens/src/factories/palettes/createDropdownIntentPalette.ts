import type { createInputColorPalette } from './createInputIntentPalette.js';

type DropdownBasePalette = ReturnType<typeof createInputColorPalette>;
type DropdownPaletteConfig = {
  contentBorder?: string;
  itemActiveBg?: string;
  itemActiveFg?: string;
  itemActiveRing?: string;
  itemHoverBg?: string;
  itemHoverFg?: string;
  itemPressedBg?: string;
  itemPressedFg?: string;
  itemFg?: string;
  itemBadgeBg?: string;
  itemBadgeFg?: string;
  itemBadgeBorder?: string;
};

export const createDropdownIntentPalette = (
  palette: DropdownBasePalette,
  config: DropdownPaletteConfig = {}
) =>
  ({
    ring: palette.ring,
    content: {
      border: config.contentBorder ?? palette.outline.default.border,
      ring: palette.ring,
    },
    trigger: {
      default: {
        ...palette.outline.default,
        fg: palette.outline.default.icon,
        border: 'transparent',
      },
      hover: {
        ...palette.outline.hover,
        bg: 'transparent',
        fg: palette.outline.hover.icon,
        border: 'transparent',
      },
      focus: {
        ...palette.outline.focus,
        fg: palette.outline.focus.icon,
        border: 'transparent',
      },
    },
    item: {
      fg: config.itemFg ?? palette.outline.default.border,
      active: {
        bg: config.itemActiveBg ?? palette.outline.hover.bg,
        fg: config.itemActiveFg ?? palette.outline.hover.fg,
        ring: config.itemActiveRing ?? palette.ring,
      },
      hover: {
        bg: config.itemHoverBg ?? palette.outline.hover.bg,
        fg: config.itemHoverFg ?? palette.outline.hover.fg,
      },
      pressed: {
        bg: config.itemPressedBg ?? palette.outline.focus.bg,
        fg: config.itemPressedFg ?? palette.outline.focus.fg,
      },
      badge: {
        bg: config.itemBadgeBg ?? palette.soft.default.bg,
        fg: config.itemBadgeFg ?? palette.soft.default.fg,
        border: config.itemBadgeBorder ?? palette.soft.default.border,
      },
    },
  }) as const;

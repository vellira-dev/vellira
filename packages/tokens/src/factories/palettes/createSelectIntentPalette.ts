import type { createInputColorPalette } from './createInputIntentPalette.js';

type SelectBasePalette = ReturnType<typeof createInputColorPalette>;
type SelectVariantName = 'outline' | 'filled' | 'soft';
type SelectPaletteConfig = {
  optionActiveBg?: string;
  dropdownBorder?: string;
  optionActiveBorder?: string;
  optionActiveFg?: string;
  optionActiveRing?: string;
  optionHoverBg?: string;
  optionHoverBorder?: string;
  optionHoverFg?: string;
  optionPressedBg?: string;
  optionPressedBorder?: string;
  optionPressedFg?: string;
  optionSelectedActiveBg?: string;
  optionSelectedActiveBorder?: string;
  optionSelectedActiveFg?: string;
  optionSelectedBg?: string;
  optionSelectedBorder?: string;
  optionSelectedFg?: string;
  optionSelectedHoverBg?: string;
  optionSelectedHoverBorder?: string;
  optionSelectedHoverFg?: string;
  optionSelectedPressedBg?: string;
  optionSelectedPressedBorder?: string;
  optionSelectedPressedFg?: string;
};

const createSelectVariant = (
  palette: SelectBasePalette,
  variant: SelectVariantName,
  config: SelectPaletteConfig
) => {
  const selected = {
    bg: config.optionSelectedBg ?? palette.soft.default.bg,
    fg: config.optionSelectedFg ?? palette.soft.default.fg,
    border: config.optionSelectedBorder ?? palette.outline.default.border,
  };

  return {
    ...palette[variant],
    dropdown: {
      border: config.dropdownBorder ?? palette.outline.default.border,
      ring: palette.ring,
    },
    option: {
      active: {
        bg: config.optionActiveBg ?? palette[variant].hover.bg,
        fg: config.optionActiveFg ?? palette[variant].hover.fg,
        border: config.optionActiveBorder ?? palette[variant].hover.border,
        ring: config.optionActiveRing ?? palette.ring,
      },
      hover: {
        bg: config.optionHoverBg ?? palette[variant].hover.bg,
        fg: config.optionHoverFg ?? palette[variant].hover.fg,
        border: config.optionHoverBorder ?? palette[variant].hover.border,
      },
      selected,
      selectedHover: {
        bg: config.optionSelectedHoverBg ?? selected.bg,
        fg: config.optionSelectedHoverFg ?? selected.fg,
        border: config.optionSelectedHoverBorder ?? selected.border,
      },
      selectedActive: {
        bg: config.optionSelectedActiveBg ?? selected.bg,
        fg: config.optionSelectedActiveFg ?? selected.fg,
        border: config.optionSelectedActiveBorder ?? selected.border,
        ring: config.optionActiveRing ?? palette.ring,
      },
      selectedPressed: {
        bg: config.optionSelectedPressedBg ?? selected.bg,
        fg: config.optionSelectedPressedFg ?? selected.fg,
        border: config.optionSelectedPressedBorder ?? selected.border,
      },
      pressed: {
        bg: config.optionPressedBg ?? palette[variant].focus.bg,
        fg: config.optionPressedFg ?? palette[variant].focus.fg,
        border: config.optionPressedBorder ?? palette[variant].focus.border,
      },
      badge: {
        bg: palette.soft.default.bg,
        fg: palette.soft.default.fg,
        border: palette.soft.default.border,
      },
    },
  };
};

export const createSelectIntentPalette = (
  palette: SelectBasePalette,
  config: SelectPaletteConfig = {}
) =>
  ({
    ring: palette.ring,
    outline: createSelectVariant(palette, 'outline', config),
    filled: createSelectVariant(palette, 'filled', config),
    soft: createSelectVariant(palette, 'soft', config),
  }) as const;

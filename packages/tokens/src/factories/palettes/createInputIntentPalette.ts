export type InputState = {
  bg: string;
  fg: string;
  border: string;
  placeholder: string;
  icon: string;
};

export type InputPaletteConfig = {
  ring: string;
  outline: {
    default: InputState;
    hover: InputState;
    focus: InputState;
  };
  filled: {
    default: InputState;
    hover: InputState;
    focus: InputState;
  };
  soft: {
    default: InputState;
    hover: InputState;
    focus: InputState;
  };
};

export const createInputIntentPalette = ({
  ring,
  outline,
  filled,
  soft,
}: InputPaletteConfig) =>
  ({
    ring,
    outline,
    filled,
    soft,
  }) as const;

export type InputColorPaletteConfig = {
  accent: string;
  accentHover: string;
  accentSoft: string;
  filledBg: string;
  filledHoverBg: string;
  hoverBg: string;
  ring: string;
  fg: string;
  placeholder: string;
  filledFocusBg: string;
  filledDefaultBorder?: string;
  filledHoverBorder?: string;
  softDefaultBorder?: string;
  softHoverBorder?: string;
};

export const createInputColorPalette = ({
  accent,
  accentHover,
  accentSoft,
  filledBg,
  filledHoverBg,
  hoverBg,
  ring,
  fg,
  placeholder,
  filledFocusBg,
  filledDefaultBorder = 'transparent',
  filledHoverBorder = accent,
  softDefaultBorder = 'transparent',
  softHoverBorder = accent,
}: InputColorPaletteConfig) =>
  createInputIntentPalette({
    ring,
    outline: {
      default: {
        bg: 'transparent',
        fg,
        border: accent,
        placeholder,
        icon: accent,
      },
      hover: {
        bg: hoverBg,
        fg,
        border: accentHover,
        placeholder,
        icon: accentHover,
      },
      focus: {
        bg: 'transparent',
        fg,
        border: accentHover,
        placeholder,
        icon: accentHover,
      },
    },
    filled: {
      default: {
        bg: filledBg,
        fg,
        border: filledDefaultBorder,
        placeholder,
        icon: accent,
      },
      hover: {
        bg: filledHoverBg,
        fg,
        border: filledHoverBorder,
        placeholder,
        icon: accentHover,
      },
      focus: {
        bg: filledFocusBg,
        fg,
        border: accentHover,
        placeholder,
        icon: accentHover,
      },
    },
    soft: {
      default: {
        bg: accentSoft,
        fg,
        border: softDefaultBorder,
        placeholder,
        icon: accent,
      },
      hover: {
        bg: accentSoft,
        fg,
        border: softHoverBorder,
        placeholder,
        icon: accentHover,
      },
      focus: {
        bg: accentSoft,
        fg,
        border: accentHover,
        placeholder,
        icon: accentHover,
      },
    },
  });

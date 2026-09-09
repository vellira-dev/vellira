export type ButtonState = {
  bg: string;
  fg: string;
  border: string;
};

export type ButtonPaletteConfig = {
  ring: string;

  solid: {
    default: ButtonState;
    hover: ButtonState;
    pressed: ButtonState;
  };

  fg: string;
  bg: string;
  border: string;

  hoverBg: string;
  hoverFg: string;
  hoverBorder?: string;

  pressedBg: string;
  pressedFg: string;
  pressedBorder?: string;

  softBorder?: string;
  softHoverBorder?: string;
  softPressedBorder?: string;
};

export const transparent = {
  bg: 'transparent',
  border: 'transparent',
} as const;

export const createButtonIntentPalette = ({
  ring,
  solid,
  fg,
  bg,
  border,
  hoverBg,
  hoverFg,
  hoverBorder = border,
  pressedBg,
  pressedFg,
  pressedBorder = border,
  softBorder = transparent.border,
  softHoverBorder = softBorder,
  softPressedBorder = softBorder,
}: ButtonPaletteConfig) =>
  ({
    ring,

    solid,

    outline: {
      default: {
        bg: transparent.bg,
        fg,
        border,
      },
      hover: {
        bg: hoverBg,
        fg: hoverFg,
        border: hoverBorder,
      },
      pressed: {
        bg: pressedBg,
        fg: pressedFg,
        border: pressedBorder,
      },
    },

    ghost: {
      default: {
        ...transparent,
        fg,
      },
      hover: {
        ...transparent,
        bg: hoverBg,
        fg: hoverFg,
      },
      pressed: {
        ...transparent,
        bg: pressedBg,
        fg: pressedFg,
      },
    },

    soft: {
      default: {
        bg,
        fg,
        border: softBorder,
      },
      hover: {
        bg: hoverBg,
        fg: hoverFg,
        border: softHoverBorder,
      },
      pressed: {
        bg: pressedBg,
        fg: pressedFg,
        border: softPressedBorder,
      },
    },

    link: {
      default: {
        ...transparent,
        fg,
      },
      hover: {
        ...transparent,
        fg: hoverFg,
      },
      pressed: {
        ...transparent,
        fg: pressedFg,
      },
    },
  }) as const;

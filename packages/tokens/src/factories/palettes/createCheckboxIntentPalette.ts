export type CheckboxState = {
  bg: string;
  fg: string;
  border: string;
  labelFg: string;
};

export type CheckboxPaletteConfig = {
  ring: string;
  default: CheckboxState;
  hover: CheckboxState;
  pressed: CheckboxState;
};

export const createCheckboxIntentPalette = ({
  ring,
  default: defaultState,
  hover,
  pressed,
}: CheckboxPaletteConfig) =>
  ({
    ring,
    default: defaultState,
    hover,
    pressed,
  }) as const;

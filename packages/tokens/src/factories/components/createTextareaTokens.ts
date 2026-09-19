export type TextareaVisualState = {
  bg: string;
  fg: string;
  border: string;
};

export type TextareaTokensConfig = {
  default: TextareaVisualState;
  hover: TextareaVisualState;
  pressed: TextareaVisualState;
  focusRing: string;
  error: {
    fg: string;
    border: string;
    ring: string;
  };
  disabled: TextareaVisualState;
};

export type TextareaThemeSemantics = {
  control: {
    default: TextareaVisualState;
    hover: TextareaVisualState;
    pressed: TextareaVisualState;
    disabled: TextareaVisualState;
  };
  focus: {
    ring: {
      color: string;
    };
  };
  status: {
    error: {
      fg: string;
      border: string;
      ring: string;
    };
  };
};

export const createTextareaTokens = (config: TextareaTokensConfig) => config;

export const createTextareaTokensFromSemantics = ({
  control,
  focus,
  status,
}: TextareaThemeSemantics) =>
  createTextareaTokens({
    default: control.default,
    hover: control.hover,
    pressed: control.pressed,
    focusRing: focus.ring.color,
    error: {
      fg: status.error.fg,
      border: status.error.border,
      ring: status.error.ring,
    },
    disabled: control.disabled,
  });

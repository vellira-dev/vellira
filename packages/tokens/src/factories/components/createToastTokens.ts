export type ToastVisualState = {
  bg: string;
  fg: string;
  border: string;
};

export type ToastTokensConfig = {
  default: ToastVisualState;
  hover: ToastVisualState;
  pressed: ToastVisualState;
  focusRing: string;
  error: {
    fg: string;
    border: string;
    ring: string;
  };
  disabled: ToastVisualState;
};

export type ToastThemeSemantics = {
  control: {
    default: ToastVisualState;
    hover: ToastVisualState;
    pressed: ToastVisualState;
    disabled: ToastVisualState;
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

export const createToastTokens = (config: ToastTokensConfig) => config;

export const createToastTokensFromSemantics = ({
  control,
  focus,
  status,
}: ToastThemeSemantics) =>
  createToastTokens({
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

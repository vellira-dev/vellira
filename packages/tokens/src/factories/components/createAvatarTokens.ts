export type AvatarVisualState = {
  bg: string;
  fg: string;
  border: string;
};

export type AvatarTokensConfig = {
  default: AvatarVisualState;
  hover: AvatarVisualState;
  pressed: AvatarVisualState;
  focusRing: string;
  error: {
    fg: string;
    border: string;
    ring: string;
  };
  disabled: AvatarVisualState;
};

export type AvatarThemeSemantics = {
  control: {
    default: AvatarVisualState;
    hover: AvatarVisualState;
    pressed: AvatarVisualState;
    disabled: AvatarVisualState;
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

export const createAvatarTokens = (config: AvatarTokensConfig) => config;

export const createAvatarTokensFromSemantics = ({
  control,
  focus,
  status,
}: AvatarThemeSemantics) =>
  createAvatarTokens({
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

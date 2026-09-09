export type SwitchVisualState = {
  trackBg: string;
  trackBorder: string;
  thumbBg: string;
};

export type SwitchGeometry = {
  trackWidth: number;
  trackHeight: number;
  borderWidth: number;
  padding: number;
  thumbSize: number;
  thumbTravel: number;
  focusRingWidth: number;
  focusRingOffset: number;
  pressScale: number;
};

export type SwitchTokensConfig = {
  geometry: SwitchGeometry;
  off: SwitchVisualState;
  on: {
    default: SwitchVisualState;
    hover: SwitchVisualState;
    pressed: SwitchVisualState;
  };
  focusRing: string;
  errorBorder: string;
  errorRing: string;
  disabled: SwitchVisualState;
};

type SwitchSemanticState = {
  bg: string;
  border: string;
  fg: string;
};

export type SwitchThemeSemantics = {
  control: {
    default: SwitchSemanticState;
    selected: {
      default: SwitchSemanticState;
      hover: SwitchSemanticState;
      pressed: SwitchSemanticState;
    };
    disabled: SwitchSemanticState;
  };
  focus: {
    ring: {
      color: string;
    };
  };
  status: {
    error: {
      border: string;
      ring: string;
    };
  };
};

const switchGeometry: SwitchGeometry = {
  trackWidth: 44,
  trackHeight: 24,
  borderWidth: 2,
  padding: 1,
  thumbSize: 18,
  thumbTravel: 20,
  focusRingWidth: 2,
  focusRingOffset: 2,
  pressScale: 0.98,
};

export const createSwitchTokens = (config: SwitchTokensConfig) => config;

export const createSwitchTokensFromSemantics = ({
  control,
  focus,
  status,
}: SwitchThemeSemantics) =>
  createSwitchTokens({
    geometry: switchGeometry,
    off: {
      trackBg: control.default.bg,
      trackBorder: control.default.border,
      thumbBg: control.default.fg,
    },
    on: {
      default: {
        trackBg: control.selected.default.bg,
        trackBorder: control.selected.default.border,
        thumbBg: control.selected.default.fg,
      },
      hover: {
        trackBg: control.selected.hover.bg,
        trackBorder: control.selected.hover.border,
        thumbBg: control.selected.hover.fg,
      },
      pressed: {
        trackBg: control.selected.pressed.bg,
        trackBorder: control.selected.pressed.border,
        thumbBg: control.selected.pressed.fg,
      },
    },
    focusRing: focus.ring.color,
    errorBorder: status.error.border,
    errorRing: status.error.ring,
    disabled: {
      trackBg: control.disabled.bg,
      trackBorder: control.disabled.border,
      thumbBg: control.disabled.fg,
    },
  });

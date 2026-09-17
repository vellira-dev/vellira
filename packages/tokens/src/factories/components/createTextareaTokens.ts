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

export const createTextareaTokens = (config: TextareaTokensConfig) => config;

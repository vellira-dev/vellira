export type AccordionTriggerState = {
  bg: string;
  fg: string;
};

export type AccordionTokensConfig = {
  root: {
    bg: string;
    border: string;
  };
  divider: string;
  trigger: {
    default: AccordionTriggerState;
    expanded: {
      bg: string;
    };
    hover: AccordionTriggerState;
    pressed: AccordionTriggerState;
    disabled: AccordionTriggerState;
  };
  indicator: string;
  content: {
    bg: string;
    fg: string;
  };
  focusRing: string;
};

export type AccordionThemeSemantics = {
  border: {
    muted: string;
  };
  focus: {
    ring: {
      color: string;
    };
  };
  surface: {
    default: string;
    subtle: string;
    hover: string;
    pressed: string;
    disabled: string;
  };
  text: {
    primary: string;
    secondary: string;
    disabled: string;
  };
};

export const createAccordionTokens = (config: AccordionTokensConfig) => config;

export const createAccordionTokensFromSemantics = ({
  border,
  focus,
  surface,
  text,
}: AccordionThemeSemantics) =>
  createAccordionTokens({
    root: {
      bg: surface.default,
      border: border.muted,
    },
    divider: border.muted,
    trigger: {
      default: {
        bg: surface.default,
        fg: text.primary,
      },
      expanded: {
        bg: surface.subtle,
      },
      hover: {
        bg: surface.hover,
        fg: text.primary,
      },
      pressed: {
        bg: surface.pressed,
        fg: text.primary,
      },
      disabled: {
        bg: surface.disabled,
        fg: text.disabled,
      },
    },
    indicator: text.secondary,
    content: {
      bg: surface.subtle,
      fg: text.secondary,
    },
    focusRing: focus.ring.color,
  });

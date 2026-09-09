import type { ComponentTokenContract } from '@vellira-ui/metadata';

import type { ComponentProfileArg, FormControlKindArg } from '../cli';
import { requireGeneratedComponentNumericValueKind } from '../token-value-kinds';
import type { ComponentTemplateParams } from './component-types';

export type ComponentTokensTemplateParams = ComponentTemplateParams & {
  componentTokens?: ComponentTokenContract;
  profile?: ComponentProfileArg;
  control?: FormControlKindArg;
};

const booleanControlGeometry = [
  ['trackWidth', 44],
  ['trackHeight', 24],
  ['borderWidth', 2],
  ['padding', 1],
  ['thumbSize', 18],
  ['thumbTravel', 20],
  ['focusRingWidth', 2],
  ['focusRingOffset', 2],
  ['pressScale', 0.98],
] as const;

function lowerCamel(componentName: string) {
  return `${componentName[0].toLowerCase()}${componentName.slice(1)}`;
}

function renderBooleanControlGeometry(componentName: string) {
  for (const [role, value] of booleanControlGeometry) {
    requireGeneratedComponentNumericValueKind({
      componentName,
      section: 'geometry',
      role,
      value,
    });
  }

  return {
    typeFields: booleanControlGeometry
      .map(([role]) => `  ${role}: number;`)
      .join('\n'),
    valueFields: booleanControlGeometry
      .map(([role, value]) => `  ${role}: ${value},`)
      .join('\n'),
  };
}

function resolveTemplateContract({
  componentTokens,
  profile = 'base',
  control = 'value',
}: ComponentTokensTemplateParams): ComponentTokenContract {
  if (componentTokens) return componentTokens;

  if (profile === 'form-control' && control === 'boolean') {
    return 'boolean-control';
  }

  return 'standard';
}

export function renderComponentTokenFactoryTemplate(
  params: ComponentTokensTemplateParams
) {
  const { componentName } = params;
  const contract = resolveTemplateContract(params);

  if (contract === 'boolean-control') {
    const geometry = renderBooleanControlGeometry(componentName);

    return `export type ${componentName}VisualState = {
  trackBg: string;
  trackBorder: string;
  thumbBg: string;
};

export type ${componentName}Geometry = {
${geometry.typeFields}
};

export type ${componentName}TokensConfig = {
  geometry: ${componentName}Geometry;
  off: ${componentName}VisualState;
  on: {
    default: ${componentName}VisualState;
    hover: ${componentName}VisualState;
    pressed: ${componentName}VisualState;
  };
  focusRing: string;
  errorBorder: string;
  errorRing: string;
  disabled: ${componentName}VisualState;
};

type ${componentName}SemanticState = {
  bg: string;
  border: string;
  fg: string;
};

export type ${componentName}ThemeSemantics = {
  control: {
    default: ${componentName}SemanticState;
    selected: {
      default: ${componentName}SemanticState;
      hover: ${componentName}SemanticState;
      pressed: ${componentName}SemanticState;
    };
    disabled: ${componentName}SemanticState;
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

const ${lowerCamel(componentName)}Geometry: ${componentName}Geometry = {
${geometry.valueFields}
};

export const create${componentName}Tokens = (config: ${componentName}TokensConfig) => config;

export const create${componentName}TokensFromSemantics = ({
  control,
  focus,
  status,
}: ${componentName}ThemeSemantics) =>
  create${componentName}Tokens({
    geometry: ${lowerCamel(componentName)}Geometry,
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
`;
  }

  if (contract === 'disclosure') {
    return `export type ${componentName}TriggerState = {
  bg: string;
  fg: string;
};

export type ${componentName}TokensConfig = {
  root: {
    bg: string;
    border: string;
  };
  divider: string;
  trigger: {
    default: ${componentName}TriggerState;
    expanded: {
      bg: string;
    };
    hover: ${componentName}TriggerState;
    pressed: ${componentName}TriggerState;
    disabled: ${componentName}TriggerState;
  };
  indicator: string;
  content: {
    bg: string;
    fg: string;
  };
  focusRing: string;
};

export type ${componentName}ThemeSemantics = {
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

export const create${componentName}Tokens = (config: ${componentName}TokensConfig) => config;

export const create${componentName}TokensFromSemantics = ({
  border,
  focus,
  surface,
  text,
}: ${componentName}ThemeSemantics) =>
  create${componentName}Tokens({
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
`;
  }

  return `export type ${componentName}VisualState = {
  bg: string;
  fg: string;
  border: string;
};

export type ${componentName}TokensConfig = {
  default: ${componentName}VisualState;
  hover: ${componentName}VisualState;
  pressed: ${componentName}VisualState;
  focusRing: string;
  error: {
    fg: string;
    border: string;
    ring: string;
  };
  disabled: ${componentName}VisualState;
};

export const create${componentName}Tokens = (config: ${componentName}TokensConfig) => config;
`;
}

export function renderThemeComponentTokensTemplate(
  params: ComponentTokensTemplateParams
) {
  const { componentName } = params;
  const tokenName = `${lowerCamel(componentName)}Tokens`;
  const contract = resolveTemplateContract(params);

  if (contract === 'boolean-control') {
    return `import { create${componentName}TokensFromSemantics } from '../../factories/components/create${componentName}Tokens.js';
import { control } from '../semantic/control.js';
import { focus } from '../semantic/focus.js';
import { status } from '../semantic/status.js';

export const ${tokenName} = create${componentName}TokensFromSemantics({
  control,
  focus,
  status,
});
`;
  }

  if (contract === 'disclosure') {
    return `import { create${componentName}TokensFromSemantics } from '../../factories/components/create${componentName}Tokens.js';
import { border } from '../semantic/border.js';
import { focus } from '../semantic/focus.js';
import { surface } from '../semantic/surface.js';
import { text } from '../semantic/text.js';

export const ${tokenName} = create${componentName}TokensFromSemantics({
  border,
  focus,
  surface,
  text,
});
`;
  }

  return `import { create${componentName}Tokens } from '../../factories/components/create${componentName}Tokens.js';
import { control } from '../semantic/control.js';
import { focus } from '../semantic/focus.js';
import { status } from '../semantic/status.js';

export const ${tokenName} = create${componentName}Tokens({
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
`;
}

export function renderComponentTokenBarrelExport(componentName: string) {
  const tokenName = `${lowerCamel(componentName)}Tokens`;
  const exportName = lowerCamel(componentName);

  return `export { ${tokenName} as ${exportName} } from './${exportName}.js';`;
}

export function renderComponentTokenFactoryBarrelExport(componentName: string) {
  return `export * from './components/create${componentName}Tokens.js';`;
}

import type { ComponentTokenContract } from '@vellira-ui/metadata';

const componentTokenLeafSuffixes = {
  standard: [
    'default.bg',
    'default.fg',
    'default.border',
    'hover.bg',
    'hover.fg',
    'hover.border',
    'pressed.bg',
    'pressed.fg',
    'pressed.border',
    'focusRing',
    'error.fg',
    'error.border',
    'error.ring',
    'disabled.bg',
    'disabled.fg',
    'disabled.border',
  ],
  'boolean-control': [
    'geometry.trackWidth',
    'geometry.trackHeight',
    'geometry.borderWidth',
    'geometry.padding',
    'geometry.thumbSize',
    'geometry.thumbTravel',
    'geometry.focusRingWidth',
    'geometry.focusRingOffset',
    'geometry.pressScale',
    'off.trackBg',
    'off.trackBorder',
    'off.thumbBg',
    'on.default.trackBg',
    'on.default.trackBorder',
    'on.default.thumbBg',
    'on.hover.trackBg',
    'on.hover.trackBorder',
    'on.hover.thumbBg',
    'on.pressed.trackBg',
    'on.pressed.trackBorder',
    'on.pressed.thumbBg',
    'focusRing',
    'errorBorder',
    'errorRing',
    'disabled.trackBg',
    'disabled.trackBorder',
    'disabled.thumbBg',
  ],
  disclosure: [
    'root.bg',
    'root.border',
    'divider',
    'trigger.default.bg',
    'trigger.default.fg',
    'trigger.expanded.bg',
    'trigger.hover.bg',
    'trigger.hover.fg',
    'trigger.pressed.bg',
    'trigger.pressed.fg',
    'trigger.disabled.bg',
    'trigger.disabled.fg',
    'indicator',
    'content.bg',
    'content.fg',
    'focusRing',
  ],
} as const satisfies Record<ComponentTokenContract, readonly string[]>;

function lowerCamel(componentName: string): string {
  return `${componentName[0].toLowerCase()}${componentName.slice(1)}`;
}

/**
 * Canonical logical leaves materialized by the matching Generator V2 token
 * factory contract. Preservation evidence is renderer/theme neutral, so each
 * returned path owns every applicable canonical, Web, and React Native context.
 */
export function getGeneratedComponentTokenLogicalPaths(params: {
  componentName: string;
  componentTokens: ComponentTokenContract;
}): string[] {
  const prefix = `components.${lowerCamel(params.componentName)}`;

  return componentTokenLeafSuffixes[params.componentTokens]
    .map((suffix) => `${prefix}.${suffix}`)
    .sort((left, right) => left.localeCompare(right, 'en'));
}

export function getGeneratedComponentTokenLeafSuffixes(
  componentTokens: ComponentTokenContract
): readonly string[] {
  return componentTokenLeafSuffixes[componentTokens];
}

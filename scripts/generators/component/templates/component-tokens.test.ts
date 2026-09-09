import { describe, expect, it } from 'vitest';

import {
  renderComponentTokenBarrelExport,
  renderComponentTokenFactoryBarrelExport,
  renderComponentTokenFactoryTemplate,
  renderThemeComponentTokensTemplate,
} from './component-tokens';

describe('component token templates', () => {
  it('generates a dedicated boolean control token factory', () => {
    const result = renderComponentTokenFactoryTemplate({
      componentName: 'Switch',
      profile: 'form-control',
      control: 'boolean',
    });

    expect(result).toContain('export type SwitchVisualState');
    expect(result).toContain('trackBg: string');
    expect(result).toContain('thumbBg: string');
    expect(result).toContain('export type SwitchTokensConfig');
    expect(result).toContain('export const createSwitchTokens');
    expect(result).toContain('export const createSwitchTokensFromSemantics');
    expect(result).toContain('const switchGeometry: SwitchGeometry');
    expect(result).toContain('geometry: switchGeometry');
    expect(result).toContain('trackBg: control.default.bg');
    expect(result).toContain('trackBg: control.selected.default.bg');
    expect(result).toContain('trackBg: control.selected.hover.bg');
    expect(result).toContain('trackBg: control.selected.pressed.bg');
    expect(result).toContain('trackBg: control.disabled.bg');
    expect(result).toContain('focusRing: focus.ring.color');
    expect(result).toContain('errorBorder: status.error.border');
    expect(result).toContain('errorRing: status.error.ring');
  });

  it('generates thin boolean theme token entrypoints with canonical runtime ESM imports', () => {
    const result = renderThemeComponentTokensTemplate({
      componentName: 'Switch',
      profile: 'form-control',
      control: 'boolean',
    });

    expect(result).toContain(
      "import { createSwitchTokensFromSemantics } from '../../factories/components/createSwitchTokens.js';"
    );
    expect(result).toContain(
      "import { control } from '../semantic/control.js';"
    );
    expect(result).toContain("import { focus } from '../semantic/focus.js';");
    expect(result).toContain("import { status } from '../semantic/status.js';");
    expect(result).toContain(
      `export const switchTokens = createSwitchTokensFromSemantics({
  control,
  focus,
  status,
});`
    );
    expect(result).not.toContain("from '../../factories/createSwitchTokens.js'");
    expect(result).not.toContain('createSwitchTokens({');
    expect(result).not.toContain('geometry:');
    expect(result).not.toContain('control.default.bg');
    expect(result).not.toContain('control.selected.default.bg');
    expect(result).not.toContain('control.selected.hover.bg');
    expect(result).not.toContain('control.selected.pressed.bg');
    expect(result).not.toContain('control.disabled.bg');
    expect(result).not.toContain('status.error.border');
    expect(result).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('generates disclosure theme entrypoints from the grouped component factory namespace', () => {
    const result = renderThemeComponentTokensTemplate({
      componentName: 'Accordion',
      componentTokens: 'disclosure',
    });

    expect(result).toContain(
      "import { createAccordionTokensFromSemantics } from '../../factories/components/createAccordionTokens.js';"
    );
    expect(result).not.toContain(
      "from '../../factories/createAccordionTokens.js'"
    );
  });

  it('generates a safe generic component token scaffold for other profiles', () => {
    const factory = renderComponentTokenFactoryTemplate({
      componentName: 'Avatar',
      profile: 'base',
      control: 'value',
    });
    const theme = renderThemeComponentTokensTemplate({
      componentName: 'Avatar',
      profile: 'base',
      control: 'value',
    });

    expect(factory).toContain('export type AvatarVisualState');
    expect(factory).toContain('export const createAvatarTokens');
    expect(theme).toContain(
      "import { createAvatarTokens } from '../../factories/components/createAvatarTokens.js';"
    );
    expect(theme).not.toContain("from '../../factories/createAvatarTokens.js'");
    expect(theme).toContain('default: control.default');
    expect(theme).toContain('hover: control.hover');
    expect(theme).toContain('pressed: control.pressed');
    expect(theme).not.toContain('pressed: control.active');
    expect(theme).toContain('disabled: control.disabled');
  });

  it('renders idempotent barrel export lines for the grouped factory namespace', () => {
    expect(renderComponentTokenFactoryBarrelExport('Switch')).toBe(
      "export * from './components/createSwitchTokens.js';"
    );
    expect(renderComponentTokenBarrelExport('Switch')).toBe(
      "export { switchTokens as switch } from './switch.js';"
    );
  });
});

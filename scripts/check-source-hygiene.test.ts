import { describe, expect, it } from 'vitest';

// @ts-expect-error The source-hygiene checker is a native ESM CLI module.
import { usesSharedThemeFactory } from './check-source-hygiene.mjs';

describe('source hygiene theme component duplication classification', () => {
  it('recognizes thin theme entrypoints that delegate mapping to a shared factory', () => {
    const filePath = '/repo/packages/tokens/src/light/components/switch.ts';
    const sources = new Map([
      [
        filePath,
        `import { createSwitchTokensFromSemantics } from '../../factories/components/createSwitchTokens.js';
import { control } from '../semantic/control.js';
import { focus } from '../semantic/focus.js';
import { status } from '../semantic/status.js';

export const switchTokens = createSwitchTokensFromSemantics({
  control,
  focus,
  status,
});
`,
      ],
    ]);

    expect(usesSharedThemeFactory(filePath, sources)).toBe(true);
  });

  it('rejects duplicated inline mapping with only an incidental factory import', () => {
    const filePath = '/repo/packages/tokens/src/light/components/switch.ts';
    const sources = new Map([
      [
        filePath,
        `import { createSwitchTokensFromSemantics } from '../../factories/components/createSwitchTokens.js';
import { createSwitchTokens } from '../../factories/components/createSwitchTokens.js';
import { control } from '../semantic/control.js';
import { focus } from '../semantic/focus.js';
import { status } from '../semantic/status.js';

export const switchTokens = createSwitchTokens({
  geometry: {
    trackWidth: 44,
    trackHeight: 24,
  },
  off: {
    trackBg: control.default.bg,
    trackBorder: control.default.border,
    thumbBg: control.default.fg,
  },
  focusRing: focus.ring.color,
  errorBorder: status.error.border,
});
`,
      ],
    ]);

    expect(usesSharedThemeFactory(filePath, sources)).toBe(false);
  });

  it('rejects local config delegation that keeps mapping in the theme file', () => {
    const filePath = '/repo/packages/tokens/src/light/components/switch.ts';
    const sources = new Map([
      [
        filePath,
        `import { createSwitchTokensFromSemantics } from '../../factories/components/createSwitchTokens.js';
import { control } from '../semantic/control.js';
import { focus } from '../semantic/focus.js';

const switchConfig = {
  control,
  focus,
};

export const switchTokens = createSwitchTokensFromSemantics(switchConfig);
`,
      ],
    ]);

    expect(usesSharedThemeFactory(filePath, sources)).toBe(false);
  });

  it('recognizes direct single-semantic-source delegation to a shared factory', () => {
    const filePath = '/repo/packages/tokens/src/light/components/radioGroup.ts';
    const sources = new Map([
      [
        filePath,
        `import { createRadioGroupTokensFromSpacing } from '../../factories/components/createRadioGroupTokens.js';
import { spacing } from '../../tokens/spacing.js';

export const radioGroup = createRadioGroupTokensFromSpacing(spacing);
`,
      ],
    ]);

    expect(usesSharedThemeFactory(filePath, sources)).toBe(true);
  });

  it('rejects legacy flat factory paths after responsibility grouping', () => {
    const filePath = '/repo/packages/tokens/src/light/components/switch.ts';
    const sources = new Map([
      [
        filePath,
        `import { createSwitchTokensFromSemantics } from '../../factories/createSwitchTokens.js';
import { control } from '../semantic/control.js';
import { focus } from '../semantic/focus.js';
import { status } from '../semantic/status.js';

export const switchTokens = createSwitchTokensFromSemantics({
  control,
  focus,
  status,
});
`,
      ],
    ]);

    expect(usesSharedThemeFactory(filePath, sources)).toBe(false);
  });
});

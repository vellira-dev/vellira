import { describe, expect, it } from 'vitest';

import { darkTheme } from './dark/theme.js';
import { highContrastTheme } from './highContrast/theme.js';
import { lightTheme } from './light/theme.js';
import {
  type ComponentTokenBoundaryFinding,
  scanCanonicalComponentTokens,
} from './platform-output/component-token-boundary.js';

const themes = [
  ['light', lightTheme],
  ['dark', darkTheme],
  ['high-contrast', highContrastTheme],
] as const;

describe('renderer-neutral canonical component token boundary', () => {
  it.each(themes)(
    'has no platform leakage in %s components',
    (_name, theme) => {
      const findings: ComponentTokenBoundaryFinding[] = [];

      scanCanonicalComponentTokens(theme.components, 'components', findings);

      expect(findings).toEqual([]);
    }
  );

  it('does not let renderer keys hide inside intent-shaped objects', () => {
    const findings: ComponentTokenBoundaryFinding[] = [];

    scanCanonicalComponentTokens(
      {
        content: {
          shadow: {
            kind: 'shadow',
            role: 'elevation',
            level: 'lg',
            web: '0 0 8px black',
          },
        },
      },
      'components.probe',
      findings
    );

    expect(findings).toEqual([
      {
        path: 'components.probe.content.shadow.web',
        reason: 'renderer-specific canonical key "web"',
      },
    ]);
  });
});

import { describe, expect, it } from 'vitest';

import { legitimatePersistentActiveStateDomainsV1 } from '../../../packages/tokens/src/token-architecture';
import {
  auditStateSource,
  checkTokenStateVocabulary,
  matchesActiveStateDomainPattern,
} from './state-vocabulary';

const root = process.cwd();

describe('state vocabulary audit adapter', () => {
  it('checks the maintained repository state contracts without findings', () => {
    const result = checkTokenStateVocabulary(root);
    expect(result.coverage).toBe('partial');
    expect(result.checked).toBeGreaterThan(0);
    expect(result.findings).toEqual([]);
  });

  it('matches wildcard active-domain registrations without broad prefixes', () => {
    const selectPattern = legitimatePersistentActiveStateDomainsV1.find(
      ({ pattern }) => pattern === 'components.select.*.option.active'
    )?.pattern;
    expect(selectPattern).toBeDefined();
    expect(
      matchesActiveStateDomainPattern(
        'components.select.primary.option.active',
        selectPattern!
      )
    ).toBe(true);
    expect(
      matchesActiveStateDomainPattern(
        'components.button.primary.active',
        selectPattern!
      )
    ).toBe(false);
  });

  it.each([
    ['pressed: control.active', 'pressed-maps-to-control-active'],
    [
      'const legacy = control.selected.active;',
      'selected-pressed-maps-to-active',
    ],
    ['pressedBg: surface.active', 'pressed-background-maps-to-active'],
    ['const interactiveActive = value;', 'interactive-active-alias'],
  ])('detects deprecated source mapping %s', (source, code) => {
    expect(auditStateSource('fixture.ts', source)).toEqual([
      expect.objectContaining({ code }),
    ]);
  });
});

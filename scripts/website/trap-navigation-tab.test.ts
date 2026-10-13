// @vitest-environment jsdom
import { expect, it } from 'vitest';

import { trapNavigationTab } from '../../apps/website/src/components/navigation/trapNavigationTab';

it('wraps Tab and Shift+Tab inside the existing drawer', () => {
  const surface = document.createElement('div');
  const first = document.createElement('button');
  const last = document.createElement('button');
  surface.append(first, last);
  document.body.append(surface);

  try {
    first.focus();
    const reverse = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      cancelable: true,
    });
    trapNavigationTab(reverse, surface);
    expect(reverse.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);

    const forward = new KeyboardEvent('keydown', {
      key: 'Tab',
      cancelable: true,
    });
    trapNavigationTab(forward, surface);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    const unrelated = new KeyboardEvent('keydown', { key: 'Escape' });
    trapNavigationTab(unrelated, surface);
    expect(unrelated.defaultPrevented).toBe(false);
  } finally {
    surface.remove();
  }
});

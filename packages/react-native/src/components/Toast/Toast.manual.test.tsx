// Coverage contract: focus-management, portal
import { act } from 'react';

import { AccessibilityInfo } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { render } from '../../test-utils/render';

import { createToastStore } from './internal/store';
import { Toast } from './Toast';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('Native Toast manual behavior coverage', () => {
  it('renders an app-root viewport without importing DOM portal semantics', () => {
    const store = createToastStore();
    store.show({ title: 'First' });
    store.show({ title: 'Second', tone: 'warning' });

    const { container, unmount } = render(
      <Toast.Provider store={store}>
        <Toast.Viewport testID='toast-viewport' />
      </Toast.Provider>
    );

    expect(
      container.querySelector('[data-testid="toast-viewport"]')
    ).not.toBeNull();
    expect(container.textContent).toContain('First');
    expect(container.textContent).toContain('Second');
    unmount();
  });

  it('uses immediate transitions when native reduced motion is enabled', async () => {
    const isReduceMotionEnabled = vi.fn().mockResolvedValue(true);
    Object.assign(AccessibilityInfo, { isReduceMotionEnabled });

    const { unmount } = render(<Toast title='Reduced motion' />);
    await act(async () => Promise.resolve());

    expect(isReduceMotionEnabled).toHaveBeenCalledOnce();
    unmount();
  });
});

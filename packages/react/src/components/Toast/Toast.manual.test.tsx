// Coverage contract: focus-management, portal, keyboard
import { act } from 'react';

import { render } from '@test-utils/render';
import { fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createToastStore } from './internal/store';
import { Toast } from './Toast';

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('Toast manual behavior coverage', () => {
  it('renders the application viewport in a portal with canonical toast stacking', () => {
    const store = createToastStore();
    store.show({ title: 'First' });
    store.show({ title: 'Second', tone: 'info' });

    const { container, unmount } = render(
      <Toast.Provider store={store}>
        <Toast.Viewport />
      </Toast.Provider>
    );
    const viewport = document.body.querySelector(
      '[aria-label="Notifications"]'
    );

    expect(container.textContent).toBe('');
    expect(viewport?.textContent).toContain('First');
    expect(viewport?.textContent).toContain('Second');
    expect(viewport?.getAttribute('style')).toMatch(/z-index/);
    unmount();
  });

  it('pauses the remaining timeout while pointer interaction is active', () => {
    vi.useFakeTimers();
    const { container, unmount } = render(
      <Toast duration={1000} title='Paused while hovered' />
    );
    const root = container.querySelector<HTMLElement>('[role="status"]');

    act(() => vi.advanceTimersByTime(400));
    act(() => {
      if (root) fireEvent.pointerEnter(root);
    });
    act(() => vi.advanceTimersByTime(1000));
    expect(container.textContent).toContain('Paused while hovered');

    act(() => {
      if (root) fireEvent.pointerLeave(root);
    });
    act(() => vi.advanceTimersByTime(599));
    expect(container.textContent).toContain('Paused while hovered');
    act(() => vi.advanceTimersByTime(1));
    expect(container.textContent).not.toContain('Paused while hovered');
    unmount();
  });

  it('keeps controls keyboard accessible and scopes Escape to focused toasts', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { container, unmount } = render(
      <Toast
        closeOnEscape
        duration={0}
        title='Keyboard toast'
        action={{ label: 'Review', closeOnAction: false }}
        onOpenChange={onOpenChange}
      />
    );
    const action = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Review'
    );

    action?.focus();
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenLastCalledWith(false, { reason: 'escape' });
    expect(container.textContent).not.toContain('Keyboard toast');
    unmount();
  });
});

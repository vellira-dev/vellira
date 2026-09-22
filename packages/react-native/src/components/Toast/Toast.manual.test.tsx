// Coverage contract: focus-management, portal
import { act } from 'react';

import { AccessibilityInfo } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { render } from '../../test-utils/render';

import { createToastStore } from './internal/store';
import { Toast } from './Toast';

afterEach(() => {
  vi.useRealTimers();
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
    const isReduceMotionEnabled = vi
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);

    const { unmount } = render(<Toast title='Reduced motion' />);
    await act(async () => Promise.resolve());

    expect(isReduceMotionEnabled).toHaveBeenCalledOnce();
    unmount();
  });

  it('preserves the deadline across rerenders and calls the latest callback', async () => {
    vi.useFakeTimers();
    const initialOnOpenChange = vi.fn();
    const latestOnOpenChange = vi.fn();
    const { container, rerender, unmount } = render(
      <Toast
        duration={1000}
        title='Initial message'
        onOpenChange={initialOnOpenChange}
      />
    );
    await act(async () => Promise.resolve());

    act(() => vi.advanceTimersByTime(400));
    rerender(
      <Toast
        duration={1000}
        title='Updated message'
        onOpenChange={latestOnOpenChange}
      />
    );
    act(() => vi.advanceTimersByTime(599));
    expect(container.textContent).toContain('Updated message');
    act(() => vi.advanceTimersByTime(1));
    expect(container.textContent).not.toContain('Updated message');
    expect(initialOnOpenChange).not.toHaveBeenCalled();
    expect(latestOnOpenChange).toHaveBeenCalledTimes(1);
    expect(latestOnOpenChange).toHaveBeenLastCalledWith(false, {
      reason: 'timeout',
    });
    unmount();
  });

  it('does not restart timeout when the reduced-motion query resolves later', async () => {
    vi.useFakeTimers();
    let resolveReduceMotion: ((enabled: boolean) => void) | undefined;
    const pendingReduceMotion = new Promise<boolean>((resolve) => {
      resolveReduceMotion = resolve;
    });
    vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(
      pendingReduceMotion
    );
    const onOpenChange = vi.fn();
    const { container, unmount } = render(
      <Toast
        duration={1000}
        title='Delayed motion preference'
        onOpenChange={onOpenChange}
      />
    );
    act(() => vi.advanceTimersByTime(400));
    await act(async () => {
      if (!resolveReduceMotion) {
        throw new Error('Expected pending motion query.');
      }
      resolveReduceMotion(true);
      await pendingReduceMotion;
    });
    act(() => vi.advanceTimersByTime(599));
    expect(container.textContent).toContain('Delayed motion preference');
    act(() => vi.advanceTimersByTime(1));
    expect(container.textContent).not.toContain('Delayed motion preference');
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, {
      reason: 'timeout',
    });
    unmount();
  });

  it('restarts the timeout only when duration changes', async () => {
    vi.useFakeTimers();
    const { container, rerender, unmount } = render(
      <Toast duration={1000} title='Changed duration' />
    );
    await act(async () => Promise.resolve());
    act(() => vi.advanceTimersByTime(400));
    rerender(<Toast duration={2000} title='Changed duration' />);
    act(() => vi.advanceTimersByTime(1999));
    expect(container.textContent).toContain('Changed duration');
    act(() => vi.advanceTimersByTime(1));
    expect(container.textContent).not.toContain('Changed duration');
    unmount();
  });

  it('cancels pending timeout work on unmount', async () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    const { unmount } = render(
      <Toast duration={1000} title='Unmounted' onOpenChange={onOpenChange} />
    );
    await act(async () => Promise.resolve());
    act(() => vi.advanceTimersByTime(400));
    unmount();
    act(() => vi.advanceTimersByTime(1000));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

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

function getToastRoot(container: HTMLElement) {
  const root = container.querySelector<HTMLElement>('[role="status"]');
  if (!root) throw new Error('Expected an open Toast status region.');
  return root;
}

function getToastControl(root: HTMLElement) {
  const control = root.querySelector('button');
  if (!control) throw new Error('Expected an interactive Toast control.');
  return control;
}

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

  it('preserves the deadline across rerenders and calls the latest callback', () => {
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

  it.each(['pointer', 'focus'] as const)(
    'keeps overlapping interactions paused when %s ends first',
    (firstToEnd) => {
      vi.useFakeTimers();
      const onOpenChange = vi.fn();
      const { container, unmount } = render(
        <Toast
          duration={1000}
          title='Overlapping interactions'
          onOpenChange={onOpenChange}
        />
      );
      const root = getToastRoot(container);
      const control = getToastControl(root);
      const endPointer = () => fireEvent.pointerLeave(root);
      const endFocus = () =>
        fireEvent.blur(control, { relatedTarget: document.body });

      act(() => vi.advanceTimersByTime(400));
      act(() => {
        fireEvent.pointerEnter(root);
        fireEvent.focus(control);
      });
      act(() => vi.advanceTimersByTime(1000));
      act(() => {
        if (firstToEnd === 'pointer') endPointer();
        else endFocus();
      });
      act(() => vi.advanceTimersByTime(1000));
      expect(container.textContent).toContain('Overlapping interactions');
      expect(onOpenChange).not.toHaveBeenCalled();

      act(() => {
        if (firstToEnd === 'pointer') endFocus();
        else endPointer();
      });
      act(() => vi.advanceTimersByTime(599));
      expect(container.textContent).toContain('Overlapping interactions');
      act(() => vi.advanceTimersByTime(1));
      expect(container.textContent).not.toContain('Overlapping interactions');
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenLastCalledWith(false, {
        reason: 'timeout',
      });
      unmount();
    }
  );

  it('preserves a pause and its remaining budget across rerenders', () => {
    vi.useFakeTimers();
    const { container, rerender, unmount } = render(
      <Toast duration={1000} title='Initial message' />
    );
    const root = getToastRoot(container);
    act(() => vi.advanceTimersByTime(400));
    act(() => fireEvent.pointerEnter(root));
    rerender(<Toast duration={1000} title='Updated while paused' />);
    act(() => vi.advanceTimersByTime(2000));
    expect(container.textContent).toContain('Updated while paused');

    act(() => fireEvent.pointerLeave(root));
    act(() => vi.advanceTimersByTime(599));
    expect(container.textContent).toContain('Updated while paused');
    act(() => vi.advanceTimersByTime(1));
    expect(container.textContent).not.toContain('Updated while paused');
    unmount();
  });

  it('applies a new duration without discarding an active pause', () => {
    vi.useFakeTimers();
    const { container, rerender, unmount } = render(
      <Toast duration={1000} title='Changed duration' />
    );
    const root = getToastRoot(container);
    act(() => vi.advanceTimersByTime(400));
    act(() => fireEvent.pointerEnter(root));
    rerender(<Toast duration={2000} title='Changed duration' />);
    act(() => vi.advanceTimersByTime(3000));
    expect(container.textContent).toContain('Changed duration');

    act(() => fireEvent.pointerLeave(root));
    act(() => vi.advanceTimersByTime(1999));
    expect(container.textContent).toContain('Changed duration');
    act(() => vi.advanceTimersByTime(1));
    expect(container.textContent).not.toContain('Changed duration');
    unmount();
  });

  it('reconciles pause policy changes against an already present pointer', () => {
    vi.useFakeTimers();
    const { container, rerender, unmount } = render(
      <Toast duration={1000} title='Live policy' pauseOnHover={false} />
    );
    const root = getToastRoot(container);
    act(() => vi.advanceTimersByTime(400));
    act(() => fireEvent.pointerEnter(root));
    rerender(<Toast duration={1000} title='Live policy' pauseOnHover />);
    act(() => vi.advanceTimersByTime(2000));
    expect(container.textContent).toContain('Live policy');

    rerender(
      <Toast duration={1000} title='Live policy' pauseOnHover={false} />
    );
    act(() => vi.advanceTimersByTime(599));
    expect(container.textContent).toContain('Live policy');
    act(() => vi.advanceTimersByTime(1));
    expect(container.textContent).not.toContain('Live policy');
    unmount();
  });

  it('does not restart a running timer when hover pausing is disabled', () => {
    vi.useFakeTimers();
    const { container, unmount } = render(
      <Toast duration={1000} title='Unpaused message' pauseOnHover={false} />
    );
    const root = getToastRoot(container);
    act(() => vi.advanceTimersByTime(400));
    act(() => {
      fireEvent.pointerEnter(root);
      fireEvent.pointerLeave(root);
    });
    act(() => vi.advanceTimersByTime(600));
    expect(container.textContent).not.toContain('Unpaused message');
    unmount();
  });

  it('clears stale interaction state when a controlled toast reopens', () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    const { container, rerender, unmount } = render(
      <Toast
        open
        duration={1000}
        title='Reopened'
        onOpenChange={onOpenChange}
      />
    );
    act(() => vi.advanceTimersByTime(400));
    act(() => fireEvent.pointerEnter(getToastRoot(container)));
    rerender(
      <Toast
        open={false}
        duration={1000}
        title='Reopened'
        onOpenChange={onOpenChange}
      />
    );
    rerender(
      <Toast
        open
        duration={1000}
        title='Reopened'
        onOpenChange={onOpenChange}
      />
    );
    act(() => vi.advanceTimersByTime(999));
    expect(onOpenChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, {
      reason: 'timeout',
    });
    unmount();
  });

  it('requests a controlled timeout only once until the lifecycle resets', () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    const { container, rerender, unmount } = render(
      <Toast
        open
        duration={1000}
        title='Controlled'
        onOpenChange={onOpenChange}
      />
    );
    act(() => vi.advanceTimersByTime(1000));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    rerender(
      <Toast
        open
        duration={1000}
        title='Still open'
        onOpenChange={onOpenChange}
      />
    );
    const root = getToastRoot(container);
    act(() => {
      fireEvent.pointerEnter(root);
      fireEvent.pointerLeave(root);
    });
    act(() => vi.advanceTimersByTime(2000));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('dismisses after resuming an already exhausted remaining budget', () => {
    vi.useFakeTimers();
    const { container, unmount } = render(
      <Toast duration={1000} title='Exhausted budget' />
    );
    const root = getToastRoot(container);
    // Model an interaction handled after the deadline but before the timer task.
    vi.setSystemTime(Date.now() + 1000);
    act(() => {
      fireEvent.pointerEnter(root);
      fireEvent.pointerLeave(root);
    });
    act(() => vi.advanceTimersByTime(0));
    expect(container.textContent).not.toContain('Exhausted budget');
    unmount();
  });

  it('cancels pending timeout work on unmount', () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    const { unmount } = render(
      <Toast duration={1000} title='Unmounted' onOpenChange={onOpenChange} />
    );
    act(() => vi.advanceTimersByTime(400));
    unmount();
    act(() => vi.advanceTimersByTime(1000));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

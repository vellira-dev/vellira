// Baseline contract: render, accessibility, controlled, uncontrolled, compound-api
import { act } from 'react';

import { render } from '@test-utils/render';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createToastStore } from './internal/store';
import { Toast } from './Toast';
import { useToast } from './useToast';

function ToastPublisher() {
  const toast = useToast();
  return (
    <button
      type='button'
      onClick={() => toast.success({ title: 'Published', duration: 0 })}
    >
      Publish
    </button>
  );
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('Toast', () => {
  it('renders a polite neutral announcement without stealing focus', () => {
    const focusTarget = document.createElement('button');
    document.body.append(focusTarget);
    focusTarget.focus();

    const { container, unmount } = render(
      <Toast title='Saved' description='Your changes are available.' />
    );
    const root = container.querySelector('[role="status"]');

    expect(root?.getAttribute('aria-live')).toBe('polite');
    expect(root?.getAttribute('aria-atomic')).toBe('true');
    expect(root?.textContent).toContain('Saved');
    expect(root?.querySelector('[data-toast-icon] svg')).not.toBeNull();
    expect(document.activeElement).toBe(focusTarget);
    unmount();
  });

  it('uses assertive announcement semantics for dangerous feedback', () => {
    const { container, unmount } = render(
      <Toast tone='danger' title='Payment failed' />
    );

    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelector('[aria-live="assertive"]')).not.toBeNull();
    unmount();
  });

  it('supports controlled and uncontrolled open state', () => {
    const onOpenChange = vi.fn();
    const { container, rerender, unmount } = render(
      <Toast open={false} onOpenChange={onOpenChange} title='Controlled' />
    );

    expect(container.textContent).not.toContain('Controlled');
    rerender(<Toast open onOpenChange={onOpenChange} title='Controlled' />);
    expect(container.textContent).toContain('Controlled');

    rerender(<Toast defaultOpen title='Uncontrolled' />);
    expect(container.textContent).toContain('Uncontrolled');
    unmount();
  });

  it('auto-dismisses after the exact configured duration', () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    const { container, unmount } = render(
      <Toast duration={2400} onOpenChange={onOpenChange} title='Uploaded' />
    );

    act(() => vi.advanceTimersByTime(2399));
    expect(container.textContent).toContain('Uploaded');
    act(() => vi.advanceTimersByTime(1));
    expect(container.textContent).not.toContain('Uploaded');
    expect(onOpenChange).toHaveBeenLastCalledWith(false, {
      reason: 'timeout',
    });
    unmount();
  });

  it('supports manual dismissal and optional actions', () => {
    const onDismiss = vi.fn();
    const onAction = vi.fn();
    const { container, rerender, unmount } = render(
      <Toast title='Message' onOpenChange={onDismiss} />
    );

    act(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Dismiss notification"]')
        ?.click()
    );
    expect(onDismiss).toHaveBeenLastCalledWith(false, { reason: 'dismiss' });

    rerender(
      <Toast
        key='action'
        title='Archived'
        action={{ label: 'Undo', onAction }}
        onOpenChange={onDismiss}
      />
    );
    act(() =>
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Undo')
        ?.click()
    );
    expect(onAction).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenLastCalledWith(false, { reason: 'action' });
    unmount();
  });

  it('exposes a thin provider-scoped convenience API', () => {
    const { container, unmount } = render(
      <Toast.Provider>
        <ToastPublisher />
        <Toast.Viewport />
      </Toast.Provider>
    );

    act(() => container.querySelector<HTMLButtonElement>('button')?.click());
    const published = document.body.querySelector('[data-tone="success"]');
    expect(published?.textContent).toContain('Published');
    unmount();
  });
});

describe('Toast store', () => {
  it('keeps FIFO order and applies a bounded oldest-first overflow policy', () => {
    const onFirstDismiss = vi.fn();
    const store = createToastStore({ maxVisible: 2 });

    const first = store.show({ title: 'First', onDismiss: onFirstDismiss });
    const second = store.show({ title: 'Second' });
    const third = store.show({ title: 'Third' });

    expect(store.getSnapshot().map(({ id }) => id)).toEqual([second, third]);
    expect(store.getSnapshot().map(({ title }) => title)).toEqual([
      'Second',
      'Third',
    ]);
    expect(onFirstDismiss).toHaveBeenCalledWith('overflow');
    expect(first).not.toBe(second);
  });

  it('replaces a dedupe key in place and rejects duplicate active IDs', () => {
    const store = createToastStore();
    const first = store.show({ title: 'Uploading', dedupeKey: 'upload' });
    store.show({ title: 'Uploaded', dedupeKey: 'upload', tone: 'success' });

    expect(store.getSnapshot()).toHaveLength(1);
    expect(store.getSnapshot()[0]).toMatchObject({
      id: first,
      title: 'Uploaded',
      tone: 'success',
      revision: 1,
    });
    expect(() => store.show({ id: first, title: 'Duplicate' })).toThrow(
      /already active/
    );
  });
});

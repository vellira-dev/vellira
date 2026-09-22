// Baseline contract: render, accessibility, controlled, uncontrolled, compound-api
import { act } from 'react';

import { AccessibilityInfo, Pressable, Text } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { render } from '../../test-utils/render';

import { createToastStore } from './internal/store';
import { Toast } from './Toast';
import { useToast } from './useToast';

function NativeToastPublisher() {
  const toast = useToast();
  return (
    <Pressable
      accessibilityRole='button'
      onPress={() => toast.info({ title: 'Published', duration: 0 })}
    >
      <Text>Publish</Text>
    </Pressable>
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('Native Toast', () => {
  it('announces feedback with native accessibility semantics', () => {
    const announce = vi.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { container, unmount } = render(
      <Toast title='Saved' description='Available offline' />
    );

    expect(announce).toHaveBeenCalledWith('Saved. Available offline');
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(container.textContent).toContain('ⓘ');
    unmount();
  });

  it('supports controlled and uncontrolled open state', () => {
    const { container, rerender, unmount } = render(
      <Toast open={false} title='Controlled' />
    );

    expect(container.textContent).not.toContain('Controlled');
    rerender(<Toast open title='Controlled' />);
    expect(container.textContent).toContain('Controlled');
    rerender(<Toast defaultOpen title='Uncontrolled' />);
    expect(container.textContent).toContain('Uncontrolled');
    unmount();
  });

  it('auto-dismisses after the configured duration', () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    const { container, unmount } = render(
      <Toast duration={1800} onOpenChange={onOpenChange} title='Uploaded' />
    );

    act(() => vi.advanceTimersByTime(1799));
    expect(container.textContent).toContain('Uploaded');
    act(() => vi.advanceTimersByTime(1));
    expect(container.textContent).not.toContain('Uploaded');
    expect(onOpenChange).toHaveBeenCalledWith(false, { reason: 'timeout' });
    unmount();
  });

  it('supports manual dismissal and actions with usable touch targets', () => {
    const onOpenChange = vi.fn();
    const onAction = vi.fn();
    const { container, rerender, unmount } = render(
      <Toast title='Message' onOpenChange={onOpenChange} />
    );
    const dismiss = container.querySelector<HTMLButtonElement>(
      '[aria-label="Dismiss notification"]'
    );

    expect(dismiss?.style.minWidth).toBe('44px');
    expect(dismiss?.style.minHeight).toBe('44px');
    act(() => dismiss?.click());
    expect(onOpenChange).toHaveBeenLastCalledWith(false, { reason: 'dismiss' });

    rerender(
      <Toast
        key='action'
        title='Archived'
        action={{ label: 'Undo', onAction }}
        onOpenChange={onOpenChange}
      />
    );
    const action = container.querySelector<HTMLButtonElement>(
      '[aria-label="Undo"]'
    );
    expect(action?.style.minWidth).toBe('44px');
    act(() => action?.click());
    expect(onAction).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, { reason: 'action' });
    unmount();
  });

  it('exposes a thin provider-scoped convenience API', () => {
    const { container, unmount } = render(
      <Toast.Provider>
        <NativeToastPublisher />
        <Toast.Viewport />
      </Toast.Provider>
    );

    act(() => container.querySelector<HTMLButtonElement>('button')?.click());
    expect(container.textContent).toContain('Published');
    unmount();
  });
});

describe('Native Toast store', () => {
  it('preserves order, bounds the stack, and deterministically deduplicates', () => {
    const overflow = vi.fn();
    const store = createToastStore({ maxVisible: 2 });
    store.show({ title: 'First', onDismiss: overflow });
    const second = store.show({ title: 'Second', dedupeKey: 'sync' });
    store.show({ title: 'Third' });

    expect(store.getSnapshot().map(({ title }) => title)).toEqual([
      'Second',
      'Third',
    ]);
    expect(overflow).toHaveBeenCalledWith('overflow');

    const replacement = store.show({
      title: 'Synced',
      dedupeKey: 'sync',
      tone: 'success',
    });
    expect(replacement).toBe(second);
    expect(store.getSnapshot()[0]).toMatchObject({
      title: 'Synced',
      tone: 'success',
      revision: 1,
    });
  });
});

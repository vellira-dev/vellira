import { act } from 'react';

import { Pressable, Text } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { render } from '../../test-utils/render';

import { Tabs } from '.';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Native Tabs asChild interop', () => {
  it('composes navigation behavior onto an intrinsic DOM child without leaking RN props or styles', () => {
    const childClick = vi.fn();
    const onValueChange = vi.fn();

    const { container, unmount } = render(
      <Tabs
        mode='navigation'
        defaultValue='overview'
        onValueChange={onValueChange}
      >
        <Tabs.List>
          <Tabs.Trigger value='overview' asChild>
            <button type='button' data-testid='overview-link'>
              Overview
            </button>
          </Tabs.Trigger>

          <Tabs.Trigger value='settings' asChild>
            <button
              type='button'
              data-testid='settings-link'
              style={{ opacity: 0.6 }}
              onClick={childClick}
            >
              Settings
            </button>
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs>
    );

    const overview = container.querySelector<HTMLButtonElement>(
      '[data-testid="overview-link"]'
    );
    const settings = container.querySelector<HTMLButtonElement>(
      '[data-testid="settings-link"]'
    );

    expect(overview?.dataset.state).toBe('active');
    expect(overview?.getAttribute('aria-current')).toBe('page');
    expect(settings?.dataset.state).toBe('inactive');
    expect(settings?.style.opacity).toBe('0.6');
    expect(settings?.getAttribute('accessibilityrole')).toBeNull();
    expect(settings?.getAttribute('accessibilitystate')).toBeNull();

    act(() => {
      settings?.click();
    });

    expect(childClick).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('settings');
    expect(settings?.dataset.state).toBe('active');
    expect(settings?.getAttribute('aria-current')).toBe('page');
    expect(overview?.dataset.state).toBe('inactive');
    expect(overview?.getAttribute('aria-current')).toBeNull();

    unmount();
  });

  it('preserves RN Pressable style composition and navigation behavior', () => {
    const onValueChange = vi.fn();

    const { container, unmount } = render(
      <Tabs
        mode='navigation'
        defaultValue='overview'
        onValueChange={onValueChange}
      >
        <Tabs.List>
          <Tabs.Trigger value='overview' asChild>
            <Pressable testID='overview-link'>
              <Text>Overview</Text>
            </Pressable>
          </Tabs.Trigger>

          <Tabs.Trigger value='settings' style={{ minHeight: 48 }} asChild>
            <Pressable testID='settings-link' style={{ opacity: 0.6 }}>
              <Text>Settings</Text>
            </Pressable>
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs>
    );

    const settings = container.querySelector<HTMLButtonElement>(
      '[data-testid="settings-link"]'
    );

    expect(settings?.style.minHeight).toBe('48px');
    expect(settings?.style.opacity).toBe('0.6');

    act(() => {
      settings?.click();
    });

    expect(onValueChange).toHaveBeenCalledWith('settings');

    unmount();
  });
});

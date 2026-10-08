// Baseline contract: render, accessibility
import { act } from 'react';

import { render } from '@test-utils/render';
import { afterEach, describe, expect, it } from 'vitest';

import { Avatar } from './Avatar';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Avatar', () => {
  it('renders a named image with its fallback', () => {
    const { container, unmount } = render(
      <Avatar fallback='JD' name='Jordan Diaz' />
    );
    const avatar = container.querySelector('[role="img"]');

    expect(avatar?.getAttribute('aria-label')).toBe('Jordan Diaz');
    expect(avatar?.textContent).toContain('JD');

    unmount();
  });

  it('replaces the fallback when the image loads and restores it after an error', () => {
    const { container, unmount } = render(
      <Avatar fallback='JD' name='Jordan Diaz' source='profile-a' />
    );
    const image = container.querySelector<HTMLImageElement>('img');

    if (!image) throw new Error('Missing avatar image.');
    expect(container.textContent).toContain('JD');

    act(() => image.dispatchEvent(new Event('load')));
    expect(container.textContent).not.toContain('JD');

    act(() => image.dispatchEvent(new Event('error')));
    expect(container.textContent).toContain('JD');

    unmount();
  });

  it('resets image lifecycle and applies deterministic size geometry', () => {
    const result = render(
      <Avatar fallback='JD' name='Jordan Diaz' source='profile-a' size='sm' />
    );
    const firstImage = result.container.querySelector<HTMLImageElement>('img');

    if (!firstImage) throw new Error('Missing first avatar image.');
    act(() => firstImage.dispatchEvent(new Event('load')));

    result.rerender(
      <Avatar fallback='JD' name='Jordan Diaz' source='profile-b' size='lg' />
    );

    const avatar = result.container.querySelector<HTMLElement>('[role="img"]');

    expect(result.container.textContent).toContain('JD');
    expect(avatar?.className).toContain('lg');

    result.unmount();
  });
});

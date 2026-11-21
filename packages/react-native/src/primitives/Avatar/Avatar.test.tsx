// Baseline contract: render, accessibility
import { act } from 'react';

import { afterEach, describe, expect, it } from 'vitest';

import { captureNativeImageRequest } from '../../../test/native-image.mock';
import { render } from '../../test-utils/render';

import { Avatar } from './Avatar';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Native Avatar', () => {
  it('renders a named image with a deterministic fallback', () => {
    const { container, unmount } = render(
      <Avatar fallback='JD' name='Jordan Diaz' />
    );

    const avatar = container.querySelector('[role="img"]');

    expect(avatar?.getAttribute('aria-label')).toBe('Jordan Diaz');
    expect(avatar?.textContent).toContain('JD');

    unmount();
  });

  it('hides the fallback after the current source loads', () => {
    const { container, unmount } = render(
      <Avatar fallback='JD' name='Jordan Diaz' source='profile-a' />
    );
    const image = container.querySelector<HTMLImageElement>('img');

    expect(container.textContent).toContain('JD');
    expect(image?.getAttribute('aria-hidden')).toBe('true');

    if (!image) throw new Error('Missing avatar image.');
    act(() => captureNativeImageRequest(image).load({ width: 32, height: 32 }));

    expect(container.textContent).not.toContain('JD');

    unmount();
  });

  it('resets the fallback and geometry when the source or size changes', () => {
    const result = render(
      <Avatar fallback='JD' name='Jordan Diaz' source='profile-a' size='sm' />
    );
    const firstImage = result.container.querySelector<HTMLImageElement>('img');

    if (!firstImage) throw new Error('Missing first avatar image.');
    act(() =>
      captureNativeImageRequest(firstImage).load({ width: 24, height: 24 })
    );

    result.rerender(
      <Avatar fallback='JD' name='Jordan Diaz' source='profile-b' size='lg' />
    );

    const avatar = result.container.querySelector<HTMLElement>('[role="img"]');

    expect(result.container.textContent).toContain('JD');
    expect(avatar?.style.width).toBe('40px');
    expect(avatar?.style.height).toBe('40px');

    result.unmount();
  });
});

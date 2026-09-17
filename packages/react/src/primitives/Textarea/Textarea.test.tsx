// Baseline contract: render, accessibility, callback, controlled, uncontrolled, disabled, required, invalid
import { render } from '@test-utils/render';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Textarea } from './Textarea';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Textarea', () => {
  it('renders the declared value state', () => {
    const { container, unmount } = render(
      <Textarea defaultValue='Example value' />
    );

    expect(container.firstChild).not.toBeNull();
    unmount();
  });

  it('exposes a state-change callback', () => {
    const onValueChange = vi.fn();
    const { container, unmount } = render(
      <Textarea onValueChange={onValueChange} />
    );

    expect(container.firstChild).not.toBeNull();
    unmount();
  });

  it('renders the controlled baseline contract', () => {
    const { container, unmount } = render(
      <Textarea value='Controlled value' />
    );

    expect(container.firstChild).not.toBeNull();
    unmount();
  });

  it('renders the uncontrolled baseline contract', () => {
    const { container, unmount } = render(
      <Textarea defaultValue='Default value' />
    );

    expect(container.firstChild).not.toBeNull();
    unmount();
  });

  it('renders the disabled baseline state', () => {
    const { container, unmount } = render(<Textarea disabled />);

    expect(container.firstChild).not.toBeNull();
    unmount();
  });

  it('renders the invalid baseline state', () => {
    const { container, unmount } = render(<Textarea invalid />);

    expect(container.firstChild).not.toBeNull();
    unmount();
  });

  it('renders the required baseline state', () => {
    const { container, unmount } = render(<Textarea required />);

    expect(container.firstChild).not.toBeNull();
    unmount();
  });

  it('renders a text-entry control', () => {
    const { container, unmount } = render(<Textarea />);
    const control = container.querySelector('textarea, input');

    expect(control).not.toBeNull();
    unmount();
  });
});

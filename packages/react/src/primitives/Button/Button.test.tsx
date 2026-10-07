import { act, createRef, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../../test-utils/a11y';

import { Button } from './Button';
import type { ButtonProps } from './types';

import styles from './Button.module.scss';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Button', () => {
  const renderButton = (props: ButtonProps = {}) => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() => root.render(<Button {...props}>{props.children}</Button>));

    return {
      button: container.querySelector('button'),
      container,
      root,
    };
  };

  it('calls onClick when enabled', async () => {
    const onClick = vi.fn();
    const { button, container, root } = renderButton({
      children: 'Save',
      onClick,
    });

    await expectNoA11yViolations(container);

    act(() => button?.click());

    expect(onClick).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it('uses the standard aria-label attribute', () => {
    const { button, root } = renderButton({
      'aria-label': 'Search',
      iconStart: 'icon',
    });

    expect(button?.getAttribute('aria-label')).toBe('Search');
    act(() => root.unmount());
  });

  it('defaults to type button', () => {
    const { button, root } = renderButton({ children: 'Save' });

    expect(button?.getAttribute('type')).toBe('button');
    act(() => root.unmount());
  });

  it('forwards refs to the button element', () => {
    const ref = createRef<HTMLButtonElement>();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() => root.render(<Button ref={ref}>Save</Button>));

    expect(ref.current).toBe(container.querySelector('button'));
    act(() => root.unmount());
  });

  it('passes custom className and fullWidth class', () => {
    const { button, root } = renderButton({
      children: 'Save',
      className: 'custom-button',
      fullWidth: true,
    });

    expect(button?.className).toContain('custom-button');
    expect(button?.className).toContain('fullWidth');
    act(() => root.unmount());
  });

  it('applies color, appearance, size, and shape classes from the public API', () => {
    const colors = [
      'primary',
      'neutral',
      'success',
      'warning',
      'danger',
    ] as const;
    const appearances = ['solid', 'outline', 'ghost', 'soft', 'link'] as const;
    const sizes = ['sm', 'md', 'lg'] as const;
    const shapes = ['square', 'rounded', 'pill'] as const;

    for (const color of colors) {
      for (const appearance of appearances) {
        for (const size of sizes) {
          for (const shape of shapes) {
            const { button, root } = renderButton({
              children: `${color} ${appearance} ${size} ${shape}`,
              appearance,
              color,
              shape,
              size,
            });

            expect(button?.classList.contains(styles[color])).toBe(true);
            expect(button?.classList.contains(styles[appearance])).toBe(true);
            expect(button?.classList.contains(styles[size])).toBe(true);
            expect(button?.classList.contains(styles[shape])).toBe(true);

            act(() => root.unmount());
          }
        }
      }
    }
  });

  it('distinguishes leading and trailing icon slots for interaction motion', () => {
    const { container, root } = renderButton({
      children: 'Navigate',
      iconStart: <svg data-testid='leading-icon' />,
      iconEnd: <svg data-testid='trailing-icon' />,
    });

    expect(
      container.querySelector('[data-testid="leading-icon"]')?.parentElement
        ?.className
    ).toContain(styles.iconStart);
    expect(
      container.querySelector('[data-testid="trailing-icon"]')?.parentElement
        ?.className
    ).toContain(styles.iconEnd);

    act(() => root.unmount());
  });

  it('renders left and right icons', () => {
    const { container, root } = renderButton({
      children: 'Save',
      iconStart: <svg data-testid='left-icon' />,
      iconEnd: <svg data-testid='right-icon' />,
    });

    expect(container.querySelector('[data-testid="left-icon"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="right-icon"]')).toBeTruthy();
    act(() => root.unmount());
  });

  it('hides the label for icon-only buttons with an accessible label', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { button, container, root } = renderButton({
      'aria-label': 'Search',
      iconOnly: true,
      iconStart: <svg data-testid='search-icon' />,
      children: 'Search',
    });

    await expectNoA11yViolations(container);

    expect(button?.getAttribute('aria-label')).toBe('Search');
    expect(button?.className).toContain('iconOnly');
    expect(button?.textContent).toBe('');
    expect(warn).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('warns for icon-only buttons without an accessible label', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { root } = renderButton({
      iconOnly: true,
      iconStart: <svg data-testid='search-icon' />,
    });

    expect(warn).toHaveBeenCalledWith(
      'Button: icon-only buttons must provide aria-label or aria-labelledby.'
    );
    act(() => root.unmount());
  });

  it('accepts aria-labelledby for icon-only buttons', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { button, root } = renderButton({
      'aria-labelledby': 'search-label',
      iconOnly: true,
      iconStart: <svg data-testid='search-icon' />,
    });

    expect(button?.getAttribute('aria-labelledby')).toBe('search-label');
    expect(warn).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('supports aria-labelledby from an external label node', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() =>
      root.render(
        <>
          <span id='refresh-label'>Refresh data</span>
          <Button
            aria-labelledby='refresh-label'
            iconOnly
            iconStart={<svg data-testid='refresh-icon' />}
          />
        </>
      )
    );

    const button = container.querySelector('button');

    await expectNoA11yViolations(container);

    expect(button?.getAttribute('aria-labelledby')).toBe('refresh-label');
    expect(warn).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('renders loading state and loadingText', () => {
    const { button, root } = renderButton({
      children: 'Save',
      loading: true,
      loadingText: 'Saving...',
    });

    expect(button?.disabled).toBe(true);
    expect(button?.getAttribute('aria-busy')).toBe('true');
    expect(button?.textContent).toBe('Saving...');
    act(() => root.unmount());
  });

  it('reserves label width when loadingText is provided', () => {
    const { button, root } = renderButton({
      children: 'Publish',
      loadingText: 'Publishing...',
    });

    const label = button?.querySelector(`.${styles.label}`);

    expect(label?.getAttribute('data-measure')).toBe('Publishing...');
    expect(button?.textContent).toBe('Publish');

    act(() =>
      root.render(
        <Button loading loadingText='Publishing...'>
          Publish
        </Button>
      )
    );

    const loadingLabel = button?.querySelector(`.${styles.label}`);

    expect(loadingLabel?.getAttribute('data-measure')).toBe('Publish');
    expect(button?.textContent).toBe('Publishing...');
    act(() => root.unmount());
  });

  it('renders href buttons as anchors with safe external rel', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() =>
      root.render(
        <Button href='https://example.com' target='_blank'>
          Docs
        </Button>
      )
    );

    const anchor = container.querySelector('a');

    expect(anchor?.getAttribute('href')).toBe('https://example.com');
    expect(anchor?.getAttribute('rel')).toBe('noreferrer noopener');
    act(() => root.unmount());
  });

  it('preserves user-provided rel for target blank href buttons', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() =>
      root.render(
        <Button
          href='https://example.com'
          rel='external sponsored'
          target='_blank'
        >
          Partner docs
        </Button>
      )
    );

    const anchor = container.querySelector('a');

    expect(anchor?.getAttribute('rel')).toBe('external sponsored');
    act(() => root.unmount());
  });

  it('prevents disabled href buttons from navigating or firing clicks', () => {
    const onClick = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() =>
      root.render(
        <Button disabled href='/billing' onClick={onClick}>
          Billing
        </Button>
      )
    );

    const anchor = container.querySelector('a');
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    act(() => anchor?.dispatchEvent(event));

    expect(anchor?.getAttribute('href')).toBeNull();
    expect(anchor?.getAttribute('aria-disabled')).toBe('true');
    expect(anchor?.getAttribute('tabindex')).toBe('-1');
    expect(event.defaultPrevented).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('prevents loading href buttons from navigating or firing clicks', () => {
    const onClick = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() =>
      root.render(
        <Button href='/save' loading onClick={onClick}>
          Save
        </Button>
      )
    );

    const anchor = container.querySelector('a');
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    act(() => anchor?.dispatchEvent(event));

    expect(anchor?.getAttribute('href')).toBeNull();
    expect(anchor?.getAttribute('aria-busy')).toBe('true');
    expect(event.defaultPrevented).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('composes asChild className, child click, and Button click', () => {
    const childClick = vi.fn();
    const buttonClick = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() =>
      root.render(
        <Button asChild className='action' onClick={buttonClick}>
          <a className='link' href='#docs' onClick={childClick}>
            Docs
          </a>
        </Button>
      )
    );

    const anchor = container.querySelector('a');

    act(() => anchor?.click());

    expect(anchor?.className).toContain('link');
    expect(anchor?.className).toContain('action');
    expect(anchor?.getAttribute('href')).toBe('#docs');
    expect(childClick).toHaveBeenCalledOnce();
    expect(buttonClick).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it('preserves multiple child and Button classes when using asChild', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() =>
      root.render(
        <Button asChild className='action elevated'>
          <a className='link muted' href='#docs'>
            Docs
          </a>
        </Button>
      )
    );

    const anchor = container.querySelector('a');

    expect(anchor?.classList.contains('link')).toBe(true);
    expect(anchor?.classList.contains('muted')).toBe(true);
    expect(anchor?.classList.contains('action')).toBe(true);
    expect(anchor?.classList.contains('elevated')).toBe(true);
    act(() => root.unmount());
  });

  it('does not run Button onClick when an asChild handler prevents default', () => {
    const childClick = vi.fn((event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
    });
    const buttonClick = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() =>
      root.render(
        <Button asChild onClick={buttonClick}>
          <a href='#docs' onClick={childClick}>
            Docs
          </a>
        </Button>
      )
    );

    act(() => container.querySelector('a')?.click());

    expect(childClick).toHaveBeenCalledOnce();
    expect(buttonClick).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('does not run asChild click handlers while disabled', () => {
    const childClick = vi.fn();
    const buttonClick = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() =>
      root.render(
        <Button asChild disabled onClick={buttonClick}>
          <a href='/delete' onClick={childClick}>
            Delete
          </a>
        </Button>
      )
    );

    const anchor = container.querySelector('a');
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    act(() => anchor?.dispatchEvent(event));

    expect(anchor?.getAttribute('href')).toBeNull();
    expect(anchor?.getAttribute('aria-disabled')).toBe('true');
    expect(anchor?.getAttribute('tabindex')).toBe('-1');
    expect(event.defaultPrevented).toBe(true);
    expect(childClick).not.toHaveBeenCalled();
    expect(buttonClick).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('overrides child tabIndex while disabled and restores it while enabled', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() =>
      root.render(
        <Button asChild disabled>
          <a href='#docs' tabIndex={2}>
            Docs
          </a>
        </Button>
      )
    );

    let anchor = container.querySelector('a');

    expect(anchor?.getAttribute('tabindex')).toBe('-1');

    act(() =>
      root.render(
        <Button asChild>
          <a href='#docs' tabIndex={2}>
            Docs
          </a>
        </Button>
      )
    );

    anchor = container.querySelector('a');

    expect(anchor?.getAttribute('tabindex')).toBe('2');
    act(() => root.unmount());
  });

  it('accepts accessible names from the asChild element for icon-only buttons', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() =>
      root.render(
        <Button asChild iconOnly iconStart={<svg data-testid='search-icon' />}>
          <a aria-label='Search' href='/search'>
            Search
          </a>
        </Button>
      )
    );

    const anchor = container.querySelector('a');

    expect(anchor?.getAttribute('aria-label')).toBe('Search');
    expect(anchor?.textContent).toBe('');
    expect(warn).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('warns when href is passed to Button while using asChild', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() =>
      root.render(
        <Button asChild href='/docs'>
          <a href='/docs'>Docs</a>
        </Button>
      )
    );

    expect(warn).toHaveBeenCalledWith(
      'Button: pass href to the child element when using asChild.'
    );
    act(() => root.unmount());
  });

  it('warns when asChild does not receive a valid element child', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { root } = renderButton({
      asChild: true,
      children: 'Text child',
    });

    expect(warn).toHaveBeenCalledWith(
      'Button: asChild requires a single valid React element child.'
    );
    act(() => root.unmount());
  });

  it('does not emit development warnings in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { root } = renderButton({
      iconOnly: true,
      iconStart: <svg data-testid='search-icon' />,
    });

    expect(warn).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('renders badge and shortcut affordances', () => {
    const { button, root } = renderButton({
      badge: '3',
      children: 'Command',
      shortcut: '⌘K',
    });

    expect(button?.textContent).toBe('Command3⌘K');
    act(() => root.unmount());
  });

  it('does not call onClick while loading', () => {
    const onClick = vi.fn();
    const { button, root } = renderButton({
      children: 'Save',
      loading: true,
      onClick,
    });

    act(() => button?.click());

    expect(onClick).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});

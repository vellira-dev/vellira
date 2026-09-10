import { describe, expect, it } from 'vitest';

import { render } from '../../test-utils/render';

import { Input } from './Input';

import styles from './Input.module.scss';

describe('Input bare variant', () => {
  it('keeps canonical search and clear behavior inside borderless chrome', () => {
    const { container, unmount } = render(
      <Input
        aria-label='Search articles'
        type='search'
        value='tokens'
        variant='bare'
        clearable
      />
    );

    const input = container.querySelector<HTMLInputElement>('input');
    const group = input?.closest(`.${styles.inputGroup}`);
    const clear = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Clear input"]'
    );

    expect(group?.classList.contains(styles.bare)).toBe(true);
    expect(input?.type).toBe('search');
    expect(input?.value).toBe('tokens');
    expect(
      container.querySelector(`.${styles.startAdornment} svg`)
    ).not.toBeNull();
    expect(clear).not.toBeNull();

    unmount();
  });
});

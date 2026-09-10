import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { describe, expect, it } from 'vitest';

import { Button } from './Button';

import styles from './Button.module.scss';

describe('Button bare appearance', () => {
  it('keeps Button behavior while leaving visual chrome to the consumer', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() =>
      root.render(
        <Button
          appearance='bare'
          color='neutral'
          size='sm'
          shape='rounded'
          className='consumer-action'
          badge={<span data-testid='count'>3</span>}
        >
          Filters
        </Button>
      )
    );

    const button = container.querySelector('button');

    expect(button?.classList.contains(styles.bare)).toBe(true);
    expect(button?.classList.contains(styles.button)).toBe(false);
    expect(button?.classList.contains(styles.neutral)).toBe(false);
    expect(button?.classList.contains(styles.sm)).toBe(false);
    expect(button?.classList.contains(styles.rounded)).toBe(false);
    expect(button?.classList.contains('consumer-action')).toBe(true);
    expect(button?.querySelector(`.${styles.label}`)).toBeNull();
    expect(button?.querySelector(`.${styles.badge}`)).toBeNull();
    expect(button?.textContent).toBe('Filters3');

    act(() => root.unmount());
    container.remove();
  });
});

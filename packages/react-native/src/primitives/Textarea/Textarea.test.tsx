// Baseline contract: render, accessibility, callback, controlled, uncontrolled, disabled, required, invalid
import { act } from 'react';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { FormField } from '../../patterns/FormField';
import { render } from '../../test-utils/render';

import { Textarea } from './Textarea';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Native Textarea', () => {
  it('renders a labelled multiline TextInput with help and error semantics', () => {
    const { container, unmount } = render(
      <Textarea
        label='Biography'
        description='Tell us about yourself.'
        error='Biography is required.'
        defaultValue='Vellira builder'
        placeholder='Write a short biography'
        numberOfLines={4}
        maxLength={120}
      />
    );

    const textarea = container.querySelector<HTMLTextAreaElement>('textarea');

    expect(textarea?.value).toBe('Vellira builder');
    expect(textarea?.placeholder).toBe('Write a short biography');
    expect(textarea?.rows).toBe(4);
    expect(textarea?.maxLength).toBe(120);
    expect(textarea?.getAttribute('aria-label')).toBe('Biography');
    expect(container.textContent).toContain('Tell us about yourself.');
    expect(container.textContent).toContain('Biography is required.');

    unmount();
  });

  it('emits uncontrolled multiline value changes', () => {
    const onValueChange = vi.fn();
    const { container, unmount } = render(
      <Textarea
        accessibilityLabel='Message'
        defaultValue='First line'
        onValueChange={onValueChange}
      />
    );
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea');
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value'
    )?.set;

    act(() => {
      valueSetter?.call(textarea, 'First line\nSecond line');
      textarea?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(onValueChange).toHaveBeenCalledWith('First line\nSecond line');
    expect(textarea?.value).toBe('First line\nSecond line');

    unmount();
  });

  it('uses label as accessible-name fallback and allows native override', () => {
    const { container, rerender, unmount } = render(
      <Textarea label='Notes' value='' />
    );

    expect(
      container.querySelector('textarea')?.getAttribute('aria-label')
    ).toBe('Notes');

    rerender(
      <Textarea label='Notes' accessibilityLabel='Private notes' value='' />
    );

    expect(
      container.querySelector('textarea')?.getAttribute('aria-label')
    ).toBe('Private notes');

    unmount();
  });

  it('inherits FormField state without rendering a nested field wrapper', () => {
    const { container, unmount } = render(
      <FormField
        label='Notes'
        description='Internal notes.'
        required
        disabled
        invalid
        size='sm'
      >
        <Textarea accessibilityLabel='Notes' value='' />
      </FormField>
    );

    const textarea = container.querySelector<HTMLTextAreaElement>('textarea');

    expect(textarea?.disabled).toBe(true);
    expect(textarea?.getAttribute('aria-disabled')).toBe('true');
    expect(container.querySelectorAll('textarea')).toHaveLength(1);
    expect(container.textContent).toContain('Internal notes.');

    unmount();
  });

  it('preserves controlled value and clamps numberOfLines to a multiline control', () => {
    const { container, unmount } = render(
      <Textarea
        accessibilityLabel='Controlled message'
        value={'Controlled\nvalue'}
        numberOfLines={0}
      />
    );

    const textarea = container.querySelector<HTMLTextAreaElement>('textarea');

    expect(textarea?.value).toBe('Controlled\nvalue');
    expect(textarea?.rows).toBe(1);

    unmount();
  });
});

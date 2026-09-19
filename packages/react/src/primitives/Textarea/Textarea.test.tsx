// Baseline contract: render, accessibility, callback, controlled, uncontrolled, disabled, required, invalid
import { act } from 'react';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../../test-utils/a11y';
import { render } from '../../test-utils/render';

import { Textarea } from './Textarea';

import { FormField } from '#patterns/FormField';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Textarea', () => {
  it('renders a labelled multiline field with linked help and error text', async () => {
    const { container, unmount } = render(
      <Textarea
        id='bio'
        label='Biography'
        description='Tell us about yourself.'
        error='Biography is required.'
        defaultValue='Vellira builder'
      />
    );

    await expectNoA11yViolations(container);

    const textarea = container.querySelector<HTMLTextAreaElement>('textarea');
    const label = container.querySelector('label');

    expect(textarea?.value).toBe('Vellira builder');
    expect(textarea?.rows).toBe(3);
    expect(label?.getAttribute('for')).toBe('bio');
    expect(textarea?.getAttribute('aria-invalid')).toBe('true');
    expect(textarea?.getAttribute('aria-describedby')).toBe(
      'bio-description bio-error'
    );
    expect(document.getElementById('bio-description')?.textContent).toBe(
      'Tell us about yourself.'
    );
    expect(document.getElementById('bio-error')?.textContent).toBe(
      'Biography is required.'
    );

    unmount();
  });

  it('passes native textarea semantics through and emits string changes', () => {
    const onValueChange = vi.fn();
    const onChange = vi.fn();
    const { container, unmount } = render(
      <Textarea
        aria-label='Message'
        value=''
        rows={5}
        maxLength={120}
        name='message'
        onChange={onChange}
        onValueChange={onValueChange}
      />
    );
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea');
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value'
    )?.set;

    expect(textarea?.getAttribute('aria-label')).toBe('Message');
    expect(textarea?.rows).toBe(5);
    expect(textarea?.maxLength).toBe(120);
    expect(textarea?.name).toBe('message');

    act(() => {
      valueSetter?.call(textarea, 'Multiline\nmessage');
      textarea?.dispatchEvent(new InputEvent('input', { bubbles: true }));
      textarea?.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('Multiline\nmessage');
    expect(onChange).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('inherits FormField state and accessible relationships', () => {
    const { container, unmount } = render(
      <FormField
        id='notes'
        label='Notes'
        description='Internal notes.'
        required
        invalid
        disabled
      >
        <Textarea />
      </FormField>
    );
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea');

    expect(textarea?.id).toBe('notes');
    expect(textarea?.required).toBe(true);
    expect(textarea?.disabled).toBe(true);
    expect(textarea?.getAttribute('aria-invalid')).toBe('true');
    expect(textarea?.getAttribute('aria-labelledby')).toBe('notes-label');
    expect(textarea?.getAttribute('aria-describedby')).toBe(
      'notes-description'
    );

    unmount();
  });

  it('preserves controlled and uncontrolled native value contracts', () => {
    const { container: controlledContainer, unmount: unmountControlled } =
      render(<Textarea aria-label='Controlled' value='Controlled value' />);
    expect(
      controlledContainer.querySelector<HTMLTextAreaElement>('textarea')?.value
    ).toBe('Controlled value');
    unmountControlled();

    const { container: uncontrolledContainer, unmount: unmountUncontrolled } =
      render(
        <Textarea aria-label='Uncontrolled' defaultValue='Default value' />
      );
    expect(
      uncontrolledContainer.querySelector<HTMLTextAreaElement>('textarea')
        ?.value
    ).toBe('Default value');
    unmountUncontrolled();
  });
});

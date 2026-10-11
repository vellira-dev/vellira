import { act, useState } from 'react';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../../test-utils/a11y';
import { render } from '../../test-utils/render';

import { Input } from './Input';

import { FormField } from '#patterns/FormField';

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('Input', () => {
  it('renders input props and connects error text', async () => {
    const { container, unmount } = render(
      <Input
        id='email'
        label='Email'
        description='Use your work email.'
        value='hello@vellira.dev'
        placeholder='name@company.com'
        error='Email is required'
        type='email'
      />
    );

    await expectNoA11yViolations(container);

    const input = container.querySelector<HTMLInputElement>('input');

    expect(input?.value).toBe('hello@vellira.dev');
    expect(input?.type).toBe('email');
    expect(input?.placeholder).toBe('name@company.com');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(input?.getAttribute('aria-describedby')).toBe(
      'email-description email-error'
    );
    expect(document.getElementById('email-description')?.textContent).toBe(
      'Use your work email.'
    );
    expect(document.getElementById('email-error')?.textContent).toBe(
      'Email is required'
    );

    unmount();
  });

  it('handles changes, disabled state, and object refs', () => {
    const enabledChange = vi.fn();
    const { container: enabledContainer, unmount: unmountEnabled } = render(
      <Input
        id='nickname'
        label='Nickname'
        value=''
        onValueChange={enabledChange}
      />
    );
    const enabledInput =
      enabledContainer.querySelector<HTMLInputElement>('input');
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;

    act(() => {
      valueSetter?.call(enabledInput, 'Roman');
      enabledInput?.dispatchEvent(new InputEvent('input', { bubbles: true }));
      enabledInput?.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(enabledChange).toHaveBeenCalledTimes(1);
    expect(enabledChange).toHaveBeenCalledWith('Roman');

    unmountEnabled();

    const disabledChange = vi.fn();
    const inputRef = { current: null as HTMLInputElement | null };
    const { container, unmount } = render(
      <Input
        ref={inputRef}
        id='name'
        label='Name'
        value=''
        onValueChange={disabledChange}
        required
        disabled
        autoComplete='name'
      />
    );

    const input = container.querySelector<HTMLInputElement>('input');

    expect(inputRef.current).toBe(input);
    expect(input?.required).toBe(true);
    expect(input?.disabled).toBe(true);
    expect(input?.getAttribute('autocomplete')).toBe('name');

    act(() => {
      input?.dispatchEvent(
        new Event('change', {
          bubbles: true,
        })
      );
    });

    expect(disabledChange).not.toHaveBeenCalled();

    unmount();
  });

  it('passes standard input props and DOM event handlers through', () => {
    const focus = vi.fn();
    const blur = vi.fn();
    const keyDown = vi.fn();
    const mouseEnter = vi.fn();
    const mouseLeave = vi.fn();

    const { container, unmount } = render(
      <Input
        id='amount'
        label='Amount'
        value='10'
        aria-label='Transfer amount'
        aria-describedby='amount-hint'
        data-testid='amount-input'
        inputMode='decimal'
        pattern='[0-9]*'
        min={1}
        max={100}
        step={0.5}
        onFocus={focus}
        onBlur={blur}
        onKeyDown={keyDown}
        onMouseEnter={mouseEnter}
        onMouseLeave={mouseLeave}
      />
    );

    const input = container.querySelector<HTMLInputElement>('input');

    expect(input?.getAttribute('aria-label')).toBe('Transfer amount');
    expect(input?.getAttribute('aria-describedby')).toBe('amount-hint');
    expect(input?.getAttribute('data-testid')).toBe('amount-input');
    expect(input?.getAttribute('inputmode')).toBe('decimal');
    expect(input?.getAttribute('pattern')).toBe('[0-9]*');
    expect(input?.getAttribute('min')).toBe('1');
    expect(input?.getAttribute('max')).toBe('100');
    expect(input?.getAttribute('step')).toBe('0.5');

    act(() => {
      input?.focus();
      input?.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })
      );
      input?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      input?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
      input?.blur();
    });

    expect(focus).toHaveBeenCalledTimes(1);
    expect(keyDown).toHaveBeenCalledTimes(1);
    expect(mouseEnter).toHaveBeenCalledTimes(1);
    expect(mouseLeave).toHaveBeenCalledTimes(1);
    expect(blur).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('does not render aria-invalid when the input is valid', () => {
    const { container } = render(<Input id='email' label='Email' value='' />);

    const input = container.querySelector('input');

    expect(input?.hasAttribute('aria-invalid')).toBe(false);
  });

  it('passes aria-invalid through when no error is present', () => {
    const { container } = render(
      <Input id='email' label='Email' value='' aria-invalid={false} />
    );

    const input = container.querySelector('input');

    expect(input?.getAttribute('aria-invalid')).toBe('false');
  });

  it('passes aria-invalid=true through when no error is present', () => {
    const { container } = render(
      <Input id='email' label='Email' value='' aria-invalid />
    );

    const input = container.querySelector('input');

    expect(input?.getAttribute('aria-invalid')).toBe('true');
  });

  it('connects generated description text without an error', () => {
    const { container, unmount } = render(
      <Input id='email' label='Email' value='' description='Optional hint.' />
    );

    const input = container.querySelector<HTMLInputElement>('input');

    expect(input?.getAttribute('aria-describedby')).toBe('email-description');
    expect(document.getElementById('email-description')?.textContent).toBe(
      'Optional hint.'
    );

    unmount();
  });

  it('merges external aria-describedby with generated description and error text', () => {
    const { container, unmount } = render(
      <Input
        id='email'
        label='Email'
        value=''
        description='Use your work email.'
        aria-describedby='email-hint'
        error='Email is required'
      />
    );

    const input = container.querySelector<HTMLInputElement>('input');

    expect(input?.getAttribute('aria-describedby')).toBe(
      'email-hint email-description email-error'
    );

    unmount();
  });

  it('supports uncontrolled changes, function refs, and adornments', () => {
    const change = vi.fn();
    const ref = vi.fn();
    const { container, unmount } = render(
      <Input
        ref={ref}
        id='search'
        label='Search'
        defaultValue='theme'
        onValueChange={change}
        startIcon={<span data-testid='left-icon'>L</span>}
        endIcon={<span data-testid='right-icon'>R</span>}
        startIconTone='primary'
        endIconTone='success'
      />
    );

    const input = container.querySelector<HTMLInputElement>('input');
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;

    expect(ref).toHaveBeenCalledWith(input);
    expect(input?.value).toBe('theme');
    expect(container.querySelector('[data-testid="left-icon"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="right-icon"]')
    ).not.toBeNull();

    act(() => {
      valueSetter?.call(input, 'tokens');
      input?.dispatchEvent(new InputEvent('input', { bubbles: true }));
      input?.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(change).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledWith('tokens');
    expect(input?.value).toBe('tokens');

    unmount();
  });

  it('clears controlled values through onClear without emitting change', () => {
    const clear = vi.fn();
    const change = vi.fn();

    const ControlledInput = () => {
      const [value, setValue] = useState('Clear me');

      return (
        <Input
          id='controlled-clearable'
          label='Controlled clearable'
          value={value}
          onValueChange={change}
          onClear={() => {
            clear();
            setValue('');
          }}
          clearable
        />
      );
    };

    const { container, unmount } = render(<ControlledInput />);

    const input = container.querySelector<HTMLInputElement>('input');
    const clearButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Clear input"]'
    );

    expect(input?.value).toBe('Clear me');
    expect(clearButton).not.toBeNull();
    expect(clearButton?.querySelector('svg')).not.toBeNull();

    act(() => {
      clearButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(change).toHaveBeenCalledWith('');
    expect(clear).toHaveBeenCalledTimes(1);
    expect(input?.value).toBe('');
    expect(
      container.querySelector('button[aria-label="Clear input"]')
    ).toBeNull();

    unmount();
  });

  it('hides the clear action for controlled empty, disabled, and read-only inputs', () => {
    const { container, rerender, unmount } = render(
      <Input id='empty' label='Empty' value='' clearable />
    );

    expect(
      container.querySelector('button[aria-label="Clear input"]')
    ).toBeNull();

    rerender(
      <Input id='disabled' label='Disabled' value='value' disabled clearable />
    );

    expect(
      container.querySelector('button[aria-label="Clear input"]')
    ).toBeNull();

    rerender(
      <Input id='readonly' label='Read only' value='value' readOnly clearable />
    );

    expect(
      container.querySelector('button[aria-label="Clear input"]')
    ).toBeNull();

    unmount();
  });

  it('supports invalid state without visible error text', () => {
    const { container, unmount } = render(
      <Input id='email' label='Email' value='' invalid />
    );

    const input = container.querySelector<HTMLInputElement>('input');

    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(container.firstElementChild?.getAttribute('data-invalid')).toBe(
      'true'
    );
    expect(container.querySelector('[role="alert"]')).toBeNull();

    unmount();
  });

  it('renders addons, prefix, suffix, counter, and loading state', () => {
    const { container, unmount } = render(
      <Input
        id='url'
        label='URL'
        value='vellira'
        startAddon='https://'
        endAddon='.com'
        prefix='@'
        suffix='kg'
        maxLength={20}
        showCounter
        loading
      />
    );

    const input = container.querySelector<HTMLInputElement>('input');

    expect(input?.readOnly).toBe(true);
    expect(input?.getAttribute('aria-busy')).toBe('true');
    expect(container.textContent).toContain('https://');
    expect(container.textContent).toContain('.com');
    expect(container.textContent).toContain('@');
    expect(container.textContent).toContain('kg');
    expect(container.textContent).toContain('7 / 20');
    expect(
      container.querySelector('[data-testid="input-spinner"]')
    ).not.toBeNull();

    unmount();
  });

  it('reveals password values on demand', () => {
    const { container, unmount } = render(
      <Input
        id='password'
        label='Password'
        value='secret'
        type='password'
        revealPassword
      />
    );

    const input = container.querySelector<HTMLInputElement>('input');
    const revealButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Show password"]'
    );

    expect(input?.type).toBe('password');
    expect(revealButton?.getAttribute('aria-pressed')).toBe('false');
    expect(revealButton?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(revealButton?.textContent).toBe('');

    act(() => {
      revealButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const hideButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Hide password"]'
    );
    expect(input?.type).toBe('text');
    expect(hideButton?.getAttribute('aria-pressed')).toBe('true');
    expect(hideButton?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(hideButton?.textContent).toBe('');

    act(() => {
      hideButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(input?.type).toBe('password');
    expect(revealButton?.getAttribute('aria-pressed')).toBe('false');
    expect(input?.value).toBe('secret');

    unmount();
  });

  it('applies string masks before onValueChange', () => {
    const valueChange = vi.fn();
    const { container, unmount } = render(
      <Input
        id='phone'
        label='Phone'
        defaultValue=''
        mask='+33 # ## ## ## ##'
        onValueChange={valueChange}
      />
    );

    const input = container.querySelector<HTMLInputElement>('input');
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;

    act(() => {
      valueSetter?.call(input, '612345678');
      input?.dispatchEvent(new InputEvent('input', { bubbles: true }));
      input?.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(valueChange).toHaveBeenCalledWith('+33 6 12 34 56 78');
    expect(input?.value).toBe('+33 6 12 34 56 78');

    unmount();
  });

  it('formats displayed values and parses edits', () => {
    const valueChange = vi.fn();
    const { container, unmount } = render(
      <Input
        id='amount'
        label='Amount'
        value='12000'
        format={(nextValue) => Number(nextValue).toLocaleString('en-US')}
        parse={(displayValue) => displayValue.replace(/,/g, '')}
        onValueChange={valueChange}
      />
    );

    const input = container.querySelector<HTMLInputElement>('input');
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;

    expect(input?.value).toBe('12,000');

    act(() => {
      valueSetter?.call(input, '12,500');
      input?.dispatchEvent(new InputEvent('input', { bubbles: true }));
      input?.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(valueChange).toHaveBeenCalledWith('12500');

    unmount();
  });

  it('inherits field semantics from an enclosing FormField', () => {
    const { container, unmount } = render(
      <FormField
        label='Email'
        description='Used for login.'
        error='Invalid email.'
        required
        disabled
        size='sm'
      >
        <Input placeholder='name@example.com' />
      </FormField>
    );

    const input = container.querySelector<HTMLInputElement>('input');
    const label = container.querySelector('label');
    const description = container.querySelector('[id$="-description"]');
    const error = container.querySelector('[id$="-error"]');

    expect(input?.id).toBeTruthy();
    expect(label?.getAttribute('for')).toBe(input?.id);
    expect(input?.required).toBe(true);
    expect(input?.disabled).toBe(true);
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(input?.getAttribute('aria-labelledby')).toBe(`${input?.id}-label`);
    expect(input?.getAttribute('aria-describedby')).toBe(
      `${description?.id} ${error?.id}`
    );
    expect(input?.className).toContain('sm');

    unmount();
  });

  it('keeps explicit Input size above FormField size', () => {
    const { container, unmount } = render(
      <FormField label='Email' size='sm'>
        <Input size='lg' />
      </FormField>
    );

    const input = container.querySelector<HTMLInputElement>('input');

    expect(input?.className).toContain('lg');
    expect(input?.className).not.toContain('sm');

    unmount();
  });

  it('does not let child Input unset required, disabled, or invalid from FormField', () => {
    const { container, unmount } = render(
      <FormField label='Email' required disabled invalid>
        <Input required={false} disabled={false} invalid={false} />
      </FormField>
    );

    const input = container.querySelector<HTMLInputElement>('input');

    expect(input?.required).toBe(true);
    expect(input?.disabled).toBe(true);
    expect(input?.getAttribute('aria-invalid')).toBe('true');

    unmount();
  });

  it('uses a stable right slot priority: loading, clear, reveal, then endIcon', () => {
    const endIcon = <span data-testid='end-icon'>E</span>;
    const { container, rerender, unmount } = render(
      <Input
        id='slot'
        label='Slot'
        value='secret'
        type='password'
        loading
        clearable
        revealPassword
        endIcon={endIcon}
      />
    );

    expect(
      container.querySelector('[data-testid="input-spinner"]')
    ).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Clear input"]')
    ).toBeNull();
    expect(
      container.querySelector('button[aria-label="Show password"]')
    ).toBeNull();
    expect(container.querySelector('[data-testid="end-icon"]')).toBeNull();

    rerender(
      <Input
        id='slot'
        label='Slot'
        value='secret'
        type='password'
        clearable
        revealPassword
        endIcon={endIcon}
      />
    );

    expect(container.querySelector('[data-testid="input-spinner"]')).toBeNull();
    expect(
      container.querySelector('button[aria-label="Clear input"]')
    ).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Show password"]')
    ).toBeNull();
    expect(container.querySelector('[data-testid="end-icon"]')).toBeNull();

    rerender(
      <Input
        id='slot'
        label='Slot'
        value=''
        type='password'
        clearable
        revealPassword
        endIcon={endIcon}
      />
    );

    expect(
      container.querySelector('button[aria-label="Clear input"]')
    ).toBeNull();
    expect(
      container.querySelector('button[aria-label="Show password"]')
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="end-icon"]')).toBeNull();

    rerender(
      <Input id='slot' label='Slot' value='' type='text' endIcon={endIcon} />
    );

    expect(
      container.querySelector('button[aria-label="Show password"]')
    ).toBeNull();
    expect(container.querySelector('[data-testid="end-icon"]')).not.toBeNull();

    unmount();
  });
});

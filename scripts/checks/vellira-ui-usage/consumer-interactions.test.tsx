// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ComponentsCatalog } from '../../../apps/website/src/component-catalog/shared/ComponentsCatalog/ComponentsCatalog';
import {
  PlaygroundControlGroup,
  PlaygroundNumberInput,
  PlaygroundTextInput,
  PlaygroundToggle,
} from '../../../apps/website/src/component-catalog/shared/PlaygroundControls/PlaygroundControls';
import { HeaderSearch } from '../../../apps/website/src/components/layout/SiteHeader/HeaderSearch/HeaderSearch';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/component-catalog', () => ({
  webComponents: [
    {
      name: 'Button',
      slug: 'button',
      description: 'Action control',
      category: 'actions',
      platforms: ['react'],
    },
    {
      name: 'Input',
      slug: 'input',
      description: 'Text control',
      category: 'forms',
      platforms: ['react'],
    },
  ],
}));
vi.mock(
  '../../../apps/website/src/component-catalog/shared/ComponentsCatalog/ComponentCatalogPreview',
  () => ({
    ComponentCatalogPreview: () => null,
  })
);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function Playground() {
  const [text, setText] = useState('Initial');
  const [number, setNumber] = useState(4);
  const [size, setSize] = useState('small');
  const [checked, setChecked] = useState(false);
  return (
    <>
      <PlaygroundTextInput label='Label' value={text} onChange={setText} />
      <PlaygroundNumberInput
        label='Count'
        value={number}
        min={0}
        max={10}
        step={2}
        onChange={setNumber}
      />
      <PlaygroundControlGroup
        label='Size'
        value={size}
        options={['small', 'large']}
        onChange={setSize}
      />
      <PlaygroundToggle
        label='Disabled'
        checked={checked}
        onChange={setChecked}
      />
    </>
  );
}

describe('canonical first-party input and button behavior', () => {
  it('preserves explicit labels, values, number constraints and pressed state', () => {
    render(<Playground />);
    const text = screen.getByRole('textbox', { name: 'Label' });
    const number = screen.getByRole('spinbutton', { name: 'Count' });
    expect(text).toHaveValue('Initial');
    expect(number).toHaveValue(4);
    expect(number).toHaveAttribute('min', '0');
    expect(number).toHaveAttribute('max', '10');
    expect(number).toHaveAttribute('step', '2');
    expect(text.id).not.toBe(number.id);
    expect(document.querySelector(`label[for="${text.id}"]`)).toHaveTextContent(
      'Label'
    );
    expect(text.closest('label')).toBeNull(); // No block wrappers inside a label.
    fireEvent.change(text, { target: { value: 'Updated' } });
    fireEvent.change(number, { target: { value: '8' } });
    expect(text).toHaveValue('Updated');
    expect(number).toHaveValue(8);
    expect((number as HTMLInputElement).validity.valid).toBe(true);
    fireEvent.change(number, { target: { value: '11' } });
    expect((number as HTMLInputElement).validity.rangeOverflow).toBe(true);
    fireEvent.change(number, { target: { value: '' } });
    expect(number).toHaveValue(0); // Preserve the existing Number('') contract.
    const large = screen.getByRole('button', { name: 'large' });
    fireEvent.click(large);
    expect(large).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'small' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    const toggle = screen.getByRole('button', { name: 'Disabled' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('preserves combobox results, keyboard selection, clear and ref focus', () => {
    render(<HeaderSearch />);
    const search = screen.getByRole('combobox', { name: 'Search components' });
    expect(search).toHaveAttribute('autocomplete', 'on');
    act(() => search.focus());
    fireEvent.change(search, { target: { value: 'control' } });
    const listbox = screen.getByRole('listbox');
    expect(search).toHaveAttribute('aria-controls', listbox.id);
    expect(screen.getAllByRole('option')).toHaveLength(2);
    fireEvent.keyDown(search, { key: 'ArrowUp' });
    const selected = screen.getByRole('option', { selected: true });
    expect(search).toHaveAttribute('aria-activedescendant', selected.id);
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(push).toHaveBeenCalledExactlyOnceWith('/components/input');
    expect(search).toHaveValue('');
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.change(search, { target: { value: 'button' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(search).toHaveValue('');
    expect(search).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear input' })).toBeNull();
  });

  it('does not navigate for absent results and dismisses on Escape or outside click', () => {
    render(<HeaderSearch />);
    const search = screen.getByRole('combobox');
    act(() => search.focus());
    fireEvent.change(search, { target: { value: 'missing-component' } });
    expect(screen.getByText('No components found')).toBeInTheDocument();
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(push).not.toHaveBeenCalled();
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(search).not.toHaveFocus();
    expect(search).toHaveAttribute('aria-expanded', 'false');
    fireEvent.change(search, { target: { value: 'button' } });
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('preserves catalog filtering, empty state and one-action reset', () => {
    render(<ComponentsCatalog />);
    const search = screen.getByRole('searchbox', { name: 'Search components' });
    expect(search).toHaveAttribute('autocomplete', 'on');
    fireEvent.change(search, { target: { value: 'does-not-exist' } });
    expect(screen.getByText('No components found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(search).toHaveValue('');
    expect(screen.queryByText('No components found')).toBeNull();
    fireEvent.change(search, { target: { value: 'button' } });
    expect(screen.getByRole('heading', { name: 'Button' })).toBeInTheDocument();
    const native = screen.getByRole('button', {
      name: 'React Native',
    });
    fireEvent.click(native);
    expect(native).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(search).toHaveValue('button');
    expect(search.closest('label')).toBeNull();
  });
});

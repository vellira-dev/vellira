import { readFileSync } from 'node:fs';

import { act } from 'react';

import { copyCompoundSlotMetadata } from '@vellira-ui/core';
import type { ComponentProps } from 'react';
import { Pressable, Text } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FormField } from '../../patterns/FormField';
import { render } from '../../test-utils/render';
import { nativeThemes, ThemeProvider } from '../../theme';

import { createContentStyles } from './Content/SelectContent.styles';
import { Select } from './Select';
import type { SelectRenderOptionContext } from './types';

const options = [
  { label: 'France', value: 'fr' },
  { label: 'Germany', value: 'de', disabled: true },
  { label: 'Spain', value: 'es' },
];

const multipleOptions = [
  { label: 'France', value: 'fr' },
  { label: 'Spain', value: 'es' },
  { label: 'Italy', value: 'it' },
];

const longOptions = Array.from({ length: 80 }, (_, index) => ({
  label: `Country ${index + 1}`,
  value: `country-${index + 1}`,
}));

const getButtonByText = (text: string) =>
  Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent === text
  );

const getButtonByLabel = (label: string) =>
  document.body.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`
  );

const hexToRgb = (hex: string) => {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgb(${red}, ${green}, ${blue})`;
};

const openSelect = (container: HTMLElement) => {
  const trigger = container.querySelector<HTMLButtonElement>('[role="button"]');

  act(() => {
    trigger?.click();
  });

  return trigger;
};

const changeInputValue = (input: HTMLInputElement | null, value: string) => {
  if (!input) return;

  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const waitForSelectScroll = () =>
  new Promise((resolve) => setTimeout(resolve, 340));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Native Select', () => {
  it('opens a native list and selects a children option immediately', () => {
    const onValueChange = vi.fn();

    const { container, unmount } = render(
      <Select label='Country' onValueChange={onValueChange}>
        <Select.Item value='fr' label='France' />
        <Select.Item value='de' label='Germany' />
      </Select>
    );

    const trigger = openSelect(container);

    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(
      document.body.querySelector('[data-testid="native-flat-list"]')
    ).toBeTruthy();

    act(() => {
      getButtonByText('France')?.click();
    });

    expect(onValueChange).toHaveBeenCalledWith('fr');
    expect(container.textContent).toContain('France');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');

    unmount();
  });

  it('supports Item asChild without rendering a second option surface', () => {
    const onValueChange = vi.fn();

    const { container, unmount } = render(
      <Select label='Country' onValueChange={onValueChange}>
        <Select.Item value='fr' label='France' asChild>
          <Pressable>
            <Text>France custom</Text>
          </Pressable>
        </Select.Item>
      </Select>
    );

    openSelect(container);

    const option = getButtonByLabel('France');

    expect(option?.textContent).toContain('France custom');

    act(() => {
      option?.click();
    });

    expect(onValueChange).toHaveBeenCalledWith('fr');
    expect(container.textContent).toContain('France');

    unmount();
  });

  it('keeps the previously selected single option visible after reopening', () => {
    const { container, unmount } = render(
      <Select label='Country'>
        <Select.Item value='fr' label='France' />
        <Select.Item value='de' label='Germany' />
        <Select.Item value='es' label='Spain' />
      </Select>
    );

    openSelect(container);

    act(() => {
      getButtonByText('France')?.click();
    });

    openSelect(container);

    expect(document.body.textContent).toContain('France');
    expect(document.body.textContent).toContain('Germany');
    expect(document.body.textContent).toContain('Spain');

    act(() => {
      getButtonByText('Spain')?.click();
    });

    openSelect(container);

    expect(document.body.textContent).toContain('France');
    expect(document.body.textContent).toContain('Germany');
    expect(document.body.textContent).toContain('Spain');

    act(() => {
      getButtonByText('Germany')?.click();
    });

    openSelect(container);

    expect(document.body.textContent).toContain('France');
    expect(document.body.textContent).toContain('Germany');
    expect(document.body.textContent).toContain('Spain');
    expect(
      document.body
        .querySelector('[data-testid="native-flat-list"]')
        ?.getAttribute('data-scroll-to-index')
    ).toBeNull();

    unmount();
  });

  it('uses readable selected option colors on dark themes', () => {
    const { container, unmount } = render(
      <ThemeProvider theme='dark'>
        <Select label='Country' defaultValue='fr'>
          <Select.Item value='fr' label='France' />
          <Select.Item value='de' label='Germany' />
        </Select>
      </ThemeProvider>
    );

    openSelect(container);

    const selectedOption = getButtonByLabel('France');
    const selectedLabel = selectedOption?.querySelector('span');

    expect(selectedOption?.style.backgroundColor).toBe(
      hexToRgb(
        nativeThemes.dark.components.select.primary.outline.option.selected.bg
      )
    );
    expect(selectedLabel?.style.color).toBe(
      hexToRgb(
        nativeThemes.dark.components.select.primary.outline.option.selected.fg
      )
    );

    unmount();
  });

  it('renders compact spacing between option rows', () => {
    const { container, unmount } = render(
      <Select label='Country' options={options} />
    );

    openSelect(container);

    expect(getButtonByText('France')?.style.marginBottom).toBe('2px');

    unmount();
  });

  it('uses hover tokens when an option is hovered', () => {
    const { container, unmount } = render(
      <Select label='Country' options={options} />
    );

    openSelect(container);

    const option = getButtonByText('France');

    act(() => {
      option?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });

    expect(option?.style.backgroundColor).toBe(
      hexToRgb(
        nativeThemes.light.components.select.primary.outline.option.hover.bg
      )
    );

    unmount();
  });

  it('supports simple options arrays', () => {
    const onValueChange = vi.fn();

    const { container, unmount } = render(
      <Select label='Country' options={options} onValueChange={onValueChange} />
    );

    openSelect(container);

    act(() => {
      getButtonByText('Spain')?.click();
    });

    expect(onValueChange).toHaveBeenCalledWith('es');
    expect(container.textContent).toContain('Spain');

    unmount();
  });

  it('ignores disabled options', () => {
    const onValueChange = vi.fn();

    const { container, unmount } = render(
      <Select
        label='Country'
        options={options}
        defaultValue='es'
        onValueChange={onValueChange}
      />
    );

    openSelect(container);

    const disabledOption = getButtonByText('Germany');

    expect(disabledOption?.disabled).toBe(true);

    act(() => {
      disabledOption?.click();
    });

    expect(onValueChange).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Spain');

    unmount();
  });

  it('closes from the backdrop without changing value', () => {
    const onValueChange = vi.fn();

    const { container, unmount } = render(
      <Select
        label='Country'
        options={options}
        defaultValue='es'
        onValueChange={onValueChange}
      />
    );

    const trigger = openSelect(container);

    act(() => {
      document.body
        .querySelector<HTMLButtonElement>('button[aria-label="Dismiss select"]')
        ?.click();
    });

    expect(onValueChange).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Spain');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');

    unmount();
  });

  it('supports controlled value and controlled open state', () => {
    const onValueChange = vi.fn();
    const onOpenChange = vi.fn();

    const { container, rerender, unmount } = render(
      <Select
        label='Country'
        options={options}
        value='fr'
        open={false}
        onOpenChange={onOpenChange}
        onValueChange={onValueChange}
      />
    );

    expect(container.textContent).toContain('France');

    openSelect(container);

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(document.body.textContent).not.toContain('Spain');

    rerender(
      <Select
        label='Country'
        options={options}
        value='fr'
        open
        onOpenChange={onOpenChange}
        onValueChange={onValueChange}
      />
    );

    act(() => {
      getButtonByText('Spain')?.click();
    });

    expect(onValueChange).toHaveBeenCalledWith('es');
    expect(onOpenChange).toHaveBeenCalledWith(false);

    unmount();
  });

  it('renders empty content when no options are available', () => {
    const { container, unmount } = render(
      <Select label='Country' empty='No countries found' />
    );

    const trigger = openSelect(container);

    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.textContent).toContain('No countries found');

    unmount();
  });

  it('renders long option lists with FlatList seeded at the selected option', () => {
    const { container, unmount } = render(
      <Select
        label='Country'
        options={longOptions}
        defaultValue='country-12'
        virtual
      />
    );

    expect(container.textContent).toContain('Country 12');

    openSelect(container);

    const list = document.body.querySelector(
      '[data-testid="native-flat-list"]'
    );

    expect(list?.querySelectorAll('button')).toHaveLength(longOptions.length);
    expect(list?.getAttribute('data-initial-scroll-index')).toBe('11');
    expect(list?.getAttribute('data-scroll-to-index')).toBeNull();
    expect(list?.getAttribute('data-scroll-to-offset')).toBeNull();
    expect(list?.getAttribute('data-scroll-view-position')).toBeNull();
    expect(getButtonByText('Country 24')).toBeTruthy();

    unmount();
  });

  it('seeds virtual list position when reopening after middle selection', () => {
    const { container, unmount } = render(
      <Select
        label='Country'
        options={longOptions}
        defaultValue='country-12'
        virtual
      />
    );

    openSelect(container);

    act(() => {
      getButtonByText('Country 16')?.click();
    });

    expect(container.textContent).toContain('Country 16');

    openSelect(container);

    const reopenedList = document.body.querySelector(
      '[data-testid="native-flat-list"]'
    );

    expect(reopenedList?.getAttribute('data-initial-scroll-index')).toBe('15');
    expect(reopenedList?.getAttribute('data-scroll-to-index')).toBeNull();
    expect(reopenedList?.getAttribute('data-scroll-to-offset')).toBeNull();
    expect(reopenedList?.getAttribute('data-scroll-view-position')).toBeNull();

    unmount();
  });

  it('uses the real compact option height for deep virtual selected items', () => {
    const { container, unmount } = render(
      <Select
        label='Country'
        options={longOptions}
        defaultValue='country-70'
        virtual
      />
    );

    openSelect(container);

    const list = document.body.querySelector(
      '[data-testid="native-flat-list"]'
    );

    expect(list?.getAttribute('data-initial-scroll-index')).toBe('69');
    expect(list?.getAttribute('data-initial-scroll-length')).toBe('46');
    expect(list?.getAttribute('data-initial-scroll-offset')).toBe('3174');

    unmount();
  });

  it('searches locally and clears the search query', () => {
    const { container, unmount } = render(
      <Select label='Country' searchable options={options} />
    );

    openSelect(container);

    const searchInput = document.body.querySelector<HTMLInputElement>('input');

    expect(searchInput?.getAttribute('data-auto-focus')).toBe('true');
    expect(searchInput?.getAttribute('data-return-key-type')).toBe('search');

    act(() => {
      searchInput?.focus();
      searchInput?.dispatchEvent(
        new Event('input', { bubbles: true, cancelable: true })
      );
    });

    act(() => {
      changeInputValue(searchInput, 'spa');
    });

    expect(document.body.textContent).toContain('Spain');
    expect(document.body.textContent).not.toContain('France');

    act(() => {
      document.body
        .querySelector<HTMLButtonElement>('button[aria-label="Clear search"]')
        ?.click();
    });

    expect(document.body.textContent).toContain('France');

    unmount();
  });

  it('does not auto focus search while opening a virtual list at a selected item', async () => {
    const { container, unmount } = render(
      <Select
        label='Country'
        searchable
        options={longOptions}
        defaultValue='country-40'
        virtual
      />
    );

    openSelect(container);

    const searchInput = document.body.querySelector<HTMLInputElement>('input');

    expect(searchInput?.getAttribute('data-auto-focus')).toBeNull();
    expect(document.activeElement).not.toBe(searchInput);

    await act(async () => {
      await waitForSelectScroll();
    });

    expect(document.activeElement).not.toBe(searchInput);

    unmount();
  });

  it('calls onSearch for async search without local filtering by default', () => {
    const onSearch = vi.fn();

    const { container, unmount } = render(
      <Select
        label='Country'
        searchable
        options={options}
        onSearch={onSearch}
      />
    );

    openSelect(container);

    const searchInput = document.body.querySelector<HTMLInputElement>('input');

    act(() => {
      changeInputValue(searchInput, 'spa');
    });

    expect(onSearch).toHaveBeenCalledWith('spa');
    expect(document.body.textContent).toContain('France');
    expect(document.body.textContent).toContain('Spain');

    unmount();
  });

  it('supports clearable single value and returns null', () => {
    const onValueChange = vi.fn();

    const { container, unmount } = render(
      <Select
        label='Country'
        clearable
        defaultValue='fr'
        options={options}
        onValueChange={onValueChange}
      />
    );

    const clearButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Clear selection"]'
    );

    expect(clearButton).toBeTruthy();
    expect(clearButton?.parentElement?.closest('button')).toBeNull();

    act(() => {
      clearButton?.click();
    });

    expect(onValueChange).toHaveBeenCalledWith(null);
    expect(container.textContent).toContain('Select...');

    unmount();
  });

  it('supports multiple values, closeOnSelect, and maxSelected', () => {
    const onValueChange = vi.fn();

    const { container, rerender, unmount } = render(
      <Select
        label='Teams'
        multiple
        maxSelected={2}
        closeOnSelect={false}
        defaultValue={['fr']}
        options={multipleOptions}
        onValueChange={onValueChange}
      />
    );

    const trigger = openSelect(container);

    act(() => {
      getButtonByText('Spain')?.click();
    });

    expect(onValueChange).toHaveBeenCalledWith(['fr', 'es']);
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');

    rerender(
      <Select
        label='Teams'
        multiple
        maxSelected={2}
        closeOnSelect={false}
        value={['fr', 'es']}
        options={multipleOptions}
        onValueChange={onValueChange}
      />
    );

    expect(getButtonByLabel('France')?.disabled).toBe(false);
    expect(getButtonByLabel('Italy')?.disabled).toBe(true);

    act(() => {
      getButtonByLabel('Italy')?.click();
    });

    expect(onValueChange).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('keeps previously selected multiple options visible after another selection', () => {
    const { container, unmount } = render(
      <Select
        label='Teams'
        multiple
        closeOnSelect={false}
        defaultValue={['fr']}
      >
        <Select.Item value='fr' label='France' />
        <Select.Item value='es' label='Spain' />
        <Select.Item value='it' label='Italy' />
      </Select>
    );

    openSelect(container);

    act(() => {
      getButtonByText('Spain')?.click();
    });

    expect(document.body.textContent).toContain('France');
    expect(document.body.textContent).toContain('Spain');
    expect(document.body.textContent).toContain('Italy');
    expect(container.textContent).toContain('France, Spain');

    unmount();
  });

  it('toggles all enabled options in a selectable group for multiple select', () => {
    const onValueChange = vi.fn();

    const { container, unmount } = render(
      <Select
        label='Teams'
        multiple
        maxSelected={2}
        closeOnSelect={false}
        onValueChange={onValueChange}
      >
        <Select.Group label='Core teams' selectable selectLabel='All core'>
          <Select.Item value='product' label='Product' />
          <Select.Item value='engineering' label='Engineering' />
          <Select.Item value='support' label='Support' disabled />
          <Select.Item value='qa' label='QA' />
        </Select.Group>
      </Select>
    );

    openSelect(container);

    const groupAction = getButtonByLabel('All core');

    expect(groupAction?.textContent).toContain('0/3');

    act(() => {
      groupAction?.click();
    });

    expect(onValueChange).toHaveBeenLastCalledWith(['product', 'engineering']);
    expect(container.textContent).toContain('Product, Engineering');
    expect(groupAction?.textContent).toContain('2/3');
    expect(groupAction?.getAttribute('aria-checked')).toBe('mixed');

    act(() => {
      groupAction?.click();
    });

    expect(onValueChange).toHaveBeenLastCalledWith([]);
    expect(container.textContent).toContain('Select...');

    unmount();
  });

  it('renders groups, separators, descriptions, icons and badges', () => {
    const { container, unmount } = render(
      <Select label='Country' defaultValue='fr'>
        <Select.Content>
          <Select.Group label='Europe'>
            <Select.Item
              value='fr'
              label='France'
              description='Paris'
              icon={<Text>FR</Text>}
              badge='EU'
            />
          </Select.Group>
          <Select.Separator />
          <Select.Item value='es' label='Spain' color='success' />
        </Select.Content>
      </Select>
    );

    openSelect(container);

    expect(document.body.textContent).toContain('Europe');
    expect(document.body.textContent).toContain('France');
    expect(document.body.textContent).toContain('Paris');
    expect(document.body.textContent).toContain('FR');
    expect(document.body.textContent).toContain('EU');
    expect(document.body.textContent).toContain('Spain');

    unmount();
  });

  it('recognizes copied compound slot metadata on wrapper components', () => {
    const WrappedContent = copyCompoundSlotMetadata(
      Select.Content,
      (props: ComponentProps<typeof Select.Content>) => (
        <Select.Content {...props} />
      )
    );
    const WrappedItem = copyCompoundSlotMetadata(
      Select.Item,
      (props: ComponentProps<typeof Select.Item>) => <Select.Item {...props} />
    );

    const { container, unmount } = render(
      <Select label='Country'>
        <WrappedContent>
          <WrappedItem value='fr' label='France' description='Paris' />
        </WrappedContent>
      </Select>
    );

    openSelect(container);

    expect(document.body.textContent).toContain('France');
    expect(document.body.textContent).toContain('Paris');

    unmount();
  });

  it('supports custom renderValue and renderOption', () => {
    const renderOptionContexts: SelectRenderOptionContext[] = [];
    const { container, unmount } = render(
      <Select
        label='Country'
        defaultValue='fr'
        options={options}
        renderValue={({ option }) =>
          option ? <Text>Selected: {option.label}</Text> : null
        }
        renderOption={(context) => {
          renderOptionContexts.push(context);

          return (
            <Text>
              {context.selected ? 'Selected ' : ''}
              {context.option.label}
            </Text>
          );
        }}
      />
    );

    expect(container.textContent).toContain('Selected: France');

    openSelect(container);

    expect(document.body.textContent).toContain('Selected France');
    expect(renderOptionContexts[0]).toMatchObject({
      selected: true,
      disabled: false,
      active: false,
      index: 0,
      values: ['fr'],
      multiple: false,
    });
    expect(renderOptionContexts[0]?.option.value).toBe('fr');

    unmount();
  });

  it('inherits FormField context without rendering a nested field wrapper', () => {
    const { container, unmount } = render(
      <FormField
        label='Country'
        description='Shipping destination'
        error='Country is required'
        required
        size='lg'
      >
        <Select placeholder='Choose country' options={options} />
      </FormField>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');

    expect(trigger?.id).toBeTruthy();
    expect(trigger?.style.minHeight).toBe('52px');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(trigger?.getAttribute('aria-disabled')).toBe('false');
    expect(trigger?.getAttribute('aria-label')).toBe('Choose country');
    expect(container.textContent).toContain('Country is required');
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(1);

    unmount();
  });

  it('keeps Cancel, title and Done usable at large native font scales', () => {
    const { container, unmount } = render(
      <Select
        label='Status'
        presentation='sheet'
        options={[
          { label: 'Planned', value: 'planned' },
          { label: 'Shipped', value: 'shipped' },
        ]}
      />
    );

    openSelect(container);

    const toolbar = document.body.querySelector<HTMLElement>('[role="toolbar"]');
    expect(toolbar?.getAttribute('aria-label')).toBe('Status selection actions');
    expect(getButtonByLabel('Close selection')).toBeTruthy();
    expect(getButtonByLabel('Done')).toBeTruthy();
    expect(toolbar?.textContent).toContain('Status');

    // Web DOM tests cannot emulate iOS Dynamic Type layout. Protect the
    // explicit native text scaling contract alongside accessible controls.
    const nativeSource = readFileSync(
      new URL('./Content/SelectContent.tsx', import.meta.url),
      'utf8'
    );
    const toolbarStart = nativeSource.indexOf('const body = (');
    const toolbarEnd = nativeSource.indexOf('{searchable &&', toolbarStart);
    const nativeToolbar = nativeSource.slice(toolbarStart, toolbarEnd);
    expect(
      nativeToolbar.match(/maxFontSizeMultiplier=\\{1\\.4\\}/g)
    ).toHaveLength(3);
    expect(
      nativeToolbar.match(/numberOfLines=\\{1\\}/g)
    ).toHaveLength(3);
    expect(
      nativeToolbar.match(/adjustsFontSizeToFit/g)
    ).toHaveLength(3);

    const titleStyle = createContentStyles(nativeThemes.light).title;
    expect(titleStyle.minWidth).toBe(0);
    expect(titleStyle.flexShrink).toBe(1);

    unmount();
  });

  it('keeps a short native sheet list content-sized instead of filling empty space', () => {
    const { container, unmount } = render(
      <Select
        label='Country'
        presentation='sheet'
        defaultValue='fr'
        options={[
          { label: 'France', value: 'fr' },
          { label: 'Spain', value: 'es' },
        ]}
      />
    );

    openSelect(container);

    const list = document.body.querySelector<HTMLElement>(
      '[data-testid="native-flat-list"]'
    );

    expect(list?.style.flexGrow).toBe('0');
    expect(list?.style.flexShrink).toBe('1');
    expect(list?.style.maxHeight).toBe('420px');
    // DOM mock renders both rows regardless of viewport. This verifies the
    // requested list height, NOT its computed Yoga size on iPhone.
    const twoRowHeight = 2 * 46 + nativeThemes.light.tokens.spacing[2] * 2;
    expect(list?.style.height).toBe(`${twoRowHeight}px`);
    // Native bounds must use the device window; a percentage of the
    // intrinsic-height shadow wrapper clips the second row on iOS.
    const sheet = document.body.querySelector<HTMLElement>(
      '[data-testid="select-sheet"]'
    );
    expect(sheet?.style.maxHeight).toBe(`${768 * 0.74}px`);
    expect(sheet?.textContent).toContain('Spain');
    expect(list?.textContent).toContain('France');
    expect(list?.textContent).toContain('Spain');

    unmount();
  });

  it('preserves the scrolling cap and selected index for long virtual sheet lists', () => {
    const { container, unmount } = render(
      <Select
        label='Country'
        presentation='sheet'
        options={longOptions}
        defaultValue='country-70'
        virtual
      />
    );

    openSelect(container);

    const list = document.body.querySelector<HTMLElement>(
      '[data-testid="native-flat-list"]'
    );

    expect(list?.style.flexGrow).toBe('0');
    expect(list?.style.flexShrink).toBe('1');
    expect(list?.style.maxHeight).toBe('420px');
    expect(list?.style.height).toBe('420px');
    expect(list?.getAttribute('data-initial-scroll-index')).toBe('69');

    unmount();
  });

  it('allocates two rows in modal and respects virtual item size estimates', () => {
    const { container, unmount } = render(
      <Select
        label='Country'
        presentation='modal'
        options={[
          { label: 'France', value: 'fr' },
          { label: 'Spain', value: 'es' },
        ]}
      />
    );

    openSelect(container);

    const list = document.body.querySelector<HTMLElement>(
      '[data-testid="native-flat-list"]'
    );
    const padding = nativeThemes.light.tokens.spacing[2] * 2;
    expect(list?.style.height).toBe(`${2 * 46 + padding}px`);
    expect(
      document.body.querySelector<HTMLElement>('[data-testid="select-modal"]')
        ?.style.maxHeight
    ).toBe(`${768 * 0.74}px`);
    expect(list?.textContent).toContain('Spain');

    unmount();

    const virtual = render(
      <Select
        label='Country'
        presentation='sheet'
        virtual={{ estimatedItemSize: 70 }}
        options={[
          { label: 'France', value: 'fr' },
          { label: 'Spain', value: 'es' },
        ]}
      />
    );

    openSelect(virtual.container);
    const virtualList = document.body.querySelector<HTMLElement>(
      '[data-testid="native-flat-list"]'
    );
    expect(virtualList?.style.height).toBe(`${2 * 70 + padding}px`);

    virtual.unmount();
  });

  it('supports loading and presentation props', () => {
    const { container, rerender, unmount } = render(
      <Select label='Country' loading presentation='sheet' options={[]} />
    );

    openSelect(container);

    expect(
      container.querySelector('[data-testid="select-loading-indicator"]')
    ).toBeTruthy();
    expect(
      document.body.querySelector('[data-testid="select-sheet"]')
    ).toBeTruthy();
    expect(document.body.textContent).toContain('Loading...');

    rerender(
      <Select
        label='Country'
        presentation='modal'
        defaultOpen
        options={options}
      />
    );

    expect(
      document.body.querySelector('[data-testid="select-modal"]')
    ).toBeTruthy();

    rerender(
      <Select
        label='Country'
        presentation='popover'
        placement='top'
        defaultOpen
        options={options}
      />
    );

    const popover = container.querySelector<HTMLElement>(
      '[data-testid="select-popover-surface"]'
    );

    expect(popover).not.toBeNull();
    expect(popover?.style.position).toBe('absolute');

    unmount();
  });

  it('supports error content and style props', () => {
    const { container, unmount } = render(
      <Select
        label='Country'
        options={options}
        error={<Text testID='custom-error'>Required</Text>}
        size='lg'
        style={{ maxWidth: 360 }}
        triggerStyle={{ maxWidth: 300 }}
        textStyle={{ fontWeight: '700' }}
        contentStyle={{ minHeight: 160 }}
      />
    );

    const field = container.firstElementChild as HTMLElement | null;
    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');
    const triggerText = trigger?.querySelector('span');

    expect(field?.style.maxWidth).toBe('360px');
    expect(trigger?.style.minHeight).toBe('52px');
    expect(trigger?.style.maxWidth).toBe('300px');
    expect(triggerText?.style.fontSize).toBe('20px');
    expect(triggerText?.style.lineHeight).toBe('28');
    expect(triggerText?.style.fontWeight).toBe('700');
    expect(container.textContent).toContain('Required');
    expect(
      container.querySelector('[data-testid="custom-error"]')
    ).toBeTruthy();

    openSelect(container);

    expect(
      document.body.querySelector<HTMLElement>('[data-testid="select-popover"]')
        ?.style.minHeight
    ).toBe('160px');

    unmount();
  });

  it('uses the shared compact visual height for small Select triggers', () => {
    const { container, unmount } = render(
      <Select label='Country' size='sm' options={options} />
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');

    expect(trigger?.style.minHeight).toBe('38px');

    unmount();
  });

  it('treats missing runtime options as an empty list', () => {
    const props = {
      label: 'Country',
      onValueChange: vi.fn(),
    } as unknown as ComponentProps<typeof Select>;

    const { container, unmount } = render(<Select {...props} />);

    expect(container.textContent).toContain('Select...');

    openSelect(container);

    expect(document.body.textContent).toContain('Nothing found');

    unmount();
  });
});

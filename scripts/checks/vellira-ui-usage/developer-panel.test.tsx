// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { readFileSync } from 'node:fs';

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { Text } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeveloperPanel } from '../../../apps/native-storybook/.rnstorybook/DeveloperPanel';
import { checkSourceFile } from './checker';

// Exercise the real public native Button through its web
// renderer; do not replace the canonical control with a test double.
vi.mock('react-native', async () => vi.importActual('react-native-web'));

afterEach(cleanup);

describe('native Storybook diagnostic control', () => {
  it('accepts the canonical native resources and reports a regressed inline color', () => {
    const file = 'apps/native-storybook/.rnstorybook/DeveloperPanel.tsx';
    const source = readFileSync(file, 'utf8');
    expect(checkSourceFile(file, source)).toEqual([]);
    const regressed = source.replace(
      'color: diagnosticTheme.semantic.text.primary',
      "color: '#123456'"
    );
    expect(regressed).not.toBe(source);
    expect(checkSourceFile(file, regressed)).toEqual([
      expect.objectContaining({
        ruleId: 'vellira-ui.noncanonical-token-value',
        detected: '#123456',
      }),
    ]);
  });

  it('preserves the platform text metrics of the original diagnostic control', () => {
    render(
      <>
        <Text testID='platform-text'>🎨 Light</Text>
        <DeveloperPanel themeName='light' onChangeTheme={() => undefined} />
      </>
    );
    const nativeText = getComputedStyle(screen.getByTestId('platform-text'));
    const button = screen.getByRole('button', { name: '🎨 Light' });
    const actual = getComputedStyle(within(button).getByText('🎨 Light'));
    for (const property of [
      'fontFamily',
      'fontSize',
      'lineHeight',
      'fontWeight',
    ] as const) {
      expect(actual[property], property).toBe(nativeText[property]);
    }
  });
  it('preserves the diagnostic control geometry while pressed', () => {
    const onChangeTheme = vi.fn();
    render(<DeveloperPanel themeName='light' onChangeTheme={onChangeTheme} />);
    const button = screen.getByRole('button', { name: '🎨 Light' });
    const transform = getComputedStyle(button).transform;
    fireEvent.keyDown(button, { key: ' ' });
    expect(getComputedStyle(button).transform).toBe(transform);
    fireEvent.keyUp(button, { key: ' ' });
    // The web renderer uses an HTML button; the browser dispatches its click
    // after Space is released, which jsdom does not synthesize automatically.
    expect(button.tagName).toBe('BUTTON');
    fireEvent.click(button);
    expect(onChangeTheme).toHaveBeenCalledOnce();
  });
  it.each([
    ['light', 'Light'],
    ['dark', 'Dark'],
    ['highContrast', 'High Contrast'],
  ] as const)(
    'retains fixed chrome and invokes the action once in %s',
    (theme, label) => {
      const onChangeTheme = vi.fn();
      const { container } = render(
        <DeveloperPanel themeName={theme} onChangeTheme={onChangeTheme} />
      );
      const button = screen.getByRole('button', { name: `🎨 ${label}` });
      fireEvent.click(button);
      expect(onChangeTheme).toHaveBeenCalledOnce();
      expect(button).not.toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveStyle({
        backgroundColor: '#ffffff',
        paddingLeft: '12px',
        paddingTop: '8px',
      });
      expect(screen.getByText('Developer')).toHaveStyle({ color: '#ffffff' });
      const backdrop = [...container.querySelectorAll('div')].find(
        (node) => getComputedStyle(node).opacity === '0.75'
      );
      expect(backdrop).toHaveStyle({
        backgroundColor: '#000000',
        position: 'absolute',
      });
      expect(getComputedStyle(button).opacity).not.toBe('0.75');
      expect(screen.getAllByRole('button')).toHaveLength(1);
    }
  );
});

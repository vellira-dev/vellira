import { describe, expect, it } from 'vitest';

import * as api from './index';

describe('public API', () => {
  it('exports only documented runtime entries', () => {
    expect(Object.keys(api).sort()).toEqual([
      'Accordion',
      'Button',
      'Checkbox',
      'Dropdown',
      'FormField',
      'Input',
      'Modal',
      'Popover',
      'Portal',
      'PortalProvider',
      'Radio',
      'RadioGroup',
      'Select',
      'Switch',
      'Tabs',
      'Textarea',
      'ThemeProvider',
      'Toast',
      'Tooltip',
      'createToastStore',
      'useTheme',
      'useToast',
    ]);
  });

  it('exports runtime components and hooks', () => {
    expect(api.ThemeProvider).toBeDefined();
    expect(api.Portal).toBeDefined();
    expect(api.PortalProvider).toBeDefined();
    expect(api.useTheme).toBeDefined();
    expect(api.createToastStore).toBeDefined();
    expect(api.useToast).toBeDefined();

    expect(typeof api.Portal).toBe('function');
    expect(typeof api.PortalProvider).toBe('function');
    expect(typeof api.useTheme).toBe('function');
    expect(typeof api.createToastStore).toBe('function');
    expect(typeof api.useToast).toBe('function');
    expect(typeof api.ThemeProvider).toBe('function');
  });
});

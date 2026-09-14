import { describe, expect, it } from 'vitest';

import {
  componentLifecycleDefinitions,
  componentLifecycleStatuses,
} from './component';
import { componentMetadata } from './components';

describe('canonical component lifecycle', () => {
  it('defines the complete ordered lifecycle and semantics', () => {
    expect(componentLifecycleStatuses).toEqual([
      'experimental',
      'beta',
      'stable',
      'deprecated',
    ]);
    expect(Object.keys(componentLifecycleDefinitions)).toEqual(
      componentLifecycleStatuses
    );
  });

  it('preserves existing Stable components and migrates public Beta components', () => {
    const statuses = Object.fromEntries(
      componentMetadata.map(({ name, status }) => [name, status])
    );

    expect(statuses.Accordion).toBe('beta');
    expect(statuses.Switch).toBe('beta');

    for (const name of [
      'Button',
      'Input',
      'Checkbox',
      'Radio',
      'RadioGroup',
      'Select',
      'FormField',
      'Tabs',
      'Dropdown',
      'Modal',
      'Popover',
      'Tooltip',
    ]) {
      expect(statuses[name]).toBe('stable');
    }
  });
});

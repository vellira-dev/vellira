import { describe, expect, it } from 'vitest';

import {
  renderSynchronizedReadmeInventory,
} from './readme-inventory-contract';

const fixture = `# Fixture

<!-- vellira:component-inventory:start -->

Platform availability is generated.

> \`Portal\` and \`PortalProvider\` are support primitives used by overlay components. They are public package infrastructure, not canonical catalog components.

| Component | React | React Native |
| --------- | :---: | :----------: |
| Button    |  ✅   |      ✅      |
| Tooltip   |  ✅   |      ✅      |

<!-- vellira:component-inventory:end -->
`;

function plan(
  componentName: string,
  platforms: readonly ('react' | 'react-native')[]
) {
  return {
    root: '/tmp/vellira',
    componentName,
    targets: platforms.map((packageName) => ({
      packageName,
    })),
  } as never;
}

function inventoryRow(readme: string, name: string) {
  const line = readme
    .split('\n')
    .find((candidate) => candidate.startsWith(`| ${name}`));

  if (!line) return undefined;

  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}

describe('Generator V2 README inventory contract', () => {
  it('adds the next component in canonical name order', () => {
    const result = renderSynchronizedReadmeInventory(
      fixture,
      plan('Notice', ['react', 'react-native'])
    );

    expect(inventoryRow(result, 'Notice')).toEqual(['Notice', '✅', '✅']);
    expect(inventoryRow(result, 'completely wrong')).toBeUndefined();
    expect(result.indexOf('| Button')).toBeLessThan(
      result.indexOf('| Notice')
    );
    expect(result.indexOf('| Notice')).toBeLessThan(
      result.indexOf('| Tooltip')
    );
  });

  it('records platform support from generation targets', () => {
    const result = renderSynchronizedReadmeInventory(
      fixture,
      plan('WebOnly', ['react'])
    );

    expect(inventoryRow(result, 'WebOnly')).toEqual(['WebOnly', '✅', '—']);
  });

  it('updates an existing row instead of duplicating it', () => {
    const first = renderSynchronizedReadmeInventory(
      fixture,
      plan('Button', ['react'])
    );
    const second = renderSynchronizedReadmeInventory(
      first,
      plan('Button', ['react'])
    );

    expect(first).toBe(second);
    expect(first.match(/^\| Button/mg)).toHaveLength(1);
    expect(inventoryRow(first, 'Button')).toEqual(['Button', '✅', '—']);
  });

  it('fails closed when generated inventory markers are unavailable', () => {
    expect(() =>
      renderSynchronizedReadmeInventory(
        '# no generated inventory',
        plan('Notice', ['react'])
      )
    ).toThrow('component-readme-inventory-markers-invalid');
  });
});

import { describe, expect, it } from 'vitest';

import { renderSynchronizedReadmeInventory } from './readme-inventory-contract';

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

describe('Generator V2 README inventory contract', () => {
  it('adds the next component in canonical name order', () => {
    const result = renderSynchronizedReadmeInventory(
      fixture,
      plan('Notice', ['react', 'react-native'])
    );

    expect(result).toMatch(/^\| Notice\s+\|\s+✅\s+\|\s+✅\s+\|$/m);
    expect(result).not.toMatch(/^completely wrong$/m);
    expect(result.indexOf('| Button')).toBeLessThan(result.indexOf('| Notice'));
    expect(result.indexOf('| Notice')).toBeLessThan(
      result.indexOf('| Tooltip')
    );
  });

  it('records platform support from generation targets', () => {
    const result = renderSynchronizedReadmeInventory(
      fixture,
      plan('WebOnly', ['react'])
    );

    expect(result).toMatch(/^\| WebOnly\s+\|\s+✅\s+\|\s+—\s+\|$/m);
    expect(result).not.toMatch(
      /^\| WebOnly\s+\|\s+✅\s+\|\s+✅\s+\|$/m
    );
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
    expect(first).toMatch(/^\| Button\s+\|\s+✅\s+\|\s+—\s+\|$/m);
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

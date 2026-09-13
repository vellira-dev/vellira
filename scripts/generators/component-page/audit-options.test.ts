import { describe, expect, it } from 'vitest';

import { selectComponentPageAuditComponents } from './audit-options';

const components = Object.freeze(['Accordion', 'Button', 'Input']);

describe('component page audit selection', () => {
  it('keeps the full inventory by default without mutating it', () => {
    const selected = selectComponentPageAuditComponents([], components);
    expect(selected).toEqual(components);
    expect(selected).not.toBe(components);
  });

  it('selects one canonical generated component explicitly', () => {
    expect(
      selectComponentPageAuditComponents(['--component', 'Button'], components)
    ).toEqual(['Button']);
  });

  it.each([
    ['--component'],
    ['--component', ''],
    ['--component', '--check'],
    ['Button'],
    ['--unknown'],
    ['--component', 'Button', '--ignore-errors'],
    ['--component', 'Button', '--component', 'Input'],
  ])('rejects malformed or unsupported arguments: %j', (...args) => {
    expect(() => selectComponentPageAuditComponents(args, components)).toThrow(
      /Usage:/
    );
  });

  it.each(['button', 'Missing', '../Button'])(
    'rejects a noncanonical or unknown component: %s',
    (component) => {
      expect(() =>
        selectComponentPageAuditComponents(
          ['--component', component],
          components
        )
      ).toThrow(/Unknown generated component/);
    }
  );

  it('rejects an empty inventory rather than reporting a vacuous pass', () => {
    expect(() => selectComponentPageAuditComponents([], [])).toThrow(
      /No generated component pages/
    );
  });
});

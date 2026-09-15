import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { validateReadmeComponentInventory } from './readme-components';

const readmeUrl = new URL('../README.md', import.meta.url);

async function readCurrentReadme(): Promise<string> {
  return readFile(readmeUrl, 'utf8');
}

describe('README component inventory', () => {
  it('matches canonical metadata', async () => {
    const readme = await readCurrentReadme();

    expect(validateReadmeComponentInventory(readme)).toEqual([]);
  });

  it('detects a missing canonical component', async () => {
    const readme = await readCurrentReadme();
    const drifted = readme.replace(/^\| Switch.*\n/m, '');
    const errors = validateReadmeComponentInventory(drifted);

    expect(errors).toContain('Missing README component: Switch');
  });

  it('detects platform support drift', async () => {
    const readme = await readCurrentReadme();
    const drifted = readme.replace(/^\| Switch.*$/m, '| Switch | — | ✅ |');
    const errors = validateReadmeComponentInventory(drifted);

    expect(errors).toContain('README React support mismatch: Switch');
  });

  it('detects duplicate and extra component rows', async () => {
    const readme = await readCurrentReadme();
    const duplicated = readme.replace(
      '<!-- vellira:component-inventory:end -->',
      '| Button | ✅ | ✅ |\n<!-- vellira:component-inventory:end -->'
    );
    const extra = readme.replace(
      '<!-- vellira:component-inventory:end -->',
      '| Portal | ✅ | ✅ |\n<!-- vellira:component-inventory:end -->'
    );

    expect(validateReadmeComponentInventory(duplicated)).toContain(
      'Duplicate README component: Button'
    );
    expect(validateReadmeComponentInventory(extra)).toContain(
      'Extra README component: Portal'
    );
  });

  it(
    'requires explicit Portal support-infrastructure classification',
    async () => {
      const readme = await readCurrentReadme();
      const drifted = readme.replace(/^> `Portal`.*\n/m, '');
      const errors = validateReadmeComponentInventory(drifted);

      expect(errors).toContain(
        'README must classify Portal as support infrastructure.'
      );
    }
  );
});

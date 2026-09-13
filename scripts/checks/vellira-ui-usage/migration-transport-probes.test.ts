import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkSourceFile, runVelliraUiUsageCheck } from './checker';

const fixturePath =
  'apps/website/scripts/fixtures/migration/app/navigation.jsx';
const source = readFileSync(path.resolve(fixturePath), 'utf8');
const bypasses = (file: string, text: string) =>
  checkSourceFile(file, text).filter(
    ({ ruleId }) => ruleId === 'vellira-ui.existing-component-bypass'
  );

describe('Next migration transport fixture classification', () => {
  it('classifies the three actual transport probes without exceptions', () => {
    // Moving the identical input to maintained product UI must expose all three
    // controls, proving that this test is not passing on an empty fixture.
    expect(bypasses('apps/website/src/navigation.jsx', source)).toHaveLength(3);
    expect(checkSourceFile(fixturePath, source)).toEqual([]);
    const report = runVelliraUiUsageCheck();
    expect(report.findings.filter(({ path }) => path === fixturePath)).toEqual(
      []
    );
    expect(report.exceptions).toEqual([]);
  });

  it('recognizes syntax independently of whitespace and comments', () => {
    expect(
      bypasses(
        fixturePath,
        source.replace(
          'router.refresh()',
          'router /* transport */ . refresh ( )'
        )
      )
    ).toEqual([]);
  });

  it.each([
    'apps/website/scripts/fixtures/migration/app/other.jsx',
    'apps/website/scripts/fixtures/other/app/navigation.jsx',
    'apps/website/src/fixtures/migration/app/navigation.jsx',
    'apps/docs/scripts/fixtures/migration/app/navigation.jsx',
  ])('still scans lookalike path %s', (file) => {
    expect(bypasses(file, source)).toHaveLength(3);
  });

  it.each([
    ["import('./lazy')", "import('./product-widget')"],
    ["import('./lazy-later')", "import('./product-widget')"],
    ['router.refresh()', "router.push('/checkout')"],
    ["id='refresh'", "id='refresh' className='productButton'"],
    ["id='refresh'", "id='refresh' {...productProps}"],
    ["id='refresh'", "id='purchase'"],
    ['() => router.refresh()', '() => { router.refresh(); purchase(); }'],
  ])(
    'rejects a changed probe operation or presentation: %s',
    (before, after) => {
      expect(bypasses(fixturePath, source.replace(before, after))).toHaveLength(
        1
      );
    }
  );

  it('still scans additional controls and design resources in the same fixture', () => {
    const regressed = source.replace(
      '</nav>',
      `<button>Purchase</button><input aria-label='Email' />
       <svg /><div style={{ color: '#123456' }} /></nav>`
    );
    expect(
      checkSourceFile(fixturePath, regressed).map(({ ruleId }) => ruleId)
    ).toEqual([
      'vellira-ui.existing-component-bypass',
      'vellira-ui.existing-component-bypass',
      'vellira-ui.noncanonical-icon',
      'vellira-ui.noncanonical-token-value',
    ]);
  });
});

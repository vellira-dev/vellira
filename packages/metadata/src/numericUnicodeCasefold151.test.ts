import { describe, expect, it } from 'vitest';

import { validateBoundedNumericSeries } from './numericSeriesValidation';
import {
  fullCasefoldUnicode151,
  isCanonicalNumericLabelUnicode151,
  numericLabelKeyUnicode151,
  numericUnicodeCasefoldMappingCount,
  numericUnicodeCasefoldVersion,
} from './numericUnicodeCasefold151';

const data = (labels: readonly string[]) => ({
  series: labels.map((label, i) => ({ id: `s${i}`, label })),
  rows: [],
});

describe('pinned Unicode 15.1 full casefold (proposed Numeric contract)', () => {
  it('pins Unicode 15.1 default C+F mapping cardinality', () => {
    expect(numericUnicodeCasefoldVersion).toBe('15.1.0');
    expect(numericUnicodeCasefoldMappingCount).toBe(1530);
  });

  it.each([
    ['Straße', 'STRASSE'],
    ['é', 'e\u0301'],
    ['Σ', 'ς'],
    ['İ', 'i\u0307'],
    ['ﬃ', 'ffi'],
    ['K', 'k'],
  ])('equates %s and %s using NFC / full casefold', (a, b) => {
    expect(numericLabelKeyUnicode151(a)).toBe(numericLabelKeyUnicode151(b));
    expect(validateBoundedNumericSeries(data([a, b]))).toMatchObject({
      ok: false,
      code: 'duplicate-series-label',
    });
  });

  it.each([
    ['ß', 'ss'],
    ['İ', 'i\u0307'],
    ['ς', 'σ'],
    ['ﬃ', 'ffi'],
  ])(
    'uses full mappings rather than simple JavaScript lowercase: %s',
    (a, folded) => {
      expect(fullCasefoldUnicode151(a)).toBe(folded);
    }
  );

  it.each([
    'A  B',
    ' A',
    'A ',
    'A\tB',
    'A\nB',
    'A\u00a0B',
    'A\u200bB',
    'A\u200dB',
    'A\x00B',
    '',
  ])(
    'rejects noncanonical or invisible label %j in public validator',
    (label) => {
      expect(isCanonicalNumericLabelUnicode151(label)).toBe(false);
      expect(validateBoundedNumericSeries(data([label]))).toMatchObject({
        ok: false,
        code: 'invalid-series-label',
      });
    }
  );

  it('does not rewrite original display labels or equate distinct accents', () => {
    const original = 'e\u0301';
    const input = data(['Revenue', original]);
    const result = validateBoundedNumericSeries(input);
    expect(result.ok).toBe(true);
    expect(input.series[1]?.label).toBe(original);
    expect(numericLabelKeyUnicode151(original)).toBe('é');
    expect(numericLabelKeyUnicode151('e')).not.toBe(
      numericLabelKeyUnicode151('é')
    );
  });

  it('preserves existing safety and numeric grammar HOLD', async () => {
    const { compileComponentProgram } = await import(
      '../../../scripts/component-program/compile'
    );
    const { componentProgramSource } = await import(
      '../../../scripts/component-program/source'
    );
    const { mediaSpec, mediaProgram } = await import(
      '../../../scripts/component-program/fixtures/programs'
    );
    const source = componentProgramSource(mediaSpec());
    const decisions = mediaProgram();
    const output = compileComponentProgram(source, {
      ...decisions,
      modules: [
        ...decisions.modules,
        { id: 'bounded-numeric-series', platforms: ['react'], bindings: {} },
      ],
    });
    expect(output.disposition).toBe('missing-grammar-capability');
    expect(output.program).toBeNull();
  });
});

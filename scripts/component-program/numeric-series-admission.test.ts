import { describe, expect, it } from 'vitest';

import {
  componentIntentCapabilities,
  type ComponentIntentTargetV1,
  validateComponentIntentTarget,
} from '../../packages/metadata/src/componentIntent';
import type { BoundedNumericSeries } from '../../packages/metadata/src/numericSeries';
import { compileComponentProgram } from './compile';
import { mediaProgram, mediaSpec } from './fixtures/programs';
import { componentGrammarV1 } from './grammar';
import { componentProgramSource } from './source';

const proposedModuleIds = [
  'bounded-numeric-series',
  'numeric-data-geometry',
] as const;

describe('numeric data type admission boundary', () => {
  it.each(proposedModuleIds)(
    'does not falsely compile an unadmitted numeric module: %s',
    (id) => {
      const source = componentProgramSource(mediaSpec());
      const decisions = mediaProgram();
      const result = compileComponentProgram(source, {
        ...decisions,
        modules: [
          ...decisions.modules,
          { id, platforms: ['react'], bindings: {} },
        ],
      });

      expect(componentGrammarV1.some((item) => item.id === id)).toBe(false);
      expect(result.disposition).toBe('missing-grammar-capability');
      expect(result.program).toBeNull();
      expect(result.findings).toContainEqual(
        expect.objectContaining({
          code: 'missing-grammar-capability',
          subject: id,
        })
      );
    }
  );

  it('does not claim unadmitted Numeric Intent evidence', () => {
    const target = {
      name: 'NumericDataProbe',
      layer: 'components',
      category: 'data-display',
      profile: 'base',
      platforms: ['react'],
      componentTokens: 'standard',
      intent: {
        schemaVersion: '1',
        job: 'Expose a proposed numeric data contract without runtime admission.',
        requiredCapabilities: ['bounded-numeric-series'],
      },
    } as unknown as ComponentIntentTargetV1;

    expect(componentIntentCapabilities).not.toContain('bounded-numeric-series');
    expect(validateComponentIntentTarget(target)).toEqual([
      expect.stringContaining('unknown capability'),
    ]);
  });

  it('rejects data-bearing module parameters before production', () => {
    const data: BoundedNumericSeries = {
      series: [{ id: 'a', label: 'A' }],
      rows: [{ x: 0, xLabel: '0', values: { a: null } }],
    };
    const decisions = mediaProgram();
    const source = componentProgramSource(mediaSpec());
    const modules = decisions.modules.map((selection, index) => {
      if (index > 0) return selection;
      return { ...selection, parameters: { dataset: data } };
    });
    const result = compileComponentProgram(source, {
      ...decisions,
      modules,
    });

    expect(result.disposition).toBe('blocked');
    expect(result.program).toBeNull();
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: 'invalid-composition',
        reason: expect.stringContaining('bounded strings or safe integers'),
      })
    );
  });
});

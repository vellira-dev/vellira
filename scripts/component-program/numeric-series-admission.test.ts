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
import { proposedNumericGrammarModulesV1 } from './numeric-grammar-proposed';
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

  it('preserves the nine numeric proposal laws outside the active registry', () => {
    const ids = proposedNumericGrammarModulesV1.flatMap((module) =>
      module.obligations.map((proof) => `${module.id}:${proof.id}`)
    );
    expect(ids).toEqual([
      'bounded-numeric-series:bounded-finite-input',
      'bounded-numeric-series:exact-series-alignment',
      'bounded-numeric-series:deterministic-domains',
      'numeric-data-geometry:irregular-x-scale',
      'numeric-data-geometry:signed-y-scale',
      'numeric-data-geometry:truthful-ticks',
      'numeric-data-geometry:null-gap-segmentation',
      'numeric-data-geometry:stable-series-binding',
      'numeric-data-geometry:semantic-table-parity',
    ]);
    expect(proposedNumericGrammarModulesV1[1].requires).toEqual([
      'bounded-numeric-series',
    ]);
    expect(
      proposedNumericGrammarModulesV1.every(
        (module) =>
          module.platforms.length === 1 && module.platforms[0] === 'react'
      )
    ).toBe(true);
    expect(
      proposedModuleIds.every(
        (id) => !componentGrammarV1.some((module) => module.id === id)
      )
    ).toBe(true);
  });

  it.each(proposedModuleIds)(
    'rejects an indirect registry implication of %s before proof',
    (id) => {
      const source = componentProgramSource(mediaSpec());
      const decisions = mediaProgram();
      const previous = compileComponentProgram(source, decisions);
      expect(previous.disposition).toBe('compiled');
      const reference = componentGrammarV1.find(
        (module) => module.id === 'accessible-name'
      );
      if (!reference) throw new Error('Missing existing grammar reference.');
      const numeric = {
        ...reference,
        id,
        capabilities: [],
        implies: [],
      };
      const bridge = {
        ...reference,
        id: 'numeric-bridge-probe',
        capabilities: [],
        implies: [id],
      };
      for (const componentName of ['PortraitProbe', 'RenamedNumericProbe']) {
        const scopedSource = componentProgramSource({
          ...mediaSpec(),
          componentName,
        });
        const denied = compileComponentProgram(
          scopedSource,
          {
            ...decisions,
            modules: [
              ...decisions.modules,
              { id: bridge.id, platforms: ['react'], bindings: {} },
            ],
          },
          [...componentGrammarV1, numeric, bridge]
        );
        expect(denied).toMatchObject({
          disposition: 'missing-grammar-capability',
          program: null,
          fingerprint: null,
        });
        expect(denied.findings).toContainEqual(
          expect.objectContaining({
            code: 'missing-grammar-capability',
            subject: id,
          })
        );
      }
      expect(compileComponentProgram(source, decisions)).toEqual(previous);
    }
  );

  it.each(proposedModuleIds)(
    'rejects an injected registry attempting to admit %s before proof',
    (id) => {
      const source = componentProgramSource(mediaSpec());
      const decisions = mediaProgram();
      const previous = compileComponentProgram(source, decisions);
      expect(previous.disposition).toBe('compiled');

      const reference = componentGrammarV1.find(
        (module) => module.id === 'accessible-name'
      );
      if (!reference) throw new Error('Missing existing grammar reference.');
      const injected = {
        ...reference,
        id,
        platforms: ['react'] as const,
        capabilities: [],
        adapters: { react: 'semantic-contract' },
        obligations: reference.obligations.map((proof) => ({
          ...proof,
          platforms: ['react'] as const,
        })),
      };
      for (const componentName of ['PortraitProbe', 'RenamedNumericProbe']) {
        const scopedSource = componentProgramSource({
          ...mediaSpec(),
          componentName,
        });
        const denied = compileComponentProgram(
          scopedSource,
          {
            ...decisions,
            modules: [
              ...decisions.modules,
              { id, platforms: ['react'], bindings: {} },
            ],
          },
          [...componentGrammarV1, injected]
        );
        expect(denied).toMatchObject({
          disposition: 'missing-grammar-capability',
          program: null,
          fingerprint: null,
        });
        expect(denied.findings).toContainEqual(
          expect.objectContaining({
            code: 'missing-grammar-capability',
            subject: id,
          })
        );
      }
      // Neither custom registry input nor the inert proposal mutates defaults.
      expect(compileComponentProgram(source, decisions)).toEqual(previous);
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

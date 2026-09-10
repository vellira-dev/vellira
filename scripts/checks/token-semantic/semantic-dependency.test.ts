import { describe, expect, it } from 'vitest';

import {
  auditComponentDependencySource,
  checkTokenSemanticDependencies,
} from './semantic-dependency';

const root = process.cwd();

describe('semantic dependency audit adapter', () => {
  it('checks the maintained #888 dependency baseline without findings', () => {
    const result = checkTokenSemanticDependencies(root);
    expect(result.coverage).toBe('partial');
    expect(result.checked).toBeGreaterThan(0);
    expect(result.findings).toEqual([]);
  });

  it('rejects primitive-color usage without an explicit classification', () => {
    expect(
      auditComponentDependencySource({
        sourcePath: 'fixture.ts',
        source: "import { colors } from '../../primitives/colors.js';\n",
        component: 'probe',
        factory: 'createProbeTokens',
        primitiveColorUsage: ['none'],
      })
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'primitive-color-classification-drift',
        }),
      ])
    );
  });

  it('rejects an unregistered cross-component factory dependency', () => {
    expect(
      auditComponentDependencySource({
        sourcePath: 'fixture.ts',
        source:
          "import { createButtonTokens } from '../../factories/components/createButtonTokens.js';\n",
        component: 'probe',
        factory: 'createProbeTokens',
        primitiveColorUsage: ['none'],
      })
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unregistered-component-dependency' }),
      ])
    );
  });

  it('rejects maintained dependencies on deprecated action semantics', () => {
    expect(
      auditComponentDependencySource({
        sourcePath: 'fixture.ts',
        source: "import { action } from '../semantic/action.js';\n",
        component: 'probe',
        factory: 'createProbeTokens',
        primitiveColorUsage: ['none'],
      })
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'deprecated-action-semantic-dependency',
        }),
      ])
    );
  });
});

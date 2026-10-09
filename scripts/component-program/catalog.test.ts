import { describe, expect, it } from 'vitest';
import { componentMetadata } from '../../packages/metadata/src/components';
import { componentExpansionCatalog } from '../../packages/metadata/src/expansionCatalog';
import { auditComponentGrammarCatalog } from './catalog';
import { canonicalProgramJson } from './compile';

describe('grammar coverage derives from canonical public authority', () => {
  it('reports every current component and target without claiming full API synthesis', () => {
    const report = auditComponentGrammarCatalog();
    expect(report.distinctCount).toBe(
      new Set(
        [...componentMetadata, ...componentExpansionCatalog].map(
          (item) => item.name
        )
      ).size
    );
    expect(report.capabilityExpressibleCount).toBe(report.distinctCount);
    expect(report.completeProgramCount).toBe(0);
    expect(
      report.rows.every((row) =>
        row.proofAuthorities.canonicalStages.includes('visual')
      )
    ).toBe(true);
  });

  it('normalizes catalog iteration order and follows reserved-to-current transitions', () => {
    const initial = auditComponentGrammarCatalog();
    expect(
      canonicalProgramJson(
        auditComponentGrammarCatalog(
          [...componentMetadata].reverse(),
          [...componentExpansionCatalog].reverse()
        )
      )
    ).toBe(canonicalProgramJson(initial));
    const synthetic = {
      ...componentExpansionCatalog[2],
      name: 'FutureMediaProbe',
    };
    const component = {
      ...synthetic,
      status: 'experimental' as const,
      capabilities: [],
      semanticCapabilities: synthetic.intent.requiredCapabilities,
      requirements: {
        tests: true,
        docs: true,
        storybook: true,
        accessibility: true,
        componentTokens: synthetic.componentTokens,
      },
    };
    const before = auditComponentGrammarCatalog(componentMetadata, [
      ...componentExpansionCatalog,
      synthetic,
    ]);
    const after = auditComponentGrammarCatalog(
      [...componentMetadata, component],
      [...componentExpansionCatalog, synthetic]
    );
    expect(after.distinctCount).toBe(before.distinctCount);
    expect(after.capabilityExpressibleCount).toBe(
      before.capabilityExpressibleCount
    );
    expect(
      after.rows.find((row) => row.identity === synthetic.name)!.registered
    ).toBe(true);
  });
});

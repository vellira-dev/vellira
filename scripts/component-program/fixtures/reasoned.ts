import type { ComponentProductionInputV1 } from '../../component-production/contracts';

/** Generic source decisions; no implementation or execution approval. */
export function reasonedSpec(
  componentName = 'StateNotice'
): ComponentProductionInputV1 {
  const both = ['react', 'react-native'] as const;
  return {
    schemaVersion: '1',
    componentName,
    platform: 'both',
    layer: 'components',
    category: 'feedback',
    profile: 'base',
    capabilities: ['controlled', 'uncontrolled'],
    semanticCapabilities: [],
    parts: [],
    componentTokens: 'standard',
    componentProgram: {
      schemaVersion: '1',
      anatomy: [{ id: 'Root', role: 'root', parent: null }],
      states: [
        {
          id: 'visible',
          domain: 'boolean',
          ownership: 'controlled-uncontrolled',
          api: 'open',
          change: {
            schemaVersion: '1',
            platforms: both,
            transitions: ['to-false', 'to-true'],
            emitTransitions: ['to-false'],
            reasonDomain: {
              id: 'close-reason',
              values: ['action', 'dismiss', 'timeout'].map((value) => ({
                value,
                transitions: ['to-false'],
              })),
            },
          },
        },
      ],
      transitions: [
        { state: 'visible', event: 'press', action: 'close', platforms: both },
        { state: 'visible', event: 'open', action: 'open', platforms: both },
      ],
      modules: [{ id: 'state-control', platforms: both, bindings: {} }],
    },
  };
}

import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { componentIntentCapabilities } from '../../packages/metadata/src/componentIntent';
import type { ComponentProgramDecisionsV1 } from '../../packages/metadata/src/componentProgram';
import {
  canonicalProgramJson,
  compileComponentProgram,
  programDigest,
  validateComponentGrammar,
  verifyComponentProgram,
} from './compile';
import { compileProductionProgram } from './cli';
import { componentGrammarV1 } from './grammar';
import { componentProgramSource } from './source';
import {
  collectionSpec,
  formSpec,
  mediaProgram,
  mediaSpec,
  overlaySpec,
  temporalSpec,
} from './fixtures/programs';
import { createComponentGenerationPlan } from '../generators/component/plan';
import { createComponentProductionGeneratorOptions } from '../component-production/contracts';

const compileMedia = (decisions: unknown = mediaProgram()) =>
  compileComponentProgram(componentProgramSource(mediaSpec()), decisions);

describe('public Component Program composition authority', () => {
  it('does not flatten a discriminated selection contract into an unsafe union', () => {
    const spec = collectionSpec();
    const result = compileProductionProgram({
      ...spec,
      componentProgram: {
        ...spec.componentProgram!,
        states: spec.componentProgram!.states.map((state) =>
          state.domain === 'selection'
            ? { ...state, domain: 'selection-union' }
            : state
        ),
      },
    });
    expect(
      result.findings.some(
        (item) =>
          item.code === 'semantic-decision-required' &&
          item.reason.includes('discriminated')
      )
    ).toBe(true);
    expect(result.program).toBeNull();
  });
  it('rejects contradictory transitions and behavior outside public intent', () => {
    const decisions = mediaProgram();
    expect(
      compileMedia({
        ...decisions,
        transitions: [
          ...decisions.transitions,
          {
            state: 'sourceStatus',
            event: 'load',
            action: 'reject',
            platforms: ['react'],
          },
        ],
      }).findings.some((item) => item.reason.includes('Contradictory'))
    ).toBe(true);
    expect(
      compileMedia({
        ...decisions,
        modules: [
          ...decisions.modules,
          { id: 'responsive-layout', platforms: ['react'], bindings: {} },
        ],
      }).findings.some((item) => item.reason.includes('exceeds public source'))
    ).toBe(true);
    expect(
      compileMedia({
        ...decisions,
        transitions: [
          ...decisions.transitions,
          {
            state: 'sourceStatus',
            event: 'press',
            action: 'pause',
            platforms: ['react'],
          },
        ],
      }).disposition
    ).toBe('blocked');
  });

  it('keeps browser-only pause proof out of native scope and structural checks below behavioral proof', () => {
    const temporal = compileProductionProgram(temporalSpec()).program!;
    expect(
      temporal.obligations
        .filter((proof) => proof.id === 'auto-dismiss:remaining-budget')
        .map((proof) => proof.platform)
    ).toEqual(['react']);
    const form = compileProductionProgram(formSpec()).program!;
    expect(
      form.obligations.find((proof) => proof.id === 'field-state:field-state')!
        .evaluation
    ).toBe('human-review');
    expect(
      form.obligations.find(
        (proof) => proof.id === 'field-state:field-state-structural'
      )!.ruleId
    ).toBe('platform.accessibility-semantics');
  });
  it('requires explicit temporal and overflow policy rather than provider inference', () => {
    const spec = temporalSpec();
    const decisions = spec.componentProgram!;
    const unresolved = {
      ...spec,
      componentProgram: {
        ...decisions,
        modules: decisions.modules.map((module) => ({
          ...module,
          parameters: {},
        })),
      },
    };
    expect(compileProductionProgram(unresolved).disposition).toBe(
      'review-required'
    );
    const invalid = {
      ...spec,
      componentProgram: {
        ...decisions,
        modules: decisions.modules.map((module) =>
          module.id === 'stacking'
            ? {
                ...module,
                parameters: {
                  'maximum-visible': 3,
                  overflow: 'provider-decides',
                },
              }
            : module
        ),
      },
    };
    expect(compileProductionProgram(invalid).disposition).toBe('blocked');
    const changed = {
      ...spec,
      componentProgram: {
        ...decisions,
        modules: decisions.modules.map((module) =>
          module.id === 'stacking'
            ? {
                ...module,
                parameters: { 'maximum-visible': 4, overflow: 'queue' },
              }
            : module
        ),
      },
    };
    expect(compileProductionProgram(changed).fingerprint).not.toBe(
      compileProductionProgram(spec).fingerprint
    );
  });
  it.each([mediaSpec, temporalSpec, formSpec, overlaySpec, collectionSpec])(
    'expresses distinct archetypes through reusable modules: %s',
    (factory) => {
      const result = compileProductionProgram(factory());
      expect(result.findings).toEqual([]);
      expect(result.disposition).toBe('compiled');
      expect(result.program!.obligations.length).toBeGreaterThan(0);
      expect(result.program!.platformPlans).toHaveLength(2);
    }
  );

  it('covers exactly the existing public capability vocabulary without a private catalog', () => {
    expect(
      [
        ...new Set(componentGrammarV1.flatMap((module) => module.capabilities)),
      ].sort()
    ).toEqual([...componentIntentCapabilities].sort());
  });

  it('canonicalizes order and duplicate module selections for identical replay bytes', () => {
    const decisions = mediaProgram();
    const expected = compileMedia(decisions);
    const permuted = {
      ...decisions,
      anatomy: [...decisions.anatomy].reverse(),
      states: [...decisions.states].reverse(),
      transitions: [...decisions.transitions].reverse(),
      modules: [...decisions.modules, decisions.modules[0]].reverse(),
    };
    expect(canonicalProgramJson(compileMedia(permuted))).toBe(
      canonicalProgramJson(expected)
    );
    expect(expected.fingerprint).toBe(
      programDigest('component-program-v1', expected.program)
    );
  });

  it.each(['UnexpectedFutureIdentity', 'Avatar', 'Toast'])(
    'names cannot select or override semantics: %s',
    (componentName) => {
      expect(
        compileProductionProgram({ ...mediaSpec(), componentName })
      ).toEqual(compileProductionProgram(mediaSpec()));
      expect(
        compileProductionProgram({
          ...mediaSpec(),
          componentName,
          componentProgram: { ...mediaProgram(), modules: [] },
        }).disposition
      ).not.toBe('compiled');
    }
  );

  it('fails closed on unknown modules and missing future primitives', () => {
    const decisions = mediaProgram();
    const result = compileMedia({
      ...decisions,
      modules: [
        ...decisions.modules,
        { id: 'drag-transaction', platforms: ['react'], bindings: {} },
      ],
    });
    expect(result.disposition).toBe('missing-grammar-capability');
    expect(result.program).toBeNull();
    expect(result.findings[0].subject).toBe('drag-transaction');
  });

  it.each([
    { ...mediaProgram(), schemaVersion: '2' },
    { ...mediaProgram(), customCode: 'providerHook()' },
    {
      ...mediaProgram(),
      states: [{ ...mediaProgram().states[0], hiddenOwner: 'provider' }],
    },
    {
      ...mediaProgram(),
      modules: [{ id: 'image-source', platforms: ['dom'], bindings: {} }],
    },
  ])(
    'rejects unsupported schema, opaque escape hatches and platform scope',
    (decisions) => {
      expect(compileMedia(decisions).disposition).toBe('blocked');
    }
  );

  it('requires declared dependencies before implementation', () => {
    expect(
      compileMedia({
        ...mediaProgram(),
        modules: mediaProgram().modules.filter(
          (module) => module.id !== 'image-source'
        ),
      }).findings
    ).toContainEqual(
      expect.objectContaining({
        code: 'invalid-composition',
        reason: expect.stringContaining('Requires image-source'),
      })
    );
  });

  it('derives implication closure once, including shared state and proof obligations', () => {
    const result = compileProductionProgram(temporalSpec());
    expect(
      result.program!.decisions.modules.find(
        (module) => module.id === 'dismissible'
      )!.bindings
    ).toEqual({ open: 'visible' });
    expect(result.program!.order.indexOf('dismissible')).toBeLessThan(
      result.program!.order.indexOf('auto-dismiss')
    );
    expect(
      result.program!.obligations.some(
        (item) => item.id === 'dismissible:close-once'
      )
    ).toBe(true);
    verifyComponentProgram(
      result.program!,
      result.fingerprint!,
      componentProgramSource(temporalSpec())
    );
  });

  it('rejects contradictory selection protocols instead of silently choosing one', () => {
    const spec = collectionSpec();
    const decisions = spec.componentProgram!;
    const result = compileProductionProgram({
      ...spec,
      componentProgram: {
        ...decisions,
        modules: [
          ...decisions.modules,
          {
            id: 'multiple-selection',
            platforms: ['react', 'react-native'],
            bindings: { value: 'selected' },
          },
          {
            id: 'radio-semantics',
            platforms: ['react', 'react-native'],
            bindings: { value: 'selected' },
          },
        ],
      },
    });
    expect(result.disposition).toBe('blocked');
    expect(
      result.findings.some((item) => item.reason.includes('Conflicts'))
    ).toBe(true);
  });

  it('rejects cyclic dependency and implication mutations', () => {
    const registry = componentGrammarV1.map((module) =>
      module.id === 'dismissible'
        ? { ...module, implies: ['auto-dismiss'] }
        : module
    );
    expect(() => validateComponentGrammar(registry)).toThrow(
      'Cyclic dependency'
    );
  });

  it('rejects missing proof authority and unknown dependency targets', () => {
    expect(() =>
      validateComponentGrammar(
        componentGrammarV1.map((module) =>
          module.id === 'image-source' ? { ...module, obligations: [] } : module
        )
      )
    ).toThrow('proof');
    expect(() =>
      validateComponentGrammar(
        componentGrammarV1.map((module) =>
          module.id === 'image-source'
            ? { ...module, requires: ['unknown'] }
            : module
        )
      )
    ).toThrow('Invalid module relation');
  });

  it('rejects platform-only behavior in a shared program', () => {
    const registry = componentGrammarV1.map((module) =>
      module.id === 'accessible-name'
        ? {
            ...module,
            platforms: ['react'] as const,
            adapters: { react: 'dom-name' },
            obligations: module.obligations.map((proof) => ({
              ...proof,
              platforms: ['react'] as const,
            })),
          }
        : module
    );
    expect(
      compileComponentProgram(
        componentProgramSource(mediaSpec()),
        mediaProgram(),
        registry
      ).findings
    ).toContainEqual(
      expect.objectContaining({
        reason: expect.stringContaining('Platform-only'),
      })
    );
  });

  it('uses different announcement mechanisms for one shared obligation', () => {
    const result = compileProductionProgram(temporalSpec());
    expect(
      result.program!.platformPlans.map(
        (plan) =>
          plan.modules.find((module) => module.id === 'announcement')!.adapter
      )
    ).toEqual(['bounded-dom-live-region', 'native-accessibility-announcement']);
    expect(
      result
        .program!.obligations.filter((item) => item.module === 'announcement')
        .map((item) => item.id)
    ).toEqual(['announcement:announcement', 'announcement:announcement']);
  });

  it('derives only uniquely selected API consequences', () => {
    const result = compileProductionProgram(formSpec());
    expect(
      result.program!.apiConsequences.map((item) => item.name).sort()
    ).toEqual(['defaultValue', 'onValueChange', 'value']);
    expect(
      result.program!.apiConsequences.every(
        (item) => item.valueType === 'string'
      )
    ).toBe(true);
    const spec = formSpec();
    expect(
      compileProductionProgram({
        ...spec,
        componentProgram: {
          ...spec.componentProgram!,
          states: [
            { ...spec.componentProgram!.states[0], api: 'review-required' },
          ],
        },
      }).disposition
    ).toBe('review-required');
  });

  it('rejects duplicate state authority, invalid domains and unbound state', () => {
    const decisions = mediaProgram();
    expect(
      compileMedia({
        ...decisions,
        states: [
          ...decisions.states,
          { ...decisions.states[0], ownership: 'read-only' },
        ],
      }).disposition
    ).toBe('blocked');
    expect(
      compileMedia({
        ...decisions,
        states: [{ ...decisions.states[0], domain: 'boolean' }],
      }).disposition
    ).toBe('blocked');
    expect(compileMedia({ ...decisions, states: [] }).disposition).not.toBe(
      'compiled'
    );
  });

  it('rejects divergent shared state owners', () => {
    const decisions = mediaProgram();
    const result = compileMedia({
      ...decisions,
      states: [...decisions.states, { ...decisions.states[0], id: 'other' }],
      modules: decisions.modules.map((module) =>
        module.id === 'image-fallback'
          ? { ...module, bindings: { image: 'other' } }
          : module
      ),
    });
    expect(
      result.findings.some((item) =>
        item.reason.includes('conflicting authority')
      )
    ).toBe(true);
  });

  it('requires cleanup and rejects motion changing a deadline', () => {
    const spec = temporalSpec();
    const decisions = spec.componentProgram!;
    expect(
      compileProductionProgram({
        ...spec,
        componentProgram: {
          ...decisions,
          transitions: decisions.transitions.filter(
            (item) => item.event !== 'unmount'
          ),
        },
      }).disposition
    ).toBe('review-required');
    expect(
      compileProductionProgram({
        ...spec,
        componentProgram: {
          ...decisions,
          transitions: [
            ...decisions.transitions,
            {
              state: 'deadline',
              event: 'motion-preference',
              action: 'reset',
              platforms: ['react'],
            },
          ],
        },
      }).disposition
    ).toBe('blocked');
  });

  it('preserves identity and rejects changed semantics or source under the same fingerprint', () => {
    const result = compileMedia();
    const source = componentProgramSource(mediaSpec());
    verifyComponentProgram(result.program!, result.fingerprint!, source);
    expect(() =>
      verifyComponentProgram(
        { ...result.program!, order: [] },
        result.fingerprint!,
        source
      )
    ).toThrow('drift');
    expect(() =>
      verifyComponentProgram(result.program!, result.fingerprint!, {
        ...source,
        resources: { ...source.resources, componentTokens: false },
      })
    ).toThrow('drift');
    const modified = compileComponentProgram(
      { ...source, resources: { ...source.resources, componentTokens: false } },
      mediaProgram()
    );
    expect(modified.fingerprint).not.toBe(result.fingerprint);
  });

  it('exposes registry-edge removal as material authority drift', () => {
    const registry = componentGrammarV1.map((module) =>
      module.id === 'image-fallback' ? { ...module, requires: [] } : module
    );
    const result = compileComponentProgram(
      componentProgramSource(mediaSpec()),
      mediaProgram(),
      registry
    );
    expect(result.disposition).toBe('compiled');
    expect(result.fingerprint).not.toBe(compileMedia().fingerprint);
    expect(() =>
      verifyComponentProgram(
        result.program!,
        result.fingerprint!,
        componentProgramSource(mediaSpec())
      )
    ).toThrow('drift');
  });

  it('blocks generation for unresolved programs and leaves legacy plans compatible', () => {
    const spec = mediaSpec();
    const options = createComponentProductionGeneratorOptions(spec);
    expect(
      createComponentGenerationPlan({ root: '/synthetic', options })
        .componentProgram!.disposition
    ).toBe('compiled');
    expect(() =>
      createComponentGenerationPlan({
        root: '/synthetic',
        options: {
          ...options,
          componentProgram: { ...mediaProgram(), modules: [] },
        },
      })
    ).toThrow('review-required');
    const legacy = { ...options };
    delete legacy.componentProgram;
    expect(
      createComponentGenerationPlan({ root: '/synthetic', options: legacy })
    ).not.toHaveProperty('componentProgram');
  });

  it('adds one reviewed reusable extension without touching component consumers by name', () => {
    const extension = {
      ...componentGrammarV1.find((module) => module.id === 'accessible-name')!,
      id: 'reviewed-name-association',
      capabilities: [],
    };
    const decisions: ComponentProgramDecisionsV1 = {
      ...mediaProgram(),
      modules: [
        ...mediaProgram().modules,
        { id: extension.id, platforms: ['react'], bindings: {} },
      ],
    };
    const registry = [...componentGrammarV1, extension];
    const result = compileComponentProgram(
      componentProgramSource(mediaSpec()),
      decisions,
      registry
    );
    expect(result.disposition).toBe('compiled');
    expect(result.program!.order).toContain(extension.id);
  });

  it('bounds the graph and rejects anatomy cycles and opaque provider replacement', () => {
    expect(
      compileMedia({
        ...mediaProgram(),
        states: Array.from({ length: 33 }, (_, index) => ({
          ...mediaProgram().states[0],
          id: `s${index}`,
        })),
      }).disposition
    ).toBe('blocked');
    expect(
      compileMedia({
        ...mediaProgram(),
        anatomy: [{ id: 'Root', role: 'root', parent: 'Root' }],
      }).disposition
    ).toBe('blocked');
    expect(
      compileMedia({ ...mediaProgram(), providerSemantics: { allow: true } })
        .disposition
    ).toBe('blocked');
  });

  it('keeps the compiler and registry free of component identity dispatch', () => {
    for (const file of ['compile.ts', 'grammar.ts', 'parse.ts']) {
      const text = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(text).not.toMatch(/\b(?:Avatar|Toast|Select|Modal|Button)\b/);
      expect(text).not.toMatch(/\bcomponentName\b/);
    }
  });
});

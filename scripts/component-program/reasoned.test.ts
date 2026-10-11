import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileProductionProgram } from './cli';
import {
  canonicalProgramJson,
  compileComponentProgram,
  programDigest,
  verifyComponentProgram,
} from './compile';
import { componentProgramSource } from './source';
import * as fixtures from './fixtures/programs';
import { reasonedSpec } from './fixtures/reasoned';

const compile = (spec: unknown) => compileProductionProgram(spec);
const changed = () => JSON.parse(JSON.stringify(reasonedSpec()));

describe('reason-bearing state callback projection', () => {
  it.each(['StateNotice', 'UncataloguedToggle'])(
    'compiles exact closing reasons for %s',
    (name) => {
      const result = compile(reasonedSpec(name));
      expect(result.disposition).toBe('compiled');
      const callback = result.program!.apiConsequences.find(
        (item) => item.kind === 'change'
      )!;
      expect(callback.typeExpression).toBe(
        "(open: boolean, details: { reason: 'action' | 'dismiss' | 'timeout' }) => void"
      );
      expect(callback.change!.emitTransitions).toEqual(['to-false']);
      expect(callback.change!.transitions).toEqual(['to-false', 'to-true']);
      expect(result.fingerprint).toBe(compile(reasonedSpec()).fingerprint);
      expect(() =>
        verifyComponentProgram(
          result.program!,
          result.fingerprint!,
          result.program!.source
        )
      ).not.toThrow();
    }
  );

  it('normalizes reason and transition order without changing meaning', () => {
    const spec = changed();
    const change = spec.componentProgram.states[0].change;
    change.reasonDomain.values.reverse();
    change.transitions.reverse();
    change.platforms.reverse();
    expect(compile(spec)).toEqual(compile(reasonedSpec()));
  });

  it.each(['react', 'react-native'] as const)(
    'projects an exact single-platform source: %s',
    (platform) => {
      const spec = changed();
      spec.platform = platform === 'react' ? 'web' : 'native';
      const program = spec.componentProgram;
      program.states[0].change.platforms = [platform];
      for (const item of [...program.modules, ...program.transitions])
        item.platforms = [platform];
      const result = compile(spec);
      expect(result.disposition).toBe('compiled');
      expect(
        result.program!.apiConsequences.find((item) => item.change)!.change!
          .platforms
      ).toEqual([platform]);
    }
  );

  it.each([
    'empty-domain',
    'duplicate-reason',
    'unknown-field',
    'unscoped-reason',
    'missing-emission',
    'unsupported-version',
    'null-change',
    'extra-transition',
    'uncovered-emission',
    'emission-outside-state',
    'wrong-platform',
    'reason-platform-injection',
    'missing-ownership',
    'internal-owner',
    'uncontrolled-only',
    'missing-source-controlled',
    'missing-source-uncontrolled',
    'nonboolean',
    'ambiguous-transition',
    'wrong-state-transition',
  ])('rejects %s', (mutation) => {
    const spec = changed();
    const state = spec.componentProgram.states[0];
    const change = state.change;
    if (mutation === 'empty-domain') change.reasonDomain.values = [];
    if (mutation === 'duplicate-reason')
      change.reasonDomain.values.push(change.reasonDomain.values[0]);
    if (mutation === 'unknown-field') change.approved = true;
    if (mutation === 'unscoped-reason')
      change.reasonDomain.values[0].transitions = [];
    if (mutation === 'missing-emission') delete change.emitTransitions;
    if (mutation === 'unsupported-version') change.schemaVersion = '2';
    if (mutation === 'null-change') state.change = null;
    if (mutation === 'extra-transition')
      change.reasonDomain.values[0].transitions.push('to-true');
    if (mutation === 'uncovered-emission')
      change.emitTransitions.push('to-true');
    if (mutation === 'emission-outside-state') change.transitions = ['to-true'];
    if (mutation === 'wrong-platform') change.platforms = ['react'];
    if (mutation === 'reason-platform-injection')
      change.reasonDomain.values[0].platforms = ['react'];
    if (mutation === 'missing-ownership') delete state.ownership;
    if (mutation === 'internal-owner') state.ownership = 'internal';
    if (mutation === 'uncontrolled-only') state.ownership = 'uncontrolled';
    if (mutation === 'missing-source-controlled')
      spec.capabilities = ['uncontrolled'];
    if (mutation === 'missing-source-uncontrolled')
      spec.capabilities = ['controlled'];
    if (mutation === 'nonboolean') {
      state.domain = 'text';
      state.api = 'value';
    }
    if (mutation === 'ambiguous-transition')
      spec.componentProgram.transitions[0].action = 'request-change';
    if (mutation === 'wrong-state-transition')
      change.transitions = ['to-false'];
    const result = compileComponentProgram(
      componentProgramSource(spec),
      spec.componentProgram
    );
    expect(result.disposition).not.toBe('compiled');
    expect(result.program).toBeNull();
    expect(result.fingerprint).toBeNull();
  });

  it.each(['wrong', 'missing', 'additional', 'opening'])(
    'cannot reuse approved identity after %s reason mutation',
    (mutation) => {
      const result = compile(reasonedSpec());
      const program = JSON.parse(canonicalProgramJson(result.program));
      const callback = program.apiConsequences.find(
        (item: { kind: string }) => item.kind === 'change'
      );
      if (mutation === 'wrong')
        callback.change.reasonDomain.values[0].value = 'other';
      if (mutation === 'missing') callback.change.reasonDomain.values.pop();
      if (mutation === 'additional')
        callback.change.reasonDomain.values.push({
          value: 'other',
          transitions: ['to-false'],
        });
      if (mutation === 'opening') callback.change.emitTransitions = ['to-true'];
      expect(() =>
        verifyComponentProgram(
          program,
          result.fingerprint!,
          result.program!.source
        )
      ).toThrow(/projection drift/);
      // Even recomputing a hash cannot substitute fabricated consequences for compilation.
      expect(() =>
        verifyComponentProgram(
          program,
          programDigest('component-program-v1', program),
          result.program!.source
        )
      ).toThrow(/projection drift/);
    }
  );

  it('retains baseline APIs, full serialization and fingerprints without opt-in', () => {
    // Recorded from public d498a56b before this extension; never regenerate for a failure.
    const baseline = JSON.parse(
      fs.readFileSync(
        new URL('./fixtures/flat-callback-baseline.json', import.meta.url),
        'utf8'
      )
    );
    for (const name of [
      'media',
      'form',
      'temporal',
      'overlay',
      'collection',
    ] as const) {
      const result = compile(fixtures[`${name}Spec`]());
      expect(result.fingerprint).toBe(baseline[name].fingerprint);
      expect(programDigest('baseline', result)).toBe(
        baseline[name].serialization
      );
      expect(result.program!.apiConsequences).toEqual(baseline[name].api);
    }
  });
});

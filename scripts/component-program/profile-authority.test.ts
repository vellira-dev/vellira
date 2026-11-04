import { describe, expect, it } from 'vitest';

import { createComponentProductionGeneratorOptions } from '../component-production/contracts';
import { createComponentGenerationPlan } from '../generators/component/plan';
import { createComponentMetadataFromPlan } from '../generators/component/metadata';
import { compileProductionProgram } from './cli';
import { componentProgramSource } from './source';
import {
  collectionSpec,
  formSpec,
  mediaSpec,
  overlaySpec,
  temporalSpec,
} from './fixtures/programs';
import { reasonedSpec } from './fixtures/reasoned';

describe('profile capability authority', () => {
  it.each([mediaSpec, formSpec, overlaySpec, collectionSpec, temporalSpec])(
    'preserves complete programs and agrees with generator metadata',
    (fixture) => {
      const input = fixture();
      const source = componentProgramSource(input);
      const plan = createComponentGenerationPlan({
        root: process.cwd(),
        options: createComponentProductionGeneratorOptions(input),
      });
      const metadata = createComponentMetadataFromPlan(plan);
      for (const capability of metadata.capabilities ?? []) {
        expect(source.capabilities).toContainEqual({
          capability,
          platforms: [...metadata.platforms].sort(),
        });
      }
      expect(compileProductionProgram(input).disposition).toBe('compiled');
    }
  );

  it.each(['SignalShelf', 'OtherOverlay'])(
    'rejects an incomplete overlay program before generation: %s',
    (name) => {
      const input = { ...reasonedSpec(name), profile: 'overlay' as const };
      const result = compileProductionProgram(input);
      expect(result.disposition).not.toBe('compiled');
      expect(result.program).toBeNull();
      const findings = JSON.stringify(result.findings);
      expect(findings).toContain('keyboard');
      expect(findings).toContain('focus-management');
      expect(() =>
        createComponentGenerationPlan({
          root: process.cwd(),
          options: createComponentProductionGeneratorOptions(input),
        })
      ).toThrow('Component Program');
    }
  );

  it('requires inherited field-state obligations even when the caller omits them', () => {
    const input = formSpec();
    input.capabilities = ['controlled', 'uncontrolled'];
    input.componentProgram!.modules = input.componentProgram!.modules.filter(
      (module) => module.id !== 'field-state'
    );
    const result = compileProductionProgram(input);
    expect(result.disposition).not.toBe('compiled');
    expect(result.program).toBeNull();
    for (const capability of ['disabled', 'required', 'invalid']) {
      expect(JSON.stringify(result.findings)).toContain(capability);
    }
  });

  it('rejects the historical temporal/overlay mismatch without adding implicit modules', () => {
    const input = { ...temporalSpec(), profile: 'overlay' as const };
    const before = structuredClone(input);
    const result = compileProductionProgram(input);
    expect(result.disposition).toBe('review-required');
    expect(result.program).toBeNull();
    expect(input).toEqual(before);
    for (const capability of [
      'keyboard',
      'focus-management',
      'compound-api',
      'portal',
    ]) {
      expect(JSON.stringify(result.findings)).toContain(capability);
    }
  });

  it('accepts implicitly inherited capabilities only with their full program', () => {
    const input = formSpec();
    input.capabilities = ['controlled', 'uncontrolled'];
    expect(compileProductionProgram(input)).toEqual(
      compileProductionProgram(formSpec())
    );
  });

  it('keeps Web-only profile obligations out of Native source scope', () => {
    const source = componentProgramSource({
      ...overlaySpec(),
      platform: 'web',
    });
    expect(
      source.capabilities.every(
        (row) => row.platforms.length === 1 && row.platforms[0] === 'react'
      )
    ).toBe(true);
  });
});

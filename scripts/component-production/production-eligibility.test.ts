import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { componentExpansionCatalog } from '@vellira-ui/metadata';
import {
  copyTokenLifecycleFixture,
  mutateTokenLifecycleFixture,
  reserveTokenLifecycleFixture,
} from '../token-lifecycle/fixtures/lifecycle';
import { assertComponentTokenLifecycleCanMaterialize } from '../generators/component/token-lifecycle-contract';
import {
  canonicalGapRequestFromComponentResolution,
  canonicalGapIssueForRequest,
} from '../canonical-gap/orchestrator';
import { canonicalGapRequestsFromComponentProductionReport } from '../canonical-gap/production-adapter';
import { parseCanonicalGapRequest } from '../canonical-gap/types';
import {
  COMPONENT_PRODUCTION_STAGE_IDS,
  createComponentProductionResult,
  parseComponentProductionInput,
} from './contracts';
import { resolveMissingComponentRequest } from './missing-component-request';
import {
  productionSeedForTarget,
  parseComponentProductionSeed,
} from './production-seed';
import {
  resolveComponentProductionEligibility,
  COMPONENT_TOKEN_REGISTRY,
} from './production-eligibility';
import { runProductionEligibilityCli } from './eligibility-cli';

describe('canonical component-token production eligibility', () => {
  let root: string;
  const target = { ...componentExpansionCatalog[2], name: 'Example' };
  const seed = productionSeedForTarget(target);
  const request = {
    schemaVersion: '1',
    requestedComponent: 'Example',
    requestedIntent: 'example display',
    consumer: 'component-production:Example',
    platforms: ['react'],
    reusable: true,
  };
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-eligibility-'));
    copyTokenLifecycleFixture(root);
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.invalid',
        'commit',
        '-qm',
        'fixture',
      ],
      { cwd: root }
    );
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('requires explicit intent on every catalog target and preserves canonical contracts', () => {
    expect(
      componentExpansionCatalog.map((t) => [
        t.name,
        productionSeedForTarget(t).componentTokens,
      ])
    ).toEqual([
      ['Textarea', 'standard'],
      ['Accordion', 'disclosure'],
      ['Avatar', 'standard'],
      ['Badge', 'standard'],
    ]);
  });
  it.each([false, 'standard', 'boolean-control', 'disclosure'] as const)(
    'round trips explicit %s without loss',
    (componentTokens) => {
      expect(
        parseComponentProductionSeed(
          JSON.parse(JSON.stringify({ ...seed, componentTokens }))
        )
      ).toEqual({ ...seed, componentTokens });
    }
  );
  it('rejects omitted/undefined/null token intent and extra seed fields', () => {
    const missing = Object.fromEntries(
      Object.entries(seed).filter(([key]) => key !== 'componentTokens')
    );
    for (const value of [
      missing,
      { ...seed, componentTokens: undefined },
      { ...seed, componentTokens: null },
      { ...seed, extra: true },
    ])
      expect(() => parseComponentProductionSeed(value)).toThrow();
  });
  it('allows tokenless without an entry, never creates artifacts', () => {
    expect(
      resolveComponentProductionEligibility(
        { ...seed, componentTokens: false },
        root
      )
    ).toMatchObject({
      eligible: true,
      reason: 'tokenless',
      lifecycleMutationRequired: false,
    });
    expect(
      execFileSync('git', ['status', '--porcelain'], {
        cwd: root,
        encoding: 'utf8',
      })
    ).toBe('');
  });
  it('rejects token intent that contradicts the canonical expansion target', () => {
    const avatar = productionSeedForTarget(componentExpansionCatalog[2]);
    expect(
      resolveComponentProductionEligibility(
        { ...avatar, componentTokens: false },
        root
      )
    ).toMatchObject({
      eligible: false,
      hardInvalid: true,
      reason: 'invalid-component-token-lifecycle',
    });
  });
  it.each(['reserved', 'current'] as const)(
    'allows valid %s without promoting it',
    (status) => {
      reserveTokenLifecycleFixture(root, 'Example');
      mutateTokenLifecycleFixture(root, (a) => {
        a.components.Example.status = status;
      });
      const before = fs.readFileSync(path.join(root, COMPONENT_TOKEN_REGISTRY));
      expect(resolveComponentProductionEligibility(seed, root)).toMatchObject({
        eligible: true,
        hardInvalid: false,
        lifecycleMutationRequired: status === 'reserved',
        reason: status,
      });
      expect(
        fs.readFileSync(path.join(root, COMPONENT_TOKEN_REGISTRY))
      ).toEqual(before);
    }
  );
  it.each(['deprecated', 'owner', 'private'] as const)(
    'hard rejects %s authority',
    (invalid) => {
      reserveTokenLifecycleFixture(root, 'Example');
      mutateTokenLifecycleFixture(root, (a) => {
        if (invalid === 'deprecated')
          a.components.Example.status = 'deprecated';
        if (invalid === 'owner') a.components.Example.owner = 'Other';
        if (invalid === 'private') a.components.Example.public = false;
      });
      expect(resolveComponentProductionEligibility(seed, root)).toMatchObject({
        eligible: false,
        hardInvalid: true,
        lifecycleMutationRequired: false,
      });
      expect(() =>
        assertComponentTokenLifecycleCanMaterialize('Example', root)
      ).toThrow();
    }
  );
  it('blocks before production; reservation makes same request eligible', () => {
    const authorities = { components: [], targets: [target], root };
    const blocked = resolveMissingComponentRequest(request, authorities);
    expect(blocked).toMatchObject({
      blocked: true,
      nextAction: 'link-or-create-component-token-reservation-issue',
      productionSeed: seed,
      productionEligibility: { eligible: false },
    });
    const gap = canonicalGapRequestFromComponentResolution(blocked)!;
    expect(gap.kind).toBe('component-token-reservation');
    expect(canonicalGapIssueForRequest(gap).labels).not.toContain(
      'canonical-gap:ready'
    );
    expect(canonicalGapIssueForRequest(gap).body).toContain(
      COMPONENT_TOKEN_REGISTRY
    );
    expect(
      canonicalGapRequestFromComponentResolution(
        resolveMissingComponentRequest(request, authorities)
      )!.requestId
    ).toBe(gap.requestId);
    reserveTokenLifecycleFixture(root, 'Example');
    const eligible = resolveMissingComponentRequest(request, authorities);
    expect(eligible.requestId).toBe(blocked.requestId);
    expect(eligible.productionEligibility?.eligible).toBe(true);
  });
  it('keeps legacy Generator missing-family defense unchanged', () => {
    expect(() =>
      assertComponentTokenLifecycleCanMaterialize('Example', root)
    ).toThrow('unregistered-component-token-family');
  });
  it('Avatar is reserved, read-only eligibility does not materialize or promote', () => {
    expect(
      resolveComponentProductionEligibility(
        productionSeedForTarget(componentExpansionCatalog[2]),
        root
      )
    ).toMatchObject({
      eligible: true,
      reason: 'reserved',
      lifecycleMutationRequired: true,
    });
    expect(
      execFileSync('git', ['status', '--porcelain'], {
        cwd: root,
        encoding: 'utf8',
      })
    ).toBe('');
  });
  it('legacy production blocker routes the same governance request', () => {
    const report = createComponentProductionResult({
      input: parseComponentProductionInput(seed),
      stages: COMPONENT_PRODUCTION_STAGE_IDS.map((id) => ({
        id,
        status: id === 'generation' ? 'blocked' : 'skipped',
        summary: 'fixture',
        artifacts: [],
        findings:
          id === 'generation'
            ? [
                {
                  id: 'generation:blocked',
                  stage: id,
                  severity: 'blocking',
                  message:
                    'unregistered-component-token-family: component="Example"; reserve the family in packages/metadata/src/tokenLifecycle.ts before Generator V2 may materialize it',
                },
              ]
            : [],
      })),
      completeness: null,
      quality: null,
    });
    const planned = canonicalGapRequestFromComponentResolution(
      resolveMissingComponentRequest(request, {
        components: [],
        targets: [target],
        root,
      })
    );
    const legacy =
      canonicalGapRequestsFromComponentProductionReport(report).requests;
    expect(legacy).toEqual([planned]);
    expect(
      parseCanonicalGapRequest(JSON.parse(JSON.stringify(legacy[0])))
    ).toEqual(planned);
  });
  it('CLI returns bound planning JSON and does not mutate registry', () => {
    const file = path.join(root, 'seed.json');
    fs.writeFileSync(file, JSON.stringify(seed));
    const output: string[] = [];
    expect(
      runProductionEligibilityCli(['--seed', file], root, (s) => output.push(s))
    ).toBe(1);
    const parsed = JSON.parse(output[0]);
    expect(parsed.eligibility.revision).toBe(
      execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
      }).trim()
    );
    expect(parsed.eligibility.registry.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.reservation.productionSeed).toEqual(seed);
  });
});

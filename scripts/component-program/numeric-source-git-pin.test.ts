import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseComponentProductionInput } from '../component-production/contracts';
import { compileComponentProgram } from './compile';
import { mediaProgram, mediaSpec } from './fixtures/programs';
import { prepareNumericBindingAuthorityV1 } from './numeric-binding-authority';
import { fingerprintNumericSeriesBindingV1 } from './numeric-series-fingerprint';
import { prepareNumericSourceGitPinV1 } from './numeric-source-git-pin';
import { componentProgramSource } from './source';

const temporary: string[] = [];
afterEach(() => {
  for (const root of temporary.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function gitFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'vellira-numeric-source-'));
  temporary.push(root);
  git(root, 'init', '-q');
  git(
    root,
    'remote',
    'add',
    'origin',
    'https://github.com/vellira-dev/vellira.git'
  );
  git(root, 'config', 'user.name', 'Fixture User');
  git(root, 'config', 'user.email', 'fixture@example.invalid');
  return root;
}

function commit(root: string, file: string, source: string): string {
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, source);
  git(root, 'add', '--', file);
  git(root, 'commit', '-q', '-m', 'test: pin immutable numeric source');
  return git(root, 'rev-parse', 'HEAD');
}

function sourceFixture(count = 1) {
  const root = gitFixture();
  const base = mediaProgram();
  const spec = {
    ...mediaSpec(),
    platform: 'web' as const,
    componentProgram: {
      ...base,
      modules: base.modules.map((item) => ({
        ...item,
        platforms: ['react'] as const,
      })),
      transitions: base.transitions.map((item) => ({
        ...item,
        platforms: ['react'] as const,
      })),
    },
  };
  const parsed = parseComponentProductionInput(spec);
  const baseline = compileComponentProgram(
    componentProgramSource(parsed),
    parsed.componentProgram
  );
  if (baseline.disposition !== 'compiled' || !baseline.fingerprint) {
    throw new Error('Fixture baseline must compile.');
  }

  const slots = [];
  const entries = [];
  for (let index = 0; index < count; index++) {
    const id = 'series-' + index;
    const binding = {
      schemaVersion: '1' as const,
      kind: 'bounded-numeric-series' as const,
      data: {
        series: [{ id: 'value', label: 'Value' }],
        rows: [{ x: 0, xLabel: 'Start', values: { value: index + 7 } }],
      },
    };
    const bindingIdentity = fingerprintNumericSeriesBindingV1(binding);
    if (!bindingIdentity.ok) throw new Error('Fixture binding rejected.');

    const authority = prepareNumericBindingAuthorityV1(spec, {
      schemaVersion: '1',
      ownerName: 'PortraitProbe',
      bindingId: id,
      expectedProgramFingerprint: baseline.fingerprint,
      expectedBindingFingerprint: bindingIdentity.fingerprint,
      binding,
    });
    if (!authority.ok) throw new Error('Fixture authority rejected.');

    slots.push({
      id,
      kind: 'bounded-numeric-series' as const,
      platform: 'react' as const,
      ownerRootId: authority.receipt.ownerRootId,
      bindingFingerprint: bindingIdentity.fingerprint,
      authorityFingerprint: authority.receipt.authorityFingerprint,
    });
    entries.push({ slotId: id, binding, receipt: authority.receipt });
  }

  const production = {
    ...spec,
    componentProgram: {
      ...spec.componentProgram,
      numericBindingSlots: {
        schemaVersion: '1' as const,
        baseProgramFingerprint: baseline.fingerprint,
        slots,
      },
    },
  };
  const sourcePath = 'scripts/component-production/specs/PortraitProbe.json';
  const sourceBytes = JSON.stringify(production, null, 2) + '\n';
  const revision = commit(root, sourcePath, sourceBytes);
  const pin = {
    schemaVersion: '1',
    repository: 'vellira-dev/vellira',
    revision,
    sourcePath,
  };
  return {
    root,
    pin,
    sourceBytes,
    production,
    evidence: { schemaVersion: '1' as const, entries },
  };
}

describe('non-authorizing numeric source Git pin preflight', () => {
  it('binds two resolved numeric receipts to an exact Git blob and SHA-256', () => {
    const { root, pin, sourceBytes, evidence } = sourceFixture(2);
    const result = prepareNumericSourceGitPinV1(root, pin, evidence);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result).toMatchObject({
      schemaVersion: '1',
      disposition: 'review-required',
      sourceContentMatched: true,
      sourceAuthenticated: false,
      ownerApproved: false,
      grammarAdmitted: false,
      repository: 'vellira-dev/vellira',
      revision: pin.revision,
      sourcePath: pin.sourcePath,
      gitBlobSha1: git(root, 'rev-parse', 'HEAD:' + pin.sourcePath),
      sourceBytesSha256: createHash('sha256')
        .update(sourceBytes, 'utf8')
        .digest('hex'),
    });
    expect(result.resolution.resolved.map((entry) => entry.slotId)).toEqual([
      'series-0',
      'series-1',
    ]);
    expect(result.resolution.grammarAdmitted).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.resolution)).toBe(true);
    expect(Object.isFrozen(result.resolution.resolved)).toBe(true);
  });

  it('checks the pinned committed blob, not modified working-tree bytes', () => {
    const { root, pin, production, evidence } = sourceFixture();
    writeFileSync(
      path.join(root, pin.sourcePath),
      JSON.stringify({ ...production, componentName: 'Tampered' })
    );
    const result = prepareNumericSourceGitPinV1(root, pin, evidence);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sourceAuthenticated).toBe(false);
    expect(result.ownerApproved).toBe(false);
  });

  it('rejects mismatched HEAD, stale pin, and missing Git history', () => {
    const { root, pin, evidence } = sourceFixture();
    expect(
      prepareNumericSourceGitPinV1(root, {
        ...pin,
        revision: 'f'.repeat(40),
      }, evidence)
    ).toMatchObject({ ok: false, code: 'revision-mismatch' });

    const next = 'scripts/component-production/specs/NextProbe.json';
    commit(root, next, '{}\n');
    expect(prepareNumericSourceGitPinV1(root, pin, evidence)).toMatchObject({
      ok: false,
      code: 'revision-mismatch',
    });
  });

  it('rejects unknown repository, unpinned location and paths escaping specs', () => {
    const { root, pin, evidence } = sourceFixture();
    expect(
      prepareNumericSourceGitPinV1(root, {
        ...pin,
        repository: 'other/project',
      }, evidence)
    ).toMatchObject({ ok: false, code: 'invalid-pin' });
    for (const sourcePath of [
      '../config.json',
      '/scripts/component-production/specs/PortraitProbe.json',
      'scripts/component-production/specs/../data.json',
      'scripts/component-production/specs/PortraitProbe.ts',
    ]) {
      expect(
        prepareNumericSourceGitPinV1(root, { ...pin, sourcePath }, evidence)
      ).toMatchObject({ ok: false, code: 'invalid-pin' });
    }
    expect(
      prepareNumericSourceGitPinV1(root, { ...pin, other: true }, evidence)
    ).toMatchObject({ ok: false, code: 'invalid-pin' });
  });

  it('rejects wrong repository remote and arbitrary checkout folders', () => {
    const { root, pin, evidence } = sourceFixture();
    git(root, 'remote', 'set-url', 'origin', 'https://github.com/other/repo');
    expect(prepareNumericSourceGitPinV1(root, pin, evidence)).toMatchObject({
      ok: false,
      code: 'repository-mismatch',
    });
    expect(
      prepareNumericSourceGitPinV1(tmpdir(), pin, evidence)
    ).toMatchObject({ ok: false, code: 'checkout-unavailable' });
  });

  it('rejects absent sources and git symlinks instead of reading through them', () => {
    const { root, pin, evidence } = sourceFixture();
    expect(
      prepareNumericSourceGitPinV1(
        root,
        { ...pin, sourcePath: 'scripts/component-production/specs/Missing.json' },
        evidence
      )
    ).toMatchObject({ ok: false, code: 'source-not-tracked' });

    const symlinkRoot = gitFixture();
    const symlinkPath = 'scripts/component-production/specs/Shadow.json';
    mkdirSync(path.dirname(path.join(symlinkRoot, symlinkPath)), {
      recursive: true,
    });
    writeFileSync(path.join(symlinkRoot, 'target.json'), '{}');
    symlinkSync('../../../target.json', path.join(symlinkRoot, symlinkPath));
    git(symlinkRoot, 'add', '--', symlinkPath);
    git(symlinkRoot, 'commit', '-q', '-m', 'test: symbolic source rejected');
    expect(
      prepareNumericSourceGitPinV1(
        symlinkRoot,
        {
          ...pin,
          revision: git(symlinkRoot, 'rev-parse', 'HEAD'),
          sourcePath: symlinkPath,
        },
        evidence
      )
    ).toMatchObject({ ok: false, code: 'source-not-tracked' });
  });

  it('fails closed for a tampered dataset and invented matching-looking receipt', () => {
    const { root, pin, evidence } = sourceFixture();
    const tampered = {
      ...evidence,
      entries: evidence.entries.map((entry) => ({
        ...entry,
        binding: {
          ...entry.binding,
          data: {
            ...entry.binding.data,
            rows: [{ x: 0, xLabel: 'Start', values: { value: 99 } }],
          },
        },
      })),
    };
    expect(
      prepareNumericSourceGitPinV1(root, pin, tampered)
    ).toMatchObject({ ok: false, code: 'receipt-resolution-failed' });

    const counterfeit = {
      ...evidence,
      entries: evidence.entries.map((entry) => ({
        ...entry,
        receipt: {
          ...entry.receipt,
          authorityFingerprint:
            'numeric-binding-authority-v1:sha256:' + 'a'.repeat(64),
        },
      })),
    };
    expect(
      prepareNumericSourceGitPinV1(root, pin, counterfeit)
    ).toMatchObject({ ok: false, code: 'receipt-resolution-failed' });
  });

  it('contains accessor/Proxy traps without executing attacker-supplied getters', () => {
    const { root, pin, evidence } = sourceFixture();
    let called = false;
    const hostile = Object.defineProperty({ ...pin }, 'revision', {
      enumerable: true,
      get() {
        called = true;
        return pin.revision;
      },
    });
    expect(
      prepareNumericSourceGitPinV1(root, hostile, evidence)
    ).toMatchObject({ ok: false, code: 'invalid-pin' });
    expect(called).toBe(false);

    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(
      prepareNumericSourceGitPinV1(root, pin, revoked.proxy)
    ).toMatchObject({ ok: false, code: 'receipt-resolution-failed' });
  });

  it('does not mistake a forgeable fake local Git checkout for owner authority', () => {
    const { root, pin, evidence } = sourceFixture();
    const result = prepareNumericSourceGitPinV1(root, pin, evidence);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // This test repository is synthetic. "ok" proves content self-consistency
    // only; an untrusted caller can forge its remote and Git history.
    expect(result.sourceContentMatched).toBe(true);
    expect(result.sourceAuthenticated).toBe(false);
    expect(result.ownerApproved).toBe(false);
    expect(result.grammarAdmitted).toBe(false);
  });
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { createTokenPreservationBaseline } from '../../../packages/tokens/scripts/token-preservation';
import { runTokenSemanticAudit, tokenSemanticExitCode } from './contract';
import {
  auditTokenVisualPreservation,
  checkTokenVisualPreservation,
} from './visual-preservation';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const roots: string[] = [];
afterEach(() => {
  for (const directory of roots.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function fixtureRoot() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-preserve-'));
  roots.push(directory);
  return directory;
}

function baselineFixture() {
  return createTokenPreservationBaseline('fixture');
}

function runFixture(baseline: ReturnType<typeof baselineFixture>) {
  return auditTokenVisualPreservation({
    baseline,
    manifest: [],
    expectedSourceRevision: 'fixture',
  });
}

describe('visual value-preservation audit adapter', () => {
  it('checks the immutable repository baseline and canonical manifest', () => {
    const result = checkTokenVisualPreservation(root);
    expect(result.coverage).toBe('complete');
    expect(result.checked).toBe(1);
    expect(result.findings).toEqual([]);
  });

  it('accepts unchanged resolved values without writing a baseline', () => {
    const baseline = baselineFixture();
    const before = JSON.stringify(baseline);
    expect(runFixture(baseline).findings).toEqual([]);
    expect(JSON.stringify(baseline)).toBe(before);
  });

  it('reports unapproved canonical color drift with its theme and path', () => {
    const baseline = baselineFixture();
    const tokenPath = 'semantic.text.primary';
    baseline.themes.light.entries[tokenPath] = '0'.repeat(64);
    const result = runFixture(baseline);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'tokens.visual-preservation',
          code: 'token.changed',
          severity: 'error',
          theme: 'light',
          platform: null,
          tokenPath,
        }),
        expect.objectContaining({
          code: 'platform.changed',
          platform: 'react-native',
          tokenPath,
        }),
      ])
    );
  });

  it('retains Web output drift independently of canonical token hashes', () => {
    const baseline = baselineFixture();
    const tokenPath = 'semantic.text.primary';
    baseline.platformOutputs.web.dark.entries[tokenPath] = '0'.repeat(64);
    expect(runFixture(baseline).findings).toEqual([
      expect.objectContaining({
        code: 'platform.changed',
        theme: 'dark',
        platform: 'web',
        tokenPath,
      }),
    ]);
  });

  it('rejects a baseline with a different source revision', () => {
    const baseline = baselineFixture();
    baseline.sourceRevision = 'wrong-revision';
    expect(runFixture(baseline).findings).toEqual([
      expect.objectContaining({ code: 'baseline.source-revision' }),
    ]);
  });

  it.each(['missing', 'malformed'])(
    'makes %s baseline evidence fatal even in report mode',
    (kind) => {
      const directory = fixtureRoot();
      if (kind === 'malformed') {
        const file = path.join(
          directory,
          'packages/tokens/src/preservation/token-preservation-baseline.v1.json'
        );
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, '{invalid');
      }
      const report = runTokenSemanticAudit([
        {
          ruleId: 'tokens.visual-preservation',
          run: () => checkTokenVisualPreservation(directory),
        },
      ]);
      expect(report.summary.runtimeErrors).toBe(1);
      expect(tokenSemanticExitCode(report, true)).toBe(2);
    }
  );
});

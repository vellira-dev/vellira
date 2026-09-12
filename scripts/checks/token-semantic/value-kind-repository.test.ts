import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  auditGeneratedTokenCssFreshness,
  checkTokenValueKinds,
} from './value-kind-repository';

const tempRoots: string[] = [];

function createTempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-value-kind-'));
  tempRoots.push(root);
  const generatedDir = path.join(
    root,
    'packages',
    'tokens',
    'src',
    'generated'
  );
  fs.mkdirSync(generatedDir, { recursive: true });
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/** Exercise real themes and controlSizes, never a fixture-only baseline. */
describe('maintained value-kind inventory', () => {
  it('checks all theme layers, shared control sizes, and generated CSS without findings', () => {
    const result = checkTokenValueKinds();
    expect(result.checked).toBeGreaterThan(7000);
    expect(result.findings).toEqual([]);
    expect(result.coverage).toBe('complete');
  });

  it('fails closed when committed generated CSS is stale', () => {
    const root = createTempRoot();
    fs.writeFileSync(
      path.join(root, 'packages', 'tokens', 'src', 'generated', 'tokens.css'),
      '/* stale generated CSS */\n'
    );

    const result = auditGeneratedTokenCssFreshness(root);
    expect(result.checked).toBe(1);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      ruleId: 'tokens.value-kind',
      code: 'generated-css-out-of-date',
      severity: 'error',
      sourcePath: 'packages/tokens/src/generated/tokens.css',
      platform: 'web',
    });
  });

  // cli.test.ts proves registration using its existing full repository report.
});

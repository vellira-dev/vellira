import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  checkSourceFile,
  checkStyleFile,
  runVelliraUiUsageCheck,
} from './checker';

const AUTHORITIES = {
  canonicalIcons: new Set(['Search']),
  canonicalCssVariables: new Set(['--surface-panel', '--text-primary']),
};
const temporaryRoots: string[] = [];

afterEach(() => {
  while (temporaryRoots.length > 0) {
    fs.rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

describe('Vellira UI usage low-noise evidence', () => {
  it('treats explicitly authored first-party CSS custom properties as local authority', () => {
    const root = makeRoot();
    write(
      root,
      'apps/website/src/theme.css',
      `.theme { --surface-local-panel: var(--surface-panel); }`
    );
    write(
      root,
      'apps/website/src/card.module.css',
      `.card { background: var(--surface-local-panel); color: var(--text-primary); }`
    );

    const report = runVelliraUiUsageCheck(root, {
      authorities: AUTHORITIES,
    });

    expect(report.findings).toEqual([]);
  });

  it('does not infer third-party UI bypass from an arbitrary bare module name', () => {
    const findings = checkSourceFile(
      'apps/website/src/example.tsx',
      `import { Button } from 'internal-toolkit'; export const Example = () => <Button />;`,
      AUTHORITIES
    );

    expect(findings).toEqual([]);
  });

  it('still reports a known third-party UI package when a Vellira abstraction exists', () => {
    const findings = checkSourceFile(
      'apps/website/src/example.tsx',
      `import { Dialog } from '@radix-ui/react-dialog'; export const Example = () => <Dialog />;`,
      AUTHORITIES
    );

    expect(findings).toEqual([
      expect.objectContaining({
        ruleId: 'vellira-ui.third-party-bypass',
        canonicalAlternative: 'Modal',
      }),
    ]);
  });

  it('captures one raw functional color instead of swallowing adjacent gradient stops', () => {
    const findings = checkStyleFile(
      'apps/website/src/example.module.css',
      `.root { background: linear-gradient(90deg, rgb(255 255 255 / 68%), rgb(255 255 255 / 22%)); }`,
      AUTHORITIES
    );

    expect(findings).toEqual([
      expect.objectContaining({
        ruleId: 'vellira-ui.noncanonical-token-value',
        detected: 'rgb(255 255 255 / 68%)',
      }),
    ]);
  });
});

function makeRoot(): string {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-ui-usage-noise-')
  );
  temporaryRoots.push(root);
  return root;
}

function write(root: string, relativePath: string, content: string) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

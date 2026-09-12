import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('token semantic blocking CI wiring', () => {
  it('keeps the strict semantic audit in the authoritative ci:quality path', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    ) as { scripts?: Record<string, unknown> };
    const strict = packageJson.scripts?.['check:tokens-semantic:strict'];
    const quality = packageJson.scripts?.['ci:quality'];

    expect(strict).toBe('tsx scripts/checks/token-semantic/cli.ts');
    expect(typeof quality).toBe('string');
    expect(quality).toContain('pnpm check:tokens-semantic:strict');
    expect(
      String(quality).match(/pnpm check:tokens-semantic:strict/g)
    ).toHaveLength(1);
  });
});

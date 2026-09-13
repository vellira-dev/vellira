import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..');

const publicRoots = [
  'packages/react/src/index.ts',
  'packages/react-native/src/index.ts',
] as const;

describe('public API authority', () => {
  it('removes React roots from manual symbol contracts', () => {
    const checkerSource = fs.readFileSync(
      path.join(root, 'scripts/check-public-api.mjs'),
      'utf8'
    );
    const manualContractStart = checkerSource.indexOf(
      'const publicSymbolContracts = {'
    );
    const explicitContractStart = checkerSource.indexOf(
      'const explicitPublicRootContracts = {'
    );
    const manualContract = checkerSource.slice(
      manualContractStart,
      explicitContractStart
    );

    expect(manualContractStart).toBeGreaterThanOrEqual(0);
    expect(explicitContractStart).toBeGreaterThan(manualContractStart);
    expect(manualContract).not.toContain("'packages/react/src/index.ts'");
    expect(manualContract).not.toContain(
      "'packages/react-native/src/index.ts'"
    );
  });

  it.each(publicRoots)('%s stays explicit-only', (entryPath) => {
    const source = fs.readFileSync(path.join(root, entryPath), 'utf8');

    expect(source).not.toMatch(/^\s*export\s+\*\s+from/m);
  });

  it('keeps the Web theme surface explicit at the package root', () => {
    const source = fs.readFileSync(
      path.join(root, 'packages/react/src/index.ts'),
      'utf8'
    );

    expect(source).toContain(
      "export { ThemeProvider, useTheme } from './theme';"
    );
    expect(source).toContain('ThemeContextValue,');
    expect(source).toContain('ThemeName,');
    expect(source).toContain('ThemeProviderProps,');
  });
});

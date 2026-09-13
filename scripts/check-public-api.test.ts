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

const publicApiContracts = [
  'packages/react/src/public-api.test.ts',
  'packages/react-native/src/public-api.test.ts',
] as const;

describe('public API authority', () => {
  it('removes generated package roots from manual symbol contracts', () => {
    const checkerSource = fs.readFileSync(
      path.join(root, 'scripts/check-public-api.mjs'),
      'utf8'
    );
    const manualContractStart = checkerSource.indexOf(
      'const publicSymbolContracts = {'
    );
    const generatedContractStart = checkerSource.indexOf(
      'const generatedPackagePublicSymbolContracts = {'
    );
    const manualContract = checkerSource.slice(
      manualContractStart,
      generatedContractStart
    );

    expect(manualContractStart).toBeGreaterThanOrEqual(0);
    expect(generatedContractStart).toBeGreaterThan(manualContractStart);
    expect(manualContract).not.toContain("'packages/react/src/index.ts'");
    expect(manualContract).not.toContain(
      "'packages/react-native/src/index.ts'"
    );
  });

  it.each(publicRoots)('%s stays explicit-only', (entryPath) => {
    const source = fs.readFileSync(path.join(root, entryPath), 'utf8');

    expect(source).not.toMatch(/^\s*export\s+\*\s+from/m);
  });

  it.each(publicApiContracts)(
    '%s owns the complete public symbol snapshot',
    (contractPath) => {
      const source = fs.readFileSync(path.join(root, contractPath), 'utf8');

      expect(source).toContain('export const publicApiSymbols = [');
    }
  );

  it('maps generated package roots to their canonical contract files', () => {
    const checkerSource = fs.readFileSync(
      path.join(root, 'scripts/check-public-api.mjs'),
      'utf8'
    );

    expect(checkerSource).toContain(
      "'packages/react/src/index.ts': 'packages/react/src/public-api.test.ts'"
    );
    expect(checkerSource).toContain(
      "'packages/react-native/src/index.ts':\n    'packages/react-native/src/public-api.test.ts'"
    );
  });
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runComponentCompletenessCli } from './cli';

const tempRoots: string[] = [];

function createTempRoot() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-component-completeness-cli-')
  );

  tempRoots.push(root);

  return root;
}

function createCompleteButtonFixture(root: string) {
  for (const packageName of ['react', 'react-native']) {
    const componentDir = path.join(
      root,
      'packages',
      packageName,
      'src',
      'primitives',
      'Button'
    );

    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(path.join(componentDir, 'Button.tsx'), '');
    fs.writeFileSync(path.join(componentDir, 'types.ts'), '');
    fs.writeFileSync(path.join(componentDir, 'Button.test.tsx'), '');
    fs.writeFileSync(path.join(componentDir, 'Button.stories.tsx'), '');
    fs.writeFileSync(path.join(componentDir, 'README.md'), '');

    fs.writeFileSync(
      path.join(componentDir, 'index.ts'),
      `export * from './Button';
export * from './types';
`
    );

    fs.writeFileSync(
      path.join(componentDir, '..', 'index.ts'),
      `export * from './Button';
`
    );
  }

  const metadataDir = path.join(
    root,
    'packages',
    'metadata',
    'src',
    'components'
  );
  fs.mkdirSync(metadataDir, { recursive: true });
  fs.writeFileSync(
    path.join(metadataDir, 'Button.metadata.ts'),
    'export const buttonMetadata = {};\n'
  );
  fs.writeFileSync(
    path.join(metadataDir, 'index.ts'),
    `import { buttonMetadata } from './Button.metadata';\n\nexport const componentMetadata = [\n  buttonMetadata,\n] as const;\n`
  );

  for (const packageName of ['@vellira-ui/types', '@vellira-ui/tokens']) {
    const packageDir = packageName.replace('@vellira-ui/', '');
    const packageRoot = path.join(root, 'packages', packageDir);
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.writeFileSync(
      path.join(packageRoot, 'package.json'),
      `${JSON.stringify({ name: packageName })}\n`
    );
  }

  const registryDir = path.join(
    root,
    'apps',
    'website',
    'src',
    'component-catalog',
    'registry'
  );

  fs.mkdirSync(registryDir, { recursive: true });

  fs.writeFileSync(
    path.join(registryDir, 'componentPresentation.ts'),
    `export const componentCatalogPresentation = [
  {
    slug: 'button',
    name: 'Button',
  },
];
`
  );

  fs.writeFileSync(
    path.join(registryDir, 'componentPages.ts'),
    `export const componentPages = {
  button: {
    name: 'Button',
    Accessibility: () => null,
    api: {
      react: [],
      'react-native': [],
    },
  },
};
`
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;

  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, {
      recursive: true,
      force: true,
    });
  }
});

describe('component completeness CLI', () => {
  it('checks one component by name', async () => {
    const root = createTempRoot();

    createCompleteButtonFixture(root);

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const results = await runComponentCompletenessCli(['Button'], root);

    expect(results).toHaveLength(1);
    expect(results[0]?.componentName).toBe('Button');
    expect(results[0]?.ready).toBe(true);

    expect(log).toHaveBeenCalledWith(expect.stringContaining('READY'));

    expect(process.exitCode).toBeUndefined();
  });

  it('accepts component names case-insensitively', async () => {
    const root = createTempRoot();

    createCompleteButtonFixture(root);

    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const results = await runComponentCompletenessCli(['button'], root);

    expect(results[0]?.componentName).toBe('Button');
    expect(results[0]?.ready).toBe(true);
  });

  it('rejects an unknown component', async () => {
    const root = createTempRoot();

    await expect(
      runComponentCompletenessCli(['DoesNotExist'], root)
    ).rejects.toThrow(
      'Unknown component "DoesNotExist". No component metadata found.'
    );
  });

  it('sets a non-zero exit code for incomplete components', async () => {
    const root = createTempRoot();

    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const results = await runComponentCompletenessCli(['Button'], root);

    expect(results[0]?.ready).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it('rejects invalid CLI usage', async () => {
    await expect(runComponentCompletenessCli([])).rejects.toThrow(
      'Usage: pnpm check:component <ComponentName|--all>'
    );

    await expect(
      runComponentCompletenessCli(['Button', 'unexpected'])
    ).rejects.toThrow('Usage: pnpm check:component <ComponentName|--all>');
  });
});

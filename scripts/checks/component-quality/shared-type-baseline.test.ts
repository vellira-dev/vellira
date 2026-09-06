import fs from 'node:fs';
import path from 'node:path';

import { componentMetadata } from '@vellira-ui/metadata';
import { describe, expect, it } from 'vitest';

function lowerCamel(value: string) {
  return `${value[0]?.toLowerCase() ?? ''}${value.slice(1)}`;
}

function platformPackage(platform: 'react' | 'react-native') {
  return platform === 'react' ? 'react' : 'react-native';
}

function collectSource(directory: string): string {
  if (!fs.existsSync(directory)) {
    return '';
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectSource(fullPath);
      }

      if (
        !/\.(ts|tsx)$/.test(entry.name) ||
        /(\.test|\.stories|\.spec)\.(ts|tsx)$/.test(entry.name)
      ) {
        return [];
      }

      return fs.readFileSync(fullPath, 'utf8');
    })
    .join('\n');
}

describe('shared type repository baseline', () => {
  it('keeps metadata, shared modules, barrel exports, and renderer derivation aligned', () => {
    const root = process.cwd();
    const sharedTypesDir = path.join(root, 'packages', 'types', 'src');
    const sharedTypesBarrel = fs.readFileSync(
      path.join(sharedTypesDir, 'index.ts'),
      'utf8'
    );
    const failures: string[] = [];

    for (const metadata of componentMetadata) {
      const sharedFileName = lowerCamel(metadata.name);
      const sharedTypesFile = path.join(sharedTypesDir, `${sharedFileName}.ts`);
      const hasSharedModule = fs.existsSync(sharedTypesFile);
      const declaresSharedDependency = (
        metadata.dependencies?.packages ?? []
      ).includes('@vellira-ui/types');
      const hasBarrelExport = sharedTypesBarrel.includes(
        `export * from './${sharedFileName}';`
      );

      if (hasSharedModule !== declaresSharedDependency) {
        failures.push(
          `${metadata.name}: matching shared type module and metadata dependency must either both exist or both be absent.`
        );
      }

      if (hasSharedModule && !hasBarrelExport) {
        failures.push(
          `${metadata.name}: packages/types/src/${sharedFileName}.ts is not exported from @vellira-ui/types.`
        );
      }

      if (!hasSharedModule) {
        continue;
      }

      for (const platform of metadata.platforms) {
        const componentDir = path.join(
          root,
          'packages',
          platformPackage(platform),
          'src',
          metadata.layer,
          metadata.name
        );
        const source = collectSource(componentDir);

        if (!source.includes('@vellira-ui/types')) {
          failures.push(
            `${metadata.name}/${platform}: renderer source does not derive/import from @vellira-ui/types.`
          );
        }
      }
    }

    expect(failures).toEqual([]);
  });
});

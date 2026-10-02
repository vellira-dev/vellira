import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  collectExportTargets,
  forbiddenPackedFiles,
  mismatchedInternalDependencies,
  validatePackedPackage,
  workspaceProtocolDependencies,
} = require('./package-artifacts.cjs');

function coreFixture(): any {
  return {
    packageInfo: {
      name: '@vellira-ui/core',
      version: '2.127.0',
    },
    packResult: {
      name: '@vellira-ui/core',
      version: '2.127.0',
      files: [
        { path: 'package.json' },
        { path: 'README.md' },
        { path: 'LICENSE' },
        { path: 'dist/index.js' },
        { path: 'dist/index.d.ts' },
      ],
    },
    packedManifest: {
      name: '@vellira-ui/core',
      version: '2.127.0',
      main: './dist/index.js',
      types: './dist/index.d.ts',
      exports: {
        '.': {
          'vellira-source': './src/index.ts',
          types: './dist/index.d.ts',
          import: './dist/index.js',
        },
      },
    },
  };
}

describe('release candidate artifact validation', () => {
  it('validates dist-only package exports and ignores workspace-only source conditions', () => {
    const fixture = coreFixture();

    expect(() => validatePackedPackage(fixture)).not.toThrow();
    expect(collectExportTargets(fixture.packedManifest.exports)).toEqual([
      'dist/index.d.ts',
      'dist/index.js',
    ]);
  });

  it('fails closed on missing exports, workspace protocols, and dev files', () => {
    const missingExport = coreFixture();
    missingExport.packResult.files = missingExport.packResult.files.filter(
      ({ path }) => path !== 'dist/index.js'
    );
    expect(() => validatePackedPackage(missingExport)).toThrow(
      'export target dist/index.js is missing'
    );

    const workspaceDependency = coreFixture();
    workspaceDependency.packedManifest.dependencies = {
      '@vellira-ui/types': 'workspace:*',
    };
    expect(() => validatePackedPackage(workspaceDependency)).toThrow(
      'unresolved workspace dependencies'
    );

    expect(
      workspaceProtocolDependencies(workspaceDependency.packedManifest)
    ).toEqual(['dependencies.@vellira-ui/types=workspace:*']);
    expect(forbiddenPackedFiles(['src/index.ts', 'dist/index.js'])).toEqual([
      'src/index.ts',
    ]);
  });

  it('pins packed internal dependencies to the exact candidate version', () => {
    const fixture = coreFixture();
    fixture.packedManifest.dependencies = {
      '@vellira-ui/types': '2.127.0',
    };

    expect(
      mismatchedInternalDependencies(
        fixture.packedManifest,
        fixture.packageInfo.version
      )
    ).toEqual([]);
    expect(() => validatePackedPackage(fixture)).not.toThrow();

    fixture.packedManifest.dependencies['@vellira-ui/types'] = '^2.127.0';

    expect(
      mismatchedInternalDependencies(
        fixture.packedManifest,
        fixture.packageInfo.version
      )
    ).toEqual(['dependencies.@vellira-ui/types=^2.127.0']);
    expect(() => validatePackedPackage(fixture)).toThrow(
      'exact candidate version'
    );
  });

  it('requires public web styles and token CSS in the tarball', () => {
    const react = coreFixture();
    react.packageInfo.name = '@vellira-ui/react';
    react.packResult.name = '@vellira-ui/react';
    react.packedManifest.name = '@vellira-ui/react';
    react.packedManifest.exports['./styles'] = './dist/styles.css';

    expect(() => validatePackedPackage(react)).toThrow(
      'must include its public stylesheet export'
    );

    react.packResult.files.push({ path: 'dist/styles.css' });
    expect(() => validatePackedPackage(react)).not.toThrow();

    const tokens = coreFixture();
    tokens.packageInfo.name = '@vellira-ui/tokens';
    tokens.packResult.name = '@vellira-ui/tokens';
    tokens.packedManifest.name = '@vellira-ui/tokens';
    tokens.packedManifest.exports['./css'] = {
      types: './css.d.ts',
      default: './dist/css/tokens.css',
    };
    tokens.packResult.files.push(
      { path: 'css.d.ts' },
      { path: 'dist/css/tokens.css' }
    );

    expect(() => validatePackedPackage(tokens)).not.toThrow();
  });

  it('requires native package export conditions to survive packing', () => {
    const native = coreFixture();
    native.packageInfo.name = '@vellira-ui/react-native';
    native.packResult.name = '@vellira-ui/react-native';
    native.packedManifest.name = '@vellira-ui/react-native';

    expect(() => validatePackedPackage(native)).toThrow(
      'must retain the react-native export condition'
    );

    native.packedManifest.exports['.']['react-native'] = './dist/index.js';
    native.packedManifest['react-native'] = './dist/index.js';
    expect(() => validatePackedPackage(native)).not.toThrow();
  });
});

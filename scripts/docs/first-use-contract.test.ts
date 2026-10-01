import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

type PackageManifest = {
  name: string;
  peerDependencies?: Record<string, string>;
};

function read(filePath: string) {
  return fs.readFileSync(filePath, 'utf8');
}

function manifest(filePath: string): PackageManifest {
  return JSON.parse(read(filePath)) as PackageManifest;
}

const reactPackage = manifest('packages/react/package.json');
const nativePackage = manifest('packages/react-native/package.json');
const reactReadme = read('packages/react/README.md');
const nativeReadme = read('packages/react-native/README.md');
const rootReadme = read('README.md');
const gettingStarted = read('apps/docs/src/start/getting-started.md');
const reactDocs = read('apps/docs/src/react/index.md');
const nativeDocs = read('apps/docs/src/react-native/index.md');

describe('first-use documentation contract', () => {
  it('keeps React install and stylesheet setup explicit', () => {
    expect(rootReadme).toContain(`pnpm add ${reactPackage.name}`);
    expect(gettingStarted).toContain(`pnpm add ${reactPackage.name}`);
    expect(reactDocs).toContain(`pnpm add ${reactPackage.name}`);
    expect(gettingStarted).toContain("import '@vellira-ui/react/styles';");
    expect(reactDocs).toContain("import '@vellira-ui/react/styles';");
  });

  it('keeps published React peer ranges visible in package installation docs', () => {
    for (const [peer, range] of Object.entries(
      reactPackage.peerDependencies ?? {}
    )) {
      expect(reactReadme).toContain(peer);
      expect(reactReadme).toContain(range);
    }
  });

  it('keeps React Native install docs aligned with declared peers', () => {
    const peerDependencies = nativePackage.peerDependencies ?? {};

    expect(rootReadme).toContain(`pnpm add ${nativePackage.name}`);
    expect(gettingStarted).toContain(`pnpm add ${nativePackage.name}`);
    expect(nativeDocs).toContain(`pnpm add ${nativePackage.name}`);

    for (const [peer, range] of Object.entries(peerDependencies)) {
      expect(nativeReadme).toContain(peer);
      expect(nativeReadme).toContain(range);
      expect(nativeDocs).toContain(peer);
      expect(nativeDocs).toContain(range);
    }

    for (const peer of Object.keys(peerDependencies).filter(
      (name) => name !== 'react' && name !== 'react-native'
    )) {
      expect(rootReadme).toContain(peer);
      expect(gettingStarted).toContain(peer);
    }
  });
});

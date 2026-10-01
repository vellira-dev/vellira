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

function expectPeerRanges(
  source: string,
  peerDependencies: Record<string, string> | undefined
) {
  for (const [peer, range] of Object.entries(peerDependencies ?? {})) {
    expect(source).toContain(`${peer} ${range}`);
  }
}

function expectCompleteNativeInstallCommands(
  source: string,
  peerDependencies: Record<string, string>
) {
  const commands = source.match(
    /^pnpm add @vellira-ui\/react-native(?: [^\r\n]+)?$/gm
  );
  const requiredInstallPeers = Object.keys(peerDependencies).filter(
    (name) => name !== 'react' && name !== 'react-native'
  );

  expect(commands?.length ?? 0).toBeGreaterThan(0);

  for (const command of commands ?? []) {
    for (const peer of requiredInstallPeers) {
      expect(command).toContain(peer);
    }
  }
}

describe('first-use documentation contract', () => {
  it('keeps React install and stylesheet setup explicit', () => {
    expect(rootReadme).toContain(`pnpm add ${reactPackage.name}`);
    expect(gettingStarted).toContain(`pnpm add ${reactPackage.name}`);
    expect(reactDocs).toContain(`pnpm add ${reactPackage.name}`);
    expect(rootReadme).toContain("import '@vellira-ui/react/styles';");
    expect(gettingStarted).toContain("import '@vellira-ui/react/styles';");
    expect(reactDocs).toContain("import '@vellira-ui/react/styles';");
  });

  it('keeps exact React peer contracts visible in first-use docs', () => {
    expectPeerRanges(reactReadme, reactPackage.peerDependencies);
    expectPeerRanges(gettingStarted, reactPackage.peerDependencies);
    expectPeerRanges(reactDocs, reactPackage.peerDependencies);
  });

  it('keeps React Native install docs aligned with declared peers', () => {
    const peerDependencies = nativePackage.peerDependencies ?? {};

    expectCompleteNativeInstallCommands(rootReadme, peerDependencies);
    expectCompleteNativeInstallCommands(gettingStarted, peerDependencies);
    expectCompleteNativeInstallCommands(nativeDocs, peerDependencies);
    expectCompleteNativeInstallCommands(nativeReadme, peerDependencies);

    expectPeerRanges(nativeReadme, peerDependencies);
    expectPeerRanges(gettingStarted, peerDependencies);
    expectPeerRanges(nativeDocs, peerDependencies);
  });
});

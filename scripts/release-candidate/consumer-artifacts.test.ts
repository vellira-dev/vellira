import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  NATIVE_PACKAGE_NAMES,
  WEB_PACKAGE_NAMES,
  assertInstalledCandidatePackages,
  validateCandidateArtifactDirectory,
} = require('./consumer-artifacts.cjs');

const tempDirs: string[] = [];

function tempDir(prefix: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function sha(buffer: Buffer, algorithm: string, encoding: 'hex' | 'base64') {
  return crypto.createHash(algorithm).update(buffer).digest(encoding);
}

function fixtureCandidate() {
  const dir = tempDir('vellira-candidate-consumer-test-');
  const candidateSha = 'a'.repeat(40);
  const version = '2.127.0';
  const packages = [
    '@vellira-ui/core',
    '@vellira-ui/tokens',
    '@vellira-ui/types',
    '@vellira-ui/icons',
    '@vellira-ui/react',
    '@vellira-ui/react-native',
  ].map((name) => {
    const filename =
      name.replace('@vellira-ui/', 'vellira-ui-') + '-' + version + '.tgz';
    const bytes = Buffer.from(name + ':' + version);
    fs.writeFileSync(path.join(dir, filename), bytes);
    return {
      name,
      version,
      filename,
      sha256: sha(bytes, 'sha256', 'hex'),
      npmIntegrity: 'sha512-' + sha(bytes, 'sha512', 'base64'),
      npmShasum: sha(bytes, 'sha1', 'hex'),
    };
  });

  fs.writeFileSync(
    path.join(dir, 'candidate.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        source: { sha: candidateSha },
        version,
        packages,
        checks: { cleanInstall: true },
      },
      null,
      2
    )
  );

  return { candidateSha, dir, packages, version };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('exact candidate consumer artifacts', () => {
  it('validates exact candidate identity and digests', () => {
    const fixture = fixtureCandidate();

    const candidate = validateCandidateArtifactDirectory(
      fixture.dir,
      fixture.candidateSha,
      WEB_PACKAGE_NAMES
    );

    const selectedNames = candidate.packages.map(
      ({ name }: { name: string }) => name
    );

    expect(candidate.manifest.version).toBe(fixture.version);
    expect(selectedNames).toEqual(WEB_PACKAGE_NAMES);
    expect(candidate.packages).toHaveLength(5);
  });

  it('selects the exact native consumer package set', () => {
    const fixture = fixtureCandidate();

    const candidate = validateCandidateArtifactDirectory(
      fixture.dir,
      fixture.candidateSha,
      NATIVE_PACKAGE_NAMES
    );

    expect(candidate.packages.map(({ name }: { name: string }) => name)).toEqual(
      NATIVE_PACKAGE_NAMES
    );
    expect(candidate.packages).toHaveLength(5);
    expect(
      candidate.packages.some(
        ({ name }: { name: string }) => name === '@vellira-ui/react-native'
      )
    ).toBe(true);
    expect(
      candidate.packages.some(
        ({ name }: { name: string }) => name === '@vellira-ui/react'
      )
    ).toBe(false);
  });

  it('fails closed when candidate identity or tarball bytes drift', () => {
    const fixture = fixtureCandidate();

    expect(() =>
      validateCandidateArtifactDirectory(
        fixture.dir,
        'b'.repeat(40),
        WEB_PACKAGE_NAMES
      )
    ).toThrow('does not match expected');

    fs.appendFileSync(
      path.join(fixture.dir, fixture.packages[0].filename),
      'drift'
    );

    expect(() =>
      validateCandidateArtifactDirectory(
        fixture.dir,
        fixture.candidateSha,
        WEB_PACKAGE_NAMES
      )
    ).toThrow('SHA-256 mismatch');
  });

  it('requires file artifacts inside clean node_modules', () => {
    const fixture = fixtureCandidate();
    const candidate = validateCandidateArtifactDirectory(
      fixture.dir,
      fixture.candidateSha,
      WEB_PACKAGE_NAMES
    );
    const consumer = tempDir('vellira-clean-consumer-test-');

    for (const name of WEB_PACKAGE_NAMES) {
      const packageDir = path.join(
        consumer,
        'node_modules',
        ...name.split('/')
      );
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(
        path.join(packageDir, 'package.json'),
        JSON.stringify({ name, version: fixture.version })
      );
    }

    fs.writeFileSync(
      path.join(consumer, 'package-lock.json'),
      JSON.stringify({
        lockfileVersion: 3,
        packages: Object.fromEntries(
          WEB_PACKAGE_NAMES.map((name: string) => [
            'node_modules/' + name,
            {
              version: fixture.version,
              resolved: 'file:/candidate/' + name.split('/').at(-1) + '.tgz',
            },
          ])
        ),
      })
    );

    expect(
      assertInstalledCandidatePackages(consumer, candidate, WEB_PACKAGE_NAMES)
    ).toHaveLength(5);

    const lock = JSON.parse(
      fs.readFileSync(path.join(consumer, 'package-lock.json'), 'utf8')
    );
    lock.packages['node_modules/@vellira-ui/react'].resolved =
      'https://registry.npmjs.org/@vellira-ui/react/-/react.tgz';
    fs.writeFileSync(
      path.join(consumer, 'package-lock.json'),
      JSON.stringify(lock)
    );

    expect(() =>
      assertInstalledCandidatePackages(consumer, candidate, WEB_PACKAGE_NAMES)
    ).toThrow('was not installed from the retained tarball');
  });
});

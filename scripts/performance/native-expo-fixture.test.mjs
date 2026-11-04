import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { getNativeExpoFixture } = require('./native-expo-fixture.cjs');

function withFakeStarter(run, mutate = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-expo58-toolchain-'));
  try {
    const dir = path.join(root, 'examples/workspace-starter/native');
    fs.mkdirSync(dir, { recursive: true });
    const versions = {
      expo: '58.0.22',
      '@expo/metro-runtime': '58.0.16',
      react: '19.3.0',
      'react-native': '0.88.1',
      'react-native-svg': '15.16.0',
      'react-native-safe-area-context': '5.10.1',
      '@types/react': '19.3.0',
      typescript: '6.0.3',
    };
    const prod = [
      'expo', '@expo/metro-runtime', 'react',
      'react-native', 'react-native-svg', 'react-native-safe-area-context',
    ];
    const dev = ['@types/react', 'typescript'];
    const manifest = {
      dependencies: Object.fromEntries(prod.map((name) => [name, versions[name]])),
      devDependencies: Object.fromEntries(dev.map((name) => [name, versions[name]])),
    };
    const lock = {
      lockfileVersion: 3,
      packages: {
        '': { ...structuredClone(manifest) },
        ...Object.fromEntries(Object.entries(versions).map(
          ([name, version]) => ['node_modules/' + name, { version }]
        )),
      },
    };
    mutate(manifest, lock);
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest));
    fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify(lock));
    run(root, versions);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('preserves exact old Metro/Expo proof profile', () => {
  const actual = getNativeExpoFixture();
  assert.equal(actual.profile, 'legacy57');
  assert.equal(actual.dependencies.expo, '57.0.31');
  assert.equal(actual.dependencies['react-native'], '0.86.3');
  assert.equal(actual.lockSha256, null);
});

test('pins every current Expo 58 dependency to the locked package version', () => {
  withFakeStarter((repo, versions) => {
    const actual = getNativeExpoFixture('starter58', repo);
    assert.equal(actual.profile, 'starter58');
    for (const [name, version] of Object.entries(versions)) {
      assert.equal((actual.dependencies[name] ?? actual.devDependencies[name]), version);
    }
    assert.match(actual.lockSha256, /^[a-f0-9]{64}$/);
    const file = fs.readFileSync(
      path.join(repo, 'examples/workspace-starter/native/package-lock.json')
    );
    assert.equal(actual.lockSha256, crypto.createHash('sha256').update(file).digest('hex'));
  });
});

test('rejects missing lock entry and manifest/lock version authority drift', () => {
  withFakeStarter((repo) => {
    assert.throws(
      () => getNativeExpoFixture('starter58', repo),
      /Starter58 lockfile drift for expo/
    );
  }, (_, lock) => {
    delete lock.packages['node_modules/expo'];
  });
  withFakeStarter((repo) => {
    assert.throws(
      () => getNativeExpoFixture('starter58', repo),
      /Starter58 lockfile drift for react-native/
    );
  }, (manifest) => {
    manifest.dependencies['react-native'] = '0.90.0';
  });
});

test('rejects unsupported profiles and unsupported future RN-major upgrades', () => {
  assert.throws(() => getNativeExpoFixture('unknown'), /Unsupported native Expo/);
  withFakeStarter((repo) => {
    assert.throws(
      () => getNativeExpoFixture('starter58', repo),
      /toolchain versions do not match/
    );
  }, (manifest, lock) => {
    manifest.dependencies['react-native'] = '0.90.0';
    lock.packages[''].dependencies['react-native'] = '0.90.0';
    lock.packages['node_modules/react-native'].version = '0.90.0';
  });
});

// Reuse the published Starter's exact dependency lock when validating a
// current Expo SDK 58 native package. Legacy57 remains a reproducible baseline.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const legacy57 = Object.freeze({
  profile: 'legacy57',
  dependencies: Object.freeze({
    '@expo/metro-runtime': '57.0.17',
    expo: '57.0.31',
    react: '19.2.3',
    'react-native': '0.86.3',
    'react-native-svg': '15.15.4',
    'react-native-safe-area-context': '5.9.1',
  }),
  devDependencies: Object.freeze({
    '@types/react': '19.2.4',
    typescript: '6.0.3',
  }),
  lockSha256: null,
});

const deps = [
  '@expo/metro-runtime', 'expo', 'react', 'react-native',
  'react-native-svg', 'react-native-safe-area-context',
];
const devDeps = ['@types/react', 'typescript'];

function getNativeExpoFixture(
  profile = 'legacy57',
  repo = path.resolve(__dirname, '../..')
) {
  if (profile === 'legacy57') return legacy57;
  if (profile !== 'starter58') {
    throw new Error('Unsupported native Expo proof profile: ' + profile);
  }

  const native = path.join(repo, 'examples/workspace-starter/native');
  const manifest = JSON.parse(
    fs.readFileSync(path.join(native, 'package.json'), 'utf8')
  );
  const lockBytes = fs.readFileSync(path.join(native, 'package-lock.json'));
  const lock = JSON.parse(lockBytes.toString('utf8'));
  const root = lock.packages?.[''];
  if (lock.lockfileVersion !== 3 || !root) {
    throw new Error('Starter58 requires a complete npm lockfile v3');
  }

  function pinned(name, kind) {
    const declared = manifest[kind]?.[name];
    const lockDeclared = root[kind]?.[name];
    const resolved = lock.packages?.['node_modules/' + name]?.version;
    if (!declared || declared !== lockDeclared ||
        !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(resolved ?? '')) {
      throw new Error('Starter58 lockfile drift for ' + name);
    }
    return resolved;
  }

  const dependencies = Object.fromEntries(
    deps.map((name) => [name, pinned(name, 'dependencies')])
  );
  const devDependencies = Object.fromEntries(
    devDeps.map((name) => [name, pinned(name, 'devDependencies')])
  );
  if (!dependencies.expo.startsWith('58.') ||
      !dependencies['@expo/metro-runtime'].startsWith('58.') ||
      !dependencies['react-native'].startsWith('0.88.') ||
      !dependencies.react.startsWith('19.')) {
    throw new Error('Starter58 toolchain versions do not match its authority');
  }

  return {
    profile,
    dependencies,
    devDependencies,
    lockSha256: crypto.createHash('sha256').update(lockBytes).digest('hex'),
  };
}

module.exports = { getNativeExpoFixture };

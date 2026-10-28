const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { assertNativeSubpathContract } = require('./native-subpath-contract.cjs');

const root = {
  'vellira-source': './src/index.ts',
  types: './dist/index.d.ts',
  'react-native': './dist/index.js',
  import: './dist/index.js',
  default: './dist/index.js',
};
const paths = {
  './button': {
    types: './dist/primitives/Button/index.d.ts',
    'react-native': './dist/button.js',
    import: './dist/button.js',
    default: './dist/button.js',
  },
  './theme': {
    types: './dist/theme/index.d.ts',
    'react-native': './dist/theme.js',
    import: './dist/theme.js',
    default: './dist/theme.js',
  },
};
function fixture(exports) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-native-contract-'));
  const manifest = {
    main: './dist/index.js', types: './dist/index.d.ts',
    'react-native': './dist/index.js', exports,
  };
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest));
  for (const file of ['dist/index.js', 'dist/index.d.ts',
    'dist/button.js', 'dist/theme.js', 'dist/primitives/Button/index.d.ts',
    'dist/theme/index.d.ts']) {
    const absolute = path.join(dir, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, '');
  }
  return dir;
}
function withFixture(exports, fn) {
  const dir = fixture(exports);
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
test('current root-only packed contract', () => {
  withFixture({ '.': root }, (dir) => {
    assert.deepEqual(assertNativeSubpathContract(dir), { enabled: false, checkedTargets: 2 });
  });
});
test('complete packed subpaths', () => {
  withFixture({ '.': root, ...paths }, (dir) => {
    assert.deepEqual(assertNativeSubpathContract(dir), { enabled: true, checkedTargets: 6 });
  });
});
test('reject partial subpath rollout', () => {
  withFixture({ '.': root, './button': paths['./button'] }, (dir) => {
    assert.throws(() => assertNativeSubpathContract(dir), /introduced together/);
  });
});
test('reject changed legacy root', () => {
  withFixture({ '.': { ...root, default: './dist/button.js' } }, (dir) => {
    assert.throws(() => assertNativeSubpathContract(dir), /root export contract/);
  });
});
test('reject missing packed target', () => {
  withFixture({ '.': root, ...paths }, (dir) => {
    fs.rmSync(path.join(dir, 'dist/theme.js'));
    assert.throws(() => assertNativeSubpathContract(dir), /Missing packed/);
  });
});
test('reject unexpected native exports', () => {
  withFixture({ '.': root, ...paths, './unsafe': './dist/unsafe.js' }, (dir) => {
    assert.throws(() => assertNativeSubpathContract(dir), /Unexpected native export/);
  });
});

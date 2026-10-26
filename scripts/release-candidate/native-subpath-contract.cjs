const fs = require('node:fs');
const path = require('node:path');

const ROOT = Object.freeze({
  'vellira-source': './src/index.ts',
  types: './dist/index.d.ts',
  'react-native': './dist/index.js',
  import: './dist/index.js',
  default: './dist/index.js',
});

const SUBPATHS = Object.freeze({
  './button': Object.freeze({
    types: './dist/primitives/Button/index.d.ts',
    'react-native': './dist/button.js',
    import: './dist/button.js',
    default: './dist/button.js',
  }),
  './theme': Object.freeze({
    types: './dist/theme/index.d.ts',
    'react-native': './dist/theme.js',
    import: './dist/theme.js',
    default: './dist/theme.js',
  }),
});

function assertNativeSubpathContract(packageDir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  const exports = manifest.exports ?? {};
  if (JSON.stringify(exports['.']) !== JSON.stringify(ROOT)) {
    throw new Error('React Native root export contract changed');
  }
  if (manifest.main !== './dist/index.js' ||
      manifest.types !== './dist/index.d.ts' ||
      manifest['react-native'] !== './dist/index.js') {
    throw new Error('React Native legacy entry fields changed');
  }
  const present = Object.keys(SUBPATHS).filter((key) => Object.hasOwn(exports, key));
  if (present.length > 0 && present.length !== Object.keys(SUBPATHS).length) {
    throw new Error('React Native subpaths must be introduced together');
  }
  const allowed = new Set(['.', ...Object.keys(SUBPATHS)]);
  const unexpected = Object.keys(exports).filter((key) => !allowed.has(key));
  if (unexpected.length) throw new Error('Unexpected native export: ' + unexpected.join(', '));
  const paths = [ROOT.types, ROOT.default];
  for (const key of present) {
    if (JSON.stringify(exports[key]) !== JSON.stringify(SUBPATHS[key])) {
      throw new Error('Native subpath export contract differs: ' + key);
    }
    paths.push(SUBPATHS[key].types, SUBPATHS[key].default);
  }
  for (const relative of paths) {
    const absolute = path.resolve(packageDir, relative);
    if (!absolute.startsWith(path.resolve(packageDir) + path.sep) ||
        !fs.statSync(absolute, { throwIfNoEntry: false })?.isFile()) {
      throw new Error('Missing packed native export target: ' + relative);
    }
  }
  return { enabled: present.length > 0, checkedTargets: paths.length };
}

module.exports = { assertNativeSubpathContract };

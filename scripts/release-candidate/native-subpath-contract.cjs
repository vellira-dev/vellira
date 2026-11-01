const fs = require('node:fs');
const path = require('node:path');

const ROOT = Object.freeze({
  'vellira-source': './src/index.ts',
  types: './dist/index.d.ts',
  'react-native': './dist/index.js',
  import: './dist/index.js',
  default: './dist/index.js',
});

const catalog = require('../../packages/react-native/native-subpaths.json');
if (Object.keys(catalog).length !== 17 ||
    Object.entries(catalog).some(([key, source]) =>
      !/^[a-z]+(?:-[a-z]+)*$/.test(key) ||
      !/^src\/(?:components|patterns|primitives|theme)\/[A-Za-z]+(?:\/[A-Za-z]+)*\/index\.ts$/.test(source) &&
      source !== 'src/theme/index.ts'
    )) {
  throw new Error('Invalid canonical Native shared-subpath catalog.');
}

const SUBPATHS = Object.freeze(Object.fromEntries(
  Object.entries(catalog).map(([name, source]) => {
    const js = './dist/' + name + '.js';
    return ['./' + name, Object.freeze({
      'vellira-source': './' + source,
      types: './dist/' + source.slice(4).replace(/\.ts$/, '.d.ts'),
      'react-native': js,
      import: js,
      default: js,
    })];
  })
));

// Requires one complete export set. Historical root-only fixtures may
// explicitly opt in to compatibility inspection, never release admission.
function assertNativeSubpathContract(packageDir, { allowLegacyRootOnly = false } = {}) {
  const rootDir = path.resolve(packageDir);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
  );
  const exported = manifest.exports ?? {};
  if (JSON.stringify(exported['.']) !== JSON.stringify(ROOT)) {
    throw new Error('React Native root export contract changed');
  }
  if (manifest.main !== ROOT.default || manifest.types !== ROOT.types ||
      manifest['react-native'] !== ROOT['react-native']) {
    throw new Error('React Native legacy entry fields changed');
  }
  const keys = Object.keys(SUBPATHS);
  const present = keys.filter((key) => Object.hasOwn(exported, key));
  if (present.length && present.length !== keys.length) {
    throw new Error('React Native subpaths must be introduced together');
  }
  if (!present.length && !allowLegacyRootOnly) {
    throw new Error('Native shared-subpath export set missing');
  }
  const unexpected = Object.keys(exported).filter(
    (key) => key !== '.' && !Object.hasOwn(SUBPATHS, key)
  );
  if (unexpected.length) {
    throw new Error('Unexpected native export: ' + unexpected.join(', '));
  }
  const targets = [ROOT.types, ROOT.default];
  for (const key of present) {
    if (JSON.stringify(exported[key]) !== JSON.stringify(SUBPATHS[key])) {
      throw new Error('Native subpath export contract differs: ' + key);
    }
    targets.push(SUBPATHS[key].types, SUBPATHS[key].default);
  }
  for (const relative of targets) {
    const absolute = path.resolve(rootDir, relative);
    if (!absolute.startsWith(rootDir + path.sep) ||
        !fs.statSync(absolute, { throwIfNoEntry: false })?.isFile()) {
      throw new Error('Missing packed native export target: ' + relative);
    }
  }

  // Validate every static ESM chunk edge in the installed package. A manifest
  // whose entry files exist but whose imported chunk is absent must fail.
  const dist = path.join(rootDir, 'dist');
  const seen = new Set();
  const pending = targets.filter((x) => x.endsWith('.js')).map(
    (x) => path.resolve(rootDir, x)
  );
  const staticImports = /(?:\bfrom\s*|\bimport\s*(?:\(|)|\brequire\s*\()(['"])(\.{1,2}\/[^'"]+)\1/g;
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    if (!file.startsWith(dist + path.sep) ||
        !fs.statSync(file, { throwIfNoEntry: false })?.isFile()) {
      throw new Error('Missing packed native JS chunk: ' + file);
    }
    seen.add(file);
    const code = fs.readFileSync(file, 'utf8');
    for (const match of code.matchAll(staticImports)) {
      const target = path.resolve(path.dirname(file), match[2]);
      if (!target.startsWith(dist + path.sep) || !target.endsWith('.js')) {
        throw new Error('Unsafe native JS chunk import: ' + file + ' -> ' + match[2]);
      }
      pending.push(target);
    }
  }
  if (present.length) {
    // Reject JS that was accidentally staged by legacy subpath probes or
    // included by an overbroad npm files glob but is not in the entry graph.
    const walk = (folder) => fs.readdirSync(folder, { withFileTypes: true })
      .flatMap((entry) => {
        const file = path.join(folder, entry.name);
        return entry.isDirectory() ? walk(file) : entry.isFile() && file.endsWith('.js') ? [file] : [];
      });
    const unreferenced = walk(dist).filter((file) => !seen.has(file));
    if (unreferenced.length) {
      throw new Error(
        'Unreferenced native JS files would be published: ' +
        unreferenced.map((file) => path.relative(dist, file)).join(', ')
      );
    }
  }
  return { enabled: present.length > 0, checkedTargets: targets.length, checkedJsFiles: seen.size };
}

module.exports = { ROOT, SUBPATHS, assertNativeSubpathContract };

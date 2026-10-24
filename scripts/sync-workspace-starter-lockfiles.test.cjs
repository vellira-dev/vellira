const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { validateStarterLock, syncStarterLockfiles, NPM_ARGS } =
  require('./sync-workspace-starter-lockfiles.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-npm-locks-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  for (const [project, name, dependencies] of [
    ['web', 'vellira-workspace-react-starter', {
      '@vellira-ui/react': '2.186.4', react: '19.3.0',
    }],
    ['native', 'vellira-workspace-native-starter', {
      '@vellira-ui/react-native': '2.186.4', react: '19.3.0',
    }],
  ]) {
    const dir = path.join(root, 'examples/workspace-starter', project);
    fs.mkdirSync(dir, { recursive: true });
    const manifest = { name, private: true, version: '1.0.0',
      dependencies, devDependencies: { typescript: '^6.0.0' } };
    const entries = Object.fromEntries(
      Object.entries({ ...dependencies, ...manifest.devDependencies }).map(([dep, version]) => [
        'node_modules/' + dep,
        { version: version.startsWith('^') ? '6.0.3' : version,
          resolved: 'https://registry.npmjs.org/' +
            dep.replaceAll('/', '%2f') + '/-/package.tgz',
          integrity: 'sha512-QUJDRA==' },
      ])
    );
    const lock = { name, version: '1.0.0', lockfileVersion: 3, requires: true,
      packages: { '': { name, version: '1.0.0',
        dependencies, devDependencies: manifest.devDependencies }, ...entries } };
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest));
    fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify(lock));
  }
  return root;
}

function read(root, project) {
  const file = path.join(root, 'examples/workspace-starter', project, 'package-lock.json');
  return { file, lock: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

test('check mode confirms the reviewed exact npm integrity trees with no installs', (t) => {
  const root = fixture(t);
  let calls = 0;
  const result = syncStarterLockfiles({ root, check: true, execute() { calls += 1; } });
  assert.equal(calls, 0);
  assert.deepEqual(result.map((r) => r.project), ['web', 'native']);
});

test('generator invokes only pinned public registry lockfile resolution with scripts disabled', (t) => {
  const root = fixture(t);
  let calls = 0;
  syncStarterLockfiles({
    root,
    execute(command, args, options) {
      calls += 1;
      assert.equal(command, 'npm');
      assert.deepEqual(args, NPM_ARGS);
      assert.ok(args.includes('--ignore-scripts'));
      assert.ok(args.includes('--package-lock-only'));
      assert.ok(args.includes('--registry=https://registry.npmjs.org'));
      assert.equal(options.stdio, 'inherit');
    },
  });
  assert.equal(calls, 2);
});

test('rejects drifted manifest dependencies without rewriting lockfile', (t) => {
  const root = fixture(t);
  const { file, lock } = read(root, 'web');
  lock.packages[''].dependencies.react = '19.4.0';
  fs.writeFileSync(file, JSON.stringify(lock));
  assert.throws(() => syncStarterLockfiles({ root, check: true }), /stale direct/);
});

test('rejects unpinned integrity, other registry URLs, and links', (t) => {
  const root = fixture(t);
  for (const [mutation, pattern] of [
    [(lock) => { delete lock.packages['node_modules/react'].integrity; }, /missing SHA-512/],
    [(lock) => { lock.packages['node_modules/react'].resolved = 'https://evil.example/'; }, /unexpected dependency source/],
    [(lock) => { lock.packages['node_modules/react'].link = true; }, /linked dependency/],
  ]) {
    const { file, lock } = read(root, 'web');
    mutation(lock);
    assert.throws(
      () => validateStarterLock({
        manifest: JSON.parse(fs.readFileSync(file.replace('package-lock.json', 'package.json'), 'utf8')),
        lock, project: 'web',
      }), pattern
    );
  }
});

test('rejects mixed Vellira release pins between platforms', (t) => {
  const root = fixture(t);
  const p = path.join(root, 'examples/workspace-starter/native');
  const m = JSON.parse(fs.readFileSync(path.join(p, 'package.json'), 'utf8'));
  const l = JSON.parse(fs.readFileSync(path.join(p, 'package-lock.json'), 'utf8'));
  m.dependencies['@vellira-ui/react-native'] = '2.186.5';
  l.packages[''].dependencies['@vellira-ui/react-native'] = '2.186.5';
  l.packages['node_modules/@vellira-ui/react-native'].version = '2.186.5';
  fs.writeFileSync(path.join(p, 'package.json'), JSON.stringify(m));
  fs.writeFileSync(path.join(p, 'package-lock.json'), JSON.stringify(l));
  assert.throws(() => syncStarterLockfiles({ root, check: true }), /one published Vellira version/);
});

test('requires exact published Vellira versions and npm v3 lockfiles', (t) => {
  const root = fixture(t);
  const {file,lock}=read(root,'web');
  lock.lockfileVersion = 2;
  assert.throws(() => validateStarterLock({
    manifest: JSON.parse(fs.readFileSync(file.replace('package-lock.json','package.json'),'utf8')),
    lock, project:'web',
  }),/npm v3 lock/);
});

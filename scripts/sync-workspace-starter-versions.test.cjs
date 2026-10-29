const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { syncWorkspaceStarterVersions } = require('./sync-workspace-starter-versions.cjs');

const WEB = 'examples/workspace-starter/web/package.json';
const NATIVE = 'examples/workspace-starter/native/package.json';
const README = 'examples/workspace-starter/README.md';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-starter-sync-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = {
    [WEB]: {
      name: 'vellira-workspace-react-starter',
      version: '1.0.0',
      private: true,
      dependencies: {
        '@vellira-ui/react': '2.179.1',
        '@vellira-ui/tokens': '2.179.1',
        '@vellira-ui/icons': '2.179.1',
        react: '19.3.0',
      },
      devDependencies: { vite: '^8.3.0' },
    },
    [NATIVE]: {
      name: 'vellira-workspace-native-starter',
      version: '1.0.0',
      private: true,
      dependencies: {
        '@vellira-ui/react-native': '2.179.1',
        '@vellira-ui/icons': '2.179.1',
        expo: '~57.0.24',
      },
    },
  };
  for (const [file, value] of Object.entries(files)) {
    const dest = path.join(root, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, `${JSON.stringify(value, null, 2)}\n`);
  }
  fs.writeFileSync(path.join(root, README), 'Both apps pin **Vellira 2.179.1 packages**.\n');
  return root;
}

function read(root, file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('updates all and only exact Vellira pins and README in one pass', (t) => {
  const root = fixture(t);
  const changed = syncWorkspaceStarterVersions({ root, version: '2.185.0' });
  assert.deepEqual(changed, [WEB, NATIVE, README]);
  const web = JSON.parse(read(root, WEB));
  const native = JSON.parse(read(root, NATIVE));
  for (const name of ['@vellira-ui/react', '@vellira-ui/tokens', '@vellira-ui/icons']) {
    assert.equal(web.dependencies[name], '2.185.0');
  }
  assert.equal(native.dependencies['@vellira-ui/react-native'], '2.185.0');
  assert.equal(native.dependencies['@vellira-ui/icons'], '2.185.0');
  assert.equal(web.dependencies.react, '19.3.0');
  assert.equal(web.devDependencies.vite, '^8.3.0');
  assert.equal(native.dependencies.expo, '~57.0.24');
  assert.match(read(root, README), /Vellira 2\.185\.0 packages/);
  assert.deepEqual(syncWorkspaceStarterVersions({ root, version: '2.185.0', check: true }), []);
  assert.deepEqual(syncWorkspaceStarterVersions({ root, version: '2.185.0' }), []);
});

test('check mode fails closed and does not write', (t) => {
  const root = fixture(t);
  const original = [WEB, NATIVE, README].map((p) => read(root, p));
  assert.throws(
    () => syncWorkspaceStarterVersions({ root, version: '2.185.0', check: true }),
    /not synchronized/
  );
  assert.deepEqual([WEB, NATIVE, README].map((p) => read(root, p)), original);
});

test('rejects downgrade, unstable version and inconsistent pins without writes', (t) => {
  const root = fixture(t);
  assert.throws(() => syncWorkspaceStarterVersions({ root, version: '2.170.0' }), /downgrade/);
  assert.throws(() => syncWorkspaceStarterVersions({ root, version: '2.185.0-rc.1' }), /stable/);
  assert.match(read(root, README), /2\.179\.1/);
  const web = JSON.parse(read(root, WEB));
  web.dependencies['@vellira-ui/icons'] = '2.180.0';
  fs.writeFileSync(path.join(root, WEB), JSON.stringify(web));
  assert.throws(() => syncWorkspaceStarterVersions({ root, version: '2.185.0' }), /pin mismatch/);
  assert.match(read(root, NATIVE), /2\.179\.1/);
});

test('rejects a stale Native Starter icons pin without partial writes', (t) => {
  const root = fixture(t);
  const original = JSON.parse(read(root, NATIVE));
  original.dependencies['@vellira-ui/icons'] = '2.179.0';
  fs.writeFileSync(path.join(root, NATIVE), `${JSON.stringify(original, null, 2)}\n`);
  const before = [WEB, NATIVE, README].map((file) => read(root, file));
  assert.throws(
    () => syncWorkspaceStarterVersions({ root, version: '2.185.0' }),
    /pin mismatch/
  );
  assert.deepEqual([WEB, NATIVE, README].map((file) => read(root, file)), before);
});

test('rejects missing or conflicting README proof', (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, README), 'Both apps pin **Vellira 2.170.0 packages**.\n');
  assert.throws(() => syncWorkspaceStarterVersions({ root, version: '2.185.0' }), /README pin/);
  assert.match(read(root, WEB), /2\.179\.1/);
});

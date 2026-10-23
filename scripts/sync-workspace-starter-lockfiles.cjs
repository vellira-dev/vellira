const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PROJECTS = Object.freeze([
  { name: 'web', manifest: 'vellira-workspace-react-starter' },
  { name: 'native', manifest: 'vellira-workspace-native-starter' },
]);
const NPM_ARGS = Object.freeze([
  'install',
  '--package-lock-only',
  '--ignore-scripts',
  '--no-audit',
  '--no-fund',
  '--registry=https://registry.npmjs.org',
]);
const SHA512 = /^sha512-[A-Za-z0-9+/]+={0,2}$/;

function validateStarterLock({ manifest, lock, project }) {
  assert.equal(manifest.private, true, project + ': expected a private example');
  assert.equal(manifest.name, project === 'web'
    ? 'vellira-workspace-react-starter'
    : 'vellira-workspace-native-starter');
  assert.equal(lock.name, manifest.name, project + ': npm lock name mismatch');
  assert.equal(lock.version, manifest.version, project + ': npm lock version mismatch');
  assert.equal(lock.lockfileVersion, 3, project + ': npm v3 lock required');
  assert.deepEqual(lock.packages?.['']?.dependencies, manifest.dependencies,
    project + ': stale direct dependency resolutions');
  assert.deepEqual(lock.packages?.['']?.devDependencies, manifest.devDependencies,
    project + ': stale dev dependency resolutions');
  let count = 0;
  for (const [location, entry] of Object.entries(lock.packages)) {
    if (!location) continue;
    count += 1;
    assert.equal(entry.link, undefined, project + ': linked dependency is not a published npm tarball: ' + location);
    assert.match(entry.integrity ?? '', SHA512,
      project + ': missing SHA-512 integrity: ' + location);
    assert.ok(entry.resolved?.startsWith('https://registry.npmjs.org/'),
      project + ': unexpected dependency source: ' + location);
  }
  assert.ok(count > 0, project + ': empty published dependency graph');
  const directVellira = Object.entries(manifest.dependencies)
    .filter(([name]) => name.startsWith('@vellira-ui/'));
  assert.ok(directVellira.length > 0, project + ': missing Vellira public pins');
  for (const [name, version] of directVellira) {
    assert.match(version, /^\d+\.\d+\.\d+$/, 'Expected exact published version: ' + name);
    const entry = lock.packages['node_modules/' + name];
    assert.equal(entry?.version, version, 'Published Vellira pin mismatch: ' + name);
    assert.match(entry?.integrity ?? '', SHA512,
      'Missing pinned registry integrity: ' + name);
  }
  return { project, packages: count, versions: directVellira.map(([, version]) => version) };
}

function syncStarterLockfiles({ root, check = false, execute = execFileSync }) {
  const results = [];
  for (const project of PROJECTS) {
    const cwd = path.join(root, 'examples/workspace-starter', project.name);
    if (!check) {
      execute('npm', [...NPM_ARGS], { cwd, stdio: 'inherit' });
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    const lock = JSON.parse(fs.readFileSync(path.join(cwd, 'package-lock.json'), 'utf8'));
    results.push(validateStarterLock({ manifest, lock, project: project.name }));
  }
  const pins = new Set(results.flatMap((r) => r.versions));
  assert.equal(pins.size, 1, 'Web and Native examples must use one published Vellira version');
  return results.map(({ project, packages }) => ({ project, packages }));
}

if (require.main === module) {
  const arg = process.argv.slice(2);
  if (arg.length > 1 || (arg.length === 1 && arg[0] !== '--check')) {
    throw new Error('Usage: node scripts/sync-workspace-starter-lockfiles.cjs [--check]');
  }
  const results = syncStarterLockfiles({
    root: path.resolve(__dirname, '..'),
    check: arg.length === 1,
  });
  console.log('Pinned npm Starter integrity: ' + JSON.stringify(results));
}

module.exports = { validateStarterLock, syncStarterLockfiles, NPM_ARGS };

const fs = require('node:fs');
const path = require('node:path');

const MANIFESTS = [
  {
    file: 'examples/workspace-starter/web/package.json',
    name: 'vellira-workspace-react-starter',
    packages: ['@vellira-ui/react', '@vellira-ui/tokens', '@vellira-ui/icons'],
  },
  {
    file: 'examples/workspace-starter/native/package.json',
    name: 'vellira-workspace-native-starter',
    packages: ['@vellira-ui/react-native', '@vellira-ui/icons'],
  },
];
const README = 'examples/workspace-starter/README.md';
const README_PIN = /\*\*Vellira (\d+\.\d+\.\d+) packages\*\*/g;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function compareVersions(a, b) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

function syncWorkspaceStarterVersions({ root, version, check = false }) {
  if (!VERSION.test(version)) {
    throw new Error(`Expected a stable x.y.z version, got ${version}`);
  }

  const edits = [];
  let oldVersion;
  for (const manifest of MANIFESTS) {
    const filename = path.join(root, manifest.file);
    const original = fs.readFileSync(filename, 'utf8');
    const pkg = JSON.parse(original);
    if (pkg.name !== manifest.name || pkg.private !== true) {
      throw new Error(`Unexpected Starter identity in ${manifest.file}`);
    }
    for (const name of manifest.packages) {
      const found = pkg.dependencies?.[name];
      if (!VERSION.test(found ?? '')) {
        throw new Error(`Expected an exact pinned ${name} version in ${manifest.file}`);
      }
      if (oldVersion !== undefined && oldVersion !== found) {
        throw new Error(`Vellira Starter pin mismatch: ${name}=${found}, expected ${oldVersion}`);
      }
      oldVersion = found;
      pkg.dependencies[name] = version;
    }
    edits.push({ file: manifest.file, original, updated: `${JSON.stringify(pkg, null, 2)}\n` });
  }

  const readmeFilename = path.join(root, README);
  const readmeOriginal = fs.readFileSync(readmeFilename, 'utf8');
  const pins = [...readmeOriginal.matchAll(README_PIN)];
  if (pins.length !== 1 || pins[0][1] !== oldVersion) {
    throw new Error(`README pin must match Starter manifests (${oldVersion}) exactly once`);
  }
  if (compareVersions(version, oldVersion) < 0) {
    throw new Error(`Refusing to downgrade Starter from ${oldVersion} to ${version}`);
  }
  const readmeUpdated = readmeOriginal.replace(
    `**Vellira ${oldVersion} packages**`,
    `**Vellira ${version} packages**`
  );
  edits.push({ file: README, original: readmeOriginal, updated: readmeUpdated });

  const changed = edits.filter(({ original, updated }) => original !== updated);
  if (check && changed.length) {
    throw new Error(`Starter is not synchronized to ${version}: ${changed.map((x) => x.file).join(', ')}`);
  }
  if (!check) {
    for (const { file, updated } of changed) {
      fs.writeFileSync(path.join(root, file), updated);
    }
  }
  return changed.map((x) => x.file);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const version = args[0];
  const check = args.length === 2 && args[1] === '--check';
  if (args.length < 1 || args.length > 2 || (args.length === 2 && !check)) {
    console.error('Usage: node scripts/sync-workspace-starter-versions.cjs <version> [--check]');
    process.exit(1);
  }
  try {
    const files = syncWorkspaceStarterVersions({
      root: path.resolve(__dirname, '..'),
      version,
      check,
    });
    console.log(
      check
        ? `Starter pinned to ${version}: PASS`
        : files.length
          ? `Starter pinned to ${version}: ${files.join(', ')}`
          : `Starter already pinned to ${version}`
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { syncWorkspaceStarterVersions };

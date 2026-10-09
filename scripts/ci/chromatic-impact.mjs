import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{40}$/;
const ZERO_SHA = /^0{40}$/;
const PACKAGE_MANIFEST = /^(?:package\.json|packages\/[^/]+\/package\.json)$/;
const CHROMATIC_DOCS_ONLY_PREFIXES = ['apps/docs/', 'docs/'];
const CHROMATIC_DOCS_ONLY_BASENAMES = new Set([
  'README.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'SECURITY.md',
]);

export function isChromaticDocsOnlyPath(filePath) {
  return (
    CHROMATIC_DOCS_ONLY_BASENAMES.has(filePath) ||
    CHROMATIC_DOCS_ONLY_PREFIXES.some((prefix) => filePath.startsWith(prefix))
  );
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function isVersionOnlyManifestChange(change) {
  if (!PACKAGE_MANIFEST.test(change.path)) return false;
  if (typeof change.before !== 'string' || typeof change.after !== 'string') {
    return false;
  }

  let before;
  let after;
  try {
    before = JSON.parse(change.before);
    after = JSON.parse(change.after);
  } catch {
    return false;
  }

  if (
    !before ||
    !after ||
    typeof before !== 'object' ||
    typeof after !== 'object' ||
    typeof before.version !== 'string' ||
    typeof after.version !== 'string' ||
    before.version === after.version
  ) {
    return false;
  }

  const { version: _beforeVersion, ...beforeWithoutVersion } = before;
  const { version: _afterVersion, ...afterWithoutVersion } = after;

  return (
    canonicalJson(beforeWithoutVersion) === canonicalJson(afterWithoutVersion)
  );
}

export function classifyChromaticImpact(changes) {
  if (changes.length === 0) {
    return {
      schemaVersion: 1,
      shouldRun: true,
      reason: 'empty-change-set',
      changedFiles: [],
    };
  }

  const changedFiles = changes.map((change) => change.path).sort();

  if (changes.every((change) => isChromaticDocsOnlyPath(change.path))) {
    return {
      schemaVersion: 1,
      shouldRun: false,
      reason: 'docs-only',
      changedFiles,
    };
  }

  if (changes.every(isVersionOnlyManifestChange)) {
    const transitions = new Set(
      changes.map((change) => {
        const before = JSON.parse(change.before);
        const after = JSON.parse(change.after);
        return `${before.version}->${after.version}`;
      })
    );
    if (transitions.size === 1) {
      return {
        schemaVersion: 1,
        shouldRun: false,
        reason: 'version-only-manifest-sync',
        changedFiles,
      };
    }
  }

  return {
    schemaVersion: 1,
    shouldRun: true,
    reason: 'visual-impact-not-proven-absent',
    changedFiles,
  };
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trimEnd();
}

function readAtRevision(revision, filename) {
  try {
    return git(['show', `${revision}:${filename}`]);
  } catch {
    return null;
  }
}

export function classifyGitRange(baseSha, headSha) {
  if (!SHA.test(baseSha ?? '') || !SHA.test(headSha ?? '')) {
    throw new Error('Chromatic impact requires valid 40-character base/head SHAs');
  }

  if (ZERO_SHA.test(baseSha)) {
    return {
      schemaVersion: 1,
      shouldRun: true,
      reason: 'missing-comparable-base',
      changedFiles: [],
    };
  }

  const output = git(['diff', '--name-only', `${baseSha}...${headSha}`, '--']);
  const files = output.length === 0 ? [] : output.split('\n').filter(Boolean);
  const changes = files.map((filename) => ({
    path: filename,
    before: readAtRevision(baseSha, filename),
    after: readAtRevision(headSha, filename),
  }));

  return classifyChromaticImpact(changes);
}

async function writeOutputs(plan) {
  if (!process.env.GITHUB_OUTPUT) return;
  await fs.appendFile(
    process.env.GITHUB_OUTPUT,
    [
      `run_chromatic=${plan.shouldRun}`,
      `reason=${plan.reason}`,
      `changed_files=${JSON.stringify(plan.changedFiles)}`,
      '',
    ].join('\n')
  );
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

async function main() {
  const args = process.argv.slice(2);
  const baseSha = argumentValue(args, '--base');
  const headSha = argumentValue(args, '--head');
  if (!baseSha || !headSha) {
    throw new Error(
      'Usage: node scripts/ci/chromatic-impact.mjs --base <sha> --head <sha>'
    );
  }

  const plan = classifyGitRange(baseSha, headSha);
  await writeOutputs(plan);
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

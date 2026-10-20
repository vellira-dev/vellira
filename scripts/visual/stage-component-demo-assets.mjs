import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const DEMO_ASSET_NAMES = Object.freeze([
  'dropdown-keyboard',
  'button-confirmation',
  'modal-focus',
  'select-keyboard',
  'tabs-keyboard',
]);

export function stageVerifiedComponentMedia(sourceRoot, targetRoot, revision, runId) {
  if (!/^[0-9a-f]{40}$/.test(revision) || String(runId) !== '39277740730') {
    throw new Error('Unexpected immutable component-demo authority.');
  }
  const index = {
    schemaVersion: 1,
    sourceCommitSha: revision,
    sourceRunId: String(runId),
    publishing: 'manual-review-required',
    demos: {},
  };
  const staged = [];
  for (const name of DEMO_ASSET_NAMES) {
    const demoDir = path.join(sourceRoot, name);
    const manifest = JSON.parse(readFileSync(path.join(demoDir, 'manifest.json'), 'utf8'));
    if (manifest.commitSha !== revision || String(manifest.githubRunId) !== String(runId) ||
        manifest.demo !== name || manifest.publishing !== 'manual-review-required' ||
        manifest.social?.profile !== 'square-1200-v1' ||
        manifest.social?.width !== 1200 || manifest.social?.height !== 1200) {
      throw new Error('Untrusted or mismatched media manifest: ' + name);
    }
    const files = manifest.social.files;
    const expected = ['mp4', 'gif', 'png'].map(ext => 'social/' + name + '-social.' + ext);
    if (!files || Object.keys(files).sort().join('|') !== expected.slice().sort().join('|')) {
      throw new Error('Unexpected social asset names for ' + name);
    }
    for (const relative of expected) {
      const from = path.join(demoDir, relative);
      const content = readFileSync(from);
      const digest = createHash('sha256').update(content).digest('hex');
      if (content.length !== files[relative].bytes || digest !== files[relative].sha256) {
        throw new Error('Social source SHA-256 mismatch: ' + name + '/' + relative);
      }
      const filename = path.basename(relative);
      mkdirSync(targetRoot, { recursive: true });
      copyFileSync(from, path.join(targetRoot, filename));
      staged.push(filename);
    }
    index.demos[name] = {
      storyId: manifest.storyId,
      phaseOrder: manifest.social.phaseOrder,
      files: Object.fromEntries(expected.map(rel => [path.basename(rel), files[rel]])),
    };
  }
  writeFileSync(path.join(targetRoot, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  return { count: staged.length, filenames: staged, index };
}

if (process.argv[1] && import.meta.url.endsWith('/' + path.basename(process.argv[1]))) {
  const [source, destination, revision, runId] = process.argv.slice(2);
  if (!source || !destination || !revision || !runId) {
    throw new Error('Usage: node stage-component-demo-assets.mjs <source> <target> <sha> <runId>');
  }
  const result = stageVerifiedComponentMedia(source, destination, revision, runId);
  console.log('Verified and staged ' + result.count + ' immutable social assets.');
}

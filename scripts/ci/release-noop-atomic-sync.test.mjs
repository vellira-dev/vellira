import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('no-op semantic-release never executes atomic sync or creates a sync PR', () => {
  const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
  const release = workflow.slice(workflow.indexOf('  release:'), workflow.indexOf('  recover-existing-release:'));
  assert.match(release, /id: release-change[\s\S]*git diff --quiet HEAD -- package\.json/);
  for (const name of [
    'Prepare verified atomic release and Starter snapshot',
    'Detect version sync changes',
    'Require unchanged pnpm lock for atomic release admission',
  ]) {
    const i = release.indexOf('      - name: ' + name);
    assert.ok(i >= 0, 'Missing ' + name);
    const step = release.slice(i, i + 180);
    assert.ok(step.includes("if: steps.release-change.outputs.changed == 'true'"),
      'No-op release must skip ' + name);
  }
  assert.match(release, /if: steps\.version-sync\.outputs\.changed == 'true'/);
});

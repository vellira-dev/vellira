import { readFileSync } from 'node:fs';

import { expect, it } from 'vitest';

const workflowPath =
  '.github/workflows/canonical-gap-exception-reconciliation.yml';
const workflow = readFileSync(workflowPath, 'utf8');
const metadataPath = 'packages/metadata/package.json';
const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));

const orderedSteps = [
  'run: pnpm install --frozen-lockfile',
  'run: pnpm --filter @vellira-ui/metadata build',
  'name: Preview approved-exception reconciliation',
  'name: Apply bounded reconciliation on exact main',
] as const;

function hasTrustedBootstrap(source: string): boolean {
  let previous = -1;
  for (const step of orderedSteps) {
    const position = source.indexOf(step);
    if (position <= previous) return false;
    previous = position;
  }
  return true;
}

it('builds metadata before reconciliation', () => {
  expect(metadata.name).toBe('@vellira-ui/metadata');
  expect(metadata.exports['.'].import).toBe('./dist/index.js');
  expect(hasTrustedBootstrap(workflow)).toBe(true);
  expect(workflow).toContain('persist-credentials: false');
  expect(workflow).toContain('contents: read');
  expect(workflow).toContain('issues: write');
});

it('rejects missing and late metadata bootstrap', () => {
  const withoutBuild = workflow.replace(orderedSteps[1], '');
  expect(hasTrustedBootstrap(withoutBuild)).toBe(false);
  const lateBuild = withoutBuild + '\n' + orderedSteps[1];
  expect(hasTrustedBootstrap(lateBuild)).toBe(false);
});

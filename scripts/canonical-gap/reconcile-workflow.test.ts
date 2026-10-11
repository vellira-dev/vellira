import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  '.github/workflows/canonical-gap-exception-reconciliation.yml',
  'utf8'
);
const metadata = JSON.parse(
  readFileSync('packages/metadata/package.json', 'utf8')
) as {
  name: string;
  exports: { '.': { import: string } };
};

const install = 'run: pnpm install --frozen-lockfile';
const build = 'run: pnpm --filter @vellira-ui/metadata build';
const preview = 'name: Preview approved-exception reconciliation';
const apply = 'name: Apply bounded reconciliation on exact main';

function assertBootstrappedWorkflow(source: string): void {
  const installAt = source.indexOf(install);
  const buildAt = source.indexOf(build);
  const previewAt = source.indexOf(preview);
  const applyAt = source.indexOf(apply);
  if (
    installAt < 0 ||
    buildAt <= installAt ||
    previewAt <= buildAt ||
    applyAt <= previewAt
  ) {
    throw new Error(
      'Canonical gap reconciliation must build the metadata package before preview or apply.'
    );
  }
}

describe('clean-runner canonical gap reconciliation bootstrap', () => {
  it('builds the actual runtime dependency before import and GitHub mutation', () => {
    expect(metadata.name).toBe('@vellira-ui/metadata');
    expect(metadata.exports['.'].import).toBe('./dist/index.js');
    expect(() => assertBootstrappedWorkflow(workflow)).not.toThrow();
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('issues: write');
  });

  it('rejects absent or reordered metadata bootstrap', () => {
    expect(() => assertBootstrappedWorkflow(workflow.replace(build, ''))).toThrow(
      /must build the metadata/
    );
    expect(() =>
      assertBootstrappedWorkflow(
        workflow.replace(build, '').replace(preview, build + '\n' + preview)
      )
    ).toThrow(/must build the metadata/);
  });
});

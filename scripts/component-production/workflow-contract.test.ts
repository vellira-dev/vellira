import fs from 'node:fs';

import { expect, it } from 'vitest';

const producer = fs.readFileSync(
  '.github/workflows/component-production.yml',
  'utf8'
);
const consumer = fs.readFileSync(
  '.github/workflows/canonical-gap-orchestrator.yml',
  'utf8'
);

it('keeps the trusted producer and canonical-gap consumer artifact contract aligned', () => {
  expect(producer).toContain('name: Component Production');
  expect(producer).toContain('source_sha:');
  expect(producer).toContain('spec_path:');
  expect(producer).toContain('source_pr_number:');
  expect(producer).toContain('WORKFLOW_HEAD_SHA: ${{ github.sha }}');
  expect(producer).toContain('test "$SOURCE_HEAD_SHA" = "$WORKFLOW_HEAD_SHA"');
  expect(producer).toContain(
    'pnpm --silent component-production:json --spec "$SPEC_PATH"'
  );
  expect(producer).toContain('component-production-${{ inputs.source_sha }}');
  expect(producer).toContain('production-report.json');
  expect(producer).toContain('routing-context.json');
  expect(producer).toContain('sha256sum "$report"');
  expect(producer).toContain('sourceRevision:process.env.SOURCE_HEAD_SHA');
  expect(producer).toContain(
    'sourcePullRequest:Number(process.env.SOURCE_PR_NUMBER)'
  );
  expect(producer).toContain('reportSha256:process.env.REPORT_SHA256');
  expect(producer).toContain(
    "launchCritical:process.env.LAUNCH_CRITICAL === 'true'"
  );
  expect(producer).toContain('contents: read');
  expect(producer).not.toContain('issues: write');
  expect(producer).not.toContain('GITHUB_TOKEN:');
  expect(consumer).toContain('workflows: [CI, Component Production]');
  expect(consumer).toContain(
    'artifact_name="component-production-$SOURCE_HEAD_SHA"'
  );
  expect(consumer).toContain('source_name=production-report.json');
  expect(consumer).toContain(
    'source_context="$download_dir/routing-context.json"'
  );
  expect(consumer).toContain("'--production-report' || '--report'");
  expect(consumer).toContain('issues: write');
  expect(consumer).toContain(
    'SOURCE_CONCLUSION: ${{ github.event.workflow_run.conclusion }}'
  );
  expect(consumer).toContain('if [[ "$SOURCE_CONCLUSION" != success ]]');
  expect(consumer).toContain('!Number.isInteger(value.sourcePullRequest)');
  expect(consumer).toContain(
    'steps.report.outputs.source_pr_number || github.event.workflow_run.pull_requests[0].number'
  );
});

it('retains blocked reports while rejecting malformed production output', () => {
  expect(producer).toContain('if [[ "$status" -gt 1 ]]');
  expect(producer).toContain("$status === 1 && result.status !== 'blocked'");
  expect(producer).toContain("result.schemaVersion !== '1'");
  expect(producer).toContain('if: always()');
  expect(consumer).toContain(
    'Component Production did not complete successfully.'
  );
});

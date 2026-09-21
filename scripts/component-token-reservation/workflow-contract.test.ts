import fs from 'node:fs';

import { expect, it } from 'vitest';

const workflow = fs.readFileSync(
  '.github/workflows/component-token-reservation.yml',
  'utf8'
);

function normalized(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

it('keeps the reservation workflow bounded to exact trusted default-branch authority', () => {
  expect(workflow).toContain('name: Component Token Reservation');
  expect(workflow).toContain('workflow_dispatch:');
  expect(workflow).not.toMatch(
    /pull_request_target|workflow_run|issue_comment:/
  );
  expect(normalized(workflow)).toContain(
    'permissions: contents: write issues: read pull-requests: write'
  );
  expect(workflow.match(/issues: write/g)).toBeNull();
  expect(workflow).toContain('test "$SOURCE_REVISION" = "$WORKFLOW_REVISION"');
  expect(workflow).toContain(
    'test "$WORKFLOW_REF" = "refs/heads/$default_branch"'
  );
  expect(workflow).toContain('test "$current_sha" = "$SOURCE_REVISION"');
  expect(workflow).toContain('ref: ${{ github.sha }}');
  expect(workflow).toContain('persist-credentials: false');
  expect(workflow).toContain('GITHUB_TOKEN: ${{ github.token }}');
  expect(workflow).toContain('--issue-number "$ISSUE_NUMBER"');
  expect(workflow).toContain('--source-revision "$SOURCE_REVISION"');
  expect(workflow).not.toMatch(
    /git push|checkout .*inputs\.source|issue\.body|fromJSON/
  );
  expect(workflow).not.toContain('Toast');
});

it('retains deterministic evidence and dry-run/apply boundaries', () => {
  expect(workflow).toContain(
    'group: component-token-reservation-${{ inputs.issue_number }}'
  );
  expect(workflow).toContain(
    'if [[ "$DRY_RUN" != true ]]; then arguments+=(--apply); fi'
  );
  expect(workflow.match(/--apply/g)).toHaveLength(1);
  expect(workflow).toContain(
    'component-token-reservation-${{ inputs.source_sha }}-${{ inputs.issue_number }}-${{ github.run_id }}'
  );
  expect(workflow).toContain(
    '.artifacts/component-token-reservation/result.json'
  );
});

it('contains no component-specific implementation or lifecycle reservation', () => {
  const productionSources = fs
    .readdirSync('scripts/component-token-reservation')
    .filter(
      (file) =>
        file.endsWith('.ts') &&
        !file.endsWith('.test.ts') &&
        file !== 'test-helpers.ts'
    );
  for (const file of productionSources) {
    expect(
      fs.readFileSync(`scripts/component-token-reservation/${file}`, 'utf8')
    ).not.toContain('Toast');
  }
  expect(
    fs.readFileSync('packages/metadata/src/tokenLifecycle.ts', 'utf8')
  ).not.toMatch(/^\s*Toast:/m);
});

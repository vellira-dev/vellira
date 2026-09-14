import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

const workflow = fs.readFileSync(
  '.github/workflows/canonical-gap-orchestrator.yml',
  'utf8'
);
const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
const temporaryRoots: string[] = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

// Scope assertions to executable YAML fields/steps, not comments or unrelated
// occurrences elsewhere in the workflow. No extra parser dependency is needed.
function topLevel(source: string, key: string) {
  const lines = source.split('\n');
  const positions = lines.flatMap((line, index) =>
    line === `${key}:` ? [index] : []
  );
  expect(positions, key).toHaveLength(1);
  const start = positions[0] + 1;
  let end = start;
  while (
    end < lines.length &&
    (!lines[end].trim() || lines[end].startsWith(' '))
  )
    end += 1;
  return lines.slice(start, end).join('\n').trim();
}
function namedStep(source: string, name: string) {
  const matches = source
    .split(/^ {6}- /m)
    .filter((step) => step.startsWith(`name: ${name}\n`));
  expect(matches, name).toHaveLength(1);
  return matches[0];
}
function runScript(step: string) {
  const marker = '        run: |\n';
  expect(step).toContain(marker);
  return step
    .slice(step.indexOf(marker) + marker.length)
    .split('\n')
    .map((line) => line.slice(10))
    .join('\n');
}
function normalized(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function assertSecurityContract(raw: string) {
  const source = raw.replace(/^\s*#.*$/gm, '');
  expect(normalized(topLevel(source, 'permissions'))).toBe(
    'contents: read actions: read pull-requests: read issues: write'
  );
  expect(source.match(/\bpermissions:/g)).toHaveLength(1);
  expect(source.match(/^\s*issues: write$/gm)).toHaveLength(1);
  expect(topLevel(source, 'jobs').match(/^ {2}[\w-]+:/gm) ?? []).toEqual([]);
  expect(source.match(/^ {2}[\w-]+:\n {4}name:/gm)).toEqual([
    '  sync:\n    name:',
  ]);
  expect(topLevel(source, 'on')).toContain(
    'workflow_run:\n    workflows: [CI]\n    types: [completed]'
  );
  expect(topLevel(source, 'on')).toContain('push:\n    branches: [main]');
  expect(source).not.toContain('workflow_run.conclusion');
  expect(normalized(source)).toContain(
    "if: >- github.event_name != 'workflow_run' || (github.event.workflow_run.event == 'pull_request' && github.event.workflow_run.head_repository.full_name == github.repository)"
  );
  expect(normalized(topLevel(source, 'concurrency'))).toBe(
    'group: canonical-gap-orchestrator cancel-in-progress: false'
  );

  const checkout = namedStep(source, 'Checkout trusted orchestration code');
  expect(source.match(/uses: actions\/checkout@/g)).toHaveLength(1);
  expect(checkout).toContain(
    "ref: ${{ github.event_name == 'push' && github.sha || 'main' }}"
  );
  expect(checkout).toContain('persist-credentials: false');
  expect(checkout).not.toMatch(/head_sha|pull_request.head/);

  const install = namedStep(source, 'Install trusted tooling dependencies');
  const metadata = namedStep(source, 'Build trusted metadata dependency');
  expect(install).toContain('run: pnpm install --frozen-lockfile');
  expect(metadata).toContain('run: pnpm --filter @vellira-ui/metadata build');
  expect(source.indexOf(install)).toBeGreaterThan(source.indexOf(checkout));
  expect(source.indexOf(metadata)).toBeGreaterThan(source.indexOf(install));

  const prepare = namedStep(source, 'Prepare exact gap report');
  expect(source.indexOf(prepare)).toBeGreaterThan(source.indexOf(metadata));
  expect(prepare).toContain(
    'SOURCE_RUN_ID: ${{ github.event.workflow_run.id }}'
  );
  expect(prepare).toContain(
    'SOURCE_HEAD_SHA: ${{ github.event.workflow_run.head_sha }}'
  );
  expect(prepare).toContain(
    'SOURCE_PR_NUMBER: ${{ github.event.workflow_run.pull_requests[0].number }}'
  );
  expect(prepare).toContain(
    'artifact_name="vellira-ui-usage-$SOURCE_HEAD_SHA"'
  );
  expect(normalized(prepare)).toContain(
    'gh run download "$SOURCE_RUN_ID" \\ --repo "$GITHUB_REPOSITORY" \\ --name "$artifact_name" \\ --dir "$download_dir"'
  );
  expect(prepare).not.toMatch(/--pattern|find .*report\.json/);
  expect(prepare).toContain('source_report="$download_dir/report.json"');
  expect(prepare).toContain(
    '[[ ! -f "$source_report" || -L "$source_report" ]]'
  );
  expect(prepare).toContain('cp "$source_report" "$report_path"');
  expect(prepare).toContain(
    'pnpm check:vellira-ui-usage:json > "$report_path"'
  );
  expect(prepare).toContain('echo "source_revision=${{ github.sha }}"');

  const guard = namedStep(source, 'Verify current source before routing');
  expect(guard).toContain('trap ');
  expect(guard).toContain("if: steps.report.outputs.ready == 'true'");
  expect(guard).toContain(
    'SOURCE_HEAD_SHA: ${{ github.event.workflow_run.head_sha }}'
  );
  expect(guard).toContain(
    'SOURCE_PR_NUMBER: ${{ github.event.workflow_run.pull_requests[0].number }}'
  );
  expect(guard).toContain('[[ -z "$SOURCE_PR_NUMBER" ]]');
  expect(guard).toContain(
    'gh api "repos/$GITHUB_REPOSITORY/pulls/$SOURCE_PR_NUMBER"'
  );
  expect(guard).toContain(
    "--jq '[.head.sha, .head.repo.full_name, .base.repo.full_name] | @tsv'"
  );
  for (const comparison of [
    '"$current_head" != "$SOURCE_HEAD_SHA"',
    '"$current_repo" != "$GITHUB_REPOSITORY"',
    '"$target_repo" != "$GITHUB_REPOSITORY"',
  ])
    expect(guard).toContain(comparison);
  expect(guard).toContain('echo "current=false" >> "$GITHUB_OUTPUT"');
  expect(guard).toContain('exit 0');
  expect(guard).toContain('echo "current=true" >> "$GITHUB_OUTPUT"');
  expect(source.indexOf(guard)).toBeGreaterThan(source.indexOf(prepare));

  for (const name of [
    'Preview canonical gap routing',
    'Apply canonical gap routing',
  ]) {
    const routing = namedStep(source, name);
    expect(source.indexOf(routing)).toBeGreaterThan(source.indexOf(guard));
    expect(normalized(routing)).toContain(
      "if: >- steps.report.outputs.ready == 'true' && steps.source.outputs.current == 'true' &&"
    );
    expect(routing).toContain('node --import tsx scripts/canonical-gap/cli.ts');
    expect(routing).toContain('--repo "${{ github.repository }}"');
    expect(routing).toContain('--report .artifacts/canonical-gap/report.json');
    expect(routing).toContain('GITHUB_TOKEN: ${{ github.token }}');
    expect(routing).toContain('> .artifacts/canonical-gap/result.json');
    expect(routing).toContain('trap ');
  }
  const preview = namedStep(source, 'Preview canonical gap routing');
  const apply = namedStep(source, 'Apply canonical gap routing');
  expect(normalized(preview)).toContain(
    "github.event_name == 'workflow_dispatch' && inputs.dry_run"
  );
  expect(preview).not.toContain('--apply');
  expect(normalized(apply)).toContain(
    "(github.event_name != 'workflow_dispatch' || !inputs.dry_run)"
  );
  expect(source.match(/--apply/g)).toHaveLength(1);
  expect(apply).toContain('--apply');
  expect(source).not.toMatch(
    /gh (?:issue|label) (?:create|edit)|printenv|set -x|toJSON\(secrets\)/
  );

  const upload = namedStep(source, 'Upload canonical gap evidence');
  expect(upload).toContain(
    "if: always() && steps.report.outputs.ready == 'true'"
  );
  expect(upload).toContain(
    'name: canonical-gap-${{ steps.report.outputs.source_revision || github.sha }}-${{ github.run_id }}'
  );
  expect(upload).toContain(
    'path: |\n            .artifacts/canonical-gap/report.json\n            .artifacts/canonical-gap/result.json'
  );
  expect(upload).not.toMatch(
    /include-hidden-files:\s*true|secrets|TOKEN|credentials|RUNNER_TEMP|\.git\//
  );
  expect(upload).toContain('if-no-files-found: error');
  expect(source).not.toMatch(/PVT_[A-Za-z0-9]|PROJECT_ID|vellira-internal/);
  for (const step of source.split(/^ {6}- /m).slice(1)) {
    if (step !== prepare && step !== guard)
      expect(step).not.toContain('/pulls/');
  }
}

it('enforces the complete trusted orchestration security contract', () =>
  assertSecurityContract(workflow));

it.each([
  ['contents: read', 'contents: write'],
  ['actions: read', 'actions: write'],
  ['pull-requests: read', 'pull-requests: write'],
  ['issues: write', 'issues: read'],
  [
    "github.event_name == 'push' && github.sha || 'main'",
    'github.event.workflow_run.head_sha',
  ],
  ['persist-credentials: false', 'persist-credentials: true'],
  ['run: pnpm --filter @vellira-ui/metadata build', 'run: true'],
  ["github.event.workflow_run.event == 'pull_request'", 'true'],
  [
    'github.event.workflow_run.head_repository.full_name == github.repository',
    'true',
  ],
  [
    'group: canonical-gap-orchestrator',
    'group: canonical-gap-${{ github.ref }}',
  ],
  ['cancel-in-progress: false', 'cancel-in-progress: true'],
  ['vellira-ui-usage-$SOURCE_HEAD_SHA', 'vellira-ui-usage-*'],
  ['gh run download "$SOURCE_RUN_ID"', 'gh run download'],
  ['[[ "$current_head" != "$SOURCE_HEAD_SHA" ||', '[[ false ||'],
  ['"$current_repo" != "$GITHUB_REPOSITORY"', 'false'],
  ['"$target_repo" != "$GITHUB_REPOSITORY"', 'false'],
  ["steps.source.outputs.current == 'true'", 'true'],
  [
    '.artifacts/canonical-gap/report.json\n            .artifacts/canonical-gap/result.json',
    '.',
  ],
])('rejects an unsafe workflow regression: %s', (before, after) => {
  expect(workflow).toContain(before);
  expect(() =>
    assertSecurityContract(workflow.replace(before, after))
  ).toThrow();
});

it('preserves exact-head report evidence even when the read-only CI checker is red', () => {
  expect(normalized(topLevel(ci, 'permissions'))).toBe('contents: read');
  const capture = namedStep(ci, 'Record advisory Vellira UI usage baseline');
  const upload = namedStep(ci, 'Upload exact-head Vellira UI usage baseline');
  expect(capture).toContain('if: always()');
  expect(upload).toContain('if: always()');
  expect(capture).toContain(
    'pnpm check:vellira-ui-usage:json > .artifacts/vellira-ui-usage/report.json'
  );
  expect(upload).toContain(
    'name: vellira-ui-usage-${{ github.event.pull_request.head.sha || github.sha }}'
  );
  expect(upload).toContain('path: .artifacts/vellira-ui-usage/report.json');
  const scripts = JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts;
  expect(scripts['check:vellira-ui-usage:json']).toContain('--report-only');
  expect(scripts['check:vellira-ui-usage:json']).toContain('--json');
  expect(scripts['check:vellira-ui-usage']).not.toContain('--report-only');
});

function temporaryRoot() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'canonical-gap-workflow-')
  );
  temporaryRoots.push(root);
  fs.mkdirSync(path.join(root, '.artifacts/canonical-gap'), {
    recursive: true,
  });
  return root;
}

it.each([
  [
    'same-repo current head',
    'current',
    'vellira-dev/vellira',
    'vellira-dev/vellira',
    '1107',
    true,
  ],
  [
    'stale head',
    'old',
    'vellira-dev/vellira',
    'vellira-dev/vellira',
    '1107',
    false,
  ],
  ['fork', 'current', 'fork/vellira', 'vellira-dev/vellira', '1107', false],
  [
    'wrong base repository',
    'current',
    'vellira-dev/vellira',
    'other/repo',
    '1107',
    false,
  ],
  [
    'missing PR',
    'current',
    'vellira-dev/vellira',
    'vellira-dev/vellira',
    '',
    false,
  ],
] as const)(
  'source verification safe-skips %s as required',
  (_name, head, repo, base, number, allowed) => {
    const root = temporaryRoot();
    const output = path.join(root, 'output');
    const script = runScript(
      namedStep(workflow, 'Verify current source before routing')
    ).replaceAll('${{ github.event_name }}', 'workflow_run');
    const result = spawnSync(
      'bash',
      ['-c', `gh() { printf '%s\\n' "$TEST_PR_STATE"; }\n${script}`],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: 5000,
        env: {
          NODE_ENV: 'test',
          PATH: process.env.PATH,
          SOURCE_HEAD_SHA: 'current',
          SOURCE_PR_NUMBER: number,
          GITHUB_REPOSITORY: 'vellira-dev/vellira',
          GITHUB_OUTPUT: output,
          TEST_PR_STATE: `${head}\t${repo}\t${base}`,
        },
      }
    );
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(output, 'utf8')).toBe(`current=${allowed}\n`);
    if (!allowed)
      expect(
        JSON.parse(
          fs.readFileSync(
            path.join(root, '.artifacts/canonical-gap/result.json'),
            'utf8'
          )
        )
      ).toMatchObject({ status: 'skipped' });
  }
);

it.each(['Preview canonical gap routing', 'Apply canonical gap routing'])(
  '%s retains bounded error evidence without credentials',
  (name) => {
    const root = temporaryRoot();
    const script = runScript(namedStep(workflow, name)).replace(
      /\$\{\{.*?\}\}/g,
      ''
    );
    const result = spawnSync(
      'bash',
      [
        '-c',
        `node() { printf '%s\\n' "$GITHUB_TOKEN" >&2; return 2; }\n${script}`,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: 5000,
        env: {
          NODE_ENV: 'test',
          PATH: process.env.PATH,
          GITHUB_TOKEN: 'test-secret-never-upload',
        },
      }
    );
    expect(result.status).toBe(2);
    const evidence = fs.readFileSync(
      path.join(root, '.artifacts/canonical-gap/result.json'),
      'utf8'
    );
    expect(JSON.parse(evidence)).toMatchObject({
      schemaVersion: '1',
      status: 'error',
    });
    expect(evidence).not.toContain('test-secret-never-upload');
  }
);

it('retains bounded evidence and fails closed when current PR verification fails', () => {
  const root = temporaryRoot();
  const output = path.join(root, 'output');
  const script = runScript(
    namedStep(workflow, 'Verify current source before routing')
  ).replaceAll('${{ github.event_name }}', 'workflow_run');
  const result = spawnSync(
    'bash',
    ['-c', `gh() { printf '%s\\n' "$GH_TOKEN" >&2; return 2; }\n${script}`],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 5000,
      env: {
        NODE_ENV: 'test',
        PATH: process.env.PATH,
        GH_TOKEN: 'test-secret-never-upload',
        SOURCE_HEAD_SHA: 'current',
        SOURCE_PR_NUMBER: '1107',
        GITHUB_REPOSITORY: 'vellira-dev/vellira',
        GITHUB_OUTPUT: output,
      },
    }
  );
  expect(result.status).toBe(2);
  expect(fs.existsSync(output)).toBe(false);
  const evidence = fs.readFileSync(
    path.join(root, '.artifacts/canonical-gap/result.json'),
    'utf8'
  );
  expect(JSON.parse(evidence)).toMatchObject({
    schemaVersion: '1',
    status: 'error',
  });
  expect(evidence).not.toContain('test-secret-never-upload');
});

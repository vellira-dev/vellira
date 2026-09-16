import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  candidateSnapshotFingerprint,
  parseCandidateSnapshot,
  verifyCandidateSnapshot,
  type CandidateSnapshotEntryV1,
  type CandidateSnapshotV1,
} from './candidate-snapshot';
import {
  COMPONENT_PRODUCTION_STAGE_IDS,
  type ComponentProductionInputV1,
  type ComponentProductionStageResult,
} from './contracts';
import { runComponentReviewBundle } from './review-bundle';
import {
  runComponentProductionValidation,
  type ComponentProductionRunDependencies,
} from './run';
import { runComponentProductionValidationCli } from './validate-cli';

const input: ComponentProductionInputV1 = {
  schemaVersion: '1',
  componentName: 'SnapshotProbe',
  platform: 'web',
  layer: 'primitives',
  category: 'data-display',
  profile: 'base',
  capabilities: [],
  componentTokens: 'standard',
  parts: [],
};
let root: string;
let baseRevision: string;
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
function write(filePath: string, value = '') {
  fs.mkdirSync(path.dirname(path.join(root, filePath)), { recursive: true });
  fs.writeFileSync(path.join(root, filePath), value);
}
function entry(
  filePath = 'candidate.txt',
  state: 'added' | 'modified' = 'modified',
  value = 'changed'
): CandidateSnapshotEntryV1 {
  return { path: filePath, state, mode: '100644', sha256: hash(value) };
}
function snapshot(
  entries: CandidateSnapshotEntryV1[] = [entry()]
): CandidateSnapshotV1 {
  return { schemaVersion: '1', baseRevision, entries };
}
function passed(
  id: ComponentProductionStageResult['id']
): ComponentProductionStageResult {
  return {
    id,
    status: 'passed',
    summary: 'Synthetic prerequisite passed',
    artifacts: [],
    findings: [],
  };
}
function bundle(candidateSnapshot?: CandidateSnapshotV1) {
  return runComponentReviewBundle({
    root,
    input,
    completenessStage: passed('completeness'),
    candidateSnapshot,
  });
}
function validators(): ComponentProductionRunDependencies {
  return {
    runCommandValidation: () => ({
      stages: COMPONENT_PRODUCTION_STAGE_IDS.slice(3, 11).map(passed),
    }),
    runStructuredValidation: async () => ({
      stages: [passed('completeness'), passed('quality')],
      completeness: [],
      quality: null,
    }),
    runFinalValidation: () => ({
      stages: ['public-api', 'tooling', 'visual', 'smoke'].map((id) =>
        passed(id as ComponentProductionStageResult['id'])
      ),
    }),
    runReviewBundle: runComponentReviewBundle,
  };
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-snapshot-test-'));
  // Harmless synthetic surfaces: no Generator, validation command or provider.
  const component = 'packages/react/src/primitives/SnapshotProbe';
  const website = 'apps/website/src/component-catalog/components/SnapshotProbe';
  for (const file of [
    'packages/metadata/src/components/SnapshotProbe.metadata.ts',
    'packages/types/src/snapshotProbe.ts',
    ...[
      'SnapshotProbe.tsx',
      'index.ts',
      'SnapshotProbe.test.tsx',
      'SnapshotProbe.test-contract.json',
      'SnapshotProbe.stories.tsx',
    ].map((name) => `${component}/${name}`),
    'packages/react/src/index.ts',
    'apps/docs/src/react/snapshot-probe.md',
    ...[
      'index.ts',
      'SnapshotProbeExamples.tsx',
      'SnapshotProbePlayground.tsx',
      'SnapshotProbeAccessibility.tsx',
      'snapshot-probeApi.ts',
      'SnapshotProbeDemo.tsx',
      'SnapshotProbeCatalogPreview.tsx',
    ].map((name) => `${website}/${name}`),
  ])
    write(file);
  write(
    'apps/website/src/component-catalog/registry/componentPresentation.ts',
    "slug: 'snapshot-probe'"
  );
  write(
    'apps/website/src/component-catalog/registry/componentPages.ts',
    "name: 'SnapshotProbe'"
  );
  write('candidate.txt', 'base');
  write('.gitignore', 'ignored-output\n');
  git('init', '-q');
  git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'user.name', 'Disposable fixture');
  git('config', 'core.filemode', 'true');
  git('add', '.');
  git(
    '-c',
    'core.hooksPath=/dev/null',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-qm',
    'fixture'
  );
  baseRevision = git('rev-parse', 'HEAD');
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('Candidate Snapshot V1 real Git verification', () => {
  it.each(['--assume-unchanged', '--skip-worktree'])(
    'rejects hidden index authority %s',
    (flag) => {
      git('update-index', flag, 'candidate.txt');
      write('candidate.txt', 'hidden drift');
      expect(verifyCandidateSnapshot(root, snapshot([]))).toMatchObject({
        valid: false,
        issues: [{ code: 'index-flags', path: 'candidate.txt' }],
      });
    }
  );
  it('verifies an empty manifest on a clean revision', () => {
    expect(bundle(snapshot([])).report).toMatchObject({
      status: 'ready',
      workingTreeClean: true,
      candidateIdentity: { kind: 'revision', revision: baseRevision },
    });
  });
  it('does not let Git environment or review test hooks substitute candidate identity', () => {
    write('candidate.txt', 'changed');
    vi.stubEnv('GIT_INDEX_FILE', path.join(root, 'nonexistent-index'));
    try {
      const result = runComponentReviewBundle({
        root,
        input,
        completenessStage: passed('completeness'),
        candidateSnapshot: snapshot(),
        dependencies: {
          resolveRevision: () => '0'.repeat(40),
          isWorkingTreeClean: () => true,
        },
      });
      expect(result.report).toMatchObject({
        status: 'ready',
        workingTreeClean: false,
        revision: baseRevision,
        candidateIdentity: { kind: 'working-tree-snapshot' },
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('invalidates identity on every surface if a surface read detects later drift', () => {
    write('candidate.txt', 'changed');
    const exists = fs.existsSync;
    let mutated = false;
    vi.spyOn(fs, 'existsSync').mockImplementation((file) => {
      if (!mutated) {
        mutated = true;
        write('candidate.txt', 'later drift');
      }
      return exists(file);
    });
    const result = bundle(snapshot());
    expect(result.report.status).toBe('blocked');
    expect(result.report.candidateIdentity).toBeNull();
    expect(
      result.report.surfaces
        .flatMap((surface) => surface.evidence)
        .every(
          (evidence) =>
            evidence.candidateIdentity === null &&
            evidence.revision === undefined
        )
    ).toBe(true);
  });
  it('preserves clean revision review and ignored-file behavior', () => {
    write('ignored-output', 'ignored');
    const result = bundle();
    expect(result.report).toMatchObject({
      workingTreeClean: true,
      status: 'ready',
      candidateIdentity: { kind: 'revision', revision: baseRevision },
    });
    for (const surface of result.report.surfaces)
      for (const evidence of surface.evidence) {
        expect(evidence.candidateIdentity).toEqual(
          result.report.candidateIdentity
        );
        expect(evidence.revision).toBe(baseRevision);
      }
  });
  it('preserves the dirty-without-snapshot blocker exactly', () => {
    write('candidate.txt', 'changed');
    expect(bundle().report.blockingFindings).toEqual([
      expect.objectContaining({
        id: 'completeness:review-bundle:working-tree',
        ruleId: 'review-bundle.exact-revision',
      }),
    ]);
  });
  it.each(['modified', 'added', 'deleted', 'mode', 'symlink'] as const)(
    'verifies exact %s snapshot and never mutates the index',
    (state) => {
      let entries: CandidateSnapshotEntryV1[];
      if (state === 'deleted') {
        fs.unlinkSync(path.join(root, 'candidate.txt'));
        entries = [{ path: 'candidate.txt', state: 'deleted' }];
      } else if (state === 'mode') {
        fs.chmodSync(path.join(root, 'candidate.txt'), 0o755);
        entries = [
          {
            ...entry('candidate.txt', 'modified', 'base'),
            mode: '100755',
          } as CandidateSnapshotEntryV1,
        ];
      } else if (state === 'symlink') {
        fs.symlinkSync('candidate.txt', path.join(root, 'link'));
        entries = [
          {
            path: 'link',
            state: 'added',
            mode: '120000',
            sha256: hash('candidate.txt'),
          },
        ];
      } else {
        const filePath = state === 'added' ? 'new file.txt' : 'candidate.txt';
        write(filePath, 'changed');
        entries = [entry(filePath, state)];
      }
      const index = fs.readFileSync(path.join(root, '.git/index'));
      const result = bundle(snapshot(entries));
      expect(result.report).toMatchObject({
        workingTreeClean: false,
        status: 'ready',
        candidateIdentity: {
          kind: 'working-tree-snapshot',
          baseRevision,
          fingerprint: candidateSnapshotFingerprint(snapshot(entries)),
          changedPaths: entries.map((e) => e.path),
        },
      });
      expect(result.completenessStage.status).toBe('passed');
      for (const surface of result.report.surfaces)
        for (const evidence of surface.evidence) {
          expect(evidence.candidateIdentity).toEqual(
            result.report.candidateIdentity
          );
          expect(evidence).not.toHaveProperty('revision');
        }
      expect(fs.readFileSync(path.join(root, '.git/index'))).toEqual(index);
    }
  );
  it('handles staged/unstaged changes and renames as deletion plus addition', () => {
    git('mv', 'candidate.txt', 'renamed file.txt');
    write('renamed file.txt', 'changed');
    const result = verifyCandidateSnapshot(
      root,
      snapshot([
        { path: 'candidate.txt', state: 'deleted' },
        entry('renamed file.txt', 'added'),
      ])
    );
    expect(result.valid).toBe(true);
  });
  it.each([
    [
      'unexpected-path',
      () => {
        write('unrelated', 'extra');
      },
      () => snapshot(),
    ],
    [
      'missing-path',
      () => {},
      () => snapshot([entry(), entry('clean.txt', 'added')]),
    ],
    [
      'missing-path',
      () => {
        fs.unlinkSync(path.join(root, 'candidate.txt'));
      },
      () => snapshot([entry(), entry('absent', 'added')]),
    ],
    [
      'digest',
      () => {},
      () => snapshot([entry('candidate.txt', 'modified', 'tampered')]),
    ],
    [
      'base-revision',
      () => {},
      () => ({ ...snapshot(), baseRevision: '0'.repeat(40) }),
    ],
    ['state', () => {}, () => snapshot([entry('candidate.txt', 'added')])],
    [
      'state',
      () => {
        fs.unlinkSync(path.join(root, 'candidate.txt'));
      },
      () => snapshot(),
    ],
    [
      'state',
      () => {
        write('new', 'changed');
      },
      () => snapshot([entry(), { path: 'new', state: 'deleted' }]),
    ],
    [
      'mode',
      () => {},
      () =>
        snapshot([{ ...entry(), mode: '100755' } as CandidateSnapshotEntryV1]),
    ],
    [
      'mode',
      () => {},
      () =>
        snapshot([{ ...entry(), mode: '120000' } as CandidateSnapshotEntryV1]),
    ],
  ] as const)('blocks %s contradictions', (code, mutate, manifest) => {
    write('candidate.txt', 'changed');
    mutate();
    const result = bundle(manifest());
    expect(result.report.status).toBe('blocked');
    expect(result.report.candidateIdentity).toBeNull();
    expect(result.completenessStage.status).toBe('blocked');
    expect(result.report.blockingFindings).toContainEqual(
      expect.objectContaining({
        ruleId: `review-bundle.candidate-snapshot.${code}`,
      })
    );
  });
  it('rejects a manifest entry for an actually clean path, even on a clean tree', () => {
    expect(verifyCandidateSnapshot(root, snapshot()).valid).toBe(false);
    expect(bundle(snapshot()).report.status).toBe('blocked');
  });
  it('does not accept index-only modification with base-equivalent worktree bytes', () => {
    write('candidate.txt', 'changed');
    git('add', 'candidate.txt');
    write('candidate.txt', 'base');
    expect(
      verifyCandidateSnapshot(
        root,
        snapshot([entry('candidate.txt', 'modified', 'base')])
      )
    ).toMatchObject({
      valid: false,
      issues: [{ code: 'state', path: 'candidate.txt' }],
    });
  });
  it('rejects symlink ancestors rather than reading through them', () => {
    fs.symlinkSync(root, path.join(root, 'alias'));
    expect(
      verifyCandidateSnapshot(root, snapshot([entry('alias/candidate.txt')]))
        .valid
    ).toBe(false);
  });
  it.each([
    '/absolute',
    '../escape',
    'a/../b',
    './relative',
    'a//b',
    '.git/config',
    'nested/.GIT/config',
    'a\\b',
    'C:/file',
    'bad\npath',
  ])('rejects unsafe path %s', (filePath) => {
    expect(() => parseCandidateSnapshot(snapshot([entry(filePath)]))).toThrow();
  });
  it.each([
    () => ({ ...snapshot(), schemaVersion: '2' }),
    () => snapshot([entry(), entry()]),
    () => snapshot([{ ...entry(), sha256: 'bad' } as CandidateSnapshotEntryV1]),
    () =>
      snapshot([
        { ...entry(), mode: '100600' } as unknown as CandidateSnapshotEntryV1,
      ]),
    () =>
      snapshot([
        {
          path: 'candidate.txt',
          state: 'deleted',
          sha256: hash('base'),
        } as CandidateSnapshotEntryV1,
      ]),
    () => ({ ...snapshot(), fingerprint: 'untrusted' }),
  ])('rejects malformed schema/duplicate authority', (manifest) => {
    expect(() => parseCandidateSnapshot(manifest())).toThrow();
    expect(bundle(manifest() as CandidateSnapshotV1).report.status).toBe(
      'blocked'
    );
  });
  it('canonicalizes ordering and fingerprints exact canonical JSON bytes', () => {
    const a = entry('a'),
      b = entry('b');
    expect(candidateSnapshotFingerprint(snapshot([a, b]))).toBe(
      candidateSnapshotFingerprint(snapshot([b, a]))
    );
    expect(candidateSnapshotFingerprint(snapshot([b, a]))).toBe(
      hash(
        JSON.stringify({ schemaVersion: '1', baseRevision, entries: [a, b] })
      )
    );
    expect(candidateSnapshotFingerprint(snapshot([a]))).not.toBe(
      candidateSnapshotFingerprint(snapshot([b]))
    );
  });
});

describe('canonical validation snapshot boundary (injected validators only)', () => {
  it('copies snapshot authority before awaiting validators', async () => {
    write('candidate.txt', 'changed');
    const supplied = snapshot();
    const dependencies = validators();
    dependencies.runFinalValidation = () => {
      write('candidate.txt', 'drift');
      const first = supplied.entries[0]!;
      if (first.state !== 'deleted') first.sha256 = hash('drift');
      return {
        stages: ['public-api', 'tooling', 'visual', 'smoke'].map((id) =>
          passed(id as ComponentProductionStageResult['id'])
        ),
      };
    };
    const result = await runComponentProductionValidation({
      root,
      input,
      candidateSnapshot: supplied,
      dependencies,
    });
    expect(result.status).toBe('blocked');
  });
  it.each([false, true])(
    'projects snapshot validity through stages, lifecycle and CLI (tampered=%s)',
    async (tampered) => {
      write('candidate.txt', 'changed');
      const candidateSnapshot = snapshot([
        entry('candidate.txt', 'modified', tampered ? 'wrong' : 'changed'),
      ]);
      const output: string[] = [];
      const code = await runComponentProductionValidationCli(
        [
          '--spec',
          'safe spec.json',
          '--candidate-snapshot',
          'safe snapshot.json',
        ],
        {
          root,
          readFile: (file) =>
            JSON.stringify(
              file.endsWith('safe spec.json') ? input : candidateSnapshot
            ),
          runValidation: (params) =>
            runComponentProductionValidation({
              ...params,
              dependencies: validators(),
            }),
          write: (value) => output.push(value),
          writeError: (value) => {
            throw new Error(value);
          },
        }
      );
      const result = JSON.parse(output[0]!);
      expect(code).toBe(tampered ? 1 : 0);
      expect(result.status).toBe(tampered ? 'blocked' : 'ready');
      expect(result.lifecycle.current).toBe(
        tampered ? 'validated' : 'ready-for-review'
      );
      expect(
        result.stages.find(
          (s: ComponentProductionStageResult) => s.id === 'completeness'
        ).status
      ).toBe(tampered ? 'blocked' : 'passed');
      expect(result.reviewBundle.workingTreeClean).toBe(false);
      expect(result.input).toEqual(input);
    }
  );
  it.each(['command', 'structured', 'final'] as const)(
    'does not run review bundle after earlier %s failure',
    async (phase) => {
      write('candidate.txt', 'changed');
      const dependencies = validators();
      const review = vi.fn(runComponentReviewBundle);
      dependencies.runReviewBundle = review;
      const blocked = (id: ComponentProductionStageResult['id']) => ({
        ...passed(id),
        status: 'blocked' as const,
        findings: [
          {
            id: `${id}:fixture`,
            stage: id,
            severity: 'blocking' as const,
            message: 'Synthetic blocked prerequisite',
          },
        ],
      });
      if (phase === 'command')
        dependencies.runCommandValidation = () => ({
          stages: [
            blocked('format'),
            ...COMPONENT_PRODUCTION_STAGE_IDS.slice(4, 11).map(passed),
          ],
        });
      if (phase === 'structured')
        dependencies.runStructuredValidation = async () => ({
          stages: [blocked('completeness'), passed('quality')],
          completeness: [],
          quality: null,
        });
      if (phase === 'final')
        dependencies.runFinalValidation = () => ({
          stages: [
            blocked('public-api'),
            passed('tooling'),
            passed('visual'),
            passed('smoke'),
          ],
        });
      const result = await runComponentProductionValidation({
        root,
        input,
        candidateSnapshot: snapshot(),
        dependencies,
      });
      expect(result.reviewBundle).toBeNull();
      expect(review).not.toHaveBeenCalled();
    }
  );
  it.each(['before', 'after'] as const)(
    'rejects snapshot drift %s validation even if the other side matches',
    async (when) => {
      write('candidate.txt', when === 'before' ? 'wrong' : 'changed');
      const dependencies = validators();
      dependencies.runFinalValidation = () => {
        write('candidate.txt', when === 'before' ? 'changed' : 'wrong');
        return {
          stages: ['public-api', 'tooling', 'visual', 'smoke'].map((id) =>
            passed(id as ComponentProductionStageResult['id'])
          ),
        };
      };
      const result = await runComponentProductionValidation({
        root,
        input,
        candidateSnapshot: snapshot(),
        dependencies,
      });
      expect(result.status).toBe('blocked');
      expect(result.reviewBundle?.candidateIdentity).toBeNull();
    }
  );
});

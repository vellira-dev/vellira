import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type CandidateSnapshotEntryV1 =
  | { path: string; state: 'deleted' }
  | {
      path: string;
      state: 'added' | 'modified';
      mode: '100644' | '100755' | '120000';
      sha256: string;
    };

export type CandidateSnapshotV1 = {
  schemaVersion: '1';
  baseRevision: string;
  entries: readonly CandidateSnapshotEntryV1[];
};

export type CandidateIdentity =
  | { kind: 'revision'; revision: string }
  | {
      kind: 'working-tree-snapshot';
      baseRevision: string;
      fingerprint: string;
      changedPaths: readonly string[];
    };

export type CandidateSnapshotIssue = {
  code: string;
  message: string;
  path?: string;
};

export type CandidateSnapshotVerification =
  | {
      valid: true;
      identity: Extract<CandidateIdentity, { kind: 'working-tree-snapshot' }>;
    }
  | { valid: false; issues: readonly CandidateSnapshotIssue[] };

class SnapshotError extends Error {
  constructor(readonly issue: CandidateSnapshotIssue) {
    super(issue.message);
  }
}

function fail(code: string, message: string, filePath?: string): never {
  throw new SnapshotError({
    code,
    message,
    ...(filePath === undefined ? {} : { path: filePath }),
  });
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('schema', 'Candidate snapshot must contain JSON objects.');
  }
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, expected: string[]): void {
  if (Object.keys(value).sort().join(',') !== expected.sort().join(',')) {
    fail('schema', 'Candidate snapshot has missing or unknown fields.');
  }
}

function safePath(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value ||
    /[\\:]/.test(value) ||
    Array.from(value).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    ) ||
    path.posix.isAbsolute(value) ||
    value
      .split('/')
      .some(
        (part) =>
          !part ||
          part === '.' ||
          part === '..' ||
          part.toLowerCase() === '.git'
      )
  ) {
    fail(
      'path',
      'Candidate snapshot path must be normalized repository-relative POSIX, outside .git.'
    );
  }
  return value;
}

/** Canonical key order, code-unit path order, lowercase hashes; no caller fingerprint. */
export function parseCandidateSnapshot(value: unknown): CandidateSnapshotV1 {
  const raw = object(value);
  keys(raw, ['schemaVersion', 'baseRevision', 'entries']);
  if (
    raw.schemaVersion !== '1' ||
    typeof raw.baseRevision !== 'string' ||
    !/^[0-9a-f]{40}$/.test(raw.baseRevision) ||
    !Array.isArray(raw.entries)
  ) {
    fail('schema', 'Invalid Candidate Snapshot V1 schema or base revision.');
  }
  const seen = new Set<string>();
  const entries = raw.entries
    .map((value): CandidateSnapshotEntryV1 => {
      const entry = object(value);
      const filePath = safePath(entry.path);
      if (seen.has(filePath))
        fail('duplicate', 'Duplicate candidate snapshot path.', filePath);
      seen.add(filePath);
      if (entry.state === 'deleted') {
        keys(entry, ['path', 'state']);
        return { path: filePath, state: 'deleted' };
      }
      keys(entry, ['path', 'state', 'mode', 'sha256']);
      if (
        (entry.state !== 'added' && entry.state !== 'modified') ||
        (entry.mode !== '100644' &&
          entry.mode !== '100755' &&
          entry.mode !== '120000') ||
        typeof entry.sha256 !== 'string' ||
        !/^[0-9a-f]{64}$/.test(entry.sha256)
      ) {
        fail(
          'schema',
          'Invalid candidate snapshot state, mode or SHA-256.',
          filePath
        );
      }
      return {
        path: filePath,
        state: entry.state,
        mode: entry.mode,
        sha256: entry.sha256,
      };
    })
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { schemaVersion: '1', baseRevision: raw.baseRevision, entries };
}

export function candidateSnapshotFingerprint(value: unknown): string {
  return sha256(
    Buffer.from(JSON.stringify(parseCandidateSnapshot(value)), 'utf8')
  );
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function git(root: string, args: string[]): Buffer {
  // Repository selection/index overrides must not replace the explicit root.
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (key.startsWith('GIT_')) delete env[key];
  const result = spawnSync('git', ['--no-optional-locks', ...args], {
    cwd: root,
    shell: false,
    timeout: 10_000,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...env, GIT_LITERAL_PATHSPECS: '1' },
  });
  if (result.error || result.status !== 0) {
    fail('git', `Unable to verify candidate snapshot with git ${args[0]}.`);
  }
  return result.stdout;
}

function dirtyPaths(root: string): string[] {
  const hidden = git(root, ['ls-files', '-v', '-z'])
    .toString('utf8')
    .split('\0')
    .find((record) => record.startsWith('S ') || /^[a-z] /.test(record));
  if (hidden)
    fail(
      'index-flags',
      'Assume-unchanged/skip-worktree flags cannot hide candidate changes.',
      safePath(hidden.slice(2))
    );
  const bytes = git(root, [
    '-c',
    'core.fsmonitor=false',
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
    '--no-renames',
    '--ignore-submodules=none',
  ]);
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes))
    fail('path', 'Non-UTF-8 candidate path is unsupported.');
  return text
    .split('\0')
    .filter(Boolean)
    .map((record) => {
      const status = record.slice(0, 2);
      if (!/^(\?\?|[ MADT][ MADT])$/.test(status)) {
        fail('state', 'Unmerged or unsupported Git candidate state.');
      }
      return safePath(record.slice(3));
    })
    .sort();
}

function materialized(
  root: string,
  filePath: string
): { mode: string; sha256: string } | null {
  // Never traverse a symlink directory or read a FIFO/device. A symlink entry
  // binds the link's own bytes (Git mode 120000), never its target's contents.
  const parts = filePath.split('/');
  for (let i = 1; i < parts.length; i++) {
    try {
      if (!fs.lstatSync(path.join(root, ...parts.slice(0, i))).isDirectory()) {
        fail(
          'type',
          'Candidate path traverses a non-directory or symlink.',
          filePath
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }
  const absolute = path.join(root, filePath);
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(absolute);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  if (stat.isSymbolicLink()) {
    return {
      mode: '120000',
      sha256: sha256(fs.readlinkSync(absolute, { encoding: 'buffer' })),
    };
  }
  if (!stat.isFile())
    fail('type', 'Candidate entry is not a regular file or symlink.', filePath);
  const fd = fs.openSync(
    absolute,
    fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK
  );
  try {
    const opened = fs.fstatSync(fd);
    if (
      !opened.isFile() ||
      opened.ino !== stat.ino ||
      opened.dev !== stat.dev
    ) {
      fail('drift', 'Candidate changed while opening file.', filePath);
    }
    const digest = sha256(fs.readFileSync(fd));
    const after = fs.fstatSync(fd);
    if (
      opened.size !== after.size ||
      opened.mtimeMs !== after.mtimeMs ||
      opened.ctimeMs !== after.ctimeMs
    ) {
      fail('drift', 'Candidate changed while hashing file.', filePath);
    }
    return {
      mode: (opened.mode & 0o100) !== 0 ? '100755' : '100644',
      sha256: digest,
    };
  } finally {
    fs.closeSync(fd);
  }
}

/** Read-only POSIX verification. Callers must exclusively own the checkout;
 * repeated checks detect drift, not provide an OS-level atomic filesystem lock. */
export function verifyCandidateSnapshot(
  root: string,
  value: unknown
): CandidateSnapshotVerification {
  try {
    const snapshot = parseCandidateSnapshot(value);
    if (
      fs.realpathSync(root) !==
      fs.realpathSync(
        git(root, ['rev-parse', '--show-toplevel']).toString('utf8').trim()
      )
    ) {
      fail('root', 'Candidate snapshot requires the repository root.');
    }
    const verify = (): void => {
      if (
        git(root, ['rev-parse', 'HEAD']).toString('utf8').trim() !==
        snapshot.baseRevision
      ) {
        fail(
          'base-revision',
          'Candidate snapshot base revision does not match HEAD.'
        );
      }
      const actual = dirtyPaths(root);
      const expected = snapshot.entries.map((entry) => entry.path);
      const extra = actual.find((filePath) => !expected.includes(filePath));
      if (extra !== undefined)
        fail('unexpected-path', 'Unexpected dirty candidate path.', extra);
      const missing = expected.find((filePath) => !actual.includes(filePath));
      if (missing !== undefined)
        fail('missing-path', 'Declared candidate path is not dirty.', missing);
      for (const entry of snapshot.entries) {
        const base = git(root, [
          'ls-tree',
          '-z',
          snapshot.baseRevision,
          '--',
          entry.path,
        ]).toString('utf8');
        const baseMatch = /^(\d{6}) (blob|tree|commit) ([0-9a-f]{40})\t/.exec(
          base
        );
        if (base && (!baseMatch || baseMatch[2] !== 'blob')) {
          fail(
            'type',
            'Base candidate entry is not a blob; directories/submodules are unsupported.',
            entry.path
          );
        }
        const current = materialized(root, entry.path);
        if (entry.state === 'deleted') {
          if (!baseMatch || current !== null)
            fail(
              'state',
              'Deleted candidate must exist in base and be absent now.',
              entry.path
            );
          continue;
        }
        if (!current || (entry.state === 'added') === Boolean(baseMatch)) {
          fail(
            'state',
            'Candidate added/modified state contradicts base or current file.',
            entry.path
          );
        }
        if (current.mode !== entry.mode)
          fail('mode', 'Candidate mode/type mismatch.', entry.path);
        if (current.sha256 !== entry.sha256)
          fail('digest', 'Candidate content SHA-256 mismatch.', entry.path);
        if (
          baseMatch &&
          baseMatch[1] === current.mode &&
          sha256(git(root, ['cat-file', 'blob', baseMatch[3]!])) ===
            current.sha256
        ) {
          fail(
            'state',
            'Modified candidate is identical to base (index-only changes are not a final snapshot).',
            entry.path
          );
        }
      }
    };
    verify();
    verify();
    return {
      valid: true,
      identity: {
        kind: 'working-tree-snapshot',
        baseRevision: snapshot.baseRevision,
        fingerprint: candidateSnapshotFingerprint(snapshot),
        changedPaths: snapshot.entries.map((entry) => entry.path),
      },
    };
  } catch (error) {
    return {
      valid: false,
      issues: [
        error instanceof SnapshotError
          ? error.issue
          : {
              code: 'inspection',
              message: 'Unable to inspect candidate snapshot safely.',
            },
      ],
    };
  }
}

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { CandidateSnapshotV1 } from './candidate-snapshot';
import type { ComponentProductionInputV1 } from './contracts';
import {
  componentProductionDiagnosticCommands,
  runComponentProductionDiagnostics,
} from './diagnostics';
import type { ValidationCommandExecution } from './validation-command';

const INPUT: ComponentProductionInputV1 = {
  schemaVersion: '1',
  componentName: 'DiagnosticFixture',
  platform: 'both',
  layer: 'primitives',
  category: 'data-display',
  profile: 'base',
  capabilities: [],
  componentTokens: 'standard',
  parts: [],
};
const roots: string[] = [];
const SOURCE =
  'packages/react/src/primitives/DiagnosticFixture/DiagnosticFixture.tsx';
const passed = (): ValidationCommandExecution => ({
  exitCode: 0,
  stdout: '',
  stderr: '',
  timedOut: false,
});

function fixture(
  files: Record<string, string> = { [SOURCE]: 'export const value = 1;\n' }
) {
  const prefix = path.join(os.tmpdir(), 'production-diagnostics-');
  const root = fs.mkdtempSync(prefix);
  roots.push(root);
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.name', 'Diagnostic Test');
  git('config', 'user.email', 'diagnostic@example.test');
  fs.writeFileSync(path.join(root, '.baseline'), 'baseline\n');
  git('add', '.baseline');
  git('commit', '-qm', 'baseline');
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), content);
  }
  const snapshot: CandidateSnapshotV1 = {
    schemaVersion: '1',
    baseRevision: git('rev-parse', 'HEAD'),
    entries: Object.entries(files)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([name, content]) => ({
        path: name,
        state: 'added',
        mode: '100644',
        sha256: createHash('sha256').update(content).digest('hex'),
      })),
  };
  return { root, snapshot };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('providerless production diagnostics', () => {
  it('collects independent failures without granting readiness', () => {
    const { root, snapshot } = fixture();
    const called: string[] = [];
    const failures = new Set([
      'lint',
      'react-tests',
      'react-native-typecheck',
      'diagnostic-quality',
    ]);
    const report = runComponentProductionDiagnostics({
      root,
      input: INPUT,
      candidateSnapshot: snapshot,
      providerResponseSha256: 'a'.repeat(64),
      runner: (command) => {
        called.push(command.id);
        return failures.has(command.id)
          ? { ...passed(), exitCode: 1, stderr: 'independent fixture finding' }
          : passed();
      },
    });
    expect(called).toContain('react-native-typecheck');
    expect(called).toContain('diagnostic-quality');
    expect(called).toContain('tooling-contracts');
    expect(called).toContain('canonical-web-visual');
    expect(called).toContain('native-smoke');
    expect(
      report.entries.filter((entry) => entry.result?.status === 'blocked')
    ).toHaveLength(4);
    expect(report.status).toBe('collected');
    expect(report.readyForReview).toBe(false);
    expect(report.readinessAuthority).toBe(false);
    expect(report).not.toHaveProperty('stages');
    expect(report.integrityFailures).toEqual([]);
    expect(report.inspectionFailures).toEqual([]);
    expect(report.providerResponseSha256).toBe('a'.repeat(64));
    expect(
      report.reviewSurfaces.some((surface) => surface.status === 'missing')
    ).toBe(true);
  });

  it('continues native checks after a web build failure', () => {
    const { root, snapshot } = fixture();
    const called: string[] = [];
    const report = runComponentProductionDiagnostics({
      root,
      input: INPUT,
      candidateSnapshot: snapshot,
      runner: (command) => {
        called.push(command.id);
        return { ...passed(), exitCode: command.id === 'react-build' ? 1 : 0 };
      },
    });
    expect(called).toContain('react-native-build');
    expect(called).toContain('native-smoke');
    expect(called).toContain('react-typecheck');
    expect(called).toContain('diagnostic-quality');
    expect(called).not.toContain('web-smoke');
    const web = report.entries.find((entry) => entry.id === 'web-smoke');
    expect(web?.state).toBe('dependency-blocked');
    expect(web?.blockedBy).toEqual(['react-build']);
    expect(web?.result).toBeNull();
    expect(report.status).toBe('incomplete');
  });

  it('reports missing Docker without hiding smoke or quality', () => {
    const { root, snapshot } = fixture();
    const called: string[] = [];
    const report = runComponentProductionDiagnostics({
      root,
      input: INPUT,
      candidateSnapshot: snapshot,
      runner: (command) => {
        called.push(command.id);
        return command.id.startsWith('diagnostic-docker')
          ? { ...passed(), exitCode: null, error: 'spawn docker ENOENT' }
          : passed();
      },
    });
    expect(called).toContain('diagnostic-quality');
    expect(called).toContain('web-smoke');
    expect(called).not.toContain('canonical-web-visual');
    const visual = report.entries.find(
      (entry) => entry.id === 'canonical-web-visual'
    );
    expect(visual?.blockedBy).toEqual([
      'diagnostic-docker-compose',
      'diagnostic-docker-daemon',
    ]);
  });

  it('runs no commands on an invalid candidate snapshot', () => {
    const { root, snapshot } = fixture();
    fs.writeFileSync(path.join(root, SOURCE), 'mutated\n');
    let calls = 0;
    const report = runComponentProductionDiagnostics({
      root,
      input: INPUT,
      candidateSnapshot: snapshot,
      runner: () => {
        calls += 1;
        return passed();
      },
    });
    expect(calls).toBe(0);
    const noneRun = report.entries.every((entry) => entry.state === 'not-run');
    expect(noneRun).toBe(true);
    expect(report.integrityFailures[0]?.boundary).toBe('before-diagnostics');
  });

  it.each(['edit', 'add'] as const)('stops after source drift: %s', (mode) => {
    const { root, snapshot } = fixture();
    const called: string[] = [];
    const report = runComponentProductionDiagnostics({
      root,
      input: INPUT,
      candidateSnapshot: snapshot,
      runner: (command) => {
        called.push(command.id);
        const target = mode === 'edit' ? SOURCE : 'unexpected.ts';
        fs.writeFileSync(path.join(root, target), 'changed\n');
        return passed();
      },
    });
    expect(called).toHaveLength(1);
    expect(report.integrityFailures[0]?.boundary).toBe(`after:${called[0]}`);
    expect(
      report.entries.slice(1).every((entry) => entry.state === 'not-run')
    ).toBe(true);
    expect(report.readyForReview).toBe(false);
  });

  it('reports missing imports but accepts existing SCSS', () => {
    const directory = path.posix.dirname(SOURCE);
    const { root, snapshot } = fixture({
      [SOURCE]:
        "import x from './absent';\n" +
        "import y from '../../absent-too';\n" +
        "import styles from './styles.scss';\n" +
        'export { x, y, styles };\n',
      [`${directory}/styles.scss`]: '.root { display: flex; }\n',
    });
    const report = runComponentProductionDiagnostics({
      root,
      input: INPUT,
      candidateSnapshot: snapshot,
      runner: passed,
    });
    expect(report.relativeImports.map((finding) => finding.module)).toEqual([
      './absent',
      '../../absent-too',
    ]);
    expect(report.integrityFailures).toEqual([]);
  });

  it('handles runner exceptions without losing other diagnostics', () => {
    const { root, snapshot } = fixture();
    const report = runComponentProductionDiagnostics({
      root,
      input: INPUT,
      candidateSnapshot: snapshot,
      runner: (command) => {
        if (command.id === 'lint') throw new Error('tool unavailable');
        return passed();
      },
    });
    const lint = report.entries.find((entry) => entry.id === 'lint');
    const quality = report.entries.find(
      (entry) => entry.id === 'diagnostic-quality'
    );
    expect(lint?.result?.status).toBe('failed');
    expect(quality?.result?.status).toBe('passed');
    expect(report.status).toBe('incomplete');
    expect(report.readyForReview).toBe(false);
  });

  it.each([
    { timedOut: true },
    { exitCode: null },
    { error: 'spawn validator ENOENT' },
  ])('marks runtime failure %j as incomplete', (failure) => {
    const { root, snapshot } = fixture();
    const called: string[] = [];
    const report = runComponentProductionDiagnostics({
      root,
      input: INPUT,
      candidateSnapshot: snapshot,
      runner: (command) => {
        called.push(command.id);
        return command.id === 'lint' ? { ...passed(), ...failure } : passed();
      },
    });
    const allExecuted = report.entries.every(
      (entry) => entry.state === 'completed'
    );
    const lint = report.entries.find((entry) => entry.id === 'lint');
    expect(allExecuted).toBe(true);
    expect(lint?.result?.status).toBe('failed');
    expect(called).toContain('diagnostic-quality');
    expect(called).toContain('native-smoke');
    expect(report.status).toBe('incomplete');
    expect(report.readyForReview).toBe(false);
    expect(report.readinessAuthority).toBe(false);
  });

  it('rejects invalid digests and selects only bounded diagnostics', () => {
    const { root, snapshot } = fixture();
    expect(() =>
      runComponentProductionDiagnostics({
        root,
        input: INPUT,
        candidateSnapshot: snapshot,
        providerResponseSha256: 'not-a-digest',
        runner: passed,
      })
    ).toThrow('lowercase SHA-256');
    const commands = componentProductionDiagnosticCommands(INPUT);
    expect(new Set(commands.map((command) => command.id)).size).toBe(
      commands.length
    );
    const hasWrite = commands.some((item) => item.command.includes('--write'));
    expect(hasWrite).toBe(false);
    const nativeCommands = componentProductionDiagnosticCommands({
      ...INPUT,
      platform: 'native',
    });
    const docker = nativeCommands.filter((item) =>
      item.id.startsWith('diagnostic-docker')
    );
    expect(docker).toEqual([]);
  });
});

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import {
  candidateSnapshotFingerprint,
  parseCandidateSnapshot,
  verifyCandidateSnapshot,
  type CandidateIdentity,
  type CandidateSnapshotV1,
} from './candidate-snapshot';
import { componentProductionValidationCommands } from './command-validation';
import {
  parseComponentProductionInput,
  type ComponentProductionInputV1,
  type ComponentProductionStageResult,
} from './contracts';
import {
  componentProductionFinalValidationCommands,
  componentProductionFinalFailureRuleId,
} from './final-validation';
import {
  evaluateComponentReviewSurfaces,
  type ComponentReviewBundleSurface,
} from './review-bundle';
import {
  runValidationCommandProcess,
  runValidationStage,
  type ValidationCommandDescriptor,
  type ValidationCommandRunner,
} from './validation-command';

export type DiagnosticCommand = ValidationCommandDescriptor & {
  /** Scheduling dependencies only; these never grant readiness. */
  requires: readonly string[];
};

export type DiagnosticEntry = {
  id: string;
  command: readonly string[];
  state: 'completed' | 'dependency-blocked' | 'not-run';
  blockedBy: readonly string[];
  result: ComponentProductionStageResult | null;
};

export type RelativeImportFinding = {
  path: string;
  module: string;
  message: string;
};

export type ComponentProductionDiagnosticReport = {
  schemaVersion: '1';
  kind: 'component-production-diagnostics';
  readinessAuthority: false;
  readyForReview: false;
  status: 'collected' | 'incomplete';
  componentName: string;
  baseRevision: string;
  candidateSnapshotFingerprint: string;
  inputFingerprint: string;
  providerResponseSha256: string | null;
  relativeImports: readonly RelativeImportFinding[];
  reviewSurfaces: readonly ComponentReviewBundleSurface[];
  inspectionFailures: readonly string[];
  entries: readonly DiagnosticEntry[];
  integrityFailures: readonly {
    boundary: string;
    messages: readonly string[];
  }[];
};

/** Collect independent canonical checks without first-failure short circuiting. */
export function componentProductionDiagnosticCommands(
  input: ComponentProductionInputV1
): readonly DiagnosticCommand[] {
  const commands = [
    ...componentProductionValidationCommands(input),
    ...componentProductionFinalValidationCommands(input),
  ];
  const hasVisual = commands.some(
    (item) => item.id === 'canonical-web-visual' && item.command[0] === 'docker'
  );
  const probes: DiagnosticCommand[] = hasVisual
    ? [
        {
          id: 'diagnostic-docker-compose',
          stage: 'visual',
          command: ['docker', 'compose', 'version'],
          timeoutMs: 15_000,
          requires: [],
        },
        {
          id: 'diagnostic-docker-daemon',
          stage: 'visual',
          command: ['docker', 'info', '--format', '{{.ServerVersion}}'],
          timeoutMs: 15_000,
          requires: [],
        },
      ]
    : [];

  const scheduled: DiagnosticCommand[] = commands.map((command) => {
    const canonicalRequires = command.requires ?? [];
    const requires =
      command.id === 'canonical-web-visual' && hasVisual
        ? [
            ...canonicalRequires,
            'diagnostic-docker-compose',
            'diagnostic-docker-daemon',
          ]
        : canonicalRequires;
    return { ...command, requires };
  });

  // Call existing checkers independently; do not copy their rules.
  scheduled.push(
    {
      id: 'diagnostic-completeness',
      stage: 'completeness',
      command: ['pnpm', 'check:component', input.componentName],
      timeoutMs: 120_000,
      requires: [],
    },
    {
      id: 'diagnostic-quality',
      stage: 'quality',
      command: [
        'pnpm',
        '--silent',
        'check:component-quality',
        input.componentName,
        '--json',
      ],
      resultFormat: 'component-quality',
      componentName: input.componentName,
      timeoutMs: 120_000,
      requires: [],
    }
  );
  return [...probes, ...scheduled];
}

/** Resolve relative imports in exact changed source artifacts. */
function diagnoseRelativeImports(
  root: string,
  snapshot: CandidateSnapshotV1
): readonly RelativeImportFinding[] {
  const findings: RelativeImportFinding[] = [];
  for (const entry of snapshot.entries) {
    if (entry.state === 'deleted' || !/\.[cm]?tsx?$/.test(entry.path)) continue;
    const file = path.join(root, entry.path);
    if (entry.mode === '120000') {
      findings.push({
        path: entry.path,
        module: '',
        message: 'Source is a symbolic link.',
      });
      continue;
    }
    const configPath = ts.findConfigFile(path.dirname(file), ts.sys.fileExists);
    let options: ts.CompilerOptions = {
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    };
    if (configPath) {
      const config = ts.readConfigFile(configPath, ts.sys.readFile);
      if (config.error) {
        findings.push({
          path: entry.path,
          module: '',
          message: ts.flattenDiagnosticMessageText(
            config.error.messageText,
            '\n'
          ),
        });
        continue;
      }
      const parsed = ts.parseJsonConfigFileContent(
        config.config,
        ts.sys,
        path.dirname(configPath)
      );
      const errors = parsed.errors.filter((item) => item.code !== 18003);
      if (errors.length) {
        for (const error of errors) {
          findings.push({
            path: entry.path,
            module: '',
            message: ts.flattenDiagnosticMessageText(error.messageText, '\n'),
          });
        }
        continue;
      }
      options = parsed.options;
    }
    const source = fs.readFileSync(file, 'utf8');
    const imports = ts.preProcessFile(source, true, true).importedFiles;
    for (const imported of imports) {
      if (
        !imported.fileName.startsWith('./') &&
        !imported.fileName.startsWith('../')
      ) {
        continue;
      }
      const resolved = ts.resolveModuleName(
        imported.fileName,
        file,
        options,
        ts.sys
      );
      const extension = path.extname(imported.fileName);
      const resource = path.resolve(path.dirname(file), imported.fileName);
      const existingResource =
        extension !== '' &&
        !/\.[cm]?[jt]sx?$/.test(imported.fileName) &&
        fs.existsSync(resource) &&
        fs.statSync(resource).isFile();
      if (!resolved.resolvedModule && !existingResource) {
        findings.push({
          path: entry.path,
          module: imported.fileName,
          message: `Unresolved relative module: ${imported.fileName}.`,
        });
      }
    }
  }
  return findings;
}

export function runComponentProductionDiagnostics(params: {
  root: string;
  input: unknown;
  candidateSnapshot: unknown;
  providerResponseSha256?: string;
  runner?: ValidationCommandRunner<DiagnosticCommand>;
}): ComponentProductionDiagnosticReport {
  const root = fs.realpathSync(params.root);
  const input = parseComponentProductionInput(params.input);
  const snapshot = parseCandidateSnapshot(params.candidateSnapshot);
  const responseDigest = params.providerResponseSha256 ?? null;
  if (responseDigest !== null && !/^[a-f0-9]{64}$/.test(responseDigest)) {
    throw new Error('Provider response digest must be lowercase SHA-256.');
  }
  const entries: DiagnosticEntry[] = [];
  const integrityFailures: { boundary: string; messages: string[] }[] = [];
  const inspectionFailures: string[] = [];
  let identity: CandidateIdentity | null = null;
  const verify = (boundary: string): boolean => {
    const observation = verifyCandidateSnapshot(root, snapshot);
    if (observation.valid) {
      identity = observation.identity;
      return true;
    }
    identity = null;
    integrityFailures.push({
      boundary,
      messages: observation.issues.map((issue) => issue.message),
    });
    return false;
  };

  let integrityValid = verify('before-diagnostics');
  let relativeImports: readonly RelativeImportFinding[] = [];
  let reviewSurfaces: readonly ComponentReviewBundleSurface[] = [];
  if (integrityValid) {
    try {
      relativeImports = diagnoseRelativeImports(root, snapshot);
    } catch (error) {
      inspectionFailures.push(`imports: ${String(error)}`);
    }
    integrityValid = verify('after-import-resolution');
  }
  if (integrityValid) {
    try {
      reviewSurfaces = evaluateComponentReviewSurfaces({
        root,
        input,
        candidateIdentity: identity,
      });
    } catch (error) {
      inspectionFailures.push(`review-surfaces: ${String(error)}`);
    }
    integrityValid = verify('after-review-surfaces');
  }
  const commands = componentProductionDiagnosticCommands(input);
  const pending = new Map(commands.map((command) => [command.id, command]));
  const completed = new Map<string, DiagnosticEntry>();
  const runner: ValidationCommandRunner<DiagnosticCommand> =
    params.runner ??
    ((command, directory) =>
      runValidationCommandProcess(
        command,
        directory,
        'Diagnostic command is empty.'
      ));

  while (pending.size > 0) {
    let progressed = false;
    for (const [id, command] of pending) {
      const waiting = command.requires.some((item) => pending.has(item));
      if (waiting) continue;
      progressed = true;
      pending.delete(id);
      const blockedBy = command.requires.filter(
        (dependency) => completed.get(dependency)?.result?.status !== 'passed'
      );
      const entry: DiagnosticEntry = {
        id,
        command: command.command,
        state: 'not-run',
        blockedBy: ['candidate-integrity'],
        result: null,
      };
      if (integrityValid && blockedBy.length) {
        entry.state = 'dependency-blocked';
        entry.blockedBy = blockedBy;
      } else if (integrityValid && verify(`before:${id}`)) {
        const result = runValidationStage({
          root,
          stageId: command.stage,
          commands: [command],
          runner,
          requireCommand: true,
          ruleIdForFailure: componentProductionFinalFailureRuleId,
        });
        entry.state = 'completed';
        entry.blockedBy = [];
        entry.result = result;
        integrityValid = verify(`after:${id}`);
      } else {
        integrityValid = false;
      }
      entries.push(entry);
      completed.set(id, entry);
    }
    if (!progressed) {
      throw new Error('Diagnostic dependency graph contains a cycle.');
    }
  }
  // A runner finishing is not proof that its validation completed reliably.
  // Canonical "blocked" means findings; "failed" means collection was incomplete.
  const collectionComplete = entries.every(
    (entry) =>
      entry.state === 'completed' &&
      (entry.result?.status === 'passed' || entry.result?.status === 'blocked')
  );
  // Never emit the canonical production result schema or readiness.
  return {
    schemaVersion: '1',
    kind: 'component-production-diagnostics',
    readinessAuthority: false,
    readyForReview: false,
    status:
      collectionComplete && integrityValid && inspectionFailures.length === 0
        ? 'collected'
        : 'incomplete',
    componentName: input.componentName,
    baseRevision: snapshot.baseRevision,
    candidateSnapshotFingerprint: candidateSnapshotFingerprint(snapshot),
    inputFingerprint: createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex'),
    providerResponseSha256: responseDigest,
    relativeImports,
    reviewSurfaces,
    inspectionFailures,
    entries,
    integrityFailures,
  };
}

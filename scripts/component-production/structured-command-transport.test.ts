import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { tokenSemanticRuleIds } from '../checks/token-semantic/contract';
import { componentProductionDiagnosticCommands } from './diagnostics';
import {
  runValidationCommandProcess,
  runValidationStage,
} from './validation-command';

const componentName = 'ChannelProbe';
const source = `packages/react/src/primitives/${componentName}/${componentName}.tsx`;
const commands = componentProductionDiagnosticCommands({
  schemaVersion: '1',
  componentName,
  platform: 'web',
  layer: 'primitives',
  category: 'utility',
  profile: 'base',
  capabilities: [],
  componentTokens: 'standard',
  parts: [],
}).filter((command) => command.resultFormat);
const roots: string[] = [];
const packageManager = JSON.parse(
  fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
).packageManager;

function fixture(extra = '', exitCode = 1) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'structured-command-'));
  roots.push(root);
  const tokens = {
    schemaVersion: 1,
    status: 'fail',
    coverage: tokenSemanticRuleIds.map((ruleId) => ({
      ruleId,
      coverage: 'complete',
    })),
    findings: [
      {
        id: 'fixture-negative',
        severity: 'error',
        ruleId: 'tokens.consumer-reference',
        sourcePath: source,
        code: 'unclassified-css-variable',
        evidence: 'The fixture intentionally fails its canonical audit.',
      },
    ],
  };
  const quality = {
    schemaVersion: '1',
    components: [
      {
        componentName,
        status: 'fail',
        findings: [
          {
            ruleId: 'platform.interaction',
            status: 'fail',
            platform: 'react',
            evidence: [source],
          },
        ],
      },
    ],
  };
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      private: true,
      packageManager,
      scripts: {
        'check:tokens-semantic:strict': 'node emit.mjs tokens',
        'check:component-quality': 'node emit.mjs quality',
      },
    })
  );
  fs.writeFileSync(
    path.join(root, 'emit.mjs'),
    [
      `const reports = ${JSON.stringify({ tokens, quality })};`,
      'process.stdout.write(JSON.stringify(reports[process.argv[2]]) + "\\n");',
      extra,
      `process.exitCode = ${exitCode};`,
    ].join('\n')
  );
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

describe('canonical machine-readable diagnostics through the real package manager', () => {
  it.each(commands)(
    'preserves negative JSON and exit status for $id',
    (command) => {
      const root = fixture();
      const execution = runValidationCommandProcess(
        command,
        root,
        'missing command'
      );
      expect(execution.exitCode).toBe(1);
      expect(execution.error).toBeUndefined();
      expect(() => JSON.parse(execution.stdout)).not.toThrow();
      expect(execution.stderr).toBe('');
      const stage = runValidationStage({
        root,
        stageId: command.stage,
        commands: [command],
        runner: () => execution,
      });
      expect(stage.status).toBe('blocked');
      expect(stage.findings).toHaveLength(1);
      expect(stage.findings[0]).toMatchObject({
        path: source,
        severity: 'blocking',
      });
    },
    30_000
  );

  it.each([
    [
      'trailing infrastructure stdout',
      'process.stdout.write("Error: missing authority\\n");',
      1,
    ],
    [
      'mixed infrastructure stderr',
      'process.stderr.write("Error: missing authority\\n");',
      1,
    ],
    ['unexpected exit status', '', 2],
    [
      'package-manager footer in stdout',
      'process.stdout.write("[ELIFECYCLE] Command failed with exit code 1.\\n");',
      1,
    ],
  ] as const)(
    'fails closed on %s',
    (_name, extra, exitCode) => {
      const root = fixture(extra, exitCode);
      const command = commands[0];
      const stage = runValidationStage({
        root,
        stageId: command.stage,
        commands: [command],
        runner: (descriptor, cwd) =>
          runValidationCommandProcess(descriptor, cwd, 'missing command'),
      });
      expect(stage.status).toBe('failed');
      expect(stage.findings[0].ruleId).toBe('validation.runtime');
    },
    30_000
  );

  it('covers both canonical structured diagnostic commands', () => {
    expect(commands.map((command) => command.id)).toEqual([
      'tooling-token-semantics',
      'diagnostic-quality',
    ]);
  });
});

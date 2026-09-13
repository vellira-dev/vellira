import fs from 'node:fs';
import path from 'node:path';

import {
  type TokenPreservationBaselineV1,
  verifyTokenPreservation,
} from '../../../packages/tokens/scripts/token-preservation';
import {
  tokenMigrationManifestV1,
  tokenPreservationBaselineRevisionV1,
} from '../../../packages/tokens/src/preservation/token-migrations';
import type { FindingInput, RuleResult } from './contract';

const baselineSource =
  'packages/tokens/src/preservation/token-preservation-baseline.v1.json';
const manifestSource = 'packages/tokens/src/preservation/token-migrations.ts';

export function auditTokenVisualPreservation(
  params: Parameters<typeof verifyTokenPreservation>[0]
): RuleResult {
  const violations = verifyTokenPreservation(params);
  const findings: FindingInput[] = violations.map((finding) => ({
    ruleId: 'tokens.visual-preservation',
    code: finding.rule,
    severity: 'error',
    sourcePath: finding.rule.startsWith('migration.')
      ? manifestSource
      : baselineSource,
    tokenPath: finding.path ?? null,
    line: null,
    column: null,
    layer: finding.platform
      ? 'platform-output'
      : finding.path?.startsWith('components.')
        ? 'component'
        : finding.path?.startsWith('semantic.')
          ? 'semantic'
          : 'primitive',
    theme: finding.theme ?? null,
    platform: finding.platform ?? null,
    evidence: finding.message,
    expected: 'Pinned #880 values and explicit canonical migration evidence.',
    migrationStatus: finding.rule.startsWith('baseline.')
      ? 'not-applicable'
      : finding.rule.startsWith('migration.')
        ? 'invalid'
        : 'untracked',
    suggestedAction:
      'Repair unintended drift or supply reviewed migration evidence; do not reset the baseline.',
  }));
  return {
    coverage: 'complete',
    scope:
      'One full #880 value-preservation verification across canonical, Web and React Native outputs; screenshots remain a separate CI gate.',
    checked: 1,
    findings,
  };
}

export function checkTokenVisualPreservation(root: string): RuleResult {
  const baseline = JSON.parse(
    fs.readFileSync(path.join(root, baselineSource), 'utf8')
  ) as TokenPreservationBaselineV1;
  return auditTokenVisualPreservation({
    baseline,
    manifest: tokenMigrationManifestV1,
    expectedSourceRevision: tokenPreservationBaselineRevisionV1,
  });
}

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { checkTokenOwnership } from '../token-ownership/checker';
import type { TokenOwnershipReport } from '../token-ownership/checker';
import { runTokenSemanticAudit } from './contract';
import type { FindingInput, RuleAdapter, RuleResult } from './contract';
import { checkTokenCssReferences } from './css-repository';
import { checkTokenFactoryConventions } from './factory-convention';
import { checkTokenPlatformBoundary } from './platform-boundary';
import { checkTokenStateVocabulary } from './state-vocabulary';
import { checkTokenValueKinds } from './value-kind-repository';
import { checkTokenVisualPreservation } from './visual-preservation';

export function checkTokenSemantics(root: string) {
  const authorityRoot = fileURLToPath(new URL('../../../', import.meta.url));
  if (fs.realpathSync(root) !== fs.realpathSync(authorityRoot)) {
    throw new Error(
      'Run the audit from the checkout that owns its authorities.'
    );
  }
  let ownership: TokenOwnershipReport | undefined;
  function ownershipRule(semantic: boolean): RuleResult {
    ownership ??= checkTokenOwnership(root);
    const ruleId = semantic
      ? 'tokens.namespace-lifecycle'
      : 'tokens.component-ownership';
    const findings: FindingInput[] = ownership.findings
      .filter((finding) => finding.code.includes('semantic') === semantic)
      .map((finding) => ({
        ruleId,
        code: finding.code,
        severity: 'error',
        sourcePath: finding.path,
        tokenPath: null,
        line: null,
        column: null,
        layer: semantic ? 'semantic' : 'component',
        theme: null,
        platform: null,
        evidence: finding.message,
        expected:
          'Canonical metadata/lifecycle and deterministic consumer evidence.',
        migrationStatus: 'untracked',
        suggestedAction:
          'Repair the canonical ownership authority or its consumers.',
      }));
    return {
      coverage: 'partial',
      scope: semantic
        ? 'Existing #886 namespace lifecycle checker; role-level lifecycle coverage is not yet connected.'
        : 'Existing #886 family ownership checker; required-token metadata and generated readiness integration remain unproven.',
      checked: semantic
        ? ownership.semanticNamespaces.length
        : ownership.componentFamilies.length,
      findings,
    };
  }
  const adapters: RuleAdapter[] = [
    { ruleId: 'tokens.value-kind', run: checkTokenValueKinds },
    {
      ruleId: 'tokens.state-vocabulary',
      run: () => checkTokenStateVocabulary(root),
    },
    {
      ruleId: 'tokens.factory-convention',
      run: () => checkTokenFactoryConventions(root),
    },
    { ruleId: 'tokens.platform-boundary', run: checkTokenPlatformBoundary },
    {
      ruleId: 'tokens.visual-preservation',
      run: () => checkTokenVisualPreservation(root),
    },
    { ruleId: 'tokens.component-ownership', run: () => ownershipRule(false) },
    { ruleId: 'tokens.namespace-lifecycle', run: () => ownershipRule(true) },
    {
      ruleId: 'tokens.consumer-reference',
      run: () => checkTokenCssReferences(root),
    },
  ];
  return runTokenSemanticAudit(adapters);
}
